from abc import ABC, abstractmethod
from typing import Protocol
import numpy as np
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import structlog

from app.core.config import settings
from app.core.exceptions import EmbeddingError, ModelUnavailableError
from app.core.logging import get_logger

logger = get_logger(__name__)


class EmbeddingService(Protocol):
    @abstractmethod
    async def embed_text(self, text: str) -> list[float]:
        ...

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        ...

    @abstractmethod
    def get_dimensions(self) -> int:
        ...

    @abstractmethod
    def get_model_name(self) -> str:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...


class BaseEmbeddingService:
    def __init__(self, model_name: str, dimensions: int, batch_size: int = 32, max_retries: int = 3, timeout: float = 60.0):
        self.model_name = model_name
        self.dimensions = dimensions
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.timeout = timeout
        self._validate_dimensions()

    def _validate_dimensions(self) -> None:
        if self.dimensions != settings.model.embedding_dimensions:
            raise ConfigurationError(
                f"Embedding dimensions mismatch: service={self.dimensions}, config={settings.model.embedding_dimensions}",
                details={"service_dimensions": self.dimensions, "config_dimensions": settings.model.embedding_dimensions},
            )

    def get_dimensions(self) -> int:
        return self.dimensions

    def get_model_name(self) -> str:
        return self.model_name

    @abstractmethod
    async def _embed_single(self, text: str) -> list[float]:
        pass

    @abstractmethod
    async def _embed_batch_impl(self, texts: list[str]) -> list[list[float]]:
        pass

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((EmbeddingError, ConnectionError, TimeoutError)),
        reraise=True,
    )
    async def embed_text(self, text: str) -> list[float]:
        if not text or not text.strip():
            raise EmbeddingError("Cannot embed empty text")
        try:
            embedding = await self._embed_single(text.strip())
            if len(embedding) != self.dimensions:
                raise EmbeddingError(
                    f"Embedding dimension mismatch: expected {self.dimensions}, got {len(embedding)}",
                    details={"expected": self.dimensions, "actual": len(embedding)},
                )
            return embedding
        except Exception as e:
            logger.error("embedding_failed", error=str(e), model=self.model_name)
            raise EmbeddingError(f"Failed to embed text: {e}") from e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((EmbeddingError, ConnectionError, TimeoutError)),
        reraise=True,
    )
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        valid_texts = [t.strip() for t in texts if t and t.strip()]
        if not valid_texts:
            return []
        try:
            embeddings = await self._embed_batch_impl(valid_texts)
            for i, emb in enumerate(embeddings):
                if len(emb) != self.dimensions:
                    raise EmbeddingError(
                        f"Batch embedding dimension mismatch at index {i}: expected {self.dimensions}, got {len(emb)}",
                        details={"index": i, "expected": self.dimensions, "actual": len(emb)},
                    )
            return embeddings
        except Exception as e:
            logger.error("batch_embedding_failed", error=str(e), model=self.model_name, count=len(valid_texts))
            raise EmbeddingError(f"Failed to embed batch: {e}") from e

    async def health_check(self) -> bool:
        try:
            test_embedding = await self.embed_text("health check")
            return len(test_embedding) == self.dimensions
        except Exception:
            return False


class ConfigurationError(EmbeddingError):
    pass


class LocalBGEEmbeddingService(BaseEmbeddingService):
    def __init__(self, model_name: str = "BAAI/bge-m3", dimensions: int = 1024, **kwargs):
        super().__init__(model_name, dimensions, **kwargs)
        self._model = None
        self._device = None

    async def _initialize(self) -> None:
        if self._model is None:
            try:
                from FlagEmbedding import BGEM3FlagModel
                import torch

                self._device = "cuda" if torch.cuda.is_available() else "cpu"
                logger.info("loading_bge_model", model=self.model_name, device=self._device)
                self._model = BGEM3FlagModel(self.model_name, device=self._device, use_fp16=self._device == "cuda")
            except ImportError:
                raise ModelUnavailableError(
                    "FlagEmbedding not installed. Install with: pip install FlagEmbedding",
                    model_name=self.model_name,
                )
            except Exception as e:
                raise ModelUnavailableError(f"Failed to load BGE model: {e}", model_name=self.model_name)

    async def _embed_single(self, text: str) -> list[float]:
        await self._initialize()
        try:
            result = self._model.encode(
                [text],
                batch_size=1,
                max_length=8192,
                return_dense=True,
                return_sparse=False,
                return_colbert_vecs=False,
            )
            return result["dense_vecs"][0].tolist()
        except Exception as e:
            raise EmbeddingError(f"BGE embedding failed: {e}") from e

    async def _embed_batch_impl(self, texts: list[str]) -> list[list[float]]:
        await self._initialize()
        try:
            results = []
            for i in range(0, len(texts), self.batch_size):
                batch = texts[i : i + self.batch_size]
                result = self._model.encode(
                    batch,
                    batch_size=len(batch),
                    max_length=8192,
                    return_dense=True,
                    return_sparse=False,
                    return_colbert_vecs=False,
                )
                results.extend([vec.tolist() for vec in result["dense_vecs"]])
            return results
        except Exception as e:
            raise EmbeddingError(f"BGE batch embedding failed: {e}") from e


class OpenAIEmbeddingService(BaseEmbeddingService):
    def __init__(self, model_name: str = "text-embedding-3-large", dimensions: int = 3072, **kwargs):
        super().__init__(model_name, dimensions, **kwargs)
        self._client = None

    async def _initialize(self) -> None:
        if self._client is None:
            try:
                from openai import AsyncOpenAI

                self._client = AsyncOpenAI(
                    api_key=settings.openai.api_key,
                    base_url=settings.openai.base_url,
                    timeout=self.timeout,
                )
            except ImportError:
                raise ModelUnavailableError("openai package not installed", model_name=self.model_name)
            except Exception as e:
                raise ModelUnavailableError(f"Failed to initialize OpenAI client: {e}", model_name=self.model_name)

    async def _embed_single(self, text: str) -> list[float]:
        await self._initialize()
        try:
            response = await self._client.embeddings.create(model=self.model_name, input=text, dimensions=self.dimensions)
            return response.data[0].embedding
        except Exception as e:
            raise EmbeddingError(f"OpenAI embedding failed: {e}") from e

    async def _embed_batch_impl(self, texts: list[str]) -> list[list[float]]:
        await self._initialize()
        try:
            response = await self._client.embeddings.create(model=self.model_name, input=texts, dimensions=self.dimensions)
            return [item.embedding for item in response.data]
        except Exception as e:
            raise EmbeddingError(f"OpenAI batch embedding failed: {e}") from e


def create_embedding_service() -> EmbeddingService:
    provider = settings.embedding.provider
    model_name = settings.embedding.model_name
    dimensions = settings.embedding.dimensions
    batch_size = settings.embedding.batch_size
    max_retries = settings.embedding.max_retries
    timeout = settings.embedding.timeout

    if provider == "local":
        return LocalBGEEmbeddingService(
            model_name=model_name,
            dimensions=dimensions,
            batch_size=batch_size,
            max_retries=max_retries,
            timeout=timeout,
        )
    elif provider == "openai":
        return OpenAIEmbeddingService(
            model_name=model_name,
            dimensions=dimensions,
            batch_size=batch_size,
            max_retries=max_retries,
            timeout=timeout,
        )
    else:
        raise ConfigurationError(f"Unknown embedding provider: {provider}")