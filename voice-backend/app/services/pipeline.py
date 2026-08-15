import logging
from datetime import datetime, timezone

from app.conversation_state import CallSession
from app.services import llm, supabase_client, whatsapp
from app.services.escalation import compute_rolling_baseline, should_escalate

logger = logging.getLogger(__name__)


def run_post_call_pipeline(session: CallSession) -> None:
    """Extract signals, persist, check for escalation, notify family. Runs after a call ends."""
    transcript = session.transcript_text()
    if not transcript.strip():
        logger.info("Empty transcript for call %s, skipping pipeline", session.call_sid)
        return

    signals = llm.extract_signals(transcript)

    baseline = {"mood_avg": None, "coherence_avg": None, "missed_medication_streak": 0}
    if session.parent_id:
        try:
            past_calls = supabase_client.get_recent_calls(session.parent_id)
            baseline = compute_rolling_baseline(past_calls)
        except Exception:
            logger.exception("Failed to load rolling baseline for parent %s", session.parent_id)

    escalate, reason = should_escalate(signals, baseline)

    row = {
        "parent_id": session.parent_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "transcript": transcript,
        "audio_url": None,
        "mood_score": signals.mood_score,
        "coherence_score": signals.coherence_score,
        "medication_taken": signals.medication_taken,
        "new_complaint": signals.new_complaint,
        "flagged_urgent": escalate,
    }
    if session.parent_id:
        try:
            supabase_client.insert_call(row)
        except Exception:
            logger.exception("Failed to persist call for parent %s", session.parent_id)

    family_numbers: list[str] = []
    if session.parent_id:
        try:
            contacts = supabase_client.get_family_contacts(session.parent_id)
            family_numbers = [c["whatsapp_number"] for c in contacts]
        except Exception:
            logger.exception("Failed to load family contacts for parent %s", session.parent_id)

    if not family_numbers:
        logger.warning("No family WhatsApp numbers configured for parent %s; skipping send", session.parent_id)
        return

    if escalate:
        whatsapp.send_urgent_alert(family_numbers, session.parent_name, signals, reason)
    else:
        whatsapp.send_digest(family_numbers, session.parent_name, signals)
