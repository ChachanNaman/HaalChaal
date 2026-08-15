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
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")

    demo_parent_phone_number: str = os.getenv("DEMO_PARENT_PHONE_NUMBER", "")


settings = Settings()
