"""Chat-completion client for any OpenAI-compatible endpoint (Groq, Gemini, OpenRouter, Ollama, ...)."""

import json
import re
from functools import lru_cache
from typing import Any, Optional

from app.core.config import settings
from app.core.exceptions import LLMError
from app.core.logging import get_logger

logger = get_logger(__name__)

_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_CODE_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def parse_json_object(content: Optional[str]) -> dict:
    """Parse a JSON object out of model output.

    Free/open models don't always honour JSON mode: they may wrap the object in a markdown
    fence, prepend chatter, or emit <think> reasoning first.
    """
    if not content or not content.strip():
        raise LLMError("Model returned an empty response")

    text = _THINK_BLOCK.sub("", content).strip()
    text = _CODE_FENCE.sub("", text).strip()
    candidates = [text]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])

    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    raise LLMError("Model response was not a valid JSON object", details={"preview": text[:200]})


class LLMService:
    def __init__(self, client: Any = None):
        self._client = client
        self._json_mode = settings.llm.json_mode

    @property
    def model_name(self) -> str:
        return settings.llm.model

    @property
    def is_configured(self) -> bool:
        return settings.llm.is_configured

    def _get_client(self):
        if self._client is None:
            from openai import AsyncOpenAI

            cfg = settings.llm
            self._client = AsyncOpenAI(
                api_key=cfg.api_key or "not-needed",  # the SDK insists on a non-empty key
                base_url=cfg.base_url,
                timeout=cfg.timeout,
                max_retries=cfg.max_retries,
            )
        return self._client

    async def chat_json(self, system: str, user: str) -> dict:
        """Run one chat completion and return the parsed JSON object."""
        if not self.is_configured:
            raise LLMError(
                "LLM is not configured: set LLM_API_KEY (free key from console.groq.com), "
                "or point LLM_BASE_URL at a local Ollama server"
            )

        cfg = settings.llm
        kwargs: dict[str, Any] = {
            "model": cfg.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": cfg.temperature,
            "max_tokens": cfg.max_tokens,
        }
        client = self._get_client()

        try:
            if self._json_mode:
                try:
                    response = await client.chat.completions.create(
                        response_format={"type": "json_object"}, **kwargs
                    )
                except Exception as e:
                    if not _rejects_json_mode(e):
                        raise
                    logger.warning("llm_json_mode_unsupported_retrying_plain", model=cfg.model)
                    self._json_mode = False
                    response = await client.chat.completions.create(**kwargs)
            else:
                response = await client.chat.completions.create(**kwargs)
        except LLMError:
            raise
        except Exception as e:
            raise LLMError(f"LLM request to {cfg.base_url} failed: {e}") from e

        choice = response.choices[0]
        if getattr(choice, "finish_reason", None) == "length":
            logger.warning("llm_response_truncated", model=cfg.model, max_tokens=cfg.max_tokens)
        return parse_json_object(choice.message.content)


def _rejects_json_mode(error: Exception) -> bool:
    text = str(error).lower()
    return getattr(error, "status_code", None) == 400 and ("response_format" in text or "json" in text)


@lru_cache(maxsize=1)
def get_llm_service() -> LLMService:
    return LLMService()
