from contextlib import asynccontextmanager

import httpx
import inngest
import inngest.fast_api
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import get_logger, setup_logging
from app.models.schemas import (
    CandidateProfile,
    GradeAnswerRequest,
    HealthCheckResponse,
    IngestResumeEvent,
    MatchScore,
    RAGSummary,
    RAGSummaryEvent,
    RankCandidatesEvent,
    RankingResult,
    ScoreJobEvent,
)
from app.core.exceptions import LLMError
from app.services.answer_grader import AnswerGrader
from app.services.contact_extractor import ContactExtractionService
from app.services.pdf_processor import PDFProcessingService
from pydantic import BaseModel
from app.services.registry import get_embedding_service, get_qdrant_service, get_reranker_service
from app.workflows.ingest_resume import ALL_FUNCTIONS, inngest_client

setup_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ai_service_starting", version="0.1.0", environment=settings.environment)

    # Warm shared services. A dependency being down at boot degrades /health instead of
    # killing the process; Qdrant also initialises lazily on first use.
    try:
        await get_qdrant_service().initialize_collection()
    except Exception as e:
        logger.error("startup_qdrant_unavailable", error=str(e))
    try:
        if not await get_embedding_service().health_check():
            logger.error("startup_embedding_unhealthy")
    except Exception as e:
        logger.error("startup_embedding_failed", error=str(e))
    logger.info("startup_complete")

    yield

    logger.info("ai_service_shutting_down")


app = FastAPI(
    title="AI Recruitment Service",
    description="AI-powered microservice for resume processing, candidate scoring, and ranking",
    version="0.1.0",
    lifespan=lifespan,
)

# Origins are configured with CORS_ORIGINS (comma separated); default is closed-by-omission
# because this service is called server-to-server by the Spring backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registers GET/PUT/POST /api/inngest so the Inngest server can discover and invoke the workflows.
inngest.fast_api.serve(app, inngest_client, ALL_FUNCTIONS)


async def _inngest_status() -> str:
    if not (settings.inngest.signing_key or settings.inngest.dev_mode):
        return "not_configured"
    if not settings.inngest.dev_mode:
        return "configured"
    # In dev the server is a separate process that is easy to forget, so check that it answers.
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            await client.get(settings.inngest.base_url)
        return "configured"
    except httpx.HTTPError:
        logger.warning("inngest_unreachable", url=settings.inngest.base_url, hint="run start-inngest.cmd")
        return "unreachable"


@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    qdrant_service = get_qdrant_service()
    embedding_service = get_embedding_service()
    reranker_service = get_reranker_service()

    deps = {
        "qdrant": "healthy" if await qdrant_service.health_check() else "unhealthy",
        "embedding": "healthy" if await embedding_service.health_check() else "unhealthy",
        "reranker": "healthy" if await reranker_service.health_check() else "unhealthy",
        "inngest": await _inngest_status(),
    }

    model_config = {
        "foundation_model": settings.model.foundation_model,
        "embedding_model": settings.embedding.model_name,
        "embedding_dimensions": settings.embedding.dimensions,
        "llm_model": f"{settings.llm.model} ({settings.llm.base_url})",
        "llm_configured": str(settings.llm.is_configured).lower(),
        "embedding_provider": settings.embedding.provider,
        "reranker_provider": settings.reranker.provider,
    }

    overall_status = "healthy" if all(v in ("healthy", "configured") for v in deps.values()) else "degraded"

    return HealthCheckResponse(
        status=overall_status,
        version="0.1.0",
        environment=settings.environment,
        dependencies=deps,
        model_config_info=model_config,
    )


async def _send_event(name: str, data: dict) -> None:
    try:
        await inngest_client.send(inngest.Event(name=name, data=data))
    except Exception as e:
        logger.error("inngest_send_failed", event_name=name, error=str(e))
        raise HTTPException(
            status_code=502,
            detail=(
                f"Could not queue workflow '{name}': {e}. "
                f"Is the Inngest dev server running at {settings.inngest.base_url}? Start it with start-inngest.cmd."
            ),
        ) from e


@app.post("/api/v1/resumes/ingest")
async def ingest_resume(request: IngestResumeEvent):
    await _send_event("candidate/ingest-resume", request.model_dump(mode="json"))
    return {
        "status": "accepted",
        "message": "Resume ingestion started",
        "candidate_id": request.candidate_id,
    }


class ExtractContactRequest(BaseModel):
    pdf_path: str
    file_name: str = ""


@app.post("/api/v1/resumes/extract-contact")
async def extract_contact(request: ExtractContactRequest):
    """Synchronously read name/email/phone/location from a stored resume so the backend can build the candidate."""
    try:
        text = await PDFProcessingService().extract_text_from_pdf(request.pdf_path)
    except Exception as e:
        logger.error("contact_pdf_read_failed", error=str(e))
        raise HTTPException(status_code=422, detail=f"Could not read the resume: {e}") from e
    if not text.strip():
        raise HTTPException(status_code=422, detail="The resume has no readable text (is it a scanned image?)")
    contact, profile = await ContactExtractionService().extract_with_profile(text, request.file_name)
    # The full profile rides along so the backend can hand it to ingestion instead of paying for a second LLM pass.
    data = {**contact, "profile": profile.model_dump(mode="json") if profile else None}
    return {"status": "success", "message": "Contact details extracted", "data": data}


@app.delete("/api/v1/candidates/{candidate_id}")
async def delete_candidate(candidate_id: str):
    """Remove a candidate's resume chunks from the vector store."""
    try:
        deleted = await get_qdrant_service().delete_candidate_chunks(candidate_id)
    except Exception as e:
        logger.error("candidate_delete_failed", candidate_id=candidate_id, error=str(e))
        raise HTTPException(status_code=502, detail=f"Could not delete candidate vectors: {e}") from e
    return {"status": "deleted", "candidate_id": candidate_id, "chunks_deleted": deleted}


@app.post("/api/v1/candidates/score-job")
async def score_job(request: ScoreJobEvent):
    await _send_event("candidate/score-job", request.model_dump(mode="json"))
    return {
        "status": "accepted",
        "message": "Candidate scoring started",
        "candidate_id": request.candidate_id,
        "job_id": request.job_id,
    }


@app.post("/api/v1/candidates/rag-summary")
async def rag_summary(request: RAGSummaryEvent):
    await _send_event("candidate/rag-summary", request.model_dump(mode="json", exclude_none=True))
    return {
        "status": "accepted",
        "message": "RAG summary generation started",
        "candidate_id": request.candidate_id,
        "job_id": request.job_id,
    }


@app.post("/api/v1/jobs/rank-candidates")
async def rank_candidates(request: RankCandidatesEvent):
    await _send_event("job/rank-candidates", request.model_dump(mode="json"))
    return {
        "status": "accepted",
        "message": "Candidate ranking started",
        "job_id": request.job_id,
        "candidate_count": len(request.candidate_ids),
    }


async def _proxy_spring_get(path: str, not_found: str):
    try:
        async with httpx.AsyncClient(
            base_url=settings.spring_boot.base_url,
            timeout=settings.spring_boot.timeout,
            headers={"X-API-Key": settings.spring_boot.api_key} if settings.spring_boot.api_key else None,
        ) as client:
            response = await client.get(path)
    except httpx.HTTPError as e:
        logger.error("spring_request_failed", path=path, error=str(e))
        raise HTTPException(status_code=502, detail=f"Backend unreachable: {e}") from e

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail=not_found)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=f"Backend returned {response.status_code}")
    return response.json()


@app.get("/api/v1/candidates/{candidate_id}/match-score/{job_id}")
async def get_match_score(candidate_id: str, job_id: str):
    return await _proxy_spring_get(f"/api/ai/match-scores/{candidate_id}/{job_id}", "Match score not found")


@app.get("/api/v1/candidates/{candidate_id}/rag-summary/{job_id}")
async def get_rag_summary(candidate_id: str, job_id: str):
    return await _proxy_spring_get(f"/api/ai/rag-summaries/{candidate_id}/{job_id}", "RAG summary not found")


@app.get("/api/v1/jobs/{job_id}/ranking")
async def get_ranking(job_id: str):
    return await _proxy_spring_get(f"/api/ai/rankings/{job_id}", "Ranking not found")


@app.post("/api/v1/internal/candidate-profile")
async def receive_candidate_profile(profile: CandidateProfile):
    return {"status": "received", "candidate_name": profile.name}


@app.post("/api/v1/internal/match-score")
async def receive_match_score(score: MatchScore):
    return {"status": "received", "candidate_id": score.candidate_id, "job_id": score.job_id}


@app.post("/api/v1/internal/rag-summary")
async def receive_rag_summary(summary: RAGSummary):
    return {"status": "received", "candidate_id": summary.candidate_id, "job_id": summary.job_id}


@app.post("/api/v1/internal/ranking")
async def receive_ranking(ranking: RankingResult):
    return {"status": "received", "job_id": ranking.job_id, "candidates": ranking.total_candidates}


@app.post("/api/v1/assessments/grade")
async def grade_assessment_answer(request: GradeAnswerRequest):
    """Synchronously grade one code/essay answer; the Spring backend calls this when a candidate submits."""
    try:
        result = await AnswerGrader().grade(request)
    except LLMError as e:
        logger.error("answer_grading_failed", error=str(e))
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"status": "success", "message": "Answer graded", "data": result.to_wire()}
