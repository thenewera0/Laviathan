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

# ---------------------------------------------------------------- model names
# /v1/models advertises friendly catalogue IDs. They are OURS, not any
# provider's, so they must be resolved before a request leaves the gateway.
# "leviathan-auto" means "you pick" -> None -> every provider uses its default.
VIRTUAL_MODELS = {"leviathan-auto", "auto", "default", "leviathan", ""}

# Friendly catalogue ID -> the real slug at the provider that serves it.
# Every value here was checked against the provider's live /models list.
MODEL_ALIASES = {
    "llama-3.3-70b": "llama-3.3-70b-versatile",          # groq
    "qwen-2.5-72b": "qwen/qwen3.6-27b",                  # groq (old qwen retired)
    "mistral-small": "mistral-small-latest",             # mistral
    "command-r-plus": "command-a-03-2025",               # cohere (retired 2025-09-15)
    "deepseek-r1": "deepseek/deepseek-r1",               # openrouter (no :free tier)
}

# If the chosen free slug is retired or throttled, try these before giving up.
# Free slugs churn constantly; one dead default must not kill the fallback.
OPENROUTER_FREE_FALLBACKS = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-20b:free",
    "inclusionai/ling-3.0-flash:free",
]


def _normalize_model(model: Optional[str]) -> Optional[str]:
    """Resolve an advertised catalogue ID to a real one (or None for auto)."""
    if model is None:
        return None
    name = str(model).strip()
    if name.lower() in VIRTUAL_MODELS:
        return None
    return MODEL_ALIASES.get(name, name)


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
    info["errors"] += 1
    # Only OPEN after repeated failures — a single transient 429 must not
    # blackball a provider for a full minute (that broke whole batches).
    if info["errors"] >= 3:
        info["state"] = "OPEN"
        info["cooldown_until"] = time.time() + COOLDOWN_DURATION
        logger.warning(f"Circuit TRIPPED for provider {provider} after {info['errors']} errors.")


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
    """Classify user intent to pick the absolute best AI provider."""

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

        # Check for long-form article/caption/content generation
        longform_keywords = ["article", "essay", "blog", "words", "caption", "write", "post", "desknomads", "long form"]
        if length > 1200 or any(k in lower for k in longform_keywords):
            return "LONG_CONTEXT"

        # Check for code/math/technical prompts
        code_keywords = ["code", "function", "def ", "class ", "python", "javascript", "sql", "bug", "algorithm", "math", "equation"]
        if any(k in lower for k in code_keywords):
            return "REASONING_CODE"

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

        # Task-based base preference order.
        # OpenRouter sits LAST in every chain: it is metered by account credit,
        # and when the balance runs down its free tier collapses to ~50
        # requests/day. Gemini/Groq/Mistral/Cohere free tiers refill hourly or
        # by the minute, so they must all be exhausted before we spend credit.
        if task_intent == "VISION":
            intent_order = ["gemini", "huggingface", "groq", "mistral", "openrouter"]
        elif task_intent == "REASONING_CODE":
            intent_order = ["groq", "gemini", "mistral", "cohere", "openrouter"]
        elif task_intent == "LONG_CONTEXT":
            intent_order = ["gemini", "groq", "mistral", "cohere", "openrouter"]
        elif task_intent == "CONVERSATIONAL_FAST":
            intent_order = ["groq", "gemini", "mistral", "cohere", "openrouter"]
        else:
            intent_order = ["gemini", "groq", "mistral", "cohere", "huggingface", "openrouter"]

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

        real = [p for p in intent_order if p in configured and p != "mock"]

        usable_providers = []
        overflow_providers = []
        circuit_open = []

        for p in real:
            state = _get_circuit_state(p)
            if state == "OPEN":
                circuit_open.append(p)
                continue
            cur_rpm = _get_provider_current_rpm(p)
            max_rpm = PROVIDER_RPM_LIMITS.get(p, 30)
            if cur_rpm >= max_rpm:
                overflow_providers.append(p)
            else:
                usable_providers.append(p)

        # Prefer healthy providers, then RPM-overflow, then even the
        # circuit-open ones as a last resort — a real attempt (which fails
        # over on a genuine error) always beats serving a mock string to an
        # API client, so we NEVER inject mock when any real key exists.
        chain = usable_providers + overflow_providers + circuit_open
        if not chain:
            chain = ["mock"] if not real else real
        return chain

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        has_files: bool = False,
        response_format: Optional[Dict] = None,
    ) -> Dict[str, str]:
        """Execute chat request with task-aware routing, high output token allowance, and circuit-breaker retries."""
        # Callers legitimately send the catalogue IDs we advertise on
        # /v1/models — including the virtual "leviathan-auto". Those are OUR
        # names, not any provider's, so resolve them here. Forwarding
        # "leviathan-auto" verbatim is what broke the OpenRouter fallback.
        model = _normalize_model(model)

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
                reply = await self._execute_provider(provider, formatted_messages, model, temperature, max_tokens, response_format)
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

                low = err_str.lower()
                throttled = (
                    "429" in err_str
                    or "rate limit" in low
                    or "quota" in low
                )
                # A drained account is not a transient blip — retrying it just
                # burns time on every later request. Treat it like a throttle
                # so the breaker parks the provider instead of hammering it.
                broke = (
                    "402" in err_str
                    or "insufficient" in low
                    or "credit" in low
                    or "negative balance" in low
                    or "payment required" in low
                )
                if throttled or broke:
                    if broke:
                        logger.warning(
                            f"Provider '{provider}' is out of credit — parking it."
                        )
                        # Skip straight to OPEN; there is nothing to retry into.
                        CIRCUIT_BREAKER[provider] = {
                            "state": "OPEN",
                            "cooldown_until": time.time() + COOLDOWN_DURATION * 5,
                            "errors": 99,
                        }
                    else:
                        _trip_circuit(provider)

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
        self,
        provider: str,
        messages: List[Dict[str, str]],
        model: Optional[str],
        temperature: float,
        max_tokens: Optional[int] = None,
        response_format: Optional[Dict] = None,
    ) -> str:
        tokens_budget = max_tokens or 8192  # High output token limit for long articles

        if provider == "gemini":
            return await self._call_gemini(messages, model, temperature, tokens_budget, response_format)
        elif provider == "groq":
            return await self._call_groq(messages, model, temperature, tokens_budget, response_format)
        elif provider == "openrouter":
            return await self._call_openrouter(messages, model, temperature, tokens_budget, response_format)
        elif provider == "mistral":
            return await self._call_mistral(messages, model, temperature, tokens_budget, response_format)
        elif provider == "cohere":
            return await self._call_cohere(messages, model, temperature)
        elif provider == "huggingface":
            return await self._call_huggingface(messages, model, temperature, tokens_budget)
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

    async def _call_gemini(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float, max_tokens: int = 8192, response_format: Optional[Dict] = None) -> str:
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

        gen_config: Dict = {"temperature": temperature, "maxOutputTokens": max_tokens}
        if response_format and response_format.get("type") in ("json_object", "json_schema"):
            gen_config["responseMimeType"] = "application/json"

        payload: Dict = {
            "contents": contents,
            "generationConfig": gen_config,
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            candidates = data.get("candidates") or []
            if not candidates:
                fb = data.get("promptFeedback", {})
                raise RuntimeError(f"Gemini returned no candidates (feedback={fb})")
            cand = candidates[0]
            parts = (cand.get("content") or {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts).strip()
            if not text:
                raise RuntimeError(f"Gemini empty text (finishReason={cand.get('finishReason')})")
            return text

    async def _call_groq(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float, max_tokens: int = 8192, response_format: Optional[Dict] = None) -> str:
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
            "max_tokens": min(8192, max_tokens),
        }
        if response_format:
            payload["response_format"] = response_format

        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Groq HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_openrouter(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float, max_tokens: int = 8192, response_format: Optional[Dict] = None) -> str:
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://leviathan.ai",
            "X-Title": "Leviathan Gateway",
        }
        # Only honour a caller's model if it is actually an OpenRouter slug
        # ("vendor/model"). Every other provider already guards this way;
        # OpenRouter did not, so names like "leviathan-auto" or "gemini-2.5-
        # flash" were forwarded verbatim and rejected as invalid model IDs.
        wanted = model if (model and "/" in model) else settings.openrouter_model

        # Try the wanted slug, then known-good free ones. A retired or
        # throttled free model must not take the whole fallback down with it.
        candidates = [wanted] + [m for m in OPENROUTER_FREE_FALLBACKS if m != wanted]

        last = ""
        async with httpx.AsyncClient(timeout=180.0) as client:
            for slug in candidates:
                payload = {
                    "model": slug,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "provider": {"allow_fallbacks": True},
                }
                if response_format:
                    payload["response_format"] = response_format

                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices") or []
                    if choices:
                        return choices[0]["message"]["content"]
                    last = f"no choices from {slug}: {str(data)[:160]}"
                    continue

                last = f"HTTP {resp.status_code} on {slug}: {resp.text[:160]}"
                # 4xx here means this slug is wrong/retired/unavailable — move
                # to the next candidate. Anything else is worth failing fast on.
                if resp.status_code not in (400, 402, 404, 429):
                    break

        raise RuntimeError(f"OpenRouter: {last}")

    async def _call_mistral(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float, max_tokens: int = 8192, response_format: Optional[Dict] = None) -> str:
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
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        async with httpx.AsyncClient(timeout=180.0) as client:
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
