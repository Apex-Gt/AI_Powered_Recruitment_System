import asyncio
from abc import abstractmethod
from typing import Protocol
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings
from app.core.exceptions import ConfigurationError, EmbeddingError, ModelUnavailableError, ValidationError
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
            raise ValidationError("Cannot embed empty text")
        try:
            embedding = await self._embed_single(text.strip())
            if len(embedding) != self.dimensions:
                raise ConfigurationError(
                    f"Embedding dimension mismatch: expected {self.dimensions}, got {len(embedding)}",
                    details={"expected": self.dimensions, "actual": len(embedding)},
                )
            return embedding
        except (ModelUnavailableError, ConfigurationError):
            raise
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
                    raise ConfigurationError(
                        f"Batch embedding dimension mismatch at index {i}: expected {self.dimensions}, got {len(emb)}",
                        details={"index": i, "expected": self.dimensions, "actual": len(emb)},
                    )
            return embeddings
        except (ModelUnavailableError, ConfigurationError):
            raise
        except Exception as e:
            logger.error("batch_embedding_failed", error=str(e), model=self.model_name, count=len(valid_texts))
            raise EmbeddingError(f"Failed to embed batch: {e}") from e

    async def health_check(self) -> bool:
        try:
            test_embedding = await self.embed_text("health check")
            return len(test_embedding) == self.dimensions
        except Exception:
            return False


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
                self._model = await asyncio.to_thread(
                    BGEM3FlagModel, self.model_name, device=self._device, use_fp16=self._device == "cuda"
                )
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
            result = await asyncio.to_thread(
                self._model.encode,
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
                result = await asyncio.to_thread(
                    self._model.encode,
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


class OllamaEmbeddingService(BaseEmbeddingService):
    """Embeddings from a local Ollama server (``bge-m3`` is 1024-d, like the in-process BGE-M3).

    Uses Ollama's native ``/api/embed`` batch endpoint, so no torch/FlagEmbedding install is needed and the
    model weights live in Ollama's store, shared with the chat model's runtime.
    """

    def __init__(self, model_name: str = "bge-m3", dimensions: int = 1024, base_url: str = "http://localhost:11434", num_gpu: int | None = None, **kwargs):
        super().__init__(model_name, dimensions, **kwargs)
        self.base_url = base_url.rstrip("/")
        self.num_gpu = num_gpu
        self._client = None

    def _get_client(self):
        if self._client is None:
            import httpx

            self._client = httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout)
        return self._client

    async def _post_embed(self, texts: list[str]) -> list[list[float]]:
        import httpx

        payload: dict = {"model": self.model_name, "input": texts}
        if self.num_gpu is not None:
            payload["options"] = {"num_gpu": self.num_gpu}
        try:
            response = await self._get_client().post("/api/embed", json=payload)
        except httpx.HTTPError as e:
            raise EmbeddingError(f"Ollama embedding server unreachable at {self.base_url}: {e}") from e
        if response.status_code == 404:
            raise ModelUnavailableError(
                f"Embedding model '{self.model_name}' is not pulled in Ollama (run: ollama pull {self.model_name})",
                self.model_name,
            )
        if response.status_code >= 400:
            raise EmbeddingError(f"Ollama /api/embed returned {response.status_code}: {response.text[:200]}")
        vectors = response.json().get("embeddings") or []
        if len(vectors) != len(texts):
            raise EmbeddingError(f"Ollama returned {len(vectors)} embeddings for {len(texts)} inputs")
        return vectors

    async def _embed_single(self, text: str) -> list[float]:
        return (await self._post_embed([text]))[0]

    async def _embed_batch_impl(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for i in range(0, len(texts), self.batch_size):
            vectors.extend(await self._post_embed(texts[i : i + self.batch_size]))
        return vectors


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
    elif provider == "ollama":
        return OllamaEmbeddingService(
            model_name=model_name,
            dimensions=dimensions,
            base_url=settings.embedding.base_url,
            num_gpu=settings.embedding.ollama_num_gpu,
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