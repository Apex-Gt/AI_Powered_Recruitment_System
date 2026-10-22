"""LLM client behaviour against a local OpenAI-compatible server (Ollama): schema output, degradation, outages."""

import httpx
import openai
import pytest

from app.core.config import settings
from app.core.exceptions import LLMUnavailableError
from app.services.llm import LLMService

SCHEMA = {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}


class _Message:
    def __init__(self, content):
        self.content = content


class _Choice:
    def __init__(self, content):
        self.message = _Message(content)
        self.finish_reason = "stop"


class _Response:
    def __init__(self, content):
        self.choices = [_Choice(content)]


class FakeClient:
    def __init__(self, behaviours):
        self.behaviours = list(behaviours)
        self.calls = []
        self.chat = type("c", (), {"completions": self})()

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        behaviour = self.behaviours.pop(0)
        if isinstance(behaviour, Exception):
            raise behaviour
        return _Response(behaviour)


def _bad_request(text):
    request = httpx.Request("POST", "http://localhost:11434/v1/chat/completions")
    return openai.BadRequestError(text, response=httpx.Response(400, request=request), body=None)


async def test_schema_is_sent_as_json_schema_response_format():
    client = FakeClient(['{"name": "Jane"}'])
    result = await LLMService(client).chat_json("sys", "usr", schema=SCHEMA)
    assert result == {"name": "Jane"}
    assert client.calls[0]["response_format"]["type"] == "json_schema"
    assert client.calls[0]["response_format"]["json_schema"]["schema"] == SCHEMA


async def test_degrades_from_schema_to_json_mode_when_server_rejects_it():
    client = FakeClient([_bad_request("response_format json_schema is not supported"), '{"name": "Jane"}'])
    service = LLMService(client)
    assert await service.chat_json("s", "u", schema=SCHEMA) == {"name": "Jane"}
    assert [c["response_format"]["type"] for c in client.calls] == ["json_schema", "json_object"]
    await_second = FakeClient(['{"name": "Ann"}'])
    service._client = await_second
    await service.chat_json("s", "u", schema=SCHEMA)
    assert await_second.calls[0]["response_format"]["type"] == "json_object"  # remembers the downgrade


async def test_connection_failure_is_unavailable_not_a_generic_error():
    request = httpx.Request("POST", "http://localhost:11434/v1/chat/completions")
    client = FakeClient([openai.APIConnectionError(request=request)])
    with pytest.raises(LLMUnavailableError):
        await LLMService(client).chat_json("s", "u")


async def test_qwen3_gets_no_think_marker(monkeypatch):
    monkeypatch.setattr(settings.llm, "model", "qwen3:4b")
    client = FakeClient(['{"a": 1}'])
    await LLMService(client).chat_json("system prompt", "user")
    assert client.calls[0]["messages"][0]["content"].endswith("/no_think")


async def test_think_blocks_are_stripped_from_output():
    client = FakeClient(['<think>pondering</think>{"name": "Jane"}'])
    assert await LLMService(client).chat_json("s", "u") == {"name": "Jane"}
