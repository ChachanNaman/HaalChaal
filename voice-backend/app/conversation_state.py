from dataclasses import dataclass, field


@dataclass
class CallSession:
    call_sid: str
    parent_id: str | None
    parent_name: str
    parent_phone: str
    language: str = "en-IN"
    messages: list[dict] = field(default_factory=list)
    ended: bool = False
    silent_retries: int = 0

    def transcript_text(self) -> str:
        lines = []
        for m in self.messages:
            if m["role"] == "system":
                continue
            speaker = "Parent" if m["role"] == "user" else "Sukoon"
            lines.append(f"{speaker}: {m['content']}")
        return "\n".join(lines)


_sessions: dict[str, CallSession] = {}


def create_session(
    call_sid: str,
    parent_id: str | None,
    parent_name: str,
    parent_phone: str,
    system_prompt: str,
    language: str = "en-IN",
) -> CallSession:
    session = CallSession(
        call_sid=call_sid,
        parent_id=parent_id,
        parent_name=parent_name,
        parent_phone=parent_phone,
        language=language,
        messages=[{"role": "system", "content": system_prompt}],
    )
    _sessions[call_sid] = session
    return session


def get_session(call_sid: str) -> CallSession | None:
    return _sessions.get(call_sid)


def pop_session(call_sid: str) -> CallSession | None:
    return _sessions.pop(call_sid, None)
