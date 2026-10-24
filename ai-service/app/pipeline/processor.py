"""The five pipeline stages the backend queue drives, one synchronous call each.

    extract  -> text + deterministic contact fields           (no LLM, no network)
    profile  -> schema-validated CandidateProfile              (local LLM)
    index    -> chunk, embed, upsert into Qdrant               (idempotent: deterministic point ids)
    score    -> explainable deterministic match score          (embeddings + rules, no LLM)
    summary  -> grounded recruiter summary                     (local LLM, retrieval-augmented)

Each stage can be repeated safely. Dependency outages are raised as ``TransientDependencyError`` so the queue
retries them later without losing work already done in earlier stages.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from typing import Any, Optional

from app.core.config import settings
from app.core.exceptions import (
    AIServiceError,
    EmbeddingError,
    LLMError,
    LLMUnavailableError,
    ModelUnavailableError,
    QdrantError,
)
from app.core.logging import get_logger
from app.models.schemas import CandidateProfile, JobDescription, MatchScore, RAGSummary, ResumeChunk
from app.pipeline.errors import NeedsReviewError, PipelineError, TransientDependencyError
from app.pipeline.experience import total_experience_years
from app.pipeline.fields import extract_contact_fields
from app.pipeline.text_extraction import ExtractedText, extract_text_cached
from app.services.pdf_processor import CandidateExtractionService, PDFProcessingService
from app.services.rag_summary import RAGSummaryService
from app.services.registry import get_embedding_service, get_qdrant_service, get_reranker_service
from app.services.scoring import ScoringService

logger = get_logger(__name__)


def _cause_chain(error: BaseException):
    seen = set()
    while error is not None and id(error) not in seen:
        seen.add(id(error))
        yield error
        error = error.__cause__ or error.__context__


def map_dependency_error(error: BaseException) -> PipelineError:
    """Translate any service-layer failure into a pipeline error with an explicit retry decision."""
    if isinstance(error, PipelineError):
        return error
    for item in _cause_chain(error):
        if isinstance(item, LLMUnavailableError):
            return TransientDependencyError("LLM_UNAVAILABLE", f"The language model is unavailable: {item.message}")
        if isinstance(item, ModelUnavailableError):
            return TransientDependencyError("MODEL_UNAVAILABLE", item.message)
        if isinstance(item, EmbeddingError):
            return TransientDependencyError("EMBEDDING_UNAVAILABLE", item.message)
        if isinstance(item, QdrantError):
            return TransientDependencyError("VECTOR_STORE_UNAVAILABLE", item.message)
    if isinstance(error, LLMError):
        # Bad or truncated model output usually differs on the next attempt, so allow a bounded retry.
        return TransientDependencyError("LLM_BAD_OUTPUT", error.message)
    if isinstance(error, (ConnectionError, TimeoutError, asyncio.TimeoutError)):
        return TransientDependencyError("DEPENDENCY_TIMEOUT", str(error) or "A dependency timed out")
    if isinstance(error, AIServiceError):
        return TransientDependencyError(error.code, error.message)
    return TransientDependencyError("INTERNAL_ERROR", f"{type(error).__name__}: {error}")


def _hash(*parts: Any) -> str:
    digest = hashlib.sha256()
    for part in parts:
        digest.update(str(part).encode("utf-8"))
        digest.update(b"\x1f")
    return digest.hexdigest()


def job_input_hash(job: JobDescription) -> str:
    """Stable hash of everything in the job that influences a score or summary."""
    payload = json.dumps(job.to_wire(), sort_keys=True, default=str)
    return _hash(payload)


class ResumePipeline:
    def __init__(
        self,
        extractor=extract_text_cached,
        profile_service: Optional[CandidateExtractionService] = None,
        embedding_service=None,
        qdrant_service=None,
        reranker_service=None,
        scoring_service: Optional[ScoringService] = None,
        pdf_service: Optional[PDFProcessingService] = None,
    ):
        self._extract = extractor
        self._profile_service = profile_service
        self._embedding = embedding_service
        self._qdrant = qdrant_service
        self._reranker = reranker_service
        self._scoring = scoring_service or ScoringService()
        self._pdf = pdf_service
        self._embed_sem: Optional[asyncio.Semaphore] = None

    # Lazy so importing this module (and unit tests) never loads a model or opens a connection.
    @property
    def embedding(self):
        return self._embedding or get_embedding_service()

    @property
    def qdrant(self):
        return self._qdrant or get_qdrant_service()

    @property
    def reranker(self):
        return self._reranker or get_reranker_service()

    @property
    def profile_service(self) -> CandidateExtractionService:
        return self._profile_service or CandidateExtractionService()

    @property
    def pdf(self) -> PDFProcessingService:
        if self._pdf is None:
            self._pdf = PDFProcessingService()
        return self._pdf

    def _embed_semaphore(self) -> asyncio.Semaphore:
        if self._embed_sem is None:
            self._embed_sem = asyncio.Semaphore(max(1, settings.pipeline.embed_concurrency))
        return self._embed_sem

    async def _read(self, file_path: str) -> ExtractedText:
        return await asyncio.to_thread(self._extract, file_path)

    # ------------------------------------------------------------------ extract

    async def extract(self, file_path: str, file_name: str = "") -> dict:
        extracted = await self._read(file_path)
        contact = extract_contact_fields(extracted.text, file_name)
        warnings = list(extracted.warnings)
        needs_review = False
        if not contact.email:
            warnings.append("No email address found in the resume")
            needs_review = True
        if len(extracted.text) < 300:
            warnings.append("Very little text was extracted; the resume may be incomplete")
            needs_review = True
        return {
            "text": extracted.text,
            "textHash": extracted.text_hash,
            "method": extracted.method,
            "pages": extracted.pages,
            "ocrUsed": extracted.ocr_used,
            "contact": contact.to_dict(),
            "warnings": warnings,
            "needsReview": needs_review,
        }

    # ------------------------------------------------------------------ profile

    async def profile(self, file_path: str, file_name: str = "") -> dict:
        extracted = await self._read(file_path)
        contact = extract_contact_fields(extracted.text, file_name)
        try:
            profile = await self.profile_service.extract_candidate_profile(extracted.text)
            if self._is_empty_profile(profile, extracted.text):
                logger.warning("profile_empty_retrying", chars=len(extracted.text))
                profile = await self.profile_service.extract_candidate_profile(extracted.text)
        except Exception as e:  # noqa: BLE001
            raise map_dependency_error(e) from e
        if self._is_empty_profile(profile, extracted.text):
            raise NeedsReviewError(
                "PROFILE_EMPTY",
                "The model returned no skills or experience for a resume with readable text; extraction needs a second look",
            )

        warnings: list[str] = []
        profile = self._ground(profile, contact, extracted.text, warnings)
        return {
            "profile": profile.model_dump(mode="json"),
            "inputHash": _hash(extracted.text_hash, settings.llm.model, settings.scoring.prompt_version),
            "model": settings.llm.model,
            "warnings": warnings,
        }

    @staticmethod
    def _is_empty_profile(profile: CandidateProfile, text: str) -> bool:
        """A resume with real text but nothing extracted means the model failed, not that the person has no skills."""
        return len(text.strip()) >= 500 and not profile.skills and not profile.experience

    @staticmethod
    def _ground(profile: CandidateProfile, contact, text: str, warnings: list[str]) -> CandidateProfile:
        """Deterministic facts override model output; model claims must appear in the resume to be kept."""
        lowered = text.lower()
        data = profile.model_dump(mode="python")

        if contact.email:
            data["email"] = contact.email
        elif data.get("email") and str(data["email"]).lower() not in lowered:
            data["email"] = None
            warnings.append("The model proposed an email that is not in the resume; ignored")
        if contact.phone:
            data["phone"] = contact.phone
        for key, value in (
            ("linkedin_url", contact.linkedin_url),
            ("github_url", contact.github_url),
            ("portfolio_url", contact.portfolio_url),
        ):
            data[key] = value or (data.get(key) if data.get(key) and str(data[key]).lower() in lowered else None)
        if not data.get("name") or data["name"] == "Unknown":
            data["name"] = contact.name or "Unknown"

        # Skills the model lists but the resume never mentions are hallucinations: drop them.
        kept = []
        for skill in data.get("skills") or []:
            name = str(skill.get("name", "")).strip()
            if name and re.search(rf"(?<![a-z0-9]){re.escape(name.lower())}(?![a-z0-9])", lowered):
                kept.append(skill)
            elif name:
                from app.services.scoring import _SKILL_ALIASES, normalize_skill

                canon = normalize_skill(name)
                aliases = {canon} | {a for a, c in _SKILL_ALIASES.items() if c == canon}
                if any(re.search(rf"(?<![a-z0-9]){re.escape(a)}(?![a-z0-9])", lowered) for a in aliases):
                    kept.append(skill)
        dropped = len(data.get("skills") or []) - len(kept)
        if dropped:
            warnings.append(f"{dropped} skill(s) proposed by the model were not found in the resume text and were dropped")
        data["skills"] = kept

        validated = CandidateProfile(**data)
        dated = total_experience_years(validated)
        if dated is not None:
            data["total_experience_years"] = min(50.0, dated)
            validated = CandidateProfile(**data)
        else:
            warnings.append("No dated employment entries; total experience is the model's reading of the resume")
        return validated

    # -------------------------------------------------------------------- index

    async def index(self, candidate_id: str, resume_id: str, job_id: Optional[str], file_path: str, file_name: str = "") -> dict:
        extracted = await self._read(file_path)
        try:
            chunks = await self.pdf.chunk_text(extracted.text, candidate_id, resume_id, job_id, file_name or resume_id)
            async with self._embed_semaphore():
                await self.qdrant.upsert_chunks(chunks)  # embeds, then upserts with deterministic point ids
        except Exception as e:  # noqa: BLE001
            raise map_dependency_error(e) from e
        return {"chunksStored": len(chunks), "textHash": extracted.text_hash}

    # -------------------------------------------------------------------- score

    async def _retrieve(self, candidate_id: str, job: JobDescription, limit: int = 20) -> tuple[list[float], list[ResumeChunk]]:
        try:
            async with self._embed_semaphore():
                query_embedding = await self.embedding.embed_text(f"{job.title}\n{job.description}".strip())
            chunks = await self.qdrant.search_similar(query_embedding, candidate_id, None, limit)
        except Exception as e:  # noqa: BLE001
            raise map_dependency_error(e) from e
        if not chunks:
            raise TransientDependencyError("NOT_INDEXED", "No resume chunks are stored for this candidate yet")
        return query_embedding, chunks

    async def score(self, candidate_id: str, job: JobDescription, profile: CandidateProfile, file_path: str) -> dict:
        extracted = await self._read(file_path)
        query_embedding, chunks = await self._retrieve(candidate_id, job)
        embeddings = [c.embedding for c in chunks if c.embedding]
        if len(embeddings) < len(chunks):
            try:
                missing = [c for c in chunks if not c.embedding]
                vectors = await self.embedding.embed_batch([c.text for c in missing])
                for chunk, vector in zip(missing, vectors):
                    chunk.embedding = vector
                embeddings = [c.embedding for c in chunks if c.embedding]
            except Exception as e:  # noqa: BLE001
                raise map_dependency_error(e) from e

        score = self._scoring.score_candidate_job(
            candidate=profile,
            job=job,
            candidate_chunks=chunks,
            query_embedding=query_embedding,
            chunk_embeddings=embeddings,
            resume_text=extracted.text,
        )
        score.candidate_id = candidate_id
        score.job_id = job.job_id
        return {"matchScore": score.to_wire(), "inputHash": _hash(extracted.text_hash, job_input_hash(job), settings.scoring.scoring_version)}

    # ------------------------------------------------------------------ summary

    async def summary(self, candidate_id: str, job: JobDescription, profile: CandidateProfile, match_score: Optional[MatchScore], file_path: str) -> dict:
        extracted = await self._read(file_path)
        _, chunks = await self._retrieve(candidate_id, job, limit=max(settings.reranker.top_k, 20))
        service = RAGSummaryService(self.reranker, self.profile_service.llm)
        try:
            result: RAGSummary = await service.generate_summary(
                candidate=profile,
                job=job,
                retrieved_chunks=chunks,
                match_score=match_score,
                candidate_id=candidate_id,
                query=f"{job.title}\n{job.description}".strip(),
                resume_text=extracted.text,
            )
        except Exception as e:  # noqa: BLE001
            raise map_dependency_error(e) from e
        result.candidate_id = candidate_id
        result.job_id = job.job_id
        return {
            "ragSummary": result.to_wire(),
            "inputHash": _hash(extracted.text_hash, job_input_hash(job), settings.llm.model, settings.scoring.prompt_version),
        }


_pipeline: Optional[ResumePipeline] = None


def get_pipeline() -> ResumePipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = ResumePipeline()
    return _pipeline
