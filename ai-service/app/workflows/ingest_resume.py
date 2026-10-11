import inngest
import structlog
import uuid
from typing import Optional

from app.core.config import settings
from app.core.logging import get_logger
from app.models.schemas import (
    IngestResumeEvent,
    ScoreJobEvent,
    RAGSummaryEvent,
    RankCandidatesEvent,
    CandidateProfile,
    JobDescription,
    MatchScore,
    ResumeChunk,
)
from app.services.pdf_processor import PDFProcessingService, CandidateExtractionService
from app.services.embedding import create_embedding_service
from app.services.qdrant import QdrantService
from app.services.scoring import ScoringService
from app.services.rag_summary import RAGSummaryService
from app.services.reranker import create_reranker_service

logger = get_logger(__name__)

embedding_service = create_embedding_service()
qdrant_service = QdrantService(embedding_service)
pdf_processor = PDFProcessingService()
candidate_extractor = CandidateExtractionService()
scoring_service = ScoringService()
reranker_service = create_reranker_service()
rag_service = RAGSummaryService(reranker_service)

inngest_client = inngest.Inngest(
    app_id="ai-service",
    signing_key=settings.inngest.signing_key,
    api_base_url=settings.inngest.base_url,
    is_production=not settings.inngest.dev_mode,
)


@inngest_client.create_function(
    fn_id="candidate/ingest-resume",
    trigger=inngest.TriggerEvent(event="candidate/ingest-resume"),
    retries=3,
)
async def ingest_resume_workflow(ctx: inngest.Context, step: inngest.Step) -> dict:
    event_data = ctx.event.data
    logger.info("ingest_resume_started", event=event_data)

    candidate_id = event_data["candidate_id"]
    resume_id = event_data["resume_id"]
    job_id = event_data.get("job_id")
    pdf_path = event_data["pdf_path"]
    source_pdf = event_data["source_pdf"]

    try:
        text = await step.run(
            "extract_pdf_text",
            lambda: pdf_processor.extract_text_from_pdf(pdf_path),
        )

        chunks = await step.run(
            "chunk_text",
            lambda: pdf_processor.chunk_text(text, candidate_id, resume_id, job_id, source_pdf),
        )

        profile = await step.run(
            "extract_candidate_profile",
            lambda: candidate_extractor.extract_candidate_profile(text),
        )

        await step.run(
            "embed_and_store_chunks",
            lambda: qdrant_service.upsert_chunks(chunks),
        )

        logger.info("ingest_resume_completed", candidate_id=candidate_id, resume_id=resume_id, chunks=len(chunks))

        return {
            "status": "completed",
            "candidate_id": candidate_id,
            "resume_id": resume_id,
            "job_id": job_id,
            "chunks_stored": len(chunks),
            "candidate_profile": profile.model_dump(),
        }

    except Exception as e:
        logger.error("ingest_resume_failed", error=str(e), candidate_id=candidate_id)
        raise


@inngest_client.create_function(
    fn_id="candidate/score-job",
    trigger=inngest.TriggerEvent(event="candidate/score-job"),
    retries=3,
)
async def score_job_workflow(ctx: inngest.Context, step: inngest.Step) -> dict:
    event_data = ctx.event.data
    logger.info("score_job_started", event=event_data)

    candidate_id = event_data["candidate_id"]
    job_id = event_data["job_id"]
    job_description_data = event_data["job_description"]

    job = JobDescription(**job_description_data)

    try:
        query_embedding = await step.run(
            "embed_job_description",
            lambda: embedding_service.embed_text(job.description),
        )

        candidate_chunks = await step.run(
            "retrieve_candidate_chunks",
            lambda: qdrant_service.search_similar(
                query_embedding=query_embedding,
                candidate_id=candidate_id,
                top_k=20,
            ),
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
            lambda: _fetch_candidate_profile(candidate_id),
        )

        if candidate_profile is None:
            candidate_profile = await step.run(
                "extract_profile_from_chunks",
                lambda: _extract_profile_from_chunks(candidate_chunks),
            )

        chunk_embeddings = await step.run(
            "get_chunk_embeddings",
            lambda: _get_chunk_embeddings(candidate_chunks),
        )

        match_score = await step.run(
            "calculate_match_score",
            lambda: scoring_service.score_candidate_job(
                candidate=candidate_profile,
                job=job,
                candidate_chunks=candidate_chunks,
                query_embedding=query_embedding,
                chunk_embeddings=chunk_embeddings,
            ),
        )

        match_score.candidate_id = candidate_id
        match_score.job_id = job_id

        await step.run(
            "store_match_score_in_spring",
            lambda: _store_match_score(match_score),
        )

        logger.info("score_job_completed", candidate_id=candidate_id, job_id=job_id, score=match_score.overall_score)

        return {
            "status": "completed",
            "candidate_id": candidate_id,
            "job_id": job_id,
            "match_score": match_score.model_dump(),
        }

    except Exception as e:
        logger.error("score_job_failed", error=str(e), candidate_id=candidate_id, job_id=job_id)
        raise


@inngest_client.create_function(
    fn_id="candidate/rag-summary",
    trigger=inngest.TriggerEvent(event="candidate/rag-summary"),
    retries=3,
)
async def rag_summary_workflow(ctx: inngest.Context, step: inngest.Step) -> dict:
    event_data = ctx.event.data
    logger.info("rag_summary_started", event=event_data)

    candidate_id = event_data["candidate_id"]
    job_id = event_data["job_id"]
    query = event_data.get("query", "")
    top_k = event_data.get("top_k", 10)

    try:
        query_embedding = await step.run(
            "embed_query",
            lambda: embedding_service.embed_text(query or f"Job {job_id} candidate {candidate_id}"),
        )

        retrieved_chunks = await step.run(
            "retrieve_relevant_chunks",
            lambda: qdrant_service.search_similar(
                query_embedding=query_embedding,
                candidate_id=candidate_id,
                top_k=max(top_k, 20),
            ),
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
            lambda: _fetch_candidate_profile(candidate_id),
        )

        job = await step.run(
            "get_job_description",
            lambda: _fetch_job_description(job_id),
        )

        match_score = await step.run(
            "get_match_score",
            lambda: _fetch_match_score(candidate_id, job_id),
        )

        rag_summary = await step.run(
            "generate_rag_summary",
            lambda: rag_service.generate_summary(
                candidate=candidate_profile,
                job=job,
                retrieved_chunks=retrieved_chunks,
                match_score=match_score,
            ),
        )

        rag_summary.candidate_id = candidate_id
        rag_summary.job_id = job_id

        await step.run(
            "store_rag_summary",
            lambda: _store_rag_summary(rag_summary),
        )

        logger.info("rag_summary_completed", candidate_id=candidate_id, job_id=job_id)

        return {
            "status": "completed",
            "candidate_id": candidate_id,
            "job_id": job_id,
            "rag_summary": rag_summary.model_dump(),
        }

    except Exception as e:
        logger.error("rag_summary_failed", error=str(e), candidate_id=candidate_id, job_id=job_id)
        raise


@inngest_client.create_function(
    fn_id="job/rank-candidates",
    trigger=inngest.TriggerEvent(event="job/rank-candidates"),
    retries=3,
)
async def rank_candidates_workflow(ctx: inngest.Context, step: inngest.Step) -> dict:
    event_data = ctx.event.data
    logger.info("rank_candidates_started", event=event_data)

    job_id = event_data["job_id"]
    candidate_ids = event_data["candidate_ids"]

    try:
        match_scores = await step.run(
            "fetch_all_match_scores",
            lambda: _fetch_all_match_scores(job_id, candidate_ids),
        )

        if not match_scores:
            logger.warning("no_match_scores_for_ranking", job_id=job_id)
            return {
                "status": "completed",
                "job_id": job_id,
                "ranked_candidates": [],
                "warning": "No match scores available",
            }

        sorted_scores = sorted(match_scores, key=lambda x: x.overall_score, reverse=True)

        ranked_candidates = []
        for rank, score in enumerate(sorted_scores, 1):
            rag_summary = await step.run(
                f"fetch_rag_summary_{score.candidate_id}",
                lambda cid=score.candidate_id: _fetch_rag_summary(cid, job_id),
            )

            ranked_candidates.append({
                "candidate_id": score.candidate_id,
                "job_id": job_id,
                "rank": rank,
                "overall_score": score.overall_score,
                "match_score": score.model_dump(),
                "rag_summary": rag_summary.model_dump() if rag_summary else None,
            })

        await step.run(
            "store_ranking_results",
            lambda: _store_ranking_results(job_id, ranked_candidates),
        )

        logger.info("rank_candidates_completed", job_id=job_id, candidates=len(ranked_candidates))

        return {
            "status": "completed",
            "job_id": job_id,
            "ranked_candidates": ranked_candidates,
        }

    except Exception as e:
        logger.error("rank_candidates_failed", error=str(e), job_id=job_id)
        raise


async def _fetch_candidate_profile(candidate_id: str) -> Optional[CandidateProfile]:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.spring_boot.base_url}/api/candidates/{candidate_id}/profile")
            if response.status_code == 200:
                return CandidateProfile(**response.json())
    except Exception as e:
        logger.warning("fetch_candidate_profile_failed", candidate_id=candidate_id, error=str(e))
    return None


async def _extract_profile_from_chunks(chunks: list[ResumeChunk]) -> CandidateProfile:
    full_text = "\n\n".join([c.text for c in chunks])
    return await candidate_extractor.extract_candidate_profile(full_text)


async def _get_chunk_embeddings(chunks: list[ResumeChunk]) -> list[list[float]]:
    embeddings = []
    for chunk in chunks:
        if chunk.embedding:
            embeddings.append(chunk.embedding)
        else:
            emb = await embedding_service.embed_text(chunk.text)
            embeddings.append(emb)
    return embeddings


async def _store_match_score(match_score: MatchScore) -> None:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{settings.spring_boot.base_url}/api/ai/match-scores",
                json=match_score.model_dump(),
            )
    except Exception as e:
        logger.error("store_match_score_failed", error=str(e))


async def _fetch_job_description(job_id: str) -> JobDescription:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.spring_boot.base_url}/api/jobs/{job_id}/description")
            if response.status_code == 200:
                return JobDescription(**response.json())
    except Exception as e:
        logger.warning("fetch_job_description_failed", job_id=job_id, error=str(e))
    return JobDescription(job_id=job_id, title="", company_id="", description="")


async def _fetch_match_score(candidate_id: str, job_id: str) -> Optional[MatchScore]:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.spring_boot.base_url}/api/ai/match-scores/{candidate_id}/{job_id}")
            if response.status_code == 200:
                return MatchScore(**response.json())
    except Exception as e:
        logger.warning("fetch_match_score_failed", candidate_id=candidate_id, job_id=job_id, error=str(e))
    return None


async def _fetch_all_match_scores(job_id: str, candidate_ids: list[str]) -> list[MatchScore]:
    import httpx
    scores = []
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for cid in candidate_ids:
                response = await client.get(f"{settings.spring_boot.base_url}/api/ai/match-scores/{cid}/{job_id}")
                if response.status_code == 200:
                    scores.append(MatchScore(**response.json()))
    except Exception as e:
        logger.warning("fetch_all_match_scores_failed", job_id=job_id, error=str(e))
    return scores


async def _fetch_rag_summary(candidate_id: str, job_id: str):
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.spring_boot.base_url}/api/ai/rag-summaries/{candidate_id}/{job_id}")
            if response.status_code == 200:
                from app.models.schemas import RAGSummary
                return RAGSummary(**response.json())
    except Exception as e:
        logger.warning("fetch_rag_summary_failed", candidate_id=candidate_id, job_id=job_id, error=str(e))
    return None


async def _store_rag_summary(rag_summary) -> None:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{settings.spring_boot.base_url}/api/ai/rag-summaries",
                json=rag_summary.model_dump(),
            )
    except Exception as e:
        logger.error("store_rag_summary_failed", error=str(e))


async def _store_ranking_results(job_id: str, ranked_candidates: list) -> None:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{settings.spring_boot.base_url}/api/ai/rankings/{job_id}",
                json={"ranked_candidates": ranked_candidates},
            )
    except Exception as e:
        logger.error("store_ranking_results_failed", job_id=job_id, error=str(e))