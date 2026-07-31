"""Leviathan configuration. All keys live HERE, loaded from backend/.env.

Clients never see a key — they speak to this backend over WebSocket only.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


class Settings:
    # Model providers
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    mistral_api_key: str = os.getenv("MISTRAL_API_KEY", "")
    cohere_api_key: str = os.getenv("COHERE_API_KEY", "")
    hf_token: str = os.getenv("HF_TOKEN", "")

    # Gateway Authentication
    leviathan_master_key: str = os.getenv("LEVIATHAN_MASTER_KEY", "lvh-master-7f8e9d0a1b2c3d4e5f6")

    # Provider Models
    openrouter_model: str = os.getenv(
        "OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"
    )
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    mistral_model: str = os.getenv("MISTRAL_MODEL", "mistral-small-latest")
    cohere_model: str = os.getenv("COHERE_MODEL", "command-r-plus")

    # Long-term memory: Supabase Postgres/pgvector when set, else local SQLite.
    supabase_db_url: str = os.getenv("SUPABASE_DB_URL", "")

    # Tool providers
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")
    exa_api_key: str = os.getenv("EXA_API_KEY", "")
    ocr_space_api_key: str = os.getenv("OCR_SPACE_API_KEY", "")
    openweather_api_key: str = os.getenv("OPENWEATHER_API_KEY", "")
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
    supabase_publishable_key: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    nasa_api_key: str = os.getenv("NASA_API_KEY", "")
    github_token: str = os.getenv("GITHUB_TOKEN", "")
    rawg_api_key: str = os.getenv("RAWG_API_KEY", "")
    coingecko_api_key: str = os.getenv("COINGECKO_API_KEY", "")
    n8n_url: str = os.getenv("N8N_URL", "https://leviathan-n8n.onrender.com")
    n8n_api_key: str = os.getenv("N8N_API_KEY", "")

    # run_code sandbox — Docker ONLY, never the host
    docker_image: str = os.getenv("LEVIATHAN_DOCKER_IMAGE", "python:3.11-slim")
    code_timeout: int = int(os.getenv("LEVIATHAN_CODE_TIMEOUT", "20"))

    # Signature voice
    edge_voice: str = os.getenv("LEVIATHAN_EDGE_VOICE", "en-US-ChristopherNeural")
    tts_voice: str = os.getenv("LEVIATHAN_TTS_VOICE", "Charon")

    # Server-side STT
    server_stt: bool = os.getenv("LEVIATHAN_SERVER_STT", "0") == "1"
    whisper_model: str = os.getenv("WHISPER_MODEL", "base")

    host: str = os.getenv("LEVIATHAN_HOST", "0.0.0.0")
    port: int = int(os.getenv("LEVIATHAN_PORT", "8000"))

    @property
    def provider(self) -> str:
        if self.gemini_api_key:
            return "gemini"
        if self.groq_api_key:
            return "groq"
        if self.openrouter_api_key:
            return "openrouter"
        if self.mistral_api_key:
            return "mistral"
        return "mock"

    @property
    def active_model(self) -> str:
        prov = self.provider
        if prov == "gemini":
            return self.gemini_model
        if prov == "groq":
            return self.groq_model
        if prov == "openrouter":
            return self.openrouter_model
        if prov == "mistral":
            return self.mistral_model
        return "leviathan-mock"


settings = Settings()
