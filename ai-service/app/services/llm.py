"""Chat-completion client for any OpenAI-compatible endpoint (Groq, Gemini, OpenRouter, Ollama, ...)."""

import asyncio
import json
import re
import time
from functools import lru_cache
from typing import Any, Optional

from app.core.config import settings
from app.core.exceptions import LLMError, LLMUnavailableError
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
        self._schema_mode = settings.llm.json_schema
        self._sem: Optional[asyncio.Semaphore] = None

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

    def _semaphore(self) -> asyncio.Semaphore:
        # Created lazily so it binds to the running event loop; one slot per concurrent model request.
        if self._sem is None:
            self._sem = asyncio.Semaphore(max(1, settings.llm.concurrency))
        return self._sem

    async def chat_json(
        self, system: str, user: str, schema: Optional[dict] = None, max_tokens: Optional[int] = None
    ) -> dict:
        """Run one chat completion and return the parsed JSON object.

        With ``schema`` (a JSON Schema) the server is asked to constrain decoding to it when it supports that
        (Ollama >= 0.5); otherwise this degrades to JSON mode and then to plain text parsing. Callers must still
        validate the result (Pydantic), as constrained decoding guarantees shape, not truth.
        """
        if not self.is_configured:
            raise LLMError(
                "LLM is not configured: point LLM_BASE_URL at a local Ollama server "
                "(default http://localhost:11434/v1) or set LLM_API_KEY for a hosted endpoint"
            )

        cfg = settings.llm
        if cfg.no_think and cfg.model.lower().startswith("qwen3") and "/no_think" not in system:
            system = f"{system}\n/no_think"
        kwargs: dict[str, Any] = {
            "model": cfg.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": cfg.temperature,
            "max_tokens": max_tokens or cfg.max_tokens,
        }
        if cfg.no_think and cfg.model.lower().startswith("qwen3") and any(h in cfg.base_url for h in ("localhost", "127.0.0.1", "host.docker.internal")):
            # "/no_think" is ignored once the answer is constrained to a JSON schema, so the model spends the whole
            # token budget reasoning and returns nothing. Ollama's OpenAI endpoint honours this switch.
            kwargs["extra_body"] = {"reasoning_effort": "none"}
        client = self._get_client()

        formats: list[Optional[dict]] = []
        if schema is not None and cfg.json_schema and self._schema_mode:
            formats.append(
                {"type": "json_schema", "json_schema": {"name": "result", "schema": schema, "strict": True}}
            )
        if self._json_mode:
            formats.append({"type": "json_object"})
        formats.append(None)

        response = None
        queued_at = time.monotonic()
        async with self._semaphore():
            started_at = time.monotonic()
            for index, response_format in enumerate(formats):
                call = dict(kwargs)
                if response_format is not None:
                    call["response_format"] = response_format
                try:
                    response = await client.chat.completions.create(**call)
                    break
                except LLMError:
                    raise
                except Exception as e:
                    if _is_unavailable(e):
                        raise LLMUnavailableError(f"LLM server at {cfg.base_url} is unavailable: {e}") from e
                    if response_format is not None and _rejects_json_mode(e) and index < len(formats) - 1:
                        kind = response_format["type"]
                        logger.warning("llm_response_format_unsupported_degrading", model=cfg.model, format=kind)
                        if kind == "json_schema":
                            self._schema_mode = False
                        else:
                            self._json_mode = False
                        continue
                    raise LLMError(f"LLM request to {cfg.base_url} failed: {e}") from e

        choice = response.choices[0]
        usage = getattr(response, "usage", None)
        logger.info(
            "llm_call_done",
            model=cfg.model,
            waited_s=round(started_at - queued_at, 1),
            seconds=round(time.monotonic() - started_at, 1),
            prompt_tokens=getattr(usage, "prompt_tokens", None),
            completion_tokens=getattr(usage, "completion_tokens", None),
        )
        if getattr(choice, "finish_reason", None) == "length":
            logger.warning("llm_response_truncated", model=cfg.model, max_tokens=kwargs["max_tokens"])
        return parse_json_object(choice.message.content)


def _rejects_json_mode(error: Exception) -> bool:
    text = str(error).lower()
    return getattr(error, "status_code", None) == 400 and ("response_format" in text or "json" in text or "schema" in text)


def _is_unavailable(error: Exception) -> bool:
    """Connection failures, timeouts, 5xx and rate limits: the server may be fine in a minute."""
    try:
        import openai

        if isinstance(error, (openai.APIConnectionError, openai.APITimeoutError, openai.RateLimitError, openai.InternalServerError)):
            return True
    except ImportError:  # pragma: no cover - openai is a hard dependency
        pass
    status = getattr(error, "status_code", None)
    return isinstance(status, int) and (status >= 500 or status == 429)


@lru_cache(maxsize=1)
def get_llm_service() -> LLMService:
    return LLMService()
