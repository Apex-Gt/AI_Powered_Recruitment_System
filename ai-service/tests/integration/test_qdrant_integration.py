import sys
from types import ModuleType
from unittest.mock import AsyncMock, Mock

import numpy as np
import pytest

from app.core.config import settings
from app.core.exceptions import ModelUnavailableError, QdrantError
from app.models.schemas import ResumeChunk
from app.services.embedding import LocalBGEEmbeddingService, OpenAIEmbeddingService
from app.services.qdrant import QdrantService
from app.services.reranker import LocalBGERerankerService


def chunk(candidate: str, chunk_id: str, text: str, job_id: str | None = "job-1") -> ResumeChunk:
    return ResumeChunk(
        candidate_id=candidate,
        resume_id=f"res-{candidate}",
        job_id=job_id,
        chunk_id=chunk_id,
        section="experience",
        source_pdf="resume.pdf",
        text=text,
    )


@pytest.fixture
def fake_flag_embedding(monkeypatch):
    """Stand-in for the FlagEmbedding + torch packages so no model is downloaded."""
    flag = ModuleType("FlagEmbedding")
    model = Mock()
    model.encode.side_effect = lambda texts, **kw: {"dense_vecs": [np.full(1024, 0.1) for _ in texts]}
    flag.BGEM3FlagModel = Mock(return_value=model)
    reranker = Mock()
    reranker.compute_score.side_effect = lambda pairs, **kw: [0.9, 0.7, 0.5][: len(pairs)]
    flag.FlagReranker = Mock(return_value=reranker)
    torch = ModuleType("torch")
    torch.cuda = Mock(is_available=Mock(return_value=False))
    monkeypatch.setitem(sys.modules, "FlagEmbedding", flag)
    monkeypatch.setitem(sys.modules, "torch", torch)
    return flag


@pytest.mark.integration
class TestQdrantIntegration:
    """Runs against Qdrant's in-process engine, so filters and scoring are the real thing."""

    @pytest.fixture
    def qdrant_service(self, monkeypatch):
        monkeypatch.setattr(settings.qdrant, "location", ":memory:")
        embedder = Mock()
        embedder.get_dimensions.return_value = 3
        embedder.embed_batch = AsyncMock(side_effect=lambda texts: [[1.0, 0.0, 0.0] if "python" in t else [0.0, 1.0, 0.0] for t in texts])
        return QdrantService(embedder)

    async def test_upsert_search_scroll_delete(self, qdrant_service):
        ids = await qdrant_service.upsert_chunks(
            [chunk("c1", "k0", "python dev"), chunk("c1", "k1", "java dev"), chunk("c2", "k0", "python other")]
        )
        assert len(set(ids)) == 3

        hits = await qdrant_service.search_similar([1.0, 0.0, 0.0], candidate_id="c1", top_k=5)
        assert [h.text for h in hits] == ["python dev", "java dev"]  # ranked by similarity, c2 filtered out
        assert hits[0].embedding == [1.0, 0.0, 0.0]

        assert len(await qdrant_service.search_by_candidate("c1")) == 2
        assert await qdrant_service.delete_candidate_chunks("c1") == 2
        assert await qdrant_service.search_by_candidate("c1") == []
        assert len(await qdrant_service.search_by_candidate("c2")) == 1

    async def test_upsert_is_idempotent(self, qdrant_service):
        first = await qdrant_service.upsert_chunks([chunk("c1", "k0", "python dev")])
        second = await qdrant_service.upsert_chunks([chunk("c1", "k0", "python dev")])
        assert first == second
        assert (await qdrant_service.get_collection_info())["points_count"] == 1

    async def test_job_filter(self, qdrant_service):
        await qdrant_service.upsert_chunks([chunk("c1", "k0", "python", "job-1"), chunk("c1", "k1", "python", "job-2")])
        hits = await qdrant_service.search_similar([1.0, 0.0, 0.0], job_id="job-2")
        assert [h.job_id for h in hits] == ["job-2"]

    async def test_collection_dimension_mismatch_is_detected(self, qdrant_service):
        await qdrant_service.upsert_chunks([chunk("c1", "k0", "python")])
        other = QdrantService(Mock(get_dimensions=Mock(return_value=8)))
        other.client = qdrant_service.client
        with pytest.raises(QdrantError, match="dimension mismatch"):
            await other.initialize_collection()


@pytest.mark.integration
class TestEmbeddingServiceIntegration:
    async def test_local_bge_embedding_service(self, fake_flag_embedding):
        service = LocalBGEEmbeddingService()
        embedding = await service.embed_text("Test text")
        assert len(embedding) == 1024
        assert all(isinstance(x, float) for x in embedding)
        assert len(await service.embed_batch(["a", "b", "c"])) == 3

    async def test_missing_flagembedding_is_not_retried(self, monkeypatch):
        monkeypatch.setitem(sys.modules, "FlagEmbedding", None)  # makes `import FlagEmbedding` raise ImportError
        with pytest.raises(ModelUnavailableError):
            await LocalBGEEmbeddingService().embed_text("Test text")

    async def test_openai_embedding_service(self, monkeypatch):
        openai = ModuleType("openai")
        response = Mock(data=[Mock(embedding=[0.1] * 1024)])
        openai.AsyncOpenAI = Mock(return_value=Mock(embeddings=Mock(create=AsyncMock(return_value=response))))
        monkeypatch.setitem(sys.modules, "openai", openai)

        embedding = await OpenAIEmbeddingService(dimensions=1024).embed_text("Test text")
        assert len(embedding) == 1024


@pytest.mark.integration
class TestRerankerServiceIntegration:
    async def test_local_bge_reranker(self, fake_flag_embedding):
        service = LocalBGERerankerService()
        chunks = [chunk("c1", f"c{i}", f"Text {i}") for i in range(3)]

        results = await service.rerank("Python developer", chunks, top_k=2)

        assert [r.chunk_id for r in results] == ["c0", "c1"]
        assert results[0].relevance_score > results[1].relevance_score
