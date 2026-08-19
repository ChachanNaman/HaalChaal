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
    Tries to record the whole call so the dashboard can offer audio playback (finishes a few
    seconds after the call ends, reported to /voice/recording-callback) -- but call-level
    recording via the REST API is blocked on Twilio trial accounts ("Invalid or disallowed
    parameters"), so this falls back to placing the call without recording rather than failing
    the call entirely."""
    # Fires no matter how the call ends -- including the caller simply hanging up mid-conversation,
    # which the normal TwiML flow never gets a chance to react to (Twilio just stops calling our
    # webhooks). /voice/status-callback uses this as a last-resort save for whatever transcript
    # was captured up to that point, so a caller hangup doesn't silently lose the whole call.
    status_kwargs = {
        "status_callback": f"{settings.public_base_url}/voice/status-callback",
        "status_callback_event": ["completed"],
        "status_callback_method": "POST",
    }
    try:
        call = get_client().calls.create(
            to=to_number,
            from_=settings.twilio_phone_number,
            url=f"{settings.public_base_url}/voice",
            record=True,
            recording_status_callback=f"{settings.public_base_url}/voice/recording-callback",
            recording_status_callback_event=["completed"],
            **status_kwargs,
        )
        return call.sid
    except TwilioRestException as exc:
        if exc.status == 400:
            logger.warning("Call recording unavailable (likely trial account restriction), placing call without it: %s", exc)
            call = get_client().calls.create(
                to=to_number,
                from_=settings.twilio_phone_number,
                url=f"{settings.public_base_url}/voice",
                **status_kwargs,
            )
            return call.sid
        raise


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
