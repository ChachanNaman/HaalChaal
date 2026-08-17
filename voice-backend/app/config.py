import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    twilio_account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    twilio_phone_number: str = os.getenv("TWILIO_PHONE_NUMBER", "")

    public_base_url: str = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")

    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    # llama-3.3-70b-versatile was deprecated/removed from Groq's lineup; gpt-oss-120b is the
    # current equivalent flagship model (also listed as an acceptable option in the PRD).
    groq_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    sarvam_api_key: str = os.getenv("SARVAM_API_KEY", "")
    # Sarvam STT needs the <Record> TwiML verb, which this account rejects outright
    # ("recording... not available on child account") -- confirmed on a live call. Default to
    # Twilio's native <Gather> until that's resolved (e.g. account upgrade); flip this on to
    # retry the Sarvam STT path.
    enable_sarvam_stt: bool = os.getenv("ENABLE_SARVAM_STT", "false").lower() == "true"
    # Sarvam TTS (via <Play>) works and was verified against the live API, but it adds an extra
    # network hop per turn (Twilio has to separately fetch our /tts-audio proxy URL, unlike
    # <Say> which needs nothing fetched) -- on this free-tier deployment that occasionally
    # contributed to slow/failed turns during live calls. Defaults off for demo reliability;
    # flip this on to use Sarvam's voice again once fetch reliability isn't a concern.
    enable_sarvam_tts: bool = os.getenv("ENABLE_SARVAM_TTS", "false").lower() == "true"

    whatsapp_token: str = os.getenv("WHATSAPP_CLOUD_API_TOKEN", "")
    whatsapp_phone_number_id: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

    supabase_url: str = os.getenv("SUPABASE_URL", "")
    # Backend writes are triggered by Twilio webhooks, not a logged-in user, so RLS (which is
    # scoped to auth.uid()) would block them under the anon key. The service_role key bypasses
    # RLS entirely -- keep it out of anything shipped to a browser.
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    demo_parent_phone_number: str = os.getenv("DEMO_PARENT_PHONE_NUMBER", "")

    # Shared secret the dashboard must send to trigger a real (paid) outbound call. Without this,
    # the publicly deployed /demo/call and /calls/trigger endpoints could be hit by anyone who
    # finds the URL to place calls at this account's expense.
    internal_api_key: str = os.getenv("INTERNAL_API_KEY", "")


settings = Settings()
