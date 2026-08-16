import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    twilio_account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    twilio_phone_number: str = os.getenv("TWILIO_PHONE_NUMBER", "")

    public_base_url: str = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")

    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    sarvam_api_key: str = os.getenv("SARVAM_API_KEY", "")

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
