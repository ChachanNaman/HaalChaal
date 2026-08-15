from app.models import CallSignals

MOOD_DROP_THRESHOLD = 2
COHERENCE_DROP_THRESHOLD = 2
BASELINE_WINDOW = 14  # days of prior calls to average over


def compute_rolling_baseline(past_calls: list[dict]) -> dict:
    """past_calls: list of prior call rows (most recent last), each with mood_score/coherence_score."""
    window = past_calls[-BASELINE_WINDOW:]
    if not window:
        return {"mood_avg": None, "coherence_avg": None, "missed_medication_streak": 0}

    mood_avg = sum(c["mood_score"] for c in window) / len(window)
    coherence_avg = sum(c["coherence_score"] for c in window) / len(window)

    missed_streak = 0
    for c in reversed(window):
        if c.get("medication_taken") == "no":
            missed_streak += 1
        else:
            break

    return {
        "mood_avg": mood_avg,
        "coherence_avg": coherence_avg,
        "missed_medication_streak": missed_streak,
    }


def should_escalate(signals: CallSignals, baseline: dict) -> tuple[bool, str]:
    """Returns (should_escalate, reason)."""
    if signals.flagged_urgent:
        return True, "urgent_keyword"

    mood_avg = baseline.get("mood_avg")
    if mood_avg is not None and (mood_avg - signals.mood_score) >= MOOD_DROP_THRESHOLD:
        return True, "mood_drop"

    coherence_avg = baseline.get("coherence_avg")
    if coherence_avg is not None and (coherence_avg - signals.coherence_score) >= COHERENCE_DROP_THRESHOLD:
        return True, "coherence_drop"

    missed_streak = baseline.get("missed_medication_streak", 0)
    if signals.medication_taken == "no" and missed_streak >= 1:
        return True, "missed_medication_repeated"

    return False, ""
