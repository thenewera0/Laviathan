"""Neural TTS — Leviathan's ONE signature voice, every single time.

Engine order is chosen for CONSISTENCY, not novelty:
1. edge-tts (Microsoft neural voices) — free, keyless, no quota. The same
   deep authoritative voice answers every request, so the voice never
   flip-flops the way the quota-limited Gemini preview did.
2. Gemini TTS — fallback only (tiny free-tier quota; 429s constantly).

The client still falls back to a pinned browser voice if BOTH fail.
Returns (audio_bytes, mime) so the endpoint can serve mp3 or wav.
"""
import base64
import struct

import httpx

from config import settings

# ---------------------------------------------------------------- edge-tts

# en-US-ChristopherNeural: deep, calm, authoritative — a composed super-mind.
# Alternatives: en-US-GuyNeural (anchor), en-GB-RyanNeural (British gravitas).
EDGE_RATE = "-4%"    # a touch slower: deliberate, never rushed
EDGE_PITCH = "-4Hz"  # slightly lower: weight without sounding synthetic


async def _edge_synthesize(text: str) -> bytes | None:
    try:
        import edge_tts
    except ImportError:
        return None
    try:
        com = edge_tts.Communicate(
            text, settings.edge_voice, rate=EDGE_RATE, pitch=EDGE_PITCH
        )
        chunks: list[bytes] = []
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        audio = b"".join(chunks)
        return audio if audio else None
    except Exception:
        return None


# ------------------------------------------------------------------ gemini

TTS_MODEL = "gemini-2.5-flash-preview-tts"
URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{TTS_MODEL}:generateContent"
)


def _pcm_to_wav(pcm: bytes, rate: int = 24000, channels: int = 1, bits: int = 16) -> bytes:
    byte_rate = rate * channels * bits // 8
    block_align = channels * bits // 8
    return (
        b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE"
        + b"fmt " + struct.pack("<IHHIIHH", 16, 1, channels, rate, byte_rate, block_align, bits)
        + b"data" + struct.pack("<I", len(pcm)) + pcm
    )


async def _gemini_synthesize(text: str, voice: str | None = None) -> bytes | None:
    if not settings.gemini_api_key:
        return None
    voice = voice or settings.tts_voice
    payload = {
        "contents": [{"parts": [{"text": text[:1400]}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}
            },
        },
    }
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                URL, headers={"x-goog-api-key": settings.gemini_api_key}, json=payload
            )
            if resp.status_code != 200:
                return None
            parts = resp.json()["candidates"][0]["content"]["parts"]
    except (httpx.HTTPError, KeyError, IndexError):
        return None
    for part in parts:
        inline = part.get("inlineData")
        if inline and inline.get("data"):
            return _pcm_to_wav(base64.b64decode(inline["data"]))
    return None


# --------------------------------------------------------------- public API

def available() -> bool:
    # edge-tts needs no key; if the package is importable, TTS is on.
    try:
        import edge_tts  # noqa: F401

        return True
    except ImportError:
        return bool(settings.gemini_api_key)


async def synthesize(text: str, voice: str | None = None) -> tuple[bytes, str] | None:
    """Return (audio, mime) for `text`, or None if every engine failed."""
    text = text.strip()
    if not text:
        return None
    audio = await _edge_synthesize(text[:2400])
    if audio:
        return audio, "audio/mpeg"
    audio = await _gemini_synthesize(text, voice)
    if audio:
        return audio, "audio/wav"
    return None
