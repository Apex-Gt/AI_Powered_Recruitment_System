import pytest
import os
from unittest.mock import Mock, patch, AsyncMock

from app.services.qdrant import QdrantService
from app.services.embedding import LocalBGEEmbeddingService, OpenAIEmbeddingService
from app.models.schemas import ResumeChunk


@pytest.mark.integration
class TestQdrantIntegration:
    @pytest.fixture
    def mock_embedding_service(self):
        service = Mock(spec=LocalBGEEmbeddingService)
        service.get_dimensions.return_value = 1024
        service.get_model_name.return_value = "BAAI/bge-m3"
        service.embed_text = AsyncMock(return_value=[0.1] * 1024)
        service.embed_batch = AsyncMock(return_value=[[0.1] * 1024, [0.2] * 1024])
        service.health_check = AsyncMock(return_value=True)
        return service

    @pytest.fixture
    def qdrant_service(self, mock_embedding_service):
        return QdrantService(mock_embedding_service)

    @pytest.mark.asyncio
    async def test_upsert_and_search_chunks(self, qdrant_service):
        with patch.object(qdrant_service, '_get_client') as mock_client:
            mock_qdrant = Mock()
            mock_client.return_value = mock_qdrant
            mock_qdrant.get_collections.return_value.collections = []
            mock_qdrant.create_collection = Mock()
            mock_qdrant.upsert = Mock()
            mock_qdrant.search = Mock(return_value=[
                Mock(payload={
                    "candidate_id": "cand-1",
                    "resume_id": "res-1",
                    "job_id": "job-1",
                    "chunk_id": "chunk-1",
                    "section": "experience",
                    "source_pdf": "resume.pdf",
                    "text": "Test experience",
                    "metadata": {},
                    "created_at": "2024-01-01T00:00:00"
                }, score=0.95)
            ])

            chunks = [
                ResumeChunk(
                    candidate_id="cand-1",
                    resume_id="res-1",
                    job_id="job-1",
                    chunk_id="chunk-1",
                    section="experience",
                    source_pdf="resume.pdf",
                    text="Test experience",
                )
            ]

            ids = await qdrant_service.upsert_chunks(chunks)
            assert len(ids) == 1

            results = await qdrant_service.search_similar(
                query_embedding=[0.1] * 1024,
                candidate_id="cand-1",
                top_k=5
            )
            assert len(results) == 1
            assert results[0].candidate_id == "cand-1"


@pytest.mark.integration
class TestEmbeddingServiceIntegration:
    @pytest.mark.asyncio
    async def test_local_bge_embedding_service(self):
        with patch('app.services.embedding.BGEM3FlagModel') as mock_model_class:
            mock_model = Mock()
            mock_model.encode.return_value = {
                "dense_vecs": [[0.1] * 1024]
            }
            mock_model_class.return_value = mock_model

            service = LocalBGEEmbeddingService()
            embedding = await service.embed_text("Test text")

            assert len(embedding) == 1024
            assert all(isinstance(x, float) for x in embedding)

    @pytest.mark.asyncio
    async def test_openai_embedding_service(self):
        with patch('app.services.embedding.AsyncOpenAI') as mock_openai:
            mock_client = AsyncMock()
            mock_response = Mock()
            mock_response.data = [Mock(embedding=[0.1] * 1024)]
            mock_client.embeddings.create = AsyncMock(return_value=mock_response)
            mock_openai.return_value = mock_client

            service = OpenAIEmbeddingService(dimensions=1024)
            embedding = await service.embed_text("Test text")

            assert len(embedding) == 1024


@pytest.mark.integration
class TestRerankerServiceIntegration:
    @pytest.mark.asyncio
    async def test_local_bge_reranker(self):
        with patch('app.services.reranker.FlagReranker') as mock_reranker_class:
            mock_reranker = Mock()
            mock_reranker.compute_score.return_value = [0.9, 0.7, 0.5]
            mock_reranker_class.return_value = mock_reranker

            from app.services.reranker import LocalBGERerankerService
            from app.models.schemas import ResumeChunk

            service = LocalBGERerankerService()
            chunks = [
                ResumeChunk(candidate_id="c1", resume_id="r1", chunk_id="c1", section="exp", source_pdf="p1.pdf", text="Text 1"),
                ResumeChunk(candidate_id="c1", resume_id="r1", chunk_id="c2", section="exp", source_pdf="p1.pdf", text="Text 2"),
                ResumeChunk(candidate_id="c1", resume_id="r1", chunk_id="c3", section="exp", source_pdf="p1.pdf", text="Text 3"),
            ]

            results = await service.rerank("Python developer", chunks, top_k=2)
            assert len(results) == 2
            assert results[0].relevance_score > results[1].relevance_score