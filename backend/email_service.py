"""Transactional email delivery for password resets and similar notices.

Supports Resend (preferred) or SMTP. Never logs message bodies that contain
secrets. Callers must not put reset tokens in API responses.
"""

from __future__ import annotations

import json
import logging
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage

from config import (
    APP_ENV,
    EMAIL_FROM,
    RESEND_API_KEY,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
    SMTP_USE_TLS,
)

logger = logging.getLogger(__name__)


def email_configured() -> bool:
    return bool(RESEND_API_KEY) or bool(SMTP_HOST and EMAIL_FROM)


def send_email(*, to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Send one email. Returns True on success. Never raises to callers."""
    if not to or not subject:
        return False
    if not EMAIL_FROM:
        logger.error("EMAIL_FROM is not configured; cannot send email")
        return False
    try:
        if RESEND_API_KEY:
            return _send_resend(to=to, subject=subject, text=text, html=html or text)
        if SMTP_HOST:
            return _send_smtp(to=to, subject=subject, text=text, html=html or text)
        logger.error("No email provider configured (set RESEND_API_KEY or SMTP_HOST)")
        return False
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


def send_password_reset_email(*, to: str, reset_url: str, expires_minutes: int) -> bool:
    subject = "Reset your ExpertAI password"
    text = (
        "We received a request to reset your ExpertAI password.\n\n"
        f"Open this link to choose a new password (expires in {expires_minutes} minutes):\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can ignore this email. "
        "Your password will stay the same.\n"
    )
    html = (
        "<p>We received a request to reset your ExpertAI password.</p>"
        f"<p><a href=\"{reset_url}\">Choose a new password</a> "
        f"(link expires in {expires_minutes} minutes).</p>"
        "<p>If you did not request this, you can ignore this email. "
        "Your password will stay the same.</p>"
    )
    sent = send_email(to=to, subject=subject, text=text, html=html)
    if not sent and APP_ENV == "development":
        # Local-only fallback so developers can still test the reset UI.
        logger.info("DEV password reset link for %s: %s", to, reset_url)
    return sent


def _send_resend(*, to: str, subject: str, text: str, html: str) -> bool:
    body = json.dumps(
        {
            "from": EMAIL_FROM,
            "to": [to],
            "subject": subject,
            "text": text,
            "html": html,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            if 200 <= response.status < 300:
                logger.info("Password reset email accepted by Resend for delivery")
                return True
            logger.error("Resend returned HTTP %s", response.status)
            return False
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        logger.error("Resend HTTP %s: %s", exc.code, detail)
        return False


def _send_smtp(*, to: str, subject: str, text: str, html: str) -> bool:
    message = EmailMessage()
    message["From"] = EMAIL_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    if SMTP_USE_TLS:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls(context=context)
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)
    logger.info("Password reset email handed to SMTP for delivery")
    return True
