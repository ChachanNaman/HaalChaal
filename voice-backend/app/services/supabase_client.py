from supabase import Client, create_client

from app.config import settings

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise RuntimeError("SUPABASE_URL / SUPABASE_ANON_KEY are not configured")
        _client = create_client(settings.supabase_url, settings.supabase_anon_key)
    return _client


def get_parent(parent_id: str) -> dict | None:
    res = get_client().table("parents").select("*").eq("id", parent_id).single().execute()
    return res.data


def get_recent_calls(parent_id: str, limit: int = 14) -> list[dict]:
    res = (
        get_client()
        .table("calls")
        .select("*")
        .eq("parent_id", parent_id)
        .order("timestamp", desc=True)
        .limit(limit)
        .execute()
    )
    return list(reversed(res.data or []))


def insert_call(row: dict) -> dict:
    res = get_client().table("calls").insert(row).execute()
    return res.data[0] if res.data else {}


def get_family_contacts(parent_id: str) -> list[dict]:
    res = get_client().table("family_contacts").select("*").eq("parent_id", parent_id).execute()
    return res.data or []
