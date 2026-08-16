from fastapi import Header, HTTPException

from app.config import settings


def require_internal_api_key(x_internal_api_key: str = Header(default="")) -> None:
    """Guards endpoints that place real (paid) outbound calls, so the publicly deployed backend
    can't be hit by anyone who finds the URL."""
    if not settings.internal_api_key or x_internal_api_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Missing or invalid X-Internal-Api-Key header")
