"""Smart, Task-Aware Multi-Provider AI Gateway for Leviathan AI.

Features:
- Task Classifier: Routes Code/Math to Groq/Qwen, Vision to Gemini, Fast Chat to Groq/Mistral, Long-Doc to Gemini.
- Rate & Quota Budget Manager: Sliding-window RPM tracker that proactively balances load before 429s occur.
- Circuit Breaker & Fallback: Automatic 429 detection, 60s cooldown, jittered retry chain.
"""
import asyncio
import json
import logging
import random
import time
from typing import AsyncIterator, Dict, List, Optional, Tuple

import httpx
from config import settings

logger = logging.getLogger("LeviathanGateway")
logging.basicConfig(level=logging.INFO)

# --- Provider Quotas & Safety Margins ---
PROVIDER_RPM_LIMITS = {
    "groq": 25,        # Free tier limit ~30 RPM
    "gemini": 12,      # Free tier limit ~15 RPM
    "mistral": 25,     # Free tier limit ~30 RPM
    "cohere": 10,      # Free tier limit ~20 RPM
    "openrouter": 45,  # Free pool limit
    "mock": 9999,
}

# Provider Sliding Window Request Counters: provider -> list of timestamps
PROVIDER_REQUEST_WINDOWS: Dict[str, List[float]] = {}

# Circuit Breaker States: provider -> {"state": "CLOSED"|"OPEN"|"HALF_OPEN", "cooldown_until": float, "errors": int}
CIRCUIT_BREAKER: Dict[str, Dict] = {}
COOLDOWN_DURATION = 60.0  # 60 seconds cooldown on 429/failures


def _get_circuit_state(provider: str) -> str:
    info = CIRCUIT_BREAKER.setdefault(provider, {"state": "CLOSED", "cooldown_until": 0.0, "errors": 0})
    if info["state"] == "OPEN":
        if time.time() > info["cooldown_until"]:
            info["state"] = "HALF_OPEN"
            logger.info(f"Circuit for {provider} transitioned to HALF_OPEN (probing recovery).")
            return "HALF_OPEN"
        return "OPEN"
    return info["state"]


def _trip_circuit(provider: str):
    info = CIRCUIT_BREAKER.setdefault(provider, {"state": "CLOSED", "cooldown_until": 0.0, "errors": 0})
    info["state"] = "OPEN"
    info["cooldown_until"] = time.time() + COOLDOWN_DURATION
    info["errors"] += 1
    logger.warning(f"Circuit TRIPPED for provider {provider}. Cooldown for {COOLDOWN_DURATION}s.")


def _record_success(provider: str):
    info = CIRCUIT_BREAKER.setdefault(provider, {"state": "CLOSED", "cooldown_until": 0.0, "errors": 0})
    if info["state"] == "HALF_OPEN":
        info["state"] = "CLOSED"
        info["errors"] = 0
        logger.info(f"Circuit for {provider} fully RECOVERED to CLOSED.")


def _record_request_timestamp(provider: str):
    now = time.time()
    window = PROVIDER_REQUEST_WINDOWS.setdefault(provider, [])
    window.append(now)
    # Prune timestamps older than 60 seconds
    PROVIDER_REQUEST_WINDOWS[provider] = [t for t in window if now - t < 60.0]


def _get_provider_current_rpm(provider: str) -> int:
    now = time.time()
    window = PROVIDER_REQUEST_WINDOWS.get(provider, [])
    valid = [t for t in window if now - t < 60.0]
    PROVIDER_REQUEST_WINDOWS[provider] = valid
    return len(valid)


class TaskClassifier:
    """Classify user intent to pick the absolute best free-tier AI provider."""

    @staticmethod
    def classify(messages: List[Dict[str, str]], has_files: bool = False) -> str:
        if has_files:
            return "VISION"

        last_user_text = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_text = m.get("content", "")
                break

        length = len(last_user_text)
        lower = last_user_text.lower()

        # Check for code/math/technical prompts
        code_keywords = ["code", "function", "def ", "class ", "python", "javascript", "sql", "bug", "algorithm", "math", "equation"]
        if any(k in lower for k in code_keywords):
            return "REASONING_CODE"

        # Check for long document / context
        if length > 3000:
            return "LONG_CONTEXT"

        # Simple conversational
        if length < 150:
            return "CONVERSATIONAL_FAST"

        return "GENERAL"


class SmartAIGateway:
    """Enterprise-grade Task-Aware AI Gateway with RPM Budgeting & Failover."""

    def __init__(self):
        self.classifier = TaskClassifier()

    def get_configured_providers(self) -> List[str]:
        provs = []
        if settings.gemini_api_key:
            provs.append("gemini")
        if settings.groq_api_key:
            provs.append("groq")
        if settings.openrouter_api_key:
            provs.append("openrouter")
        if settings.mistral_api_key:
            provs.append("mistral")
        if settings.cohere_api_key:
            provs.append("cohere")
        if settings.hf_token:
            provs.append("huggingface")
        if not provs:
            provs.append("mock")
        return provs

    def build_smart_provider_chain(
        self,
        task_intent: str,
        user_model_preference: Optional[str] = None,
    ) -> List[str]:
        """Build priority provider chain based on Task Intent & RPM Headroom."""
        configured = self.get_configured_providers()

        # Task-based base preference order
        if task_intent == "VISION":
            intent_order = ["gemini", "openrouter", "huggingface", "groq", "mistral"]
        elif task_intent == "REASONING_CODE":
            intent_order = ["groq", "openrouter", "gemini", "mistral", "cohere"]
        elif task_intent == "LONG_CONTEXT":
            intent_order = ["gemini", "openrouter", "cohere", "groq", "mistral"]
        elif task_intent == "CONVERSATIONAL_FAST":
            intent_order = ["groq", "gemini", "mistral", "cohere", "openrouter"]
        else:
            intent_order = ["gemini", "groq", "openrouter", "mistral", "cohere", "huggingface"]

        # Override if user requested specific model
        if user_model_preference:
            pref = user_model_preference.lower()
            if "gemini" in pref and "gemini" in configured:
                intent_order = ["gemini"] + [p for p in intent_order if p != "gemini"]
            elif ("groq" in pref or "llama" in pref or "qwen" in pref) and "groq" in configured:
                intent_order = ["groq"] + [p for p in intent_order if p != "groq"]
            elif "mistral" in pref and "mistral" in configured:
                intent_order = ["mistral"] + [p for p in intent_order if p != "mistral"]
            elif "cohere" in pref and "cohere" in configured:
                intent_order = ["cohere"] + [p for p in intent_order if p != "cohere"]
            elif "huggingface" in pref and "huggingface" in configured:
                intent_order = ["huggingface"] + [p for p in intent_order if p != "huggingface"]

        # Filter and score providers by health state & RPM budget headroom
        usable_providers = []
        overflow_providers = []

        for p in intent_order:
            if p not in configured:
                continue

            state = _get_circuit_state(p)
            if state == "OPEN":
                logger.info(f"Skipping {p} (Circuit OPEN, on cooldown).")
                continue

            # Check RPM capacity
            cur_rpm = _get_provider_current_rpm(p)
            max_rpm = PROVIDER_RPM_LIMITS.get(p, 30)

            if cur_rpm >= max_rpm:
                logger.info(f"Provider {p} at RPM capacity ({cur_rpm}/{max_rpm}). Moving to overflow queue.")
                overflow_providers.append(p)
            else:
                usable_providers.append(p)

        chain = usable_providers + overflow_providers
        if not chain:
            chain = ["mock"]  # Ultimate fallback
        return chain

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        has_files: bool = False,
    ) -> Dict[str, str]:
        """Execute chat request with task-aware routing, budget checks, and circuit-breaker retries."""
        task_intent = self.classifier.classify(messages, has_files)
        logger.info(f"Gateway Classified Task Intent: {task_intent}")

        formatted_messages = list(messages)
        if system_prompt:
            formatted_messages.insert(0, {"role": "system", "content": system_prompt})

        chain = self.build_smart_provider_chain(task_intent, model)
        attempts = []
        last_err = None

        for provider in chain:
            attempts.append(provider)
            _record_request_timestamp(provider)

            try:
                logger.info(f"Routing request to provider: '{provider}' (Task: {task_intent})")
                reply = await self._execute_provider(provider, formatted_messages, model, temperature)
                _record_success(provider)

                return {
                    "success": True,
                    "reply": reply,
                    "provider": provider,
                    "task_intent": task_intent,
                    "model": model or self._default_model_for_provider(provider),
                    "attempts": attempts,
                }
            except Exception as exc:
                err_str = str(exc)
                logger.error(f"Execution failed on provider '{provider}': {err_str}")
                last_err = exc

                if "429" in err_str or "rate limit" in err_str.lower() or "quota" in err_str.lower():
                    _trip_circuit(provider)

                # Jittered backoff delay before trying next provider
                await asyncio.sleep(random.uniform(0.2, 0.6))

        return {
            "success": False,
            "reply": f"All AI providers rate-limited or unavailable ({last_err}).",
            "provider": "none",
            "task_intent": task_intent,
            "model": "error",
            "attempts": attempts,
        }

    async def _execute_provider(
        self, provider: str, messages: List[Dict[str, str]], model: Optional[str], temperature: float
    ) -> str:
        if provider == "gemini":
            return await self._call_gemini(messages, model, temperature)
        elif provider == "groq":
            return await self._call_groq(messages, model, temperature)
        elif provider == "openrouter":
            return await self._call_openrouter(messages, model, temperature)
        elif provider == "mistral":
            return await self._call_mistral(messages, model, temperature)
        elif provider == "cohere":
            return await self._call_cohere(messages, model, temperature)
        elif provider == "huggingface":
            return await self._call_huggingface(messages, model, temperature)
        else:
            return await self._call_mock(messages)

    def _default_model_for_provider(self, provider: str) -> str:
        defaults = {
            "gemini": settings.gemini_model,
            "groq": settings.groq_model,
            "openrouter": settings.openrouter_model,
            "mistral": settings.mistral_model,
            "cohere": settings.cohere_model,
            "huggingface": "meta-llama/Llama-3.2-3B-Instruct",
            "mock": "leviathan-mock",
        }
        return defaults.get(provider, "default")

    # --- API Implementations ---

    async def _call_gemini(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float) -> str:
        selected_model = model if model and "gemini" in model else settings.gemini_model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{selected_model}:generateContent?key={settings.gemini_api_key}"

        contents = []
        system_instruction = None

        for m in messages:
            role = m.get("role")
            content = m.get("content", "")
            if role == "system":
                system_instruction = {"parts": [{"text": content}]}
            elif role == "user":
                contents.append({"role": "user", "parts": [{"text": content}]})
            elif role == "assistant":
                contents.append({"role": "model", "parts": [{"text": content}]})

        payload: Dict = {
            "contents": contents,
            "generationConfig": {"temperature": temperature, "maxOutputTokens": 2048},
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    async def _call_groq(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float) -> str:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        selected_model = model if model and ("llama" in model or "groq" in model or "qwen" in model) else settings.groq_model
        payload = {
            "model": selected_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 2048,
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Groq HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_openrouter(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float) -> str:
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://leviathan.ai",
            "X-Title": "Leviathan Gateway",
        }
        selected_model = model or settings.openrouter_model
        payload = {
            "model": selected_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 2048,
            "provider": {"allow_fallbacks": True},
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenRouter HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_mistral(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float) -> str:
        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.mistral_api_key}",
            "Content-Type": "application/json",
        }
        selected_model = model if model and "mistral" in model else settings.mistral_model
        payload = {
            "model": selected_model,
            "messages": messages,
            "temperature": temperature,
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Mistral HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_cohere(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float) -> str:
        url = "https://api.cohere.com/v1/chat"
        headers = {
            "Authorization": f"Bearer {settings.cohere_api_key}",
            "Content-Type": "application/json",
        }
        last_msg = messages[-1]["content"] if messages else ""
        payload = {
            "message": last_msg,
            "model": settings.cohere_model,
            "temperature": temperature,
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Cohere HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            return data.get("text", "")

    async def _call_huggingface(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float) -> str:
        url = "https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.hf_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "meta-llama/Llama-3.2-3B-Instruct",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1024,
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"HuggingFace HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_mock(self, messages: List[Dict[str, str]]) -> str:
        await asyncio.sleep(0.3)
        last_user = messages[-1]["content"] if messages else "Hello"
        return f"[Leviathan Mock Response]: Processed '{last_user}'. All configured API keys are active."

    def get_gateway_stats(self) -> Dict:
        """Return real-time health, RPM usage, and circuit status for monitoring."""
        stats = {}
        for p in ["gemini", "groq", "openrouter", "mistral", "cohere", "huggingface"]:
            rpm = _get_provider_current_rpm(p)
            limit = PROVIDER_RPM_LIMITS.get(p, 30)
            state = _get_circuit_state(p)
            stats[p] = {
                "state": state,
                "current_rpm": rpm,
                "max_rpm": limit,
                "utilization_pct": round((rpm / limit) * 100, 1),
            }
        return stats


gateway = SmartAIGateway()
