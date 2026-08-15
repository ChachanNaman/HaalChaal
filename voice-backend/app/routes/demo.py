import logging

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.models import DemoCallRequest
from app.services import twilio_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/demo/call")
async def trigger_demo_call(payload: DemoCallRequest):
    """Kicks off a real outbound call for the demo. Number must be Twilio-verified while on trial."""
    to_number = payload.phone_number or settings.demo_parent_phone_number
    if not to_number:
        raise HTTPException(status_code=400, detail="No phone number provided and DEMO_PARENT_PHONE_NUMBER is unset")

    try:
        call_sid = twilio_client.place_outbound_call(to_number)
    except Exception as exc:
        logger.exception("Failed to place demo call")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"call_sid": call_sid, "to": to_number}
