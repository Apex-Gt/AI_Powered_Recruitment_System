from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import structlog

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.exceptions import AIServiceError
from app.models.schemas import (
    HealthCheckResponse,
    IngestResumeEvent,
    ScoreJobEvent,
    RAGSummaryEvent,
    RankCandidatesEvent,
    CandidateProfile,
    JobDescription,
    MatchScore,
    RAGSummary,
    RankingResult,
)
from app.workflows.ingest_resume import inngest_client

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.log_level)
    logger.info("ai_service_starting", version="0.1.0", environment=settings.environment)

    try:
        from app.services.embedding import create_embedding_service
        from app.services.qdrant import QdrantService

        embedding_service = create_embedding_service()
        qdrant_service = QdrantService(embedding_service)
        await qdrant_service.initialize_collection()
        await embedding_service.health_check()
        logger.info("startup_validation_passed")
    except Exception as e:
        logger.error("startup_validation_failed", error=str(e))
        raise

    yield

    logger.info("ai_service_shutting_down")


app = FastAPI(
    title="AI Recruitment Service",
    description="AI-powered microservice for resume processing, candidate scoring, and ranking",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    from app.services.embedding import create_embedding_service
    from app.services.qdrant import QdrantService
    from app.services.reranker import create_reranker_service

    embedding_service = create_embedding_service()
    qdrant_service = QdrantService(embedding_service)
    reranker_service = create_reranker_service()

    deps = {}
    deps["qdrant"] = "healthy" if await qdrant_service.health_check() else "unhealthy"
    deps["embedding"] = "healthy" if await embedding_service.health_check() else "unhealthy"
    deps["reranker"] = "healthy" if await reranker_service.health_check() else "unhealthy"
    deps["inngest"] = "configured" if settings.inngest.signing_key else "not_configured"

    model_config = {
        "foundation_model": settings.model.foundation_model,
        "embedding_model": settings.model.embedding_model,
        "embedding_dimensions": settings.model.embedding_dimensions,
        "llm_model": settings.model.llm_model,
        "embedding_provider": settings.embedding.provider,
        "reranker_provider": settings.reranker.provider,
    }

    overall_status = "healthy" if all(v == "healthy" for v in deps.values() if v != "not_configured") else "degraded"

    return HealthCheckResponse(
        status=overall_status,
        version="0.1.0",
        environment=settings.environment,
        dependencies=deps,
        model_config_info=model_config,
    )


class IngestResumeRequest(BaseModel):
    candidate_id: str
    resume_id: str
    job_id: str | None = None
    pdf_path: str
    source_pdf: str


@app.post("/api/v1/resumes/ingest")
async def ingest_resume(request: IngestResumeRequest, background_tasks: BackgroundTasks):
    try:
        event = IngestResumeEvent(**request.model_dump())
        await inngest_client.send(
            inngest.Event(
                name="candidate/ingest-resume",
                data=event.model_dump(),
            )
        )
        return {"status": "accepted", "message": "Resume ingestion started", "candidate_id": request.candidate_id}
    except Exception as e:
        logger.error("ingest_resume_request_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


class ScoreJobRequest(BaseModel):
    candidate_id: str
    job_id: str
    job_description: JobDescription


@app.post("/api/v1/candidates/score-job")
async def score_job(request: ScoreJobRequest):
    try:
        event = ScoreJobEvent(**request.model_dump())
        await inngest_client.send(
            inngest.Event(
                name="candidate/score-job",
                data=event.model_dump(),
            )
        )
        return {"status": "accepted", "message": "Candidate scoring started", "candidate_id": request.candidate_id, "job_id": request.job_id}
    except Exception as e:
        logger.error("score_job_request_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


class RAGSummaryRequest(BaseModel):
    candidate_id: str
    job_id: str
    query: str = ""
    top_k: int = 10


@app.post("/api/v1/candidates/rag-summary")
async def rag_summary(request: RAGSummaryRequest):
    try:
        event = RAGSummaryEvent(**request.model_dump())
        await inngest_client.send(
            inngest.Event(
                name="candidate/rag-summary",
                data=event.model_dump(),
            )
        )
        return {"status": "accepted", "message": "RAG summary generation started", "candidate_id": request.candidate_id, "job_id": request.job_id}
    except Exception as e:
        logger.error("rag_summary_request_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


class RankCandidatesRequest(BaseModel):
    job_id: str
    candidate_ids: list[str]


@app.post("/api/v1/jobs/rank-candidates")
async def rank_candidates(request: RankCandidatesRequest):
    try:
        event = RankCandidatesEvent(**request.model_dump())
        await inngest_client.send(
            inngest.Event(
                name="job/rank-candidates",
                data=event.model_dump(),
            )
        )
        return {"status": "accepted", "message": "Candidate ranking started", "job_id": request.job_id, "candidate_count": len(request.candidate_ids)}
    except Exception as e:
        logger.error("rank_candidates_request_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/candidates/{candidate_id}/match-score/{job_id}")
async def get_match_score(candidate_id: str, job_id: str):
    import httpx
    try:
        async with httpx.AsyncClient(timeout=settings.spring_boot.timeout) as client:
            response = await client.get(f"{settings.spring_boot.base_url}/api/ai/match-scores/{candidate_id}/{job_id}")
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Match score not found")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error("get_match_score_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/candidates/{candidate_id}/rag-summary/{job_id}")
async def get_rag_summary(candidate_id: str, job_id: str):
    import httpx
    try:
        async with httpx.AsyncClient(timeout=settings.spring_boot.timeout) as client:
            response = await client.get(f"{settings.spring_boot.base_url}/api/ai/rag-summaries/{candidate_id}/{job_id}")
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="RAG summary not found")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error("get_rag_summary_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/jobs/{job_id}/ranking")
async def get_ranking(job_id: str):
    import httpx
    try:
        async with httpx.AsyncClient(timeout=settings.spring_boot.timeout) as client:
            response = await client.get(f"{settings.spring_boot.base_url}/api/ai/rankings/{job_id}")
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Ranking not found")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error("get_ranking_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/internal/candidate-profile")
async def receive_candidate_profile(profile: CandidateProfile):
    return {"status": "received", "candidate_id": profile.name}


@app.post("/api/v1/internal/match-score")
async def receive_match_score(score: MatchScore):
    return {"status": "received", "candidate_id": score.candidate_id, "job_id": score.job_id}


@app.post("/api/v1/internal/rag-summary")
async def receive_rag_summary(summary: RAGSummary):
    return {"status": "received", "candidate_id": summary.candidate_id, "job_id": summary.job_id}


@app.post("/api/v1/internal/ranking")
async def receive_ranking(ranking: RankingResult):
    return {"status": "received", "job_id": ranking.job_id, "candidates": ranking.total_candidates}