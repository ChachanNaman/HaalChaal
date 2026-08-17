"""Sarvam AI Saarika (STT) + Bulbul (TTS) integration -- the PRD's stated vernacular
differentiator. Every call here is defensive: on any failure (network, unexpected response
shape, etc.) we return None and the caller falls back to Twilio's native Say/Gather, so a
Sarvam outage or API contract drift never breaks a live call. This has not been exercised on a
real phone call yet -- verify the exact request/response shape against Sarvam's current docs if
it doesn't work first try, and adjust the field names below.
"""

import base64
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TTS_URL = "https://api.sarvam.ai/text-to-speech"
STT_URL = "https://api.sarvam.ai/speech-to-text"


def is_configured() -> bool:
    return bool(settings.sarvam_api_key)


def _target_language(language: str) -> str:
    return "hi-IN" if language == "hi-IN" else "en-IN"


def synthesize_speech(text: str, language: str) -> bytes | None:
    """Returns WAV audio bytes for the given text via Sarvam Bulbul, or None on any failure."""
    if not settings.sarvam_api_key or not text.strip():
        return None

    try:
        resp = httpx.post(
            TTS_URL,
            headers={"api-subscription-key": settings.sarvam_api_key, "Content-Type": "application/json"},
            json={
                "inputs": [text[:1500]],
                "target_language_code": _target_language(language),
                "speaker": "anushka",
                "model": "bulbul:v2",
                "speech_sample_rate": 8000,
            },
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
        audios = data.get("audios") or []
        if not audios:
            logger.warning("Sarvam TTS returned no audio: %s", data)
            return None
        return base64.b64decode(audios[0])
    except Exception:
        logger.exception("Sarvam TTS failed, falling back to Twilio Say")
        return None


def transcribe_audio(audio_bytes: bytes, language: str) -> str | None:
    """Returns the transcript for the given audio via Sarvam Saarika, or None on any failure
    (including "nothing intelligible was said" if Sarvam returns an empty transcript) -- callers
    should treat None the same as silence."""
    if not settings.sarvam_api_key or not audio_bytes:
        return None

    try:
        resp = httpx.post(
            STT_URL,
            headers={"api-subscription-key": settings.sarvam_api_key},
            files={"file": ("audio.wav", audio_bytes, "audio/wav")},
            data={"model": "saarika:v2.5", "language_code": _target_language(language)},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        transcript = (data.get("transcript") or "").strip()
        return transcript or None
    except Exception:
        logger.exception("Sarvam STT failed, treating turn as silence")
        return None
