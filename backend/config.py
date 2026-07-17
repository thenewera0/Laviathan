"""Leviathan configuration. All keys live HERE, loaded from backend/.env.

Clients never see a key — they speak to this backend over WebSocket only.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


class Settings:
    # Model providers — first configured provider wins. With neither key set,
    # Leviathan runs a mock brain so the voice loop is testable end-to-end.
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")

    openrouter_model: str = os.getenv(
        "OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"
    )
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Long-term memory: Supabase Postgres/pgvector when set (use the
    # SESSION POOLER string, IPv4-safe), else local SQLite.
    supabase_db_url: str = os.getenv("SUPABASE_DB_URL", "")

    # Tool providers (all optional — every tool has a keyless default
    # or degrades honestly)
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")  # else: DuckDuckGo
    hf_token: str = os.getenv("HF_TOKEN", "")  # else: Pollinations image gen

    # run_code sandbox — Docker ONLY, never the host
    docker_image: str = os.getenv("LEVIATHAN_DOCKER_IMAGE", "python:3.11-slim")
    code_timeout: int = int(os.getenv("LEVIATHAN_CODE_TIMEOUT", "20"))

    # Server-side STT (optional; requires faster-whisper in requirements.txt)
    server_stt: bool = os.getenv("LEVIATHAN_SERVER_STT", "0") == "1"
    whisper_model: str = os.getenv("WHISPER_MODEL", "base")

    host: str = os.getenv("LEVIATHAN_HOST", "0.0.0.0")
    port: int = int(os.getenv("LEVIATHAN_PORT", "8000"))

    @property
    def provider(self) -> str:
        if self.openrouter_api_key:
            return "openrouter"
        if self.gemini_api_key:
            return "gemini"
        return "mock"

    @property
    def active_model(self) -> str:
        return {
            "openrouter": self.openrouter_model,
            "gemini": self.gemini_model,
            "mock": "leviathan-mock",
        }[self.provider]


settings = Settings()
