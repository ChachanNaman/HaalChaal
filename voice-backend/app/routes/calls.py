import logging

from fastapi import APIRouter, Depends, HTTPException

from app.models import TriggerCallRequest
from app.security import require_internal_api_key
from app.services import supabase_client, twilio_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/calls/trigger", dependencies=[Depends(require_internal_api_key)])
async def trigger_call(payload: TriggerCallRequest):
    """Places a real outbound call to a specific parent by id. Called by the dashboard's
    "Call now" button, authenticated with the internal API key (not a public endpoint)."""
    parent = supabase_client.get_parent(payload.parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")

    try:
        call_sid = twilio_client.place_outbound_call(parent["phone_number"])
    except Exception as exc:
        logger.exception("Failed to place call for parent %s", payload.parent_id)
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"call_sid": call_sid, "parent_id": payload.parent_id, "to": parent["phone_number"]}
