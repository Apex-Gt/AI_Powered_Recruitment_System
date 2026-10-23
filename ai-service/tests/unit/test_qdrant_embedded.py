import pytest

from app.core.config import settings
from app.services.qdrant import QdrantService


class _FakeEmbedding:
    def get_dimensions(self) -> int:
        return 8


@pytest.mark.asyncio
async def test_embedded_path_needs_no_server_and_persists(tmp_path, monkeypatch):
    monkeypatch.setattr(settings.qdrant, "location", None)
    monkeypatch.setattr(settings.qdrant, "path", str(tmp_path / "qdrant"))
    monkeypatch.setattr(settings.qdrant, "host", "127.0.0.1")
    monkeypatch.setattr(settings.qdrant, "port", 1)  # nothing listens here: a server connection would fail

    first = QdrantService(_FakeEmbedding())
    await first.initialize_collection()
    first.client.close()

    second = QdrantService(_FakeEmbedding())
    await second.initialize_collection()
    names = {c.name for c in second.client.get_collections().collections}
    second.client.close()
    assert settings.qdrant.collection_name in names
