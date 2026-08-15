import logging

from fastapi import APIRouter, Form, Response
from twilio.twiml.voice_response import Gather, VoiceResponse

from app.config import settings
from app.conversation_state import CallSession, create_session, get_session, pop_session
from app.prompts import CONVERSATION_SYSTEM_PROMPT, OPENING_GREETING_TEMPLATE
from app.services import llm, supabase_client
from app.services.pipeline import run_post_call_pipeline

logger = logging.getLogger(__name__)
router = APIRouter()

END_TOKEN = "[END_CALL]"
MAX_SILENT_RETRIES = 2
GATHER_ACTION_URL = f"{settings.public_base_url}/voice/gather"


def _lookup_parent_by_phone(phone_number: str) -> dict | None:
    try:
        res = (
            supabase_client.get_client()
            .table("parents")
            .select("*")
            .eq("phone_number", phone_number)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception:
        logger.exception("Parent lookup failed for %s", phone_number)
        return None


def _language_code(preferred_language: str) -> str:
    return "hi-IN" if preferred_language.startswith("hi") else "en-IN"


def _voice_for_language(language: str) -> str:
    # Google's WaveNet voices pronounce Devanagari-script Hindi far more naturally than
    # Twilio's default TTS engine.
    return "Google.hi-IN-Wavenet-A" if language == "hi-IN" else "Google.en-IN-Wavenet-D"


def _gather_response(prompt_text: str, language: str) -> VoiceResponse:
    """A <Gather> that speaks prompt_text then listens for the caller's reply; falls back to a
    goodbye + hangup if nothing is heard at all, since Gather always calls the action URL."""
    voice = _voice_for_language(language)
    vr = VoiceResponse()
    gather = Gather(
        input="speech",
        action=GATHER_ACTION_URL,
        method="POST",
        language=language,
        speech_timeout="auto",
        speech_model="phone_call",
    )
    gather.say(prompt_text, language=language, voice=voice)
    vr.append(gather)
    fallback = "माफ़ कीजिए, कुछ सुनाई नहीं दिया। नमस्ते।" if language == "hi-IN" else "Sorry, I couldn't hear anything. Goodbye."
    vr.say(fallback, language=language, voice=voice)
    vr.hangup()
    return vr


def _end_call_response(closing_text: str, language: str) -> VoiceResponse:
    vr = VoiceResponse()
    vr.say(closing_text, language=language, voice=_voice_for_language(language))
    vr.hangup()
    return vr


@router.post("/voice")
async def voice_webhook(To: str = Form(...), From: str = Form(...), CallSid: str = Form(...)):
    """Twilio hits this when the outbound call is answered. Starts a turn-based Gather/Say
    conversation loop (ConversationRelay requires a paid Twilio account, so we use the classic,
    always-available speech verbs instead)."""
    parent = _lookup_parent_by_phone(To)
    parent_name = parent["name"] if parent else "there"
    parent_id = parent["id"] if parent else ""
    preferred_language = (parent or {}).get("preferred_language", "hi-en")
    language = _language_code(preferred_language)

    system_prompt = CONVERSATION_SYSTEM_PROMPT.format(parent_name=parent_name)
    session = create_session(CallSid, parent_id or None, parent_name, To, system_prompt, language)

    greeting = OPENING_GREETING_TEMPLATE.format(parent_name=parent_name)
    session.messages.append({"role": "assistant", "content": greeting})

    return Response(content=str(_gather_response(greeting, language)), media_type="application/xml")


@router.post("/voice/gather")
async def voice_gather(
    CallSid: str = Form(...),
    SpeechResult: str = Form(default=""),
):
    """Handles each turn: Twilio posts the transcribed speech here after every <Gather>."""
    session: CallSession | None = get_session(CallSid)
    if session is None:
        vr = VoiceResponse()
        vr.hangup()
        return Response(content=str(vr), media_type="application/xml")

    if not SpeechResult.strip():
        session.silent_retries += 1
        if session.silent_retries > MAX_SILENT_RETRIES:
            session.ended = True
            closing = "ठीक है, मैं बाद में फिर से call करूँगी। अपना ख्याल रखिएगा!" if session.language == "hi-IN" else "Okay, I'll call again later. Take care!"
            response = _end_call_response(closing, session.language)
            _finish_call(session)
            return Response(content=str(response), media_type="application/xml")

        retry_prompt = "माफ़ कीजिए, मैं सुन नहीं पाई। क्या आप फिर से बोल सकते हैं?" if session.language == "hi-IN" else "Sorry, I didn't catch that. Could you say it again?"
        response = _gather_response(retry_prompt, session.language)
        return Response(content=str(response), media_type="application/xml")

    session.silent_retries = 0
    session.messages.append({"role": "user", "content": SpeechResult})

    reply = llm.get_next_reply(session.messages)
    should_end = END_TOKEN in reply
    spoken_reply = reply.replace(END_TOKEN, "").strip()
    session.messages.append({"role": "assistant", "content": spoken_reply})

    if should_end:
        session.ended = True
        response = _end_call_response(spoken_reply, session.language)
        _finish_call(session)
    else:
        response = _gather_response(spoken_reply, session.language)

    return Response(content=str(response), media_type="application/xml")


def _finish_call(session: CallSession) -> None:
    pop_session(session.call_sid)
    try:
        run_post_call_pipeline(session)
    except Exception:
        logger.exception("Post-call pipeline failed for call %s", session.call_sid)
