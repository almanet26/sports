"""
AI Chat — Virtual Coaching Assistant.

POST /chat/message     stream Gemini response as SSE  (Basic+)
GET  /chat/sessions    list user's sessions
DELETE /chat/sessions/{session_id}   wipe a session

System prompt locks Gemini to cricket-only answers.
The Gemini streaming call is dispatched in a daemon thread so it never
blocks the uvicorn event loop.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.config import SessionLocal, get_db
from database.models.chat_history import ChatHistory
from database.models.user import User
from dependencies.feature_gate import require_feature
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

# ---------------------------------------------------------------------------
# Gemini setup — mirrors the key-rotation pattern in batting_engine.py
# ---------------------------------------------------------------------------

_GEMINI_KEYS: list[str] = [
    k
    for k in [os.getenv(f"GEMINI_API_KEY_{i}") for i in range(1, 6)]
    + [os.getenv("GEMINI_API_KEY"), os.getenv("GOOGLE_API_KEY")]
    if k
]
_GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
_KEY_IDX: int = 0

_SYSTEM_PROMPT = (
    "You are a cricket technique coach. Only answer questions about cricket "
    "biomechanics, batting technique, bowling technique, and training drills. "
    "Refuse all off-topic questions politely."
)

_GEMINI_AVAILABLE = False
try:
    from google import genai as _genai  # type: ignore

    _GEMINI_AVAILABLE = bool(_GEMINI_KEYS)
except ImportError:
    _genai = None  # type: ignore


def _get_gemini_client():
    global _KEY_IDX
    if not _GEMINI_AVAILABLE or _genai is None:
        return None
    key = _GEMINI_KEYS[_KEY_IDX % len(_GEMINI_KEYS)]
    _KEY_IDX = (_KEY_IDX + 1) % len(_GEMINI_KEYS)
    return _genai.Client(api_key=key)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field(..., min_length=1, max_length=100)


class SessionSummary(BaseModel):
    session_id: str
    last_message: str
    created_at: datetime


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _save_message(db: Session, user_id: str, session_id: str, role: str, content: str) -> None:
    db.add(ChatHistory(
        id=str(uuid.uuid4()),
        user_id=user_id,
        session_id=session_id,
        role=role,
        content=content,
    ))
    db.commit()


def _get_history(db: Session, user_id: str, session_id: str, limit: int = 20) -> list[ChatHistory]:
    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id, ChatHistory.session_id == session_id)
        .order_by(ChatHistory.created_at.asc())
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------------------------
# SSE streaming generator
# ---------------------------------------------------------------------------

async def _stream_response(
    user_id: str,
    session_id: str,
    history: list[ChatHistory],
    user_message: str,
) -> AsyncGenerator[str, None]:
    """
    Runs the blocking Gemini streaming call in a daemon thread and bridges
    chunks to the async generator via an asyncio.Queue.
    """
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()
    accumulated: list[str] = []

    def _gemini_thread() -> None:
        client = _get_gemini_client()
        if client is None:
            loop.call_soon_threadsafe(queue.put_nowait, ("error", "AI service not configured"))
            return

        contents = [
            {
                "role": "user" if msg.role == "user" else "model",
                "parts": [{"text": msg.content}],
            }
            for msg in history
        ]
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        try:
            for chunk in client.models.generate_content_stream(
                model=_GEMINI_MODEL,
                contents=contents,
                config={"system_instruction": _SYSTEM_PROMPT},
            ):
                text = getattr(chunk, "text", None) or ""
                if text:
                    loop.call_soon_threadsafe(queue.put_nowait, ("delta", text))
        except Exception as exc:
            logger.exception("Gemini stream error for user=%s session=%s", user_id, session_id)
            loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc)))
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, ("done", None))

    thread = threading.Thread(target=_gemini_thread, daemon=True)
    thread.start()

    error_occurred = False
    while True:
        kind, payload = await queue.get()
        if kind == "delta":
            accumulated.append(payload)
            yield f"data: {json.dumps({'delta': payload})}\n\n"
        elif kind == "error":
            error_occurred = True
            yield f"data: {json.dumps({'error': payload})}\n\n"
            break
        elif kind == "done":
            break

    yield "data: [DONE]\n\n"

    if not error_occurred and accumulated:
        full_text = "".join(accumulated)
        # Persist the assistant reply in a fresh session (the route's session
        # may already be closed by the time streaming finishes).
        db = SessionLocal()
        try:
            db.add(ChatHistory(
                id=str(uuid.uuid4()),
                user_id=user_id,
                session_id=session_id,
                role="assistant",
                content=full_text,
            ))
            db.commit()
        except Exception:
            logger.exception("Failed to persist assistant reply user=%s", user_id)
            db.rollback()
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/message")
async def send_message(
    body: ChatMessageRequest,
    current_user: User = Depends(require_feature("ai_chat")),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Stream a Gemini-powered cricket coaching response via SSE."""
    # Persist user turn before streaming so history is consistent.
    _save_message(db, current_user.id, body.session_id, "user", body.message)

    history = _get_history(db, current_user.id, body.session_id, limit=20)
    # Exclude the message we just added (last item) from the context passed to
    # the generator — it appends the user turn itself.
    context = history[:-1]

    return StreamingResponse(
        _stream_response(current_user.id, body.session_id, context, body.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx proxy buffering
        },
    )


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(
    current_user: User = Depends(require_feature("ai_chat")),
    db: Session = Depends(get_db),
) -> list[SessionSummary]:
    """Return distinct sessions with their most recent message preview."""
    # Subquery: latest created_at per (user_id, session_id)
    latest_ts = (
        db.query(
            ChatHistory.session_id,
            func.max(ChatHistory.created_at).label("max_ts"),
        )
        .filter(ChatHistory.user_id == current_user.id)
        .group_by(ChatHistory.session_id)
        .subquery()
    )

    rows = (
        db.query(ChatHistory)
        .join(
            latest_ts,
            (ChatHistory.session_id == latest_ts.c.session_id)
            & (ChatHistory.created_at == latest_ts.c.max_ts),
        )
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .all()
    )

    return [
        SessionSummary(
            session_id=r.session_id,
            last_message=r.content[:120] + ("…" if len(r.content) > 120 else ""),
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    current_user: User = Depends(require_feature("ai_chat")),
    db: Session = Depends(get_db),
) -> None:
    """Delete a session and all its messages."""
    deleted = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == current_user.id,
            ChatHistory.session_id == session_id,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Session not found")