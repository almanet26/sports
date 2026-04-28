"""
AI Chat — Virtual Coaching Assistant.

POST /chat/message     stream Gemini response as SSE  (Basic+ for players, Coach Starter+ for coaches)

Fully stateless — no DB reads or writes per message. Each message is a standalone
Gemini call with no prior conversation context sent. Refreshing the page clears
the conversation entirely. This eliminates linear token cost growth from history.

System prompt locks Gemini to cricket-only answers.
The Gemini streaming call is dispatched in a daemon thread so it never
blocks the uvicorn event loop.

Chat history table (chat_history) is retained in the schema as a historical
artifact but NO new rows are written. See database/models/chat_history.py.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from database.models.user import User
from dependencies.feature_gate import require_feature

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
    "You are a cricket technique coach for the PitchVision platform. "
    "Only answer questions about cricket biomechanics, batting technique, "
    "bowling technique, fielding, and training drills. If asked anything "
    "outside cricket, politely decline and redirect to cricket topics. "
    "Keep responses concise and actionable."
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


# ---------------------------------------------------------------------------
# SSE streaming generator — stateless, single-message Gemini call
# ---------------------------------------------------------------------------

async def _stream_response(
    user_id: str,
    user_message: str,
) -> AsyncGenerator[str, None]:
    """
    Runs the blocking Gemini streaming call in a daemon thread and bridges
    chunks to the async generator via an asyncio.Queue.

    No history is sent — single user message in, single assistant response out.
    No DB writes after streaming completes.
    """
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def _gemini_thread() -> None:
        client = _get_gemini_client()
        if client is None:
            loop.call_soon_threadsafe(queue.put_nowait, ("error", "AI service not configured"))
            return

        # Stateless: only the current user message is sent — no history array.
        contents = [
            {
                "role": "user",
                "parts": [{"text": user_message}],
            }
        ]

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
            logger.exception("Gemini stream error for user=%s", user_id)
            loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc)))
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, ("done", None))

    thread = threading.Thread(target=_gemini_thread, daemon=True)
    thread.start()

    while True:
        kind, payload = await queue.get()
        if kind == "delta":
            yield f"data: {json.dumps({'delta': payload})}\n\n"
        elif kind == "error":
            yield f"data: {json.dumps({'error': payload})}\n\n"
            break
        elif kind == "done":
            break

    yield "data: [DONE]\n\n"
    # No DB write — stateless by design.


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/message")
async def send_message(
    body: ChatMessageRequest,
    current_user: User = Depends(require_feature("ai_chat")),
) -> StreamingResponse:
    """
    Stream a Gemini-powered cricket coaching response via SSE.

    Gate check (require_feature) runs FIRST as a FastAPI dependency —
    no Gemini tokens are burned on unauthorized requests.
    No DB reads or writes occur during or after message processing.
    """
    return StreamingResponse(
        _stream_response(current_user.id, body.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx proxy buffering
        },
    )