"""The think loop for one connected client.

Phase 2 loop: HEAR -> PLAN (LLM with tools + the clarify rule) -> ACT
(tool router) -> OBSERVE (results fed back) -> repeat -> SPEAK. Each tool
call surfaces a quiet line in the client's ThoughtStream. Long-term
memory arrives in Phase 3; short-term memory is the history kept here.
"""
import asyncio
import json

from fastapi import WebSocket

from brain import memory
from brain.prompts import SYSTEM_PROMPT
from brain.router import stream_chat
from config import settings
from tools.registry import TOOL_SCHEMAS, execute, thought_for

MAX_HISTORY_MESSAGES = 40  # rolling window incl. tool traffic
MAX_TOOL_ROUNDS = 6  # PLAN->ACT->OBSERVE iterations per utterance
FRAME_TIMEOUT = 20  # seconds to wait for a camera frame


class BrainSession:
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.history: list[dict] = []
        self._task: asyncio.Task | None = None
        self._frame_future: asyncio.Future | None = None

    async def send(self, payload: dict) -> None:
        await self.ws.send_text(json.dumps(payload))

    async def send_meta(self) -> None:
        await self.send(
            {
                "type": "meta",
                "provider": settings.provider,
                "model": settings.active_model,
                "tools": [t["name"] for t in TOOL_SCHEMAS],
            }
        )

    async def handle(self, msg: dict) -> None:
        kind = msg.get("type")
        if kind == "user_text":
            text = (msg.get("text") or "").strip()
            if text:
                self._cancel_current()
                self._task = asyncio.create_task(self._think(text))
        elif kind == "interrupt":
            # Barge-in: the user started talking over Leviathan.
            self._cancel_current()
            await self.send({"type": "state", "state": "listening"})
        elif kind == "frame":
            if self._frame_future and not self._frame_future.done():
                self._frame_future.set_result(msg.get("data") or "")

    async def request_frame(self) -> str:
        """Ask the client for one camera frame (base64 jpeg, no prefix)."""
        self._frame_future = asyncio.get_running_loop().create_future()
        await self.send({"type": "request_frame"})
        try:
            return await asyncio.wait_for(self._frame_future, FRAME_TIMEOUT)
        except asyncio.TimeoutError:
            return ""
        finally:
            self._frame_future = None

    def _cancel_current(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()

    def _trim_history(self) -> None:
        if len(self.history) <= MAX_HISTORY_MESSAGES:
            return
        trimmed = self.history[-MAX_HISTORY_MESSAGES:]
        # Never start the window on a tool result — its call would be gone
        while trimmed and trimmed[0]["role"] == "tool":
            trimmed.pop(0)
        self.history = trimmed

    async def _think(self, user_text: str) -> None:
        self.history.append({"role": "user", "content": user_text})
        self._trim_history()
        await self.send({"type": "state", "state": "thinking"})

        # Currents of memory: relevant long-term facts surface each turn
        try:
            recalled = await memory.recall(user_text, k=4)
        except Exception:
            recalled = []
        memory_block = (
            "\n\nCURRENTS OF MEMORY (facts you stored about this user in "
            "earlier sessions — use them naturally, never recite them "
            "unprompted):\n- " + "\n- ".join(recalled)
            if recalled
            else ""
        )

        use_tools = settings.provider != "mock"
        try:
            for _round in range(MAX_TOOL_ROUNDS):
                messages = [
                    {"role": "system", "content": SYSTEM_PROMPT + memory_block},
                    *self.history,
                ]
                text = ""
                tool_calls: list[dict] = []
                async for event in stream_chat(
                    messages, TOOL_SCHEMAS if use_tools else None
                ):
                    if event["kind"] == "text":
                        text += event["text"]
                    else:
                        tool_calls.append(event)

                if not tool_calls:
                    # Final answer for this utterance
                    self.history.append({"role": "assistant", "content": text})
                    await self.send({"type": "reply_delta", "text": text})
                    await self.send({"type": "reply_done", "text": text})
                    return

                # ACT: run the requested tools, narrate via ThoughtStream
                self.history.append(
                    {
                        "role": "assistant",
                        "content": text,
                        "tool_calls": [
                            {"id": tc["id"], "name": tc["name"], "args": tc["args"]}
                            for tc in tool_calls
                        ],
                    }
                )
                for tc in tool_calls:
                    await self.send(
                        {"type": "thought", "text": thought_for(tc["name"], tc["args"])}
                    )
                    result = await execute(self, tc["name"], tc["args"])
                    self.history.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "name": tc["name"],
                            "content": result,
                        }
                    )

            # Ran out of rounds — say so rather than looping forever
            bail = "That task ran deeper than I can follow in one breath. Ask me to continue."
            self.history.append({"role": "assistant", "content": bail})
            await self.send({"type": "reply_delta", "text": bail})
            await self.send({"type": "reply_done", "text": bail})

        except asyncio.CancelledError:
            raise
        except Exception as exc:  # provider/network failure -> error state
            message = str(exc)
            if "429" in message:
                message = (
                    "the model provider is rate-limiting (free tier) — "
                    "wait a few seconds and ask again"
                )
            await self.send({"type": "error", "message": message})
            await self.send({"type": "state", "state": "error"})
        # The client owns the "speaking" visual state while its TTS plays.
