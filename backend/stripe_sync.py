"""Background-free reconciliation of Stripe subscription state into the DB.

Webhooks are the source of truth for billing history, but they can be delayed
or fail to deliver (e.g. the container was paused at payment time). This module
lets authenticated endpoints heal the current user's plan directly from Stripe
so the UI never shows a stale "free" after a successful payment.
"""

from __future__ import annotations

import logging

import stripe

from config import B2B_PRICE_ID, B2C_PRICE_ID, STRIPE_SECRET_KEY
from models import SubscriptionTier, User


logger = logging.getLogger(__name__)


def _tier_for_price_ids(price_ids: set[str]) -> SubscriptionTier | None:
    if B2C_PRICE_ID and B2C_PRICE_ID in price_ids:
        return SubscriptionTier.b2c
    if B2B_PRICE_ID and B2B_PRICE_ID in price_ids:
        return SubscriptionTier.b2b
    return None


def reconcile_subscription(user: User) -> bool:
    """Reconcile ``user``'s plan with Stripe. Mutates the row in place.

    Returns True when the row changed (the caller must commit). Never raises:
    any Stripe failure leaves the row untouched.
    """
    if not STRIPE_SECRET_KEY:
        return False
    stripe.api_key = STRIPE_SECRET_KEY

    customer_ids: set[str] = set()
    if user.stripe_customer_id:
        customer_ids.add(user.stripe_customer_id)
    try:
        for customer in stripe.Customer.list(email=user.email, limit=5).data:
            customer_ids.add(customer.id)
    except stripe.StripeError:
        logger.warning("Stripe customer lookup failed for user_id=%s", user.id)
        return False

    changed = False
    for customer_id in customer_ids:
        try:
            subscriptions = stripe.Subscription.list(customer=customer_id, limit=5)
        except stripe.StripeError:
            logger.warning("Stripe subscription lookup failed for customer=%s", customer_id)
            continue

        active = [sub for sub in subscriptions.data if sub.status == "active"]
        if active:
            sub = active[0]
            price_ids: set[str] = set()
            items = getattr(sub, "items", None)
            for item in (items.data if items and items.data else []):
                price = getattr(item, "price", None)
                if price:
                    price_ids.add(price.id)
            tier = _tier_for_price_ids(price_ids)
            if not tier:
                continue
            if (
                user.subscription_tier.value != tier.value
                or not user.subscription_active
                or user.stripe_customer_id != customer_id
            ):
                user.subscription_tier = tier
                user.subscription_active = True
                user.stripe_customer_id = customer_id
                changed = True
            return changed

        # This customer has no active subscription: the user has nothing paid.
        if user.subscription_active or user.subscription_tier != SubscriptionTier.free:
            user.subscription_tier = SubscriptionTier.free
            user.subscription_active = False
            changed = True
    return changed