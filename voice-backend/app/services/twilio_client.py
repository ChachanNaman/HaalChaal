from twilio.rest import Client

from app.config import settings

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not settings.twilio_account_sid or not settings.twilio_auth_token:
            raise RuntimeError("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not configured")
        _client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    return _client


def place_outbound_call(to_number: str) -> str:
    """Kicks off an outbound call that hits our /voice webhook for TwiML. Returns the Twilio call SID."""
    call = get_client().calls.create(
        to=to_number,
        from_=settings.twilio_phone_number,
        url=f"{settings.public_base_url}/voice",
    )
    return call.sid
