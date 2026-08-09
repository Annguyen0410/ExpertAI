"""Stripe-ready billing endpoints with verified, idempotent webhooks."""

from __future__ import annotations

from typing import Literal

import stripe
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.orm import Session

from auth import get_current_user
from config import APP_BASE_URL, B2B_PRICE_ID, B2C_PRICE_ID, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
from database import get_db
from models import RevenueEvent, SubscriptionTier, User
from security import check_rate_limit


router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


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


def _webhook_user(event_object: dict, db: Session) -> User | None:
    metadata = event_object.get("metadata") or {}
    user_id = metadata.get("user_id") if isinstance(metadata, dict) else None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            return user
    customer_id = event_object.get("customer")
    if customer_id:
        return db.query(User).filter(User.stripe_customer_id == customer_id).first()
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
