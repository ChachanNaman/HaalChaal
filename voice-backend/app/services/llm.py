import json
import logging

from groq import Groq

from app.config import settings
from app.models import CallSignals
from app.prompts import EXTRACTION_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

_client = Groq(api_key=settings.groq_api_key, timeout=12.0) if settings.groq_api_key else None


def get_next_reply(messages: list[dict]) -> str:
    """messages: list of {"role": "system"|"user"|"assistant", "content": str}"""
    if _client is None:
        raise RuntimeError("GROQ_API_KEY is not configured")

    completion = _client.chat.completions.create(
        model=settings.groq_model,
        messages=messages,
        temperature=0.6,
        max_tokens=300,
        extra_body={"reasoning_effort": "low"},
    )
    content = completion.choices[0].message.content
    return content.strip() if content else ""


def extract_signals(transcript: str) -> CallSignals:
    if _client is None:
        raise RuntimeError("GROQ_API_KEY is not configured")

    completion = _client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": f"Transcript:\n\n{transcript}"},
        ],
        temperature=0,
        max_tokens=600,
        extra_body={"reasoning_effort": "low"},
        response_format={"type": "json_object"},
    )
    raw = completion.choices[0].message.content
    try:
        data = json.loads(raw)
        return CallSignals(**data)
    except Exception:
        logger.exception("Failed to parse extraction JSON, raw=%s", raw)
        return CallSignals(
            mood_score=3,
            coherence_score=3,
            medication_taken="unclear",
            new_complaint=None,
            flagged_urgent=False,
            summary="Call completed; automatic summary unavailable.",
        )
