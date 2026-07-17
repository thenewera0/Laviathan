"""Optional server-side speech-to-text via faster-whisper.

Phase 1 default is the browser's Web Speech API (zero install, low
latency). Enable this path with LEVIATHAN_SERVER_STT=1 and uncomment
faster-whisper in requirements.txt — the /stt endpoint then accepts
audio and returns a transcript.
"""
from __future__ import annotations

import tempfile

from config import settings

_model = None


def available() -> bool:
    if not settings.server_stt:
        return False
    try:
        import faster_whisper  # noqa: F401

        return True
    except ImportError:
        return False


def transcribe(audio_bytes: bytes) -> str:
    global _model
    from faster_whisper import WhisperModel

    if _model is None:
        _model = WhisperModel(settings.whisper_model, compute_type="int8")
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_bytes)
        path = f.name
    segments, _info = _model.transcribe(path)
    return " ".join(seg.text.strip() for seg in segments).strip()
