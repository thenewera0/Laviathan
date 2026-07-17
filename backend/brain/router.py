"""Model routing with function calling.

Neutral history format (loop.py owns it):
  {role: system|user, content}
  {role: assistant, content, tool_calls?: [{id, name, args(dict)}]}
  {role: tool, tool_call_id, name, content(json str)}

stream_chat yields events:
  {kind: "text", text}                        — a token/delta to surface
  {kind: "tool_call", id, name, args(dict)}   — the model wants a tool

Providers: OpenRouter -> Gemini -> mock (keyless, for loop testing).
"""
import asyncio
import json
import random
import uuid
from typing import AsyncIterator

import httpx

from config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:streamGenerateContent?alt=sse"
)


async def complete(messages: list[dict]) -> str:
    """Non-streaming completion for internal work (planning, synthesis)."""
    parts: list[str] = []
    async for event in stream_chat(messages, tools=None):
        if event["kind"] == "text":
            parts.append(event["text"])
    return "".join(parts).strip()


async def stream_chat(
    messages: list[dict], tools: list[dict] | None = None
) -> AsyncIterator[dict]:
    provider = settings.provider
    if provider == "openrouter":
        gen = _stream_openrouter(messages, tools)
    elif provider == "gemini":
        gen = _stream_gemini(messages, tools)
    else:
        gen = _stream_mock(messages)
    async for event in gen:
        yield event


# ---------------------------------------------------------------- OpenRouter

def _to_openai_messages(messages: list[dict]) -> list[dict]:
    out = []
    for m in messages:
        if m["role"] == "assistant" and m.get("tool_calls"):
            out.append(
                {
                    "role": "assistant",
                    "content": m.get("content") or None,
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": json.dumps(tc["args"]),
                            },
                        }
                        for tc in m["tool_calls"]
                    ],
                }
            )
        elif m["role"] == "tool":
            out.append(
                {
                    "role": "tool",
                    "tool_call_id": m["tool_call_id"],
                    "content": m["content"],
                }
            )
        else:
            out.append({"role": m["role"], "content": m["content"]})
    return out


async def _stream_openrouter(
    messages: list[dict], tools: list[dict] | None
) -> AsyncIterator[dict]:
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Leviathan",
    }
    payload: dict = {
        "model": settings.openrouter_model,
        "messages": _to_openai_messages(messages),
        "stream": True,
        "max_tokens": 700,
    }
    if tools:
        payload["tools"] = [
            {"type": "function", "function": t} for t in tools
        ]

    # Streamed tool calls arrive as fragments keyed by index — assemble them
    pending: dict[int, dict] = {}

    async with httpx.AsyncClient(timeout=90) as client:
        async with client.stream(
            "POST", OPENROUTER_URL, headers=headers, json=payload
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    delta = json.loads(data)["choices"][0]["delta"]
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
                if delta.get("content"):
                    yield {"kind": "text", "text": delta["content"]}
                for frag in delta.get("tool_calls") or []:
                    slot = pending.setdefault(
                        frag.get("index", 0), {"id": "", "name": "", "args": ""}
                    )
                    if frag.get("id"):
                        slot["id"] = frag["id"]
                    fn = frag.get("function") or {}
                    if fn.get("name"):
                        slot["name"] += fn["name"]
                    if fn.get("arguments"):
                        slot["args"] += fn["arguments"]

    for slot in pending.values():
        if not slot["name"]:
            continue
        try:
            args = json.loads(slot["args"]) if slot["args"] else {}
        except json.JSONDecodeError:
            args = {}
        yield {
            "kind": "tool_call",
            "id": slot["id"] or f"call_{uuid.uuid4().hex[:8]}",
            "name": slot["name"],
            "args": args,
        }


# ------------------------------------------------------------------- Gemini

def _to_gemini_contents(messages: list[dict]) -> tuple[str, list[dict]]:
    system = "\n".join(m["content"] for m in messages if m["role"] == "system")
    contents: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            continue
        if m["role"] == "assistant":
            parts: list[dict] = []
            if m.get("content"):
                parts.append({"text": m["content"]})
            for tc in m.get("tool_calls") or []:
                parts.append(
                    {"functionCall": {"name": tc["name"], "args": tc["args"]}}
                )
            if parts:
                contents.append({"role": "model", "parts": parts})
        elif m["role"] == "tool":
            try:
                response = json.loads(m["content"])
            except json.JSONDecodeError:
                response = {"result": m["content"]}
            if not isinstance(response, dict):
                response = {"result": response}
            part = {
                "functionResponse": {"name": m["name"], "response": response}
            }
            # Consecutive tool results merge into one user turn
            if contents and contents[-1]["role"] == "user" and any(
                "functionResponse" in p for p in contents[-1]["parts"]
            ):
                contents[-1]["parts"].append(part)
            else:
                contents.append({"role": "user", "parts": [part]})
        else:
            contents.append({"role": "user", "parts": [{"text": m["content"]}]})
    return system, contents


async def _stream_gemini(
    messages: list[dict], tools: list[dict] | None
) -> AsyncIterator[dict]:
    system, contents = _to_gemini_contents(messages)
    payload: dict = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system}]},
        # thinkingBudget 0: 2.5-flash otherwise spends the token budget on
        # hidden reasoning and can return an EMPTY reply; a voice loop
        # wants fast, visible answers.
        "generationConfig": {
            "maxOutputTokens": 1500,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    if tools:
        payload["tools"] = [{"functionDeclarations": tools}]

    url = GEMINI_URL.format(model=settings.gemini_model)
    headers = {"x-goog-api-key": settings.gemini_api_key}
    async with httpx.AsyncClient(timeout=90) as client:
        async with client.stream(
            "POST", url, headers=headers, json=payload
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    chunk = json.loads(line[6:])
                    parts = chunk["candidates"][0]["content"]["parts"]
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
                for part in parts:
                    if part.get("text"):
                        yield {"kind": "text", "text": part["text"]}
                    if part.get("functionCall"):
                        fc = part["functionCall"]
                        yield {
                            "kind": "tool_call",
                            "id": f"call_{uuid.uuid4().hex[:8]}",
                            "name": fc.get("name", ""),
                            "args": fc.get("args") or {},
                        }


# --------------------------------------------------------------------- Mock

_MOCK_REPLIES = [
    "I hear you. My deeper reasoning is not yet connected — add an "
    "OpenRouter or Gemini key to the backend and I will truly wake.",
    "The current carries your words to me. Give my backend a model key, "
    "and I will answer with more than echoes.",
    "I am listening from the shallows. Connect a model provider and "
    "I will surface fully.",
]


async def _stream_mock(messages: list[dict]) -> AsyncIterator[dict]:
    reply = random.choice(_MOCK_REPLIES)
    for word in reply.split(" "):
        yield {"kind": "text", "text": word + " "}
        await asyncio.sleep(0.045)
