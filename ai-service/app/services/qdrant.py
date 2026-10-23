import asyncio
import uuid
from typing import Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from app.core.config import settings
from app.core.exceptions import QdrantError
from app.core.logging import get_logger
from app.models.schemas import ResumeChunk
from app.services.embedding import EmbeddingService

logger = get_logger(__name__)

_INDEXED_FIELDS = ("candidate_id", "job_id", "resume_id")


class QdrantService:
    def __init__(self, embedding_service: EmbeddingService):
        self.embedding_service = embedding_service
        self.client: Optional[QdrantClient] = None
        self.collection_name = settings.qdrant.collection_name
        self.batch_size = settings.qdrant.batch_size
        self.distance_metric = settings.qdrant.distance_metric
        self._collection_ready = False
        self._init_lock = asyncio.Lock()

    def _get_client(self) -> QdrantClient:
        if self.client is None:
            if settings.qdrant.location:
                self.client = QdrantClient(location=settings.qdrant.location)
            elif settings.qdrant.path:
                self.client = QdrantClient(path=settings.qdrant.path)
            else:
                self.client = QdrantClient(
                    host=settings.qdrant.host,
                    port=settings.qdrant.port,
                    timeout=int(settings.qdrant.timeout),
                )
        return self.client

    async def initialize_collection(self) -> None:
        client = self._get_client()
        try:
            await asyncio.to_thread(self._initialize_collection_sync, client)
        except QdrantError:
            raise
        except Exception as e:
            raise QdrantError(f"Failed to initialize collection: {e}") from e
        self._collection_ready = True

    def _initialize_collection_sync(self, client: QdrantClient) -> None:
        existing = {c.name for c in client.get_collections().collections}
        dimensions = self.embedding_service.get_dimensions()

        if self.collection_name not in existing:
            logger.info("creating_qdrant_collection", collection=self.collection_name)
            distance = {
                "cosine": Distance.COSINE,
                "euclidean": Distance.EUCLID,
                "dot": Distance.DOT,
            }[self.distance_metric]
            client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=dimensions, distance=distance),
            )
            logger.info("qdrant_collection_created", collection=self.collection_name)
        else:
            logger.info("qdrant_collection_exists", collection=self.collection_name)
            existing_size = client.get_collection(self.collection_name).config.params.vectors.size
            if existing_size != dimensions:
                raise QdrantError(
                    f"Collection dimension mismatch: existing={existing_size}, expected={dimensions}",
                    details={"existing_dimensions": existing_size, "expected_dimensions": dimensions},
                )

        for field in _INDEXED_FIELDS:
            client.create_payload_index(
                collection_name=self.collection_name,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )

    async def _ensure_collection(self) -> None:
        if self._collection_ready:
            return
        async with self._init_lock:
            if not self._collection_ready:
                await self.initialize_collection()

    async def upsert_chunks(self, chunks: list[ResumeChunk]) -> list[str]:
        if not chunks:
            return []

        await self._ensure_collection()
        client = self._get_client()

        missing = [c for c in chunks if c.embedding is None]
        if missing:
            try:
                vectors = await self.embedding_service.embed_batch([c.text for c in missing])
            except Exception as e:
                raise QdrantError(f"Failed to generate embeddings for chunks: {e}") from e
            if len(vectors) != len(missing):
                raise QdrantError(
                    f"Embedding count mismatch: expected {len(missing)}, got {len(vectors)} "
                    "(blank chunks cannot be embedded)"
                )
            for chunk, vector in zip(missing, vectors):
                chunk.embedding = vector

        points: list[PointStruct] = []
        ids: list[str] = []
        for chunk in chunks:
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
                await asyncio.to_thread(client.upsert, collection_name=self.collection_name, points=batch, wait=True)
            logger.info("chunks_upserted", count=len(points), collection=self.collection_name)
            return ids
        except Exception as e:
            raise QdrantError(f"Failed to upsert chunks: {e}") from e

    @staticmethod
    def _chunk_from_point(point: Any) -> ResumeChunk:
        payload = point.payload or {}
        vector = getattr(point, "vector", None)
        return ResumeChunk(
            candidate_id=payload["candidate_id"],
            resume_id=payload["resume_id"],
            job_id=payload.get("job_id"),
            chunk_id=payload["chunk_id"],
            section=payload["section"],
            source_pdf=payload["source_pdf"],
            text=payload["text"],
            embedding=list(vector) if isinstance(vector, (list, tuple)) else None,
            metadata=payload.get("metadata") or {},
        )

    @staticmethod
    def _build_filter(candidate_id: Optional[str], job_id: Optional[str]) -> Optional[Filter]:
        conditions = []
        if candidate_id:
            conditions.append(FieldCondition(key="candidate_id", match=MatchValue(value=candidate_id)))
        if job_id:
            conditions.append(FieldCondition(key="job_id", match=MatchValue(value=job_id)))
        return Filter(must=conditions) if conditions else None

    async def search_similar(
        self,
        query_embedding: list[float],
        candidate_id: Optional[str] = None,
        job_id: Optional[str] = None,
        top_k: int = 10,
        score_threshold: Optional[float] = None,
    ) -> list[ResumeChunk]:
        await self._ensure_collection()
        client = self._get_client()
        try:
            response = await asyncio.to_thread(
                client.query_points,
                collection_name=self.collection_name,
                query=query_embedding,
                query_filter=self._build_filter(candidate_id, job_id),
                limit=top_k,
                score_threshold=score_threshold,
                with_payload=True,
                with_vectors=True,
            )
            return [self._chunk_from_point(point) for point in response.points]
        except Exception as e:
            raise QdrantError(f"Failed to search similar chunks: {e}") from e

    async def search_by_candidate(self, candidate_id: str, top_k: int = 100) -> list[ResumeChunk]:
        await self._ensure_collection()
        client = self._get_client()
        try:
            points, _ = await asyncio.to_thread(
                client.scroll,
                collection_name=self.collection_name,
                scroll_filter=self._build_filter(candidate_id, None),
                limit=top_k,
                with_payload=True,
                with_vectors=False,
            )
            return [self._chunk_from_point(point) for point in points]
        except Exception as e:
            raise QdrantError(f"Failed to search by candidate: {e}") from e

    async def delete_candidate_chunks(self, candidate_id: str) -> int:
        await self._ensure_collection()
        client = self._get_client()
        selector = self._build_filter(candidate_id, None)
        try:
            count = (
                await asyncio.to_thread(
                    client.count, collection_name=self.collection_name, count_filter=selector, exact=True
                )
            ).count
            await asyncio.to_thread(
                client.delete,
                collection_name=self.collection_name,
                points_selector=FilterSelector(filter=selector),
                wait=True,
            )
            logger.info("candidate_chunks_deleted", candidate_id=candidate_id, count=count)
            return count
        except Exception as e:
            raise QdrantError(f"Failed to delete candidate chunks: {e}") from e

    async def health_check(self) -> bool:
        try:
            await asyncio.to_thread(self._get_client().get_collections)
            return True
        except Exception:
            return False

    async def get_collection_info(self) -> dict:
        await self._ensure_collection()
        client = self._get_client()
        try:
            info = await asyncio.to_thread(client.get_collection, self.collection_name)
            vectors = info.config.params.vectors
            return {
                "name": self.collection_name,
                "points_count": info.points_count,
                "dimensions": vectors.size,
                "distance": vectors.distance.value,
            }
        except Exception as e:
            raise QdrantError(f"Failed to get collection info: {e}") from e
