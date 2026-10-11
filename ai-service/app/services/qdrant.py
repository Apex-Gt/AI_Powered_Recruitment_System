from typing import Optional
from qdrant_client import QdrantClient, models
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import structlog
import uuid

from app.core.config import settings
from app.core.exceptions import QdrantError
from app.core.logging import get_logger
from app.models.schemas import ResumeChunk
from app.services.embedding import EmbeddingService

logger = get_logger(__name__)


class QdrantService:
    def __init__(self, embedding_service: EmbeddingService):
        self.embedding_service = embedding_service
        self.client: Optional[QdrantClient] = None
        self.collection_name = settings.qdrant.collection_name
        self.batch_size = settings.qdrant.batch_size
        self.distance_metric = settings.qdrant.distance_metric

    def _get_client(self) -> QdrantClient:
        if self.client is None:
            self.client = QdrantClient(
                host=settings.qdrant.host,
                port=settings.qdrant.port,
                timeout=settings.qdrant.timeout,
            )
        return self.client

    async def initialize_collection(self) -> None:
        client = self._get_client()
        try:
            collections = client.get_collections().collections
            collection_names = [c.name for c in collections]

            if self.collection_name not in collection_names:
                logger.info("creating_qdrant_collection", collection=self.collection_name)
                distance = Distance.COSINE
                if self.distance_metric == "euclidean":
                    distance = Distance.EUCLID
                elif self.distance_metric == "dot":
                    distance = Distance.DOT

                client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.embedding_service.get_dimensions(),
                        distance=distance,
                    ),
                )
                logger.info("qdrant_collection_created", collection=self.collection_name)
            else:
                logger.info("qdrant_collection_exists", collection=self.collection_name)
                collection_info = client.get_collection(self.collection_name)
                if collection_info.config.params.vectors.size != self.embedding_service.get_dimensions():
                    raise QdrantError(
                        f"Collection dimension mismatch: existing={collection_info.config.params.vectors.size}, expected={self.embedding_service.get_dimensions()}",
                        details={
                            "existing_dimensions": collection_info.config.params.vectors.size,
                            "expected_dimensions": self.embedding_service.get_dimensions(),
                        },
                    )
        except QdrantError:
            raise
        except Exception as e:
            raise QdrantError(f"Failed to initialize collection: {e}") from e

    async def upsert_chunks(self, chunks: list[ResumeChunk]) -> list[str]:
        if not chunks:
            return []

        client = self._get_client()
        points = []
        ids = []

        for chunk in chunks:
            if chunk.embedding is None:
                try:
                    chunk.embedding = await self.embedding_service.embed_text(chunk.text)
                except Exception as e:
                    logger.error("embedding_failed_for_chunk", chunk_id=chunk.chunk_id, error=str(e))
                    raise QdrantError(f"Failed to generate embedding for chunk {chunk.chunk_id}: {e}") from e

            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{chunk.candidate_id}-{chunk.resume_id}-{chunk.chunk_id}"))
            ids.append(point_id)

            payload = {
                "candidate_id": chunk.candidate_id,
                "resume_id": chunk.resume_id,
                "job_id": chunk.job_id,
                "chunk_id": chunk.chunk_id,
                "section": chunk.section,
                "source_pdf": chunk.source_pdf,
                "text": chunk.text,
                "metadata": chunk.metadata,
                "created_at": chunk.created_at.isoformat() if chunk.created_at else None,
            }

            points.append(PointStruct(id=point_id, vector=chunk.embedding, payload=payload))

        try:
            for i in range(0, len(points), self.batch_size):
                batch = points[i : i + self.batch_size]
                client.upsert(collection_name=self.collection_name, points=batch, wait=True)
            logger.info("chunks_upserted", count=len(points), collection=self.collection_name)
            return ids
        except Exception as e:
            raise QdrantError(f"Failed to upsert chunks: {e}") from e

    async def search_similar(
        self,
        query_embedding: list[float],
        candidate_id: Optional[str] = None,
        job_id: Optional[str] = None,
        top_k: int = 10,
        score_threshold: float = 0.0,
    ) -> list[ResumeChunk]:
        client = self._get_client()
        try:
            filter_conditions = []
            if candidate_id:
                filter_conditions.append(FieldCondition(key="candidate_id", match=MatchValue(value=candidate_id)))
            if job_id:
                filter_conditions.append(FieldCondition(key="job_id", match=MatchValue(value=job_id)))

            query_filter = Filter(must=filter_conditions) if filter_conditions else None

            results = client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=query_filter,
                limit=top_k,
                score_threshold=score_threshold,
                with_payload=True,
                with_vectors=False,
            )

            chunks = []
            for hit in results:
                payload = hit.payload
                chunks.append(
                    ResumeChunk(
                        candidate_id=payload["candidate_id"],
                        resume_id=payload["resume_id"],
                        job_id=payload.get("job_id"),
                        chunk_id=payload["chunk_id"],
                        section=payload["section"],
                        source_pdf=payload["source_pdf"],
                        text=payload["text"],
                        metadata=payload.get("metadata", {}),
                    )
                )
            return chunks
        except Exception as e:
            raise QdrantError(f"Failed to search similar chunks: {e}") from e

    async def search_by_candidate(self, candidate_id: str, top_k: int = 100) -> list[ResumeChunk]:
        client = self._get_client()
        try:
            results = client.scroll(
                collection_name=self.collection_name,
                scroll_filter=Filter(must=[FieldCondition(key="candidate_id", match=MatchValue(value=candidate_id))]),
                limit=top_k,
                with_payload=True,
                with_vectors=False,
            )

            chunks = []
            for hit in results[0]:
                payload = hit.payload
                chunks.append(
                    ResumeChunk(
                        candidate_id=payload["candidate_id"],
                        resume_id=payload["resume_id"],
                        job_id=payload.get("job_id"),
                        chunk_id=payload["chunk_id"],
                        section=payload["section"],
                        source_pdf=payload["source_pdf"],
                        text=payload["text"],
                        metadata=payload.get("metadata", {}),
                    )
                )
            return chunks
        except Exception as e:
            raise QdrantError(f"Failed to search by candidate: {e}") from e

    async def delete_candidate_chunks(self, candidate_id: str) -> int:
        client = self._get_client()
        try:
            result = client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(must=[FieldCondition(key="candidate_id", match=MatchValue(value=candidate_id))]),
                wait=True,
            )
            logger.info("candidate_chunks_deleted", candidate_id=candidate_id, count=result.operation_id)
            return result.operation_id
        except Exception as e:
            raise QdrantError(f"Failed to delete candidate chunks: {e}") from e

    async def health_check(self) -> bool:
        try:
            client = self._get_client()
            client.get_collections()
            return True
        except Exception:
            return False

    async def get_collection_info(self) -> dict:
        client = self._get_client()
        try:
            info = client.get_collection(self.collection_name)
            return {
                "name": info.config.name,
                "vectors_count": info.vectors_count,
                "points_count": info.points_count,
                "dimensions": info.config.params.vectors.size,
                "distance": info.config.params.vectors.distance.value,
            }
        except Exception as e:
            raise QdrantError(f"Failed to get collection info: {e}") from e