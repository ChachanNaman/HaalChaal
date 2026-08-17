import json
import logging

from groq import Groq

from app.config import settings
from app.models import CallSignals
from app.prompts import END_TOKEN, EXTRACTION_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

_client = Groq(api_key=settings.groq_api_key, timeout=12.0) if settings.groq_api_key else None


# Conjunctions the model sometimes uses to join two questions into one sentence with a single
# trailing "?", which a plain question-mark count doesn't catch (seen in testing, e.g. "...है,
# और क्या आप...सो पाए?" -- two questions, one "?"). Split on the first of these too.
_JOIN_WORDS = [" और ", " साथ ही ", " and ", " also "]


def _limit_to_one_question(text: str) -> str:
    """Hard safety net: the system prompt asks for one question per turn, but that's not
    guaranteed -- if the model still stacks multiple questions, truncate to the first one rather
    than making an elderly caller parse a run-on multi-part question. Preserves END_TOKEN if
    present, regardless of where the truncation lands."""
    has_end_token = END_TOKEN in text
    body = text.replace(END_TOKEN, "").strip()

    question_marks = [i for i, ch in enumerate(body) if ch == "?"]
    if len(question_marks) > 1:
        body = body[: question_marks[0] + 1].strip()

    for join_word in _JOIN_WORDS:
        idx = body.find(join_word)
        if idx != -1:
            body = body[:idx].rstrip(" ,;-—।").strip()
            if not body.endswith(("?", ".", "!")):
                body += "?"
            break

    return f"{body} {END_TOKEN}" if has_end_token else body


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
    content = content.strip() if content else ""
    return _limit_to_one_question(content)


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
