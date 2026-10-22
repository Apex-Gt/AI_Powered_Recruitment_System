import asyncio
from abc import abstractmethod
from typing import Protocol
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

from app.core.config import settings
from app.core.exceptions import AIServiceError, ModelUnavailableError, ValidationError
from app.core.logging import get_logger
from app.models.schemas import ResumeChunk, EvidenceChunk

logger = get_logger(__name__)


def _is_transient(exc: BaseException) -> bool:
    if isinstance(exc, (ModelUnavailableError, ValidationError)):
        return False
    return isinstance(exc, (AIServiceError, ConnectionError, TimeoutError))


class RerankerService(Protocol):
    @abstractmethod
    async def rerank(self, query: str, chunks: list[ResumeChunk], top_k: int) -> list[EvidenceChunk]:
        ...

    @abstractmethod
    def get_model_name(self) -> str:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...


class BaseRerankerService:
    def __init__(self, model_name: str, top_k: int = 20, max_retries: int = 3, timeout: float = 60.0):
        self.model_name = model_name
        self.top_k = top_k
        self.max_retries = max_retries
        self.timeout = timeout

    def get_model_name(self) -> str:
        return self.model_name

    @abstractmethod
    async def _rerank_impl(self, query: str, chunks: list[ResumeChunk], top_k: int) -> list[EvidenceChunk]:
        pass

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(_is_transient),
        reraise=True,
    )
    async def rerank(self, query: str, chunks: list[ResumeChunk], top_k: int | None = None) -> list[EvidenceChunk]:
        if not chunks:
            return []
        if not query or not query.strip():
            raise ValidationError("Cannot rerank with empty query")
        k = top_k or self.top_k
        try:
            return await self._rerank_impl(query.strip(), chunks, k)
        except ModelUnavailableError:
            raise
        except Exception as e:
            logger.error("reranking_failed", error=str(e), model=self.model_name, query=query[:100])
            raise AIServiceError(f"Failed to rerank: {e}") from e

    async def health_check(self) -> bool:
        try:
            test_chunks = [
                ResumeChunk(
                    candidate_id="test",
                    resume_id="test",
                    chunk_id="test-1",
                    section="summary",
                    source_pdf="test.pdf",
                    text="Test candidate with Python and machine learning experience",
                )
            ]
            result = await self.rerank("Python developer", test_chunks, top_k=1)
            return len(result) > 0
        except Exception:
            return False


class LocalBGERerankerService(BaseRerankerService):
    def __init__(self, model_name: str = "BAAI/bge-reranker-v2-m3", **kwargs):
        super().__init__(model_name, **kwargs)
        self._model = None
        self._device = None

    async def _initialize(self) -> None:
        if self._model is None:
            try:
                from FlagEmbedding import FlagReranker
                import torch

                self._device = "cuda" if torch.cuda.is_available() else "cpu"
                logger.info("loading_bge_reranker", model=self.model_name, device=self._device)
                self._model = await asyncio.to_thread(
                    FlagReranker, self.model_name, device=self._device, use_fp16=self._device == "cuda"
                )
            except ImportError:
                raise ModelUnavailableError(
                    "FlagEmbedding not installed. Install with: pip install FlagEmbedding",
                    model_name=self.model_name,
                )
            except Exception as e:
                raise ModelUnavailableError(f"Failed to load BGE reranker: {e}", model_name=self.model_name)

    async def _rerank_impl(self, query: str, chunks: list[ResumeChunk], top_k: int) -> list[EvidenceChunk]:
        await self._initialize()
        try:
            pairs = [[query, chunk.text] for chunk in chunks]
            scores = await asyncio.to_thread(self._model.compute_score, pairs, normalize=True)
            if isinstance(scores, (int, float)):
                scores = [scores]
            scored_chunks = list(zip(chunks, scores, strict=False))
            scored_chunks.sort(key=lambda x: x[1], reverse=True)
            top_chunks = scored_chunks[:top_k]
            return [
                EvidenceChunk(
                    chunk_id=chunk.chunk_id,
                    text=chunk.text,
                    section=chunk.section,
                    relevance_score=float(score),
                    source_pdf=chunk.source_pdf,
                )
                for chunk, score in top_chunks
            ]
        except Exception as e:
            raise AIServiceError(f"BGE reranking failed: {e}") from e


class OpenAIRerankerService(BaseRerankerService):
    def __init__(self, model_name: str = "gpt-4o-mini", **kwargs):
        super().__init__(model_name, **kwargs)
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

    async def _rerank_impl(self, query: str, chunks: list[ResumeChunk], top_k: int) -> list[EvidenceChunk]:
        await self._initialize()
        try:
            chunk_texts = "\n\n".join([f"[CHUNK {i}]: {chunk.text}" for i, chunk in enumerate(chunks)])
            prompt = f"""Given the query: "{query}"

Rank the following resume chunks by relevance to the query. Return only the indices of the top {top_k} most relevant chunks, ordered by relevance (most relevant first), as a JSON array of integers.

Chunks:
{chunk_texts}

Return format: [index1, index2, ...]"""

            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are a precise ranking assistant. Return only a JSON array of indices."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=100,
            )

            import json

            content = response.choices[0].message.content.strip()
            indices = json.loads(content)

            top_chunks = [chunks[i] for i in indices if 0 <= i < len(chunks)]
            return [
                EvidenceChunk(
                    chunk_id=chunk.chunk_id,
                    text=chunk.text,
                    section=chunk.section,
                    relevance_score=1.0 - (idx / len(top_chunks)),
                    source_pdf=chunk.source_pdf,
                )
                for idx, chunk in enumerate(top_chunks)
            ]
        except Exception as e:
            raise AIServiceError(f"OpenAI reranking failed: {e}") from e


class NoopRerankerService(BaseRerankerService):
    """Keeps the vector-search order. Lets the stack run without the ~2 GB cross-encoder (RERANKER_PROVIDER=none)."""

    async def _rerank_impl(self, query: str, chunks: list[ResumeChunk], top_k: int) -> list[EvidenceChunk]:
        total = max(len(chunks), 1)
        return [
            EvidenceChunk(
                chunk_id=chunk.chunk_id,
                text=chunk.text,
                section=chunk.section,
                relevance_score=round(1.0 - i / total, 4),  # rank-derived, not a model score
                source_pdf=chunk.source_pdf,
            )
            for i, chunk in enumerate(chunks[:top_k])
        ]


def create_reranker_service() -> RerankerService:
    provider = settings.reranker.provider
    model_name = settings.reranker.model_name
    top_k = settings.reranker.top_k
    max_retries = settings.reranker.max_retries
    timeout = settings.reranker.timeout

    if provider == "none":
        return NoopRerankerService(model_name="none", top_k=top_k, max_retries=max_retries, timeout=timeout)
    if provider == "local":
        return LocalBGERerankerService(
            model_name=model_name,
            top_k=top_k,
            max_retries=max_retries,
            timeout=timeout,
        )
    elif provider == "openai":
        return OpenAIRerankerService(
            model_name=model_name,
            top_k=top_k,
            max_retries=max_retries,
            timeout=timeout,
        )
    else:
        raise AIServiceError(f"Unknown reranker provider: {provider}")