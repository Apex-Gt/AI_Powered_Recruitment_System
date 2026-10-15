"""Inngest workflows.

Every ``step.run`` result is memoised by Inngest as JSON and handed back on the next
invocation of the function, so any step that returns a pydantic model passes
``output_type=`` to have it re-hydrated (the client uses ``PydanticSerializer``).
Step ids are static so replays line up with the memoised state.
"""

import asyncio
from typing import Optional

import httpx
import inngest

from app.core.config import settings
from app.core.logging import get_logger
from app.models.schemas import (
    CandidateProfile,
    JobDescription,
    MatchScore,
    RAGSummary,
    RankedCandidate,
    RankingResult,
    ResumeChunk,
)
from app.services.pdf_processor import CandidateExtractionService, PDFProcessingService
from app.services.rag_summary import RAGSummaryService
from app.services.registry import get_embedding_service, get_qdrant_service, get_reranker_service
from app.services.scoring import ScoringService

logger = get_logger(__name__)

embedding_service = get_embedding_service()
qdrant_service = get_qdrant_service()
reranker_service = get_reranker_service()
pdf_processor = PDFProcessingService()
candidate_extractor = CandidateExtractionService()
scoring_service = ScoringService()
rag_service = RAGSummaryService(reranker_service)

_client_kwargs: dict = {}
if settings.inngest.dev_mode and settings.environment != "production":
    _client_kwargs = {
        "api_base_url": settings.inngest.base_url,
        "event_api_base_url": settings.inngest.base_url,
    }

inngest_client = inngest.Inngest(
    app_id="ai-service",
    event_key=settings.inngest.event_key or None,
    signing_key=settings.inngest.signing_key or None,
    is_production=settings.environment == "production" or not settings.inngest.dev_mode,
    serializer=inngest.PydanticSerializer(),
    **_client_kwargs,
)

MAX_RANKING_FETCH_CONCURRENCY = 10


# --------------------------------------------------------------------------- #
# Workflow handlers (plain coroutines so they can be unit-tested directly)
# --------------------------------------------------------------------------- #


async def ingest_resume_handler(ctx: inngest.Context, step: inngest.Step) -> dict:
    event_data = ctx.event.data
    candidate_id = event_data["candidate_id"]
    resume_id = event_data["resume_id"]
    job_id = event_data.get("job_id")
    pdf_path = event_data["pdf_path"]
    source_pdf = event_data["source_pdf"]
    logger.info("ingest_resume_started", candidate_id=candidate_id, resume_id=resume_id)

    try:
        text = await step.run("extract_pdf_text", pdf_processor.extract_text_from_pdf, pdf_path)

        chunks = await step.run(
            "chunk_text",
            pdf_processor.chunk_text,
            text,
            candidate_id,
            resume_id,
            job_id,
            source_pdf,
            output_type=list[ResumeChunk],
        )

        await step.run("embed_and_store_chunks", qdrant_service.upsert_chunks, chunks)

        profile: Optional[CandidateProfile] = None
        if settings.llm.is_configured:
            profile = await step.run(
                "extract_candidate_profile",
                candidate_extractor.extract_candidate_profile,
                text,
                output_type=CandidateProfile,
            )
            await step.run("store_candidate_profile", _store_candidate_profile, candidate_id, profile)
        else:
            logger.warning("profile_extraction_skipped_llm_not_configured", candidate_id=candidate_id)

        logger.info("ingest_resume_completed", candidate_id=candidate_id, resume_id=resume_id, chunks=len(chunks))
        return {
            "status": "completed",
            "candidate_id": candidate_id,
            "resume_id": resume_id,
            "job_id": job_id,
            "chunks_stored": len(chunks),
            "candidate_profile": profile.model_dump(mode="json") if profile else None,
        }
    except Exception as e:
        logger.error("ingest_resume_failed", error=str(e), candidate_id=candidate_id)
        raise


async def score_job_handler(ctx: inngest.Context, step: inngest.Step) -> dict:
    event_data = ctx.event.data
    candidate_id = event_data["candidate_id"]
    job_id = event_data["job_id"]
    job = JobDescription.model_validate(event_data["job_description"])
    logger.info("score_job_started", candidate_id=candidate_id, job_id=job_id)

    try:
        query_embedding = await step.run(
            "embed_job_description",
            embedding_service.embed_text,
            f"{job.title}\n{job.description}".strip(),
        )

        candidate_chunks = await step.run(
            "retrieve_candidate_chunks",
            qdrant_service.search_similar,
            query_embedding,
            candidate_id,
            None,
            20,
            output_type=list[ResumeChunk],
        )

        if not candidate_chunks:
            logger.warning("no_chunks_found_for_candidate", candidate_id=candidate_id, job_id=job_id)
            return {
                "status": "completed",
                "candidate_id": candidate_id,
                "job_id": job_id,
                "match_score": None,
                "warning": "No resume chunks found for candidate",
            }

        candidate_profile = await step.run(
            "get_candidate_profile_from_spring",
            _fetch_candidate_profile,
            candidate_id,
            output_type=Optional[CandidateProfile],
        )

        if candidate_profile is None:
            candidate_profile = await step.run(
                "extract_profile_from_chunks",
                _extract_profile_from_chunks,
                candidate_chunks,
                output_type=CandidateProfile,
            )

        chunk_embeddings = await step.run("get_chunk_embeddings", _get_chunk_embeddings, candidate_chunks)

        match_score = await step.run(
            "calculate_match_score",
            _calculate_match_score,
            candidate_profile,
            job,
            candidate_chunks,
            query_embedding,
            chunk_embeddings,
            candidate_id,
            job_id,
            output_type=MatchScore,
        )

        await step.run("store_match_score_in_spring", _store_match_score, match_score)

        logger.info("score_job_completed", candidate_id=candidate_id, job_id=job_id, score=match_score.overall_score)
        return {
            "status": "completed",
            "candidate_id": candidate_id,
            "job_id": job_id,
            "match_score": match_score.model_dump(mode="json"),
        }
    except Exception as e:
        logger.error("score_job_failed", error=str(e), candidate_id=candidate_id, job_id=job_id)
        raise


async def rag_summary_handler(ctx: inngest.Context, step: inngest.Step) -> dict:
    event_data = ctx.event.data
    candidate_id = event_data["candidate_id"]
    job_id = event_data["job_id"]
    query = event_data.get("query") or ""
    top_k = event_data.get("top_k") or 10
    logger.info("rag_summary_started", candidate_id=candidate_id, job_id=job_id)

    try:
        if event_data.get("job_description"):
            job = JobDescription.model_validate(event_data["job_description"])
        else:
            job = await step.run(
                "get_job_description",
                _fetch_job_description,
                job_id,
                output_type=Optional[JobDescription],
            )
        if job is None:
            raise inngest.NonRetriableError(
                f"No job description available for job {job_id}: pass jobDescription in the request "
                "or expose GET /api/jobs/{id}/description on the backend"
            )

        search_text = (query or f"{job.title}\n{job.description}").strip()
        query_embedding = await step.run("embed_query", embedding_service.embed_text, search_text)

        retrieved_chunks = await step.run(
            "retrieve_relevant_chunks",
            qdrant_service.search_similar,
            query_embedding,
            candidate_id,
            None,
            max(top_k, 20),
            output_type=list[ResumeChunk],
        )

        if not retrieved_chunks:
            logger.warning("no_chunks_for_rag", candidate_id=candidate_id, job_id=job_id)
            return {
                "status": "completed",
                "candidate_id": candidate_id,
                "job_id": job_id,
                "rag_summary": None,
                "warning": "No relevant chunks found",
            }

        candidate_profile = await step.run(
            "get_candidate_profile",
            _fetch_candidate_profile,
            candidate_id,
            output_type=Optional[CandidateProfile],
        )
        if candidate_profile is None:
            candidate_profile = await step.run(
                "extract_profile_from_chunks",
                _extract_profile_from_chunks,
                retrieved_chunks,
                output_type=CandidateProfile,
            )

        match_score = await step.run(
            "get_match_score",
            _fetch_match_score,
            candidate_id,
            job_id,
            output_type=Optional[MatchScore],
        )

        rag_summary = await step.run(
            "generate_rag_summary",
            _generate_rag_summary,
            candidate_profile,
            job,
            retrieved_chunks,
            match_score,
            candidate_id,
            search_text,
            output_type=RAGSummary,
        )

        await step.run("store_rag_summary", _store_rag_summary, rag_summary)

        logger.info("rag_summary_completed", candidate_id=candidate_id, job_id=job_id)
        return {
            "status": "completed",
            "candidate_id": candidate_id,
            "job_id": job_id,
            "rag_summary": rag_summary.model_dump(mode="json"),
        }
    except Exception as e:
        logger.error("rag_summary_failed", error=str(e), candidate_id=candidate_id, job_id=job_id)
        raise


async def rank_candidates_handler(ctx: inngest.Context, step: inngest.Step) -> dict:
    event_data = ctx.event.data
    job_id = event_data["job_id"]
    candidate_ids = event_data["candidate_ids"]
    logger.info("rank_candidates_started", job_id=job_id, candidates=len(candidate_ids))

    try:
        match_scores = await step.run(
            "fetch_all_match_scores",
            _fetch_all_match_scores,
            job_id,
            candidate_ids,
            output_type=list[MatchScore],
        )

        if not match_scores:
            logger.warning("no_match_scores_for_ranking", job_id=job_id)
            return {
                "status": "completed",
                "job_id": job_id,
                "ranked_candidates": [],
                "warning": "No match scores available",
            }

        sorted_scores = sorted(match_scores, key=lambda s: (-s.overall_score, s.candidate_id))

        rag_summaries = await step.run(
            "fetch_rag_summaries",
            _fetch_rag_summaries,
            job_id,
            [s.candidate_id for s in sorted_scores],
            output_type=dict[str, Optional[RAGSummary]],
        )

        ranked = [
            RankedCandidate(
                candidate_id=score.candidate_id,
                job_id=job_id,
                rank=rank,
                overall_score=score.overall_score,
                match_score=score,
                rag_summary=rag_summaries.get(score.candidate_id),
            )
            for rank, score in enumerate(sorted_scores, 1)
        ]
        ranking = RankingResult(
            job_id=job_id,
            candidates=ranked,
            total_candidates=len(ranked),
            scoring_version=settings.scoring.scoring_version,
        )

        await step.run("store_ranking_results", _store_ranking_results, ranking)

        logger.info("rank_candidates_completed", job_id=job_id, candidates=len(ranked))
        return {
            "status": "completed",
            "job_id": job_id,
            "ranked_candidates": [r.model_dump(mode="json") for r in ranked],
        }
    except Exception as e:
        logger.error("rank_candidates_failed", error=str(e), job_id=job_id)
        raise


# --------------------------------------------------------------------------- #
# Function registration (served by app.api.main via inngest.fast_api.serve)
# --------------------------------------------------------------------------- #

def _register(fn_id: str, event: str, handler):
    """Register ``handler(ctx, step)``. The inngest 0.5 SDK calls functions with ``ctx`` only
    and exposes the step API as ``ctx.step``, so adapt it here and keep handlers easy to test."""

    async def entrypoint(ctx: inngest.Context) -> dict:
        return await handler(ctx, ctx.step)

    entrypoint.__name__ = handler.__name__.replace("_handler", "_workflow")
    return inngest_client.create_function(
        fn_id=fn_id,
        trigger=inngest.TriggerEvent(event=event),
        retries=3,
    )(entrypoint)


ingest_resume_workflow = _register("candidate/ingest-resume", "candidate/ingest-resume", ingest_resume_handler)
score_job_workflow = _register("candidate/score-job", "candidate/score-job", score_job_handler)
rag_summary_workflow = _register("candidate/rag-summary", "candidate/rag-summary", rag_summary_handler)
rank_candidates_workflow = _register("job/rank-candidates", "job/rank-candidates", rank_candidates_handler)

ALL_FUNCTIONS = [
    ingest_resume_workflow,
    score_job_workflow,
    rag_summary_workflow,
    rank_candidates_workflow,
]


# --------------------------------------------------------------------------- #
# Step helpers
# --------------------------------------------------------------------------- #


def _spring_client() -> httpx.AsyncClient:
    headers = {"Content-Type": "application/json"}
    if settings.spring_boot.api_key:
        headers["X-API-Key"] = settings.spring_boot.api_key
    return httpx.AsyncClient(
        base_url=settings.spring_boot.base_url,
        timeout=settings.spring_boot.timeout,
        headers=headers,
    )


async def _spring_get_json(path: str) -> Optional[dict]:
    """GET a JSON object from Spring; None when it is absent (404) or unreachable."""
    try:
        async with _spring_client() as client:
            response = await client.get(path)
        if response.status_code == 200:
            body = response.json()
            if isinstance(body, dict) and isinstance(body.get("data"), dict):
                return body["data"]  # unwrap the backend's {status, message, data} envelope
            return body
        if response.status_code != 404:
            logger.warning("spring_get_unexpected_status", path=path, status=response.status_code)
    except Exception as e:
        logger.warning("spring_get_failed", path=path, error=str(e))
    return None


async def _spring_post(path: str, payload: dict) -> None:
    """POST to Spring; raises on any failure so the Inngest step is retried."""
    async with _spring_client() as client:
        response = await client.post(path, json=payload)
    response.raise_for_status()


async def _fetch_candidate_profile(candidate_id: str) -> Optional[CandidateProfile]:
    body = await _spring_get_json(f"/api/candidates/{candidate_id}/profile")
    if body is None:
        return None
    try:
        return CandidateProfile.model_validate(body)
    except Exception as e:
        logger.warning("candidate_profile_invalid", candidate_id=candidate_id, error=str(e))
        return None


async def _extract_profile_from_chunks(chunks: list[ResumeChunk]) -> CandidateProfile:
    if not settings.llm.is_configured:
        raise inngest.NonRetriableError(
            "No candidate profile available from the backend and LLM_API_KEY is not set, "
            "so one cannot be extracted from the resume text"
        )
    ordered = sorted(chunks, key=lambda c: c.metadata.get("start_char_idx") or 0)
    full_text = "\n\n".join(c.text for c in ordered)
    return await candidate_extractor.extract_candidate_profile(full_text)


async def _get_chunk_embeddings(chunks: list[ResumeChunk]) -> list[list[float]]:
    missing = [c for c in chunks if not c.embedding]
    if missing:
        vectors = await embedding_service.embed_batch([c.text for c in missing])
        for chunk, vector in zip(missing, vectors):
            chunk.embedding = vector
    return [c.embedding for c in chunks if c.embedding]


async def _calculate_match_score(
    candidate: CandidateProfile,
    job: JobDescription,
    candidate_chunks: list[ResumeChunk],
    query_embedding: list[float],
    chunk_embeddings: list[list[float]],
    candidate_id: str,
    job_id: str,
) -> MatchScore:
    score = scoring_service.score_candidate_job(
        candidate=candidate,
        job=job,
        candidate_chunks=candidate_chunks,
        query_embedding=query_embedding,
        chunk_embeddings=chunk_embeddings,
    )
    score.candidate_id = candidate_id
    score.job_id = job_id
    return score


async def _generate_rag_summary(
    candidate: CandidateProfile,
    job: JobDescription,
    chunks: list[ResumeChunk],
    match_score: Optional[MatchScore],
    candidate_id: str,
    query: str,
) -> RAGSummary:
    summary = await rag_service.generate_summary(
        candidate=candidate,
        job=job,
        retrieved_chunks=chunks,
        match_score=match_score,
        candidate_id=candidate_id,
        query=query,
    )
    summary.candidate_id = candidate_id
    summary.job_id = job.job_id or summary.job_id
    return summary


async def _store_candidate_profile(candidate_id: str, profile: CandidateProfile) -> None:
    payload = profile.model_dump(mode="json")
    payload["candidateId"] = candidate_id
    await _spring_post("/api/ai/candidate-profile", payload)


async def _store_match_score(match_score: MatchScore) -> None:
    await _spring_post("/api/ai/match-scores", match_score.to_wire())


async def _fetch_job_description(job_id: str) -> Optional[JobDescription]:
    body = await _spring_get_json(f"/api/jobs/{job_id}/description")
    if body is None:
        return None
    try:
        return JobDescription.model_validate(body)
    except Exception as e:
        logger.warning("job_description_invalid", job_id=job_id, error=str(e))
        return None


async def _fetch_match_score(candidate_id: str, job_id: str) -> Optional[MatchScore]:
    body = await _spring_get_json(f"/api/ai/match-scores/{candidate_id}/{job_id}")
    if body is None:
        return None
    try:
        return MatchScore.model_validate(body)
    except Exception as e:
        logger.warning("match_score_invalid", candidate_id=candidate_id, job_id=job_id, error=str(e))
        return None


async def _fetch_all_match_scores(job_id: str, candidate_ids: list[str]) -> list[MatchScore]:
    semaphore = asyncio.Semaphore(MAX_RANKING_FETCH_CONCURRENCY)

    async def fetch(candidate_id: str) -> Optional[MatchScore]:
        async with semaphore:
            return await _fetch_match_score(candidate_id, job_id)

    results = await asyncio.gather(*(fetch(cid) for cid in dict.fromkeys(candidate_ids)))
    scores = [r for r in results if r is not None]
    if len(scores) < len(set(candidate_ids)):
        logger.warning(
            "match_scores_missing_for_ranking",
            job_id=job_id,
            requested=len(set(candidate_ids)),
            found=len(scores),
        )
    return scores


async def _fetch_rag_summary(candidate_id: str, job_id: str) -> Optional[RAGSummary]:
    body = await _spring_get_json(f"/api/ai/rag-summaries/{candidate_id}/{job_id}")
    if body is None:
        return None
    try:
        return RAGSummary.model_validate(body)
    except Exception as e:
        logger.warning("rag_summary_invalid", candidate_id=candidate_id, job_id=job_id, error=str(e))
        return None


async def _fetch_rag_summaries(job_id: str, candidate_ids: list[str]) -> dict[str, Optional[RAGSummary]]:
    semaphore = asyncio.Semaphore(MAX_RANKING_FETCH_CONCURRENCY)

    async def fetch(candidate_id: str) -> Optional[RAGSummary]:
        async with semaphore:
            return await _fetch_rag_summary(candidate_id, job_id)

    results = await asyncio.gather(*(fetch(cid) for cid in candidate_ids))
    return dict(zip(candidate_ids, results))


async def _store_rag_summary(rag_summary: RAGSummary) -> None:
    await _spring_post("/api/ai/rag-summaries", rag_summary.to_wire())


async def _store_ranking_results(ranking: RankingResult) -> None:
    await _spring_post(f"/api/ai/rankings/{ranking.job_id}", ranking.to_wire())
