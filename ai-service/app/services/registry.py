"""Process-wide singletons so the API, health check and workflows share one set of
(expensive, lazily-loaded) model instances instead of each building their own."""

from functools import lru_cache

from app.services.embedding import EmbeddingService, create_embedding_service
from app.services.qdrant import QdrantService
from app.services.reranker import RerankerService, create_reranker_service


@lru_cache(maxsize=1)
def get_embedding_service() -> EmbeddingService:
    return create_embedding_service()


@lru_cache(maxsize=1)
def get_qdrant_service() -> QdrantService:
    return QdrantService(get_embedding_service())


@lru_cache(maxsize=1)
def get_reranker_service() -> RerankerService:
    return create_reranker_service()
