import logging

from fastapi import APIRouter, Form, Response
from twilio.twiml.voice_response import Gather, VoiceResponse

from app.config import settings
from app.conversation_state import CallSession, create_session, get_session, pop_session
from app.prompts import CONVERSATION_SYSTEM_PROMPT, END_TOKEN, OPENING_GREETING_TEMPLATE, build_custom_questions_section
from app.services import audio_cache, llm, sarvam, supabase_client, twilio_client
from app.services.pipeline import run_post_call_pipeline

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_SILENT_RETRIES = 2
# Hard ceiling on conversation length -- the prompt already asks the model to wrap up within
# 5-8 turns, but that's a request, not a guarantee. If it hasn't ended the call by MAX_TURNS,
# force a close instead of letting the conversation ramble on indefinitely.
MAX_TURNS = 8
GATHER_ACTION_URL = f"{settings.public_base_url}/voice/gather"
RECORD_ACTION_URL = f"{settings.public_base_url}/voice/record"


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
    # Twilio's default TTS engine. Used as the fallback when Sarvam TTS isn't configured or fails.
    return "Google.hi-IN-Wavenet-A" if language == "hi-IN" else "Google.en-IN-Wavenet-D"


def _add_speech(container, text: str, language: str) -> None:
    """Adds a spoken prompt to a TwiML container (VoiceResponse or Gather, both support nested
    <Play>/<Say>). Uses Sarvam Bulbul TTS (the PRD's vernacular differentiator) only when
    explicitly enabled -- see settings.enable_sarvam_tts -- since it adds a network hop (Twilio
    has to separately fetch our /tts-audio proxy) that's contributed to unreliable live calls on
    this free-tier deployment. Twilio's own Say is the reliable default."""
    audio = sarvam.synthesize_speech(text, language) if (settings.enable_sarvam_tts and sarvam.is_configured()) else None
    if audio:
        audio_id = audio_cache.store(audio)
        container.play(f"{settings.public_base_url}/tts-audio/{audio_id}")
    else:
        container.say(text, language=language, voice=_voice_for_language(language))


def _prompt_response(prompt_text: str, language: str) -> VoiceResponse:
    """Speaks prompt_text then listens for the caller's reply. Uses Sarvam Saarika STT (via a
    short <Record> + our own transcription) when enabled and configured, otherwise uses
    Twilio's built-in <Gather> speech recognition (Sarvam TTS is still used for the spoken
    prompt either way, via _add_speech)."""
    vr = VoiceResponse()

    if settings.enable_sarvam_stt and sarvam.is_configured():
        _add_speech(vr, prompt_text, language)
        vr.record(
            action=RECORD_ACTION_URL,
            method="POST",
            max_length=30,
            timeout=4,
            trim="trim-silence",
            play_beep=False,
        )
        vr.hangup()  # safety net if <Record> somehow falls through without hitting the action URL
    else:
        gather = Gather(
            input="speech",
            action=GATHER_ACTION_URL,
            method="POST",
            language=language,
            # Tried a fixed "2" to cut dead air, but it cuts callers off mid-sentence on any
            # natural pause and returns empty speech (heard as the "sorry, didn't catch that"
            # fallback firing constantly) -- "auto" is slower but was the reliable, correct
            # baseline before that change and callers can actually finish speaking.
            speech_timeout="auto",
            speech_model="phone_call",
        )
        _add_speech(gather, prompt_text, language)
        vr.append(gather)
        fallback = "माफ़ कीजिए, कुछ सुनाई नहीं दिया। नमस्ते।" if language == "hi-IN" else "Sorry, I couldn't hear anything. Goodbye."
        _add_speech(vr, fallback, language)
        vr.hangup()

    return vr


def _end_call_response(closing_text: str, language: str) -> VoiceResponse:
    vr = VoiceResponse()
    _add_speech(vr, closing_text, language)
    vr.hangup()
    return vr


def _crash_fallback_response(language: str = "en-IN") -> Response:
    """Last-resort safety net: if anything in a turn raises an unhandled exception, return a
    plain, always-valid TwiML apology instead of a raw 500. An uncaught exception previously
    meant FastAPI returned an error page Twilio couldn't parse as TwiML, which likely explains
    "could not reach server" mid-call -- this uses Twilio's own Say only (no Sarvam/Groq calls)
    so the fallback itself can't also fail."""
    vr = VoiceResponse()
    text = "माफ़ कीजिए, कुछ गड़बड़ हो गई। मैं बाद में फिर से call करूँगी।" if language == "hi-IN" else "Sorry, something went wrong. I'll call again later."
    vr.say(text, language=language, voice=_voice_for_language(language))
    vr.hangup()
    return Response(content=str(vr), media_type="application/xml")


@router.post("/voice")
def voice_webhook(To: str = Form(...), From: str = Form(...), CallSid: str = Form(...)):
    """Twilio hits this when the outbound call is answered. Starts the turn-based conversation
    loop (ConversationRelay requires a paid Twilio account, so we use classic speech verbs)."""
    try:
        parent = _lookup_parent_by_phone(To)
        parent_name = parent["name"] if parent else "there"
        parent_id = parent["id"] if parent else ""
        preferred_language = (parent or {}).get("preferred_language", "hi-en")
        language = _language_code(preferred_language)

        custom_questions_section = build_custom_questions_section((parent or {}).get("custom_questions"))
        system_prompt = CONVERSATION_SYSTEM_PROMPT.format(parent_name=parent_name, custom_questions_section=custom_questions_section)
        session = create_session(CallSid, parent_id or None, parent_name, To, system_prompt, language)

        greeting = OPENING_GREETING_TEMPLATE.format(parent_name=parent_name)
        session.messages.append({"role": "assistant", "content": greeting})

        return Response(content=str(_prompt_response(greeting, language)), media_type="application/xml")
    except Exception:
        logger.exception("Unhandled error in /voice for call %s", CallSid)
        return _crash_fallback_response()


def _handle_turn(session: CallSession, spoken_text: str) -> VoiceResponse:
    """Shared turn logic for both the Twilio-native Gather path and the Sarvam Record path --
    spoken_text is the transcribed caller speech either way (empty string means silence/nothing
    understood, which both paths funnel into the same retry logic)."""
    if not spoken_text.strip():
        session.silent_retries += 1
        if session.silent_retries > MAX_SILENT_RETRIES:
            session.ended = True
            closing = "ठीक है, मैं बाद में फिर से call करूँगी। अपना ख्याल रखिएगा!" if session.language == "hi-IN" else "Okay, I'll call again later. Take care!"
            response = _end_call_response(closing, session.language)
            _finish_call(session)
            return response

        retry_prompt = "माफ़ कीजिए, मैं सुन नहीं पाई। क्या आप फिर से बोल सकते हैं?" if session.language == "hi-IN" else "Sorry, I didn't catch that. Could you say it again?"
        return _prompt_response(retry_prompt, session.language)

    session.silent_retries = 0
    session.messages.append({"role": "user", "content": spoken_text})
    session.turn_count += 1

    reply = llm.get_next_reply(session.messages)
    should_end = END_TOKEN in reply or session.turn_count >= MAX_TURNS
    spoken_reply = reply.replace(END_TOKEN, "").strip()
    session.messages.append({"role": "assistant", "content": spoken_reply})

    if should_end:
        session.ended = True
        response = _end_call_response(spoken_reply, session.language)
        _finish_call(session)
    else:
        response = _prompt_response(spoken_reply, session.language)

    return response


@router.post("/voice/gather")
def voice_gather(
    CallSid: str = Form(...),
    SpeechResult: str = Form(default=""),
):
    """Handles each turn when using Twilio's native <Gather> speech recognition (Sarvam not
    configured, or as the historical/default path)."""
    session: CallSession | None = get_session(CallSid)
    if session is None:
        vr = VoiceResponse()
        vr.hangup()
        return Response(content=str(vr), media_type="application/xml")

    try:
        response = _handle_turn(session, SpeechResult)
        return Response(content=str(response), media_type="application/xml")
    except Exception:
        logger.exception("Unhandled error in /voice/gather for call %s", CallSid)
        # Salvage whatever the call captured so far instead of losing the transcript/digest
        # entirely -- _finish_call's own pipeline call is already exception-safe.
        _finish_call(session)
        return _crash_fallback_response(session.language)


@router.post("/voice/record")
def voice_record(
    CallSid: str = Form(...),
    RecordingUrl: str = Form(default=""),
):
    """Handles each turn when using Sarvam Saarika STT: downloads the just-finished per-turn
    recording and transcribes it. Any failure (download or transcription) is treated as silence,
    which reuses the existing retry logic rather than crashing the call."""
    session: CallSession | None = get_session(CallSid)
    if session is None:
        vr = VoiceResponse()
        vr.hangup()
        return Response(content=str(vr), media_type="application/xml")

    try:
        transcript = None
        if RecordingUrl:
            audio_bytes = twilio_client.download_recording_wav(RecordingUrl)
            if audio_bytes:
                transcript = sarvam.transcribe_audio(audio_bytes, session.language)

        response = _handle_turn(session, transcript or "")
        return Response(content=str(response), media_type="application/xml")
    except Exception:
        logger.exception("Unhandled error in /voice/record for call %s", CallSid)
        _finish_call(session)
        return _crash_fallback_response(session.language)


@router.post("/voice/status-callback")
def status_callback(
    CallSid: str = Form(...),
    CallStatus: str = Form(default=""),
):
    """Fires when the call ends for ANY reason, including the caller hanging up mid-conversation
    -- which the normal TwiML flow never reacts to (Twilio just stops calling our webhooks, and
    the session would otherwise sit in memory forever, with the transcript/WhatsApp digest never
    saved). If a session is still open at this point, it wasn't finalized through the normal
    end-of-call or crash paths, so salvage whatever was captured here as a last resort."""
    if CallStatus == "completed":
        session = get_session(CallSid)
        if session is not None:
            logger.info("Call %s ended without a normal finish (likely caller hangup) -- salvaging via status callback", CallSid)
            _finish_call(session)
    return Response(content="<Response></Response>", media_type="application/xml")


@router.post("/voice/recording-callback")
def recording_callback(
    CallSid: str = Form(...),
    RecordingSid: str = Form(default=""),
    RecordingStatus: str = Form(default=""),
):
    """Twilio calls this once the whole-call recording (started via record=True on the outbound
    call) has finished processing. Points the calls row's audio_url at our own authenticated
    proxy route, since Twilio recording URLs require Basic Auth the browser doesn't have."""
    if RecordingStatus == "completed" and RecordingSid:
        try:
            supabase_client.set_call_audio_url(CallSid, f"{settings.public_base_url}/recordings/{RecordingSid}")
        except Exception:
            logger.exception("Failed to set audio_url for call %s", CallSid)
    return Response(content="<Response></Response>", media_type="application/xml")


def _finish_call(session: CallSession) -> None:
    pop_session(session.call_sid)
    try:
        run_post_call_pipeline(session)
    except Exception:
        logger.exception("Post-call pipeline failed for call %s", session.call_sid)
