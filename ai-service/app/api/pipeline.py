"""HTTP surface of the staged resume pipeline (internal: called by the Spring backend's queue worker).

Errors are returned as JSON with ``code``, ``retryable`` and ``needsReview`` so the caller can decide to back off,
park the resume for review, or fail it for good. 422 means the document is the problem; 503 means a dependency is.
"""

import hmac
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import get_logger
from app.models.schemas import CamelModel, CandidateProfile, JobDescription, MatchScore
from app.pipeline.errors import PipelineError
from app.pipeline.processor import get_pipeline, map_dependency_error

logger = get_logger(__name__)


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    expected = settings.pipeline.api_key
    if not expected:
        return  # local development: no shared secret configured
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


router = APIRouter(prefix="/api/v1/pipeline", tags=["pipeline"], dependencies=[Depends(require_api_key)])


class FileRequest(CamelModel):
    file_path: str
    file_name: str = ""


class IndexRequest(FileRequest):
    candidate_id: str
    resume_id: str
    job_id: Optional[str] = None


class ScoreRequest(CamelModel):
    candidate_id: str
    file_path: str
    job: JobDescription
    profile: CandidateProfile


class SummaryRequest(ScoreRequest):
    match_score: Optional[MatchScore] = None


def _error_response(error: BaseException, stage: str) -> JSONResponse:
    err: PipelineError = map_dependency_error(error)
    status = 503 if err.retryable else 422
    if status == 503:
        logger.warning("pipeline_stage_transient_failure", stage=stage, code=err.code, message=err.message)
    else:
        logger.info("pipeline_stage_rejected", stage=stage, code=err.code)
    return JSONResponse(status_code=status, content=err.to_dict())


@router.post("/extract")
async def extract(request: FileRequest):
    try:
        return await get_pipeline().extract(request.file_path, request.file_name)
    except Exception as e:  # noqa: BLE001 - classified in _error_response
        return _error_response(e, "extract")


@router.post("/profile")
async def profile(request: FileRequest):
    try:
        return await get_pipeline().profile(request.file_path, request.file_name)
    except Exception as e:  # noqa: BLE001
        return _error_response(e, "profile")


@router.post("/index")
async def index(request: IndexRequest):
    try:
        return await get_pipeline().index(request.candidate_id, request.resume_id, request.job_id, request.file_path, request.file_name)
    except Exception as e:  # noqa: BLE001
        return _error_response(e, "index")


@router.post("/score")
async def score(request: ScoreRequest):
    try:
        return await get_pipeline().score(request.candidate_id, request.job, request.profile, request.file_path)
    except Exception as e:  # noqa: BLE001
        return _error_response(e, "score")


@router.post("/summary")
async def summary(request: SummaryRequest):
    try:
        return await get_pipeline().summary(request.candidate_id, request.job, request.profile, request.match_score, request.file_path)
    except Exception as e:  # noqa: BLE001
        return _error_response(e, "summary")
