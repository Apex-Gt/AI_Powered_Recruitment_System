import json

import httpx
import pytest
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.exceptions import LLMError
from app.services.llm import LLMService, parse_json_object


def completion(content: str, finish_reason: str = "stop") -> dict:
    return {
        "id": "x", "object": "chat.completion", "created": 0, "model": "m",
        "choices": [{"index": 0, "finish_reason": finish_reason, "message": {"role": "assistant", "content": content}}],
    }


def service_with(handler) -> tuple[LLMService, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    client = AsyncOpenAI(
        api_key="gsk_test", base_url=settings.llm.base_url, max_retries=0,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(wrapped)),
    )
    return LLMService(client=client), seen


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(settings.llm, "api_key", "gsk_test")


@pytest.mark.parametrize(
    "raw",
    [
        '{"a": 1}',
        '```json\n{"a": 1}\n```',
        'Sure! Here is the JSON:\n{"a": 1}\nHope that helps.',
        '<think>reasoning {with braces}</think>\n{"a": 1}',
    ],
)
def test_parse_json_object_tolerates_messy_model_output(raw):
    assert parse_json_object(raw) == {"a": 1}


@pytest.mark.parametrize("raw", ["", "   ", "not json", "[1, 2]", None])
def test_parse_json_object_rejects_garbage(raw):
    with pytest.raises(LLMError):
        parse_json_object(raw)


async def test_request_goes_to_configured_endpoint_with_key_and_model():
    service, seen = service_with(lambda r: httpx.Response(200, json=completion('{"ok": true}')))

    assert await service.chat_json("sys", "user json") == {"ok": True}

    request = seen[0]
    body = json.loads(request.content)
    assert str(request.url) == "https://api.groq.com/openai/v1/chat/completions"
    assert request.headers["authorization"] == "Bearer gsk_test"
    assert body["model"] == "llama-3.3-70b-versatile"
    assert body["response_format"] == {"type": "json_object"}
    assert [m["role"] for m in body["messages"]] == ["system", "user"]


async def test_falls_back_to_plain_completion_when_json_mode_rejected():
    def handler(request):
        if "response_format" in json.loads(request.content):
            return httpx.Response(400, json={"error": {"message": "response_format json_object is not supported"}})
        return httpx.Response(200, json=completion('```json\n{"ok": true}\n```'))

    service, seen = service_with(handler)

    assert await service.chat_json("s", "u") == {"ok": True}
    assert len(seen) == 2
    assert await service.chat_json("s", "u") == {"ok": True}
    assert len(seen) == 3  # json mode stays disabled after the first rejection


async def test_provider_errors_become_llm_error():
    service, _ = service_with(lambda r: httpx.Response(401, json={"error": {"message": "Invalid API Key"}}))
    with pytest.raises(LLMError, match="Invalid API Key"):
        await service.chat_json("s", "u")


async def test_unconfigured_llm_fails_with_actionable_message(monkeypatch):
    monkeypatch.setattr(settings.llm, "api_key", "")
    with pytest.raises(LLMError, match="LLM_API_KEY"):
        await LLMService().chat_json("s", "u")
