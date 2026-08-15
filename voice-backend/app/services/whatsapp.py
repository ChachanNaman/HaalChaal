import logging

import httpx

from app.config import settings
from app.models import CallSignals

logger = logging.getLogger(__name__)

GRAPH_URL = "https://graph.facebook.com/v20.0"


def _send_text(to_number: str, body: str) -> None:
    if not settings.whatsapp_token or not settings.whatsapp_phone_number_id:
        logger.warning("WhatsApp not configured; skipping send to %s: %s", to_number, body)
        return

    url = f"{GRAPH_URL}/{settings.whatsapp_phone_number_id}/messages"
    headers = {"Authorization": f"Bearer {settings.whatsapp_token}"}
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": body},
    }
    with httpx.Client(timeout=10) as client:
        resp = client.post(url, headers=headers, json=payload)
        if resp.status_code >= 400:
            logger.error("WhatsApp send failed (%s): %s", resp.status_code, resp.text)


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
    lines.append("— Sukoon check-in")
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
    lines.append("— Sukoon check-in")
    return "\n".join(lines)


def send_digest(family_numbers: list[str], parent_name: str, signals: CallSignals) -> None:
    message = build_digest_message(parent_name, signals)
    for number in family_numbers:
        _send_text(number, message)


def send_urgent_alert(family_numbers: list[str], parent_name: str, signals: CallSignals, reason: str) -> None:
    message = build_urgent_message(parent_name, signals, reason)
    for number in family_numbers:
        _send_text(number, message)
