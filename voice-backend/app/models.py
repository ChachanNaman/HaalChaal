from typing import Optional

from pydantic import BaseModel


class CallSignals(BaseModel):
    mood_score: int
    coherence_score: int
    medication_taken: str  # "yes" | "no" | "unclear"
    new_complaint: Optional[str] = None
    flagged_urgent: bool
    summary: str


class Parent(BaseModel):
    id: str
    name: str
    phone_number: str
    preferred_language: str = "hi-en"


class DemoCallRequest(BaseModel):
    parent_name: Optional[str] = None
    phone_number: Optional[str] = None
    preferred_language: Optional[str] = None


class TriggerCallRequest(BaseModel):
    parent_id: str
