import logging

import httpx

from app.config import settings
from app.models import CallSignals
from app.services import twilio_client

logger = logging.getLogger(__name__)

GRAPH_URL = "https://graph.facebook.com/v20.0"


def _send_whatsapp(to_number: str, body: str) -> bool:
    """Returns True if WhatsApp accepted the message, False on any failure (including WhatsApp
    not being configured), so the caller can fall back to SMS."""
    if not settings.whatsapp_token or not settings.whatsapp_phone_number_id:
        logger.warning("WhatsApp not configured; skipping send to %s", to_number)
        return False

    url = f"{GRAPH_URL}/{settings.whatsapp_phone_number_id}/messages"
    headers = {"Authorization": f"Bearer {settings.whatsapp_token}"}
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": body},
    }
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code >= 400:
                logger.error("WhatsApp send failed (%s): %s", resp.status_code, resp.text)
                return False
            return True
    except Exception:
        logger.exception("WhatsApp send raised an exception for %s", to_number)
        return False


def _send_sms_fallback(to_number: str, body: str) -> None:
    """Nice-to-have from the PRD: if WhatsApp delivery fails (number not verified in test mode,
    API outage, etc.), fall back to a plain SMS via Twilio so the family still gets notified."""
    try:
        twilio_client.get_client().messages.create(
            to=to_number,
            from_=settings.twilio_phone_number,
            body=body,
        )
        logger.info("Sent SMS fallback to %s after WhatsApp failure", to_number)
    except Exception:
        logger.exception("SMS fallback also failed for %s", to_number)


def _send_text(to_number: str, body: str) -> None:
    if not _send_whatsapp(to_number, body):
        _send_sms_fallback(to_number, body)


def build_digest_message(parent_name: str, signals: CallSignals) -> str:
    mood_bar = "🟢" if signals.mood_score >= 4 else ("🟡" if signals.mood_score == 3 else "🔴")
    meds = {"yes": "took medicine ✅", "no": "did not take medicine ❌", "unclear": "medicine status unclear"}[
        signals.medication_taken
    ]
    lines = [
        f"{mood_bar} Daily check-in: {parent_name}",
        "",
        signals.summary,
        "",
        f"Mood: {signals.mood_score}/5 · Clarity: {signals.coherence_score}/5 · {meds}",
    ]
    if signals.new_complaint:
        lines.append(f"Mentioned: {signals.new_complaint}")
    lines.append("")
    lines.append("— HaalChaal check-in")
    return "\n".join(lines)


def build_urgent_message(parent_name: str, signals: CallSignals, reason: str) -> str:
    reason_text = {
        "urgent_keyword": "something concerning came up on the call",
        "mood_drop": "their mood dropped noticeably compared to recent days",
        "coherence_drop": "they sounded less clear/coherent than usual",
        "missed_medication_repeated": "they've missed medicine multiple days in a row",
    }.get(reason, "something changed compared to recent days")

    lines = [
        f"⚠️ URGENT: {parent_name} — please check in",
        "",
        f"During today's call, {reason_text}.",
        signals.summary,
    ]
    if signals.new_complaint:
        lines.append(f"They mentioned: {signals.new_complaint}")
    lines.append("")
    lines.append("This is a signal to check in or discuss with a doctor, not a diagnosis.")
    lines.append("— HaalChaal check-in")
    return "\n".join(lines)


def send_digest(family_numbers: list[str], parent_name: str, signals: CallSignals) -> None:
    message = build_digest_message(parent_name, signals)
    for number in family_numbers:
        _send_text(number, message)


def send_urgent_alert(family_numbers: list[str], parent_name: str, signals: CallSignals, reason: str) -> None:
    message = build_urgent_message(parent_name, signals, reason)
    for number in family_numbers:
        _send_text(number, message)
