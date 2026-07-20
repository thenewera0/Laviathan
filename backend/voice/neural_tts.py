"""Neural TTS via Gemini — gives Leviathan a real, distinctive voice
instead of the flat browser synth. Returns WAV bytes the client plays.

Uses the GEMINI_API_KEY that already lives on the backend. The client
falls back to browser speech synthesis if this is unavailable or errors.
"""
import base64
import struct

import httpx

from config import settings

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


def available() -> bool:
    return bool(settings.gemini_api_key)


async def synthesize(text: str, voice: str | None = None) -> bytes | None:
    """Return WAV audio for `text`, or None on any failure (client falls back)."""
    if not settings.gemini_api_key or not text.strip():
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
