"""Stripe-ready billing endpoints with verified, idempotent webhooks."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict
import stripe
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.orm import Session

from auth import get_current_user
from config import APP_BASE_URL, B2B_PRICE_ID, B2C_PRICE_ID, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
from database import get_db
from models import RevenueEvent, SubscriptionTier, User
from security import check_rate_limit


router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class ConfirmCheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str


def _billing_ready(tier: str) -> tuple[str, str]:
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured for this deployment.",
        )
    price_id = B2C_PRICE_ID if tier == "b2c" else B2B_PRICE_ID
    if not price_id or price_id.startswith("price_") and price_id in {"price_b2c_monthly", "price_b2b_monthly"}:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing plans are not configured for this deployment.",
        )
    return price_id, tier


@router.get("/status")
def billing_status(user: User = Depends(get_current_user)):
    return {
        "billing_available": bool(STRIPE_SECRET_KEY and B2C_PRICE_ID and B2B_PRICE_ID),
        "subscription_tier": user.subscription_tier.value,
        "subscription_active": user.subscription_active,
    }


@router.post("/create-checkout")
def create_checkout(
    tier: Literal["b2c", "b2b"],
    request: Request,
    user: User = Depends(get_current_user),
):
    check_rate_limit(request, max_requests=5, window=60, bucket="checkout")
    price_id, tier = _billing_ready(tier)
    stripe.api_key = STRIPE_SECRET_KEY
    try:
        session_args = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": f"{APP_BASE_URL}/dashboard?billing=success&session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{APP_BASE_URL}/pricing?billing=cancelled",
            "client_reference_id": user.id,
            "metadata": {"user_id": user.id, "tier": tier},
            "allow_promotion_codes": True,
        }
        if user.stripe_customer_id:
            session_args["customer"] = user.stripe_customer_id
        else:
            session_args["customer_email"] = user.email
        checkout = stripe.checkout.Session.create(**session_args)
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is temporarily unavailable. Please try again.",
        ) from exc
    return {"url": checkout.url, "mock": False}


@router.post("/portal")
def billing_portal(request: Request, user: User = Depends(get_current_user)):
    """Open Stripe's hosted customer portal (cancel, card update, invoices)."""
    check_rate_limit(request, max_requests=10, window=60, bucket="portal")
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured for this deployment.",
        )
    if not user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing account found. Subscribe to a plan first.",
        )
    stripe.api_key = STRIPE_SECRET_KEY
    try:
        portal = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=f"{APP_BASE_URL}/settings?tab=billing",
        )
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing portal is temporarily unavailable. Please try again.",
        ) from exc
    return {"url": portal.url}


@router.post("/confirm")
def confirm_checkout(
    req: ConfirmCheckoutRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Synchronously activate a paid subscription after checkout returns to the app.

    The client calls this with the Stripe checkout session id once the customer
    is redirected back to /dashboard?billing=success&session_id=... so the plan
    upgrades immediately, without waiting on webhook delivery. The session must
    belong to the authenticated user and be a paid, completed subscription.
    Re-confirming the same session id is a no-op.
    """
    check_rate_limit(request, max_requests=10, window=60, bucket="checkout-confirm")
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured for this deployment.",
        )
    if not req.session_id or not req.session_id.startswith("cs_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid checkout session.",
        )

    # Idempotent: a confirmed session is never applied twice.
    if db.query(RevenueEvent).filter(RevenueEvent.stripe_event_id == req.session_id).first():
        return {
            "subscription_tier": user.subscription_tier.value,
            "subscription_active": bool(user.subscription_active),
            "already_applied": True,
        }

    stripe.api_key = STRIPE_SECRET_KEY
    try:
        session = stripe.checkout.Session.retrieve(req.session_id)
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checkout session could not be verified. Please try again.",
        ) from exc

    metadata = session.get("metadata") or {}
    session_user_id = metadata.get("user_id") or session.get("client_reference_id")
    if (
        session.get("mode") != "subscription"
        or session.get("payment_status") != "paid"
        or session.get("status") != "complete"
        or session_user_id != user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checkout session does not correspond to a paid subscription for this account.",
        )

    tier = metadata.get("tier")
    if tier not in {SubscriptionTier.b2c.value, SubscriptionTier.b2b.value}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checkout session has no valid subscription tier.",
        )

    if user.subscription_tier.value != tier or not user.subscription_active:
        user.subscription_tier = SubscriptionTier(tier)
        user.subscription_active = True
    user.stripe_customer_id = session.get("customer") or user.stripe_customer_id
    db.add(
        RevenueEvent(
            user_id=user.id,
            event_type="checkout_confirmed",
            amount_cents=int(session.get("amount_total") or 0),
            description=f"{tier} subscription activated",
            stripe_event_id=req.session_id,
        )
    )
    db.commit()
    return {
        "subscription_tier": user.subscription_tier.value,
        "subscription_active": bool(user.subscription_active),
        "already_applied": False,
    }


def _webhook_user(event_object: dict, db: Session) -> User | None:
    metadata = event_object.get("metadata") or {}
    user_id = metadata.get("user_id") if isinstance(metadata, dict) else None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            return user
    client_reference_id = event_object.get("client_reference_id")
    if client_reference_id:
        user = db.query(User).filter(User.id == client_reference_id).first()
        if user:
            return user
    customer_id = event_object.get("customer")
    if customer_id:
        return db.query(User).filter(User.stripe_customer_id == customer_id).first()
    return None


def _tier_from_subscription(event_object: dict) -> SubscriptionTier | None:
    """Map a Stripe subscription's price ID back to our subscription tier."""
    items = (event_object.get("items") or {}).get("data") or []
    price_ids = set()
    for item in items:
        price = item.get("price") if isinstance(item, dict) else None
        if isinstance(price, dict) and price.get("id"):
            price_ids.add(price["id"])
        elif isinstance(item, dict) and item.get("plan", {}).get("id"):
            price_ids.add(item["plan"]["id"])
    if B2C_PRICE_ID and B2C_PRICE_ID in price_ids:
        return SubscriptionTier.b2c
    if B2B_PRICE_ID and B2B_PRICE_ID in price_ids:
        return SubscriptionTier.b2b
    metadata = event_object.get("metadata") or {}
    tier = metadata.get("tier") if isinstance(metadata, dict) else None
    if tier in {SubscriptionTier.b2c.value, SubscriptionTier.b2b.value}:
        return SubscriptionTier(tier)
    return None


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    db: Session = Depends(get_db),
):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Billing webhooks are not configured")
    if not stripe_signature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature")
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, STRIPE_WEBHOOK_SECRET, tolerance=300)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook payload") from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature") from exc

    event_id = event.get("id")
    if not isinstance(event_id, str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook event ID is missing")
    if db.query(RevenueEvent).filter(RevenueEvent.stripe_event_id == event_id).first():
        return {"status": "received", "duplicate": True}

    event_type = event.get("type", "")
    event_object = event.get("data", {}).get("object", {})
    user = _webhook_user(event_object, db)

    recorded = False
    if event_type == "checkout.session.completed":
        metadata = event_object.get("metadata") or {}
        tier = metadata.get("tier")
        if user and tier in {SubscriptionTier.b2c.value, SubscriptionTier.b2b.value}:
            user.subscription_tier = SubscriptionTier(tier)
            user.subscription_active = True
            user.stripe_customer_id = event_object.get("customer") or user.stripe_customer_id
            db.add(
                RevenueEvent(
                    user_id=user.id,
                    event_type="checkout_completed",
                    amount_cents=int(event_object.get("amount_total") or 0),
                    description=f"{tier} subscription checkout",
                    stripe_event_id=event_id,
                )
            )
            recorded = True
    elif event_type == "invoice.paid":
        if user:
            db.add(
                RevenueEvent(
                    user_id=user.id,
                    event_type="invoice_paid",
                    amount_cents=int(event_object.get("amount_paid") or 0),
                    description="Subscription invoice paid",
                    stripe_event_id=event_id,
                )
            )
            recorded = True
    elif event_type == "invoice.payment_failed":
        # Access stays active during Stripe's retry window; the portal lets the
        # customer fix the card before the subscription drops to a cancel state.
        if user:
            db.add(
                RevenueEvent(
                    user_id=user.id,
                    event_type="invoice_payment_failed",
                    amount_cents=int(event_object.get("amount_due") or 0),
                    description="Payment failed — Stripe will retry",
                    stripe_event_id=event_id,
                )
            )
            recorded = True
    elif event_type in {"customer.subscription.deleted", "customer.subscription.paused"}:
        if user:
            user.subscription_active = False
            user.subscription_tier = SubscriptionTier.free
            db.add(
                RevenueEvent(
                    user_id=user.id,
                    event_type="subscription_cancelled",
                    amount_cents=0,
                    description="Subscription no longer active",
                    stripe_event_id=event_id,
                )
            )
            recorded = True
    if not recorded:
        # Persist a zero-value event ID so signature-verified retries remain
        # idempotent without pretending that it is revenue or a state change.
        db.add(
            RevenueEvent(
                user_id=user.id if user else None,
                event_type=f"stripe_{event_type[:70] or 'event'}",
                amount_cents=0,
                description="Verified Stripe event with no billing state change",
                stripe_event_id=event_id,
            )
        )
    db.commit()
    return {"status": "received"}
