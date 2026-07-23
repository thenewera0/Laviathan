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
        self._turns = 0  # user turns, for periodic auto-memory
        # Live translation mode (Phase 4): language code or None
        self.translate_lang: str | None = None
        self.translate_lang_name: str | None = None
        # Paired PC companions (Phase 6): name -> registry entry
        self.devices: dict[str, dict] = {}
        self._pc_futures: dict[str, asyncio.Future] = {}

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
        elif kind == "get_memories":
            try:
                items = await memory.list_all()
            except Exception:
                items = []  # a DB hiccup must never drop the session
            await self.send({"type": "memories", "items": items})
        elif kind == "forget_memory":
            mid = msg.get("id")
            try:
                if mid:
                    await memory.forget(str(mid))
                items = await memory.list_all()
            except Exception:
                items = []
            await self.send({"type": "memories", "items": items})
        elif kind == "relink":
            # Host reconnected (or backend restarted) — re-register its link
            # token to THIS live session so the guest URL keeps working.
            from linking import registry as links

            tok = msg.get("token")
            if tok:
                links.rebind(tok, self, msg.get("purpose") or "camera")
        elif kind == "link_signal":
            # Host's SDP/ICE answer -> relay to the linked guest device
            from linking import registry as links

            found = links.find_by_session(self)
            if found and found[1]["guest"] is not None:
                await found[1]["guest"].send_text(
                    json.dumps({"type": "signal", "data": msg.get("data")})
                )
        elif kind == "link_close":
            from linking import registry as links

            found = links.find_by_session(self)
            if found:
                token, link = found
                if link["guest"] is not None:
                    try:
                        await link["guest"].close()
                    except Exception:
                        pass
                links.drop(token)

    def resolve_pc(self, msg: dict) -> None:
        fut = self._pc_futures.pop(msg.get("id", ""), None)
        if fut and not fut.done():
            fut.set_result(msg)

    def device_names(self) -> list[str]:
        return list(self.devices.keys())

    def _select_devices(self, device: str | None) -> list[tuple[str, dict]] | dict:
        """Resolve a device selector to targets, or an error dict."""
        if not self.devices:
            return {
                "error": "no PC is paired. The user runs the companion on "
                "each computer and reads you its 6-digit code (pair_computer)."
            }
        if device in (None, "", "all", "everywhere", "all devices", "everyone"):
            return list(self.devices.items())
        key = device.strip().lower()
        # exact, then fuzzy contains
        for name, entry in self.devices.items():
            if name == key:
                return [(name, entry)]
        matches = [(n, e) for n, e in self.devices.items() if key in n or n in key]
        if matches:
            return matches
        return {
            "error": f"no paired device matches '{device}'. Paired: "
            + ", ".join(self.devices) + ". Omit device to target all."
        }

    async def _send_one(self, name: str, entry: dict, action: str,
                        target: str, extra: dict) -> dict:
        import uuid

        cmd_id = uuid.uuid4().hex[:10]
        fut = asyncio.get_running_loop().create_future()
        self._pc_futures[cmd_id] = fut
        try:
            await entry["ws"].send_text(json.dumps(
                {"type": "cmd", "id": cmd_id, "action": action,
                 "target": target, **extra}))
        except Exception:
            self.devices.pop(name, None)
            self._pc_futures.pop(cmd_id, None)
            await self._broadcast_devices()
            return {"error": f"device '{name}' disconnected"}
        try:
            result = await asyncio.wait_for(fut, timeout=30)
            return {k: v for k, v in result.items() if k in ("ok", "detail")}
        except asyncio.TimeoutError:
            self._pc_futures.pop(cmd_id, None)
            return {"error": f"device '{name}' did not answer in time"}

    async def pc_exec(self, action: str, target: str,
                      device: str | None = None, **extra) -> dict:
        """Run a command on one paired device, or fan out to all.
        `extra` carries content (write_file), dest (move), etc."""
        selected = self._select_devices(device)
        if isinstance(selected, dict):  # error
            return selected

        if len(selected) == 1:
            name, entry = selected[0]
            res = await self._send_one(name, entry, action, target, extra)
            res["device"] = name
            return res

        # fan out concurrently
        results = await asyncio.gather(*[
            self._send_one(name, entry, action, target, extra)
            for name, entry in selected
        ])
        return {"fanned_out_to": [n for n, _ in selected],
                "results": {n: r for (n, _), r in zip(selected, results)}}

    async def _broadcast_devices(self) -> None:
        await self.send({
            "type": "companion",
            "status": "online" if self.devices else "offline",
            "devices": self.device_names(),
        })

    async def request_frame(self, source: str = "camera") -> str:
        """Ask the client for one frame (base64 jpeg): camera or screen."""
        self._frame_future = asyncio.get_running_loop().create_future()
        await self.send({"type": "request_frame", "source": source})
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

    STOP_TRANSLATE = (
        "stop translating", "stop translation", "stop the translation",
        "end translation", "translation off",
    )

    async def _translate(self, user_text: str) -> None:
        """Live translation mode: no tools, no memory — just the bridge."""
        from brain.router import complete

        await self.send({"type": "state", "state": "thinking"})
        try:
            translated = await complete(
                [
                    {
                        "role": "system",
                        "content": f"You are a live interpreter. Translate the "
                        f"user's words into {self.translate_lang_name}. Output "
                        "ONLY the translation — no commentary, no quotes.",
                    },
                    {"role": "user", "content": user_text},
                ]
            )
        except Exception as exc:
            await self.send({"type": "error", "message": str(exc)})
            await self.send({"type": "state", "state": "error"})
            return
        await self.send({"type": "reply_delta", "text": translated})
        await self.send(
            {"type": "reply_done", "text": translated, "lang": self.translate_lang}
        )

    async def _auto_remember(self) -> None:
        """Quietly distil durable facts from the recent conversation into
        long-term memory. Runs in the background, one cheap LLM call."""
        from brain.router import complete

        recent = [m for m in self.history[-12:]
                  if m.get("role") in ("user", "assistant") and m.get("content")]
        if len(recent) < 2:
            return
        convo = "\n".join(f"{m['role']}: {m['content']}" for m in recent)
        prompt = (
            "From this conversation, extract only DURABLE facts worth "
            "remembering long-term about the user or their world (name, "
            "preferences, projects, people, decisions, ongoing tasks). "
            "Write each as one short third-person sentence starting 'The "
            "user'. Skip small talk and anything transient. If nothing is "
            "worth keeping, reply exactly NONE.\n\n" + convo
        )
        try:
            out = await complete([{"role": "user", "content": prompt}])
        except Exception:
            return
        if not out or "NONE" in out.upper()[:8]:
            return
        for line in out.splitlines():
            fact = line.strip("-• \t")
            if len(fact) > 8 and fact.lower().startswith("the user"):
                try:
                    await memory.remember(fact)
                except Exception:
                    pass

    async def _think(self, user_text: str) -> None:
        if self.translate_lang:
            if any(p in user_text.lower() for p in self.STOP_TRANSLATE):
                self.translate_lang = None
                self.translate_lang_name = None
                await self.send({"type": "translation", "lang": None})
                done = "The bridge closes. We speak plainly again."
                await self.send({"type": "reply_delta", "text": done})
                await self.send({"type": "reply_done", "text": done})
                return
            await self._translate(user_text)
            return

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
                    # Every few turns, quietly distil durable facts from the
                    # conversation into long-term memory — so Leviathan keeps
                    # remembering without being told to.
                    self._turns += 1
                    if self._turns % 4 == 0:
                        asyncio.create_task(self._auto_remember())
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
