import logging

from fastapi import APIRouter, HTTPException, Response

from app.services import audio_cache, twilio_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/tts-audio/{audio_id}")
async def get_tts_audio(audio_id: str):
    """Serves a Sarvam-synthesized reply so Twilio's <Play> can fetch it by URL (TwiML can't
    embed audio bytes inline)."""
    data = audio_cache.get(audio_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Audio not found or expired")
    return Response(content=data, media_type="audio/wav")


@router.get("/recordings/{recording_sid}")
async def get_recording(recording_sid: str):
    """Proxies a finished call recording from Twilio so the dashboard's <audio> tag can play it
    without needing Twilio Basic Auth credentials in the browser."""
    try:
        data = twilio_client.get_recording_audio(recording_sid)
    except Exception as exc:
        logger.exception("Failed to fetch recording %s", recording_sid)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return Response(content=data, media_type="audio/mpeg")
