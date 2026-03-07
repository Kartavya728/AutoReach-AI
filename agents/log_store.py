"""
Thread-safe in-memory log store for streaming agent reasoning logs.
Each pipeline run gets a unique session_id; logs are stored per session
and streamed via SSE to the frontend.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import AsyncGenerator


@dataclass
class AgentLogEntry:
    """Structured log entry emitted by each agent step."""
    agent: str
    thought: str
    action: str
    timestamp: str


# ── In-memory store ──────────────────────────────────────────────

_sessions: dict[str, dict] = {}
_SESSION_TTL = 3600  # 1 hour


def create_session() -> str:
    """Create a new log session, returns session_id."""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "logs": [],
        "queue": asyncio.Queue(),
        "done": False,
        "created_at": time.time(),
    }
    _gc_expired()
    return session_id


def emit_log(session_id: str, entry: AgentLogEntry | dict) -> None:
    """Emit a log entry to a session (call from pipeline code)."""
    if session_id not in _sessions:
        return

    if isinstance(entry, AgentLogEntry):
        record = asdict(entry)
    else:
        record = entry

    _sessions[session_id]["logs"].append(record)

    # Non-blocking put — if nobody is listening yet the queue will buffer
    try:
        _sessions[session_id]["queue"].put_nowait(record)
    except Exception:
        pass


def emit_in_pipeline(session_id: str, agent: str, thought: str, action: str) -> None:
    """Helper for pipeline nodes to easily emit standard event logs."""
    if not session_id:
        return
    emit_log(session_id, AgentLogEntry(
        agent=agent,
        thought=thought,
        action=action,
        timestamp=datetime.now(timezone.utc).isoformat()
    ))


def mark_done(session_id: str) -> None:
    """Signal that the pipeline has finished emitting logs."""
    if session_id in _sessions:
        _sessions[session_id]["done"] = True
        try:
            _sessions[session_id]["queue"].put_nowait(None)  # sentinel
        except Exception:
            pass


def get_logs(session_id: str) -> list[dict]:
    """Get all logs emitted so far (non-streaming, for tests)."""
    if session_id not in _sessions:
        return []
    return list(_sessions[session_id]["logs"])


async def stream_logs(session_id: str) -> AsyncGenerator[dict, None]:
    """
    Async generator that yields log entries as they are emitted.
    Completes when the session is marked done.
    """
    if session_id not in _sessions:
        return

    queue = _sessions[session_id]["queue"]

    while True:
        try:
            entry = await asyncio.wait_for(queue.get(), timeout=60.0)
        except asyncio.TimeoutError:
            # Check if session is done (pipeline may have crashed)
            if _sessions.get(session_id, {}).get("done", True):
                break
            continue

        if entry is None:  # sentinel → done
            break
        yield entry


# ── Garbage collection ───────────────────────────────────────────

def _gc_expired() -> None:
    """Remove sessions older than TTL."""
    now = time.time()
    expired = [
        sid for sid, data in _sessions.items()
        if now - data["created_at"] > _SESSION_TTL
    ]
    for sid in expired:
        del _sessions[sid]
