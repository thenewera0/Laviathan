"""Neural TTS — Leviathan's ONE signature voice. Locked.

THE SIGNATURE VOICE IS FROZEN (2026-08-05, by explicit operator instruction).
It must never change again. Everything below exists to protect that.

  engine : edge-tts (Microsoft neural) — free, keyless, no quota
  voice  : en-US-ChristopherNeural
  rate   : -4%    deliberate, never rushed
  pitch  : -4Hz   weight without sounding synthetic

Why it is pinned in code and NOT read from the environment: an env var
silently overriding a pinned value is exactly how the gateway's model bug
hid for weeks. The signature is a constant here, and it is the only source
of truth. Setting LEVIATHAN_EDGE_VOICE will NOT change it.

Why edge-tts is retried instead of failing over quickly: the Gemini
fallback is a DIFFERENT voice (Charon). Speaking in a stranger's voice
breaks the lock, so a transient blip must be retried, not routed around.
Gemini remains only as a last resort before total silence.

Text is normalised before synthesis (`speakable`): markdown, emoji, code
fences and raw URLs are what make TTS sound synthetic — the voice reading
"asterisk asterisk" or spelling out a URL is the loudest AI tell there is.
"""
import asyncio
import base64
import re
import struct

import httpx

from config import settings

# ---------------------------------------------------------------- THE LOCK
# Do not parameterise these. Do not read them from env. Do not "improve" them.
SIGNATURE_VOICE = "en-US-ChristopherNeural"
SIGNATURE_RATE = "-4%"
SIGNATURE_PITCH = "-4Hz"

EDGE_ATTEMPTS = 3  # a blip must not cost us the signature


# ------------------------------------------------------- speakable text
# Everything here removes something a human would never say out loud.

_CODE_FENCE = re.compile(r"```.*?```", re.S)
_INLINE_CODE = re.compile(r"`([^`]*)`")
_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_BARE_URL = re.compile(r"https?://\S+|www\.\S+")
_HEADING = re.compile(r"^\s{0,3}#{1,6}\s*", re.M)
_BULLET = re.compile(r"^\s*[-*+]\s+", re.M)
_EMPHASIS = re.compile(r"(\*\*|__|\*|_)(.+?)\1", re.S)
_LEFTOVER_MD = re.compile(r"[*_~`>#|]")
_EMOJI = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002190-\U000021FF"
    "\U00002300-\U000023FF"
    "\U00002600-\U000027BF"
    "\U0000FE00-\U0000FE0F"
    "\U0001F000-\U0001F2FF"
    "]+"
)
_MULTI_SPACE = re.compile(r"[ \t]{2,}")
_MULTI_NL = re.compile(r"\n{2,}")

# Said aloud, these read as an assistant reciting a document.
_SPOKEN = {
    "e.g.": "for example",
    "i.e.": "that is",
    "etc.": "and so on",
    "vs.": "versus",
    "&": " and ",
    "%": " percent",
    "→": " to ",
    "…": "...",
}


def speakable(text: str) -> str:
    """Turn written text into something a person would actually say."""
    if not text:
        return ""
    t = text

    t = _CODE_FENCE.sub(" ", t)          # never read a code block aloud
    t = _INLINE_CODE.sub(r"\1", t)
    t = _MD_LINK.sub(r"\1", t)           # keep the label, drop the URL
    t = _BARE_URL.sub(" the link ", t)   # spelling out a URL is unlistenable
    t = _HEADING.sub("", t)
    t = _BULLET.sub("", t)
    t = _EMPHASIS.sub(r"\2", t)
    t = _EMOJI.sub("", t)

    for k, v in _SPOKEN.items():
        t = t.replace(k, v)

    t = _LEFTOVER_MD.sub("", t)

    # A blank line is a beat, not a run-on sentence.
    t = _MULTI_NL.sub(". ", t)
    t = t.replace("\n", ", ")
    t = _MULTI_SPACE.sub(" ", t)

    # Tidy the punctuation the substitutions above can leave behind.
    t = re.sub(r"\s+([,.!?;:])", r"\1", t)
    t = re.sub(r"([,.!?;:]){2,}", r"\1", t)
    t = re.sub(r",\s*\.", ".", t)
    t = re.sub(r"\s{2,}", " ", t)

    return t.strip(" ,.;:-").strip()


# ---------------------------------------------------------------- edge-tts

async def _edge_synthesize(text: str) -> bytes | None:
    try:
        import edge_tts
    except ImportError:
        return None

    for attempt in range(EDGE_ATTEMPTS):
        try:
            com = edge_tts.Communicate(
                text,
                SIGNATURE_VOICE,
                rate=SIGNATURE_RATE,
                pitch=SIGNATURE_PITCH,
            )
            chunks: list[bytes] = []
            async for chunk in com.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])
            audio = b"".join(chunks)
            if audio:
                return audio
        except Exception:
            pass
        if attempt < EDGE_ATTEMPTS - 1:
            await asyncio.sleep(0.4 * (attempt + 1))
    return None


# ------------------------------------------------------------------ gemini
# LAST RESORT ONLY. This is a different voice and therefore breaks the
# signature; it exists so Leviathan is not mute if edge-tts is truly down.

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
    try:
        import edge_tts  # noqa: F401

        return True
    except ImportError:
        return bool(settings.gemini_api_key)


async def synthesize(text: str, voice: str | None = None) -> tuple[bytes, str] | None:
    """Return (audio, mime) for `text`, or None if every engine failed.

    `voice` is accepted for API compatibility and deliberately ignored for
    the primary engine — the signature is not caller-overridable.
    """
    spoken = speakable(text)
    if not spoken:
        return None

    audio = await _edge_synthesize(spoken[:2400])
    if audio:
        return audio, "audio/mpeg"

    audio = await _gemini_synthesize(spoken, voice)
    if audio:
        return audio, "audio/wav"
    return None
