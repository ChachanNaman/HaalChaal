import logging

import httpx
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from app.config import settings

logger = logging.getLogger(__name__)

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not settings.twilio_account_sid or not settings.twilio_auth_token:
            raise RuntimeError("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not configured")
        _client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    return _client


def place_outbound_call(to_number: str) -> str:
    """Kicks off an outbound call that hits our /voice webhook for TwiML. Returns the Twilio call SID.

    This Twilio trial account rejects extra call-creation parameters with a blanket "Invalid or
    disallowed parameters provided" 400 -- confirmed for both `record` and, separately,
    `status_callback`. Rather than guess which combination is safe, try progressively fewer
    optional parameters and use whichever attempt actually succeeds, so placing the call itself
    never fails just because a nice-to-have (recording, hangup-salvage callback) isn't available
    on this account."""
    base_kwargs = {
        "to": to_number,
        "from_": settings.twilio_phone_number,
        "url": f"{settings.public_base_url}/voice",
    }
    recording_kwargs = {
        "record": True,
        "recording_status_callback": f"{settings.public_base_url}/voice/recording-callback",
        "recording_status_callback_event": ["completed"],
    }
    status_kwargs = {
        "status_callback": f"{settings.public_base_url}/voice/status-callback",
        "status_callback_event": ["completed"],
        "status_callback_method": "POST",
    }

    attempts = [
        {**base_kwargs, **recording_kwargs, **status_kwargs},
        {**base_kwargs, **status_kwargs},
        {**base_kwargs, **recording_kwargs},
        base_kwargs,
    ]

    last_exc: TwilioRestException | None = None
    for i, kwargs in enumerate(attempts):
        try:
            call = get_client().calls.create(**kwargs)
            if i > 0:
                logger.warning("Placed call with reduced parameters (attempt %d) after trial-account rejection: %s", i + 1, last_exc)
            return call.sid
        except TwilioRestException as exc:
            if exc.status != 400:
                raise
            last_exc = exc

    # All parameter combinations rejected -- base_kwargs alone already succeeded once when this
    # backend was first deployed, so reaching here means something else is wrong; surface it.
    raise last_exc


def get_recording_audio(recording_sid: str) -> bytes:
    """Downloads a finished recording's audio bytes (mp3) using Twilio's authenticated API --
    recording URLs require Basic Auth, so the browser can't hit them directly."""
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Recordings/{recording_sid}.mp3"
    resp = httpx.get(url, auth=(settings.twilio_account_sid, settings.twilio_auth_token), timeout=30)
    resp.raise_for_status()
    return resp.content


def download_recording_wav(recording_url: str) -> bytes | None:
    """Downloads a per-turn recording as WAV (for Sarvam STT) given the RecordingUrl Twilio
    provides in a <Record> action callback. Returns None on any failure -- caller treats that
    as silence rather than crashing the call."""
    try:
        resp = httpx.get(
            f"{recording_url}.wav",
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            timeout=20,
        )
        resp.raise_for_status()
        return resp.content
    except Exception:
        return None
