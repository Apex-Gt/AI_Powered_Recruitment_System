"""Stage behaviour with fake dependencies: no Ollama, Qdrant or model weights are touched."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.exceptions import EmbeddingError, LLMError, LLMUnavailableError, PDFProcessingError, QdrantError
from app.models.schemas import CandidateProfile, JobDescription, JobRequirement, ResumeChunk, Skill
from app.pipeline.errors import PermanentDocumentError, TransientDependencyError
from app.pipeline.processor import ResumePipeline, job_input_hash, map_dependency_error
from app.pipeline.text_extraction import ExtractedText

TEXT = (
    "Jane Doe\njane.doe@example.com | +1 415 555 0132\n\nExperience\nBackend Engineer, Acme, Jan 2019 - Dec 2022\n"
    "Built Python and PostgreSQL services for payments. Led migrations and wrote Kafka consumers.\n" * 3
)


def _extracted(text=TEXT):
    return ExtractedText(text=text, method="txt", pages=1, text_hash="h" * 64)


class FakeProfileService:
    def __init__(self, profile=None, error=None):
        self.profile, self.error, self.calls = profile, error, 0
        self.llm = object()

    async def extract_candidate_profile(self, text):
        self.calls += 1
        if self.error:
            raise self.error
        return self.profile


class FakeQdrant:
    def __init__(self, fail=None):
        self.points: dict[str, ResumeChunk] = {}
        self.fail = fail

    async def upsert_chunks(self, chunks):
        if self.fail:
            raise self.fail
        for c in chunks:
            self.points[f"{c.candidate_id}-{c.resume_id}-{c.chunk_id}"] = c  # deterministic key, like the real ids
        return list(self.points)

    async def search_similar(self, vector, candidate_id, job_id, limit):
        return [c for c in self.points.values() if c.candidate_id == candidate_id][:limit]


class FakeEmbedding:
    async def embed_text(self, text):
        return [1.0, 0.0]

    async def embed_batch(self, texts):
        return [[1.0, 0.0] for _ in texts]


class FakePdf:
    async def chunk_text(self, text, candidate_id, resume_id, job_id, source):
        return [
            ResumeChunk(candidate_id=candidate_id, resume_id=resume_id, job_id=job_id, chunk_id=f"{resume_id}-chunk-{i}", section="general", source_pdf=source, text=t, embedding=[1.0, 0.0])
            for i, t in enumerate(text.split("\n\n")[:3])
        ]


def _pipeline(**kw):
    return ResumePipeline(extractor=lambda path: _extracted(), pdf_service=kw.pop("pdf", FakePdf()), embedding_service=FakeEmbedding(), **kw)


JOB = JobDescription(
    job_id="job-1", title="Backend Developer", company_id="c", description="Python services",
    requirements=[JobRequirement(skill="Python", required=True), JobRequirement(skill="Kubernetes", required=True)],
)


async def test_extract_stage_needs_no_llm_and_flags_review_when_email_missing():
    pipeline = ResumePipeline(extractor=lambda path: _extracted("No contact info here " * 30))
    result = await pipeline.extract("any.pdf", "anon.pdf")
    assert result["needsReview"] is True
    assert "No email address found in the resume" in result["warnings"]
    assert result["contact"]["email"] is None


async def test_profile_stage_grounds_the_model_output():
    hallucinated = CandidateProfile(
        name="Jane Doe",
        email="made.up@elsewhere.com",
        skills=[Skill(name="Python"), Skill(name="Rust")],  # Rust is not in the resume
        total_experience_years=30,
    )
    pipeline = _pipeline(profile_service=FakeProfileService(hallucinated))
    out = await pipeline.profile("any.pdf", "jane.pdf")
    profile = out["profile"]
    assert profile["email"] == "jane.doe@example.com"  # deterministic value wins
    assert [s["name"] for s in profile["skills"]] == ["Python"]
    assert any("not found in the resume" in w for w in out["warnings"])
    assert out["model"] == settings.llm.model


async def test_profile_stage_llm_down_is_retryable_and_keeps_cause():
    wrapped = PDFProcessingError("Failed to extract candidate profile: boom")
    wrapped.__cause__ = LLMUnavailableError("connection refused")
    pipeline = _pipeline(profile_service=FakeProfileService(error=wrapped))
    with pytest.raises(TransientDependencyError) as exc:
        await pipeline.profile("any.pdf")
    assert exc.value.code == "LLM_UNAVAILABLE"
    assert exc.value.retryable


async def test_index_stage_is_idempotent():
    qdrant = FakeQdrant()
    pipeline = _pipeline(qdrant_service=qdrant)
    first = await pipeline.index("cand", "res", "job", "f.pdf", "f.pdf")
    stored = dict(qdrant.points)
    second = await pipeline.index("cand", "res", "job", "f.pdf", "f.pdf")
    assert first["chunksStored"] == second["chunksStored"] > 0
    assert qdrant.points.keys() == stored.keys()  # a retry overwrites, never duplicates


@pytest.mark.parametrize(
    "error,code",
    [(QdrantError("down"), "VECTOR_STORE_UNAVAILABLE"), (EmbeddingError("down"), "EMBEDDING_UNAVAILABLE")],
)
async def test_index_stage_dependency_outage_is_transient(error, code):
    pipeline = _pipeline(qdrant_service=FakeQdrant(fail=error))
    with pytest.raises(TransientDependencyError) as exc:
        await pipeline.index("cand", "res", "job", "f.pdf")
    assert exc.value.code == code


async def test_score_requires_indexed_chunks():
    pipeline = _pipeline(qdrant_service=FakeQdrant())
    with pytest.raises(TransientDependencyError) as exc:
        await pipeline.score("cand", JOB, CandidateProfile(name="Jane"), "f.pdf")
    assert exc.value.code == "NOT_INDEXED"


async def test_score_stage_reports_mandatory_gap_and_evidence():
    qdrant = FakeQdrant()
    pipeline = _pipeline(qdrant_service=qdrant)
    await pipeline.index("cand", "res", "job-1", "f.pdf")
    out = await pipeline.score("cand", JOB, CandidateProfile(name="Jane", skills=[Skill(name="Python")]), "f.pdf")
    score = out["matchScore"]
    assert score["meetsMandatory"] is False
    assert score["mandatoryMissing"] == ["kubernetes"]
    assert "python" in score["skillEvidence"]
    assert score["jobId"] == "job-1" and len(out["inputHash"]) == 64


def test_input_hash_changes_with_the_job_but_not_with_key_order():
    changed = JOB.model_copy(update={"description": "Rust services"})
    assert job_input_hash(JOB) != job_input_hash(changed)
    assert job_input_hash(JOB) == job_input_hash(JobDescription(**JOB.model_dump()))


def test_error_classification():
    assert map_dependency_error(LLMError("bad json")).retryable
    assert map_dependency_error(ValueError("boom")).code == "INTERNAL_ERROR"
    permanent = PermanentDocumentError("CORRUPT_FILE", "x")
    assert map_dependency_error(permanent) is permanent and not permanent.retryable


# ----------------------------------------------------------------------------- HTTP contract


@pytest.fixture
def client(monkeypatch):
    from app.api.main import app
    import app.api.pipeline as api

    class Boom:
        async def extract(self, *a, **k):
            raise PermanentDocumentError("ENCRYPTED_FILE", "locked")

        async def profile(self, *a, **k):
            raise TransientDependencyError("LLM_UNAVAILABLE", "down")

    monkeypatch.setattr(api, "get_pipeline", lambda: Boom())
    return TestClient(app)


def test_permanent_error_is_422_and_not_retryable(client):
    r = client.post("/api/v1/pipeline/extract", json={"filePath": "x.pdf"})
    assert r.status_code == 422
    assert r.json()["retryable"] is False and r.json()["code"] == "ENCRYPTED_FILE"


def test_transient_error_is_503_and_retryable(client):
    r = client.post("/api/v1/pipeline/profile", json={"filePath": "x.pdf"})
    assert r.status_code == 503
    assert r.json()["retryable"] is True


def test_shared_key_is_enforced_when_configured(client, monkeypatch):
    monkeypatch.setattr(settings.pipeline, "api_key", "s3cret")
    assert client.post("/api/v1/pipeline/extract", json={"filePath": "x"}).status_code == 401
    assert client.post("/api/v1/pipeline/extract", json={"filePath": "x"}, headers={"X-API-Key": "wrong"}).status_code == 401
    assert client.post("/api/v1/pipeline/extract", json={"filePath": "x"}, headers={"X-API-Key": "s3cret"}).status_code == 422


async def test_profile_stage_empty_result_for_a_real_resume_is_retried_then_parked_for_review():
    from app.pipeline.errors import NeedsReviewError

    service = FakeProfileService(CandidateProfile(name="Jane Doe"))  # the model returned nothing useful
    pipeline = _pipeline(profile_service=service)
    with pytest.raises(NeedsReviewError) as exc:
        await pipeline.profile("any.pdf")
    assert exc.value.code == "PROFILE_EMPTY"
    assert service.calls == 2  # one retry before giving up


async def test_profile_stage_empty_result_succeeds_on_retry():
    class Flaky(FakeProfileService):
        async def extract_candidate_profile(self, text):
            self.calls += 1
            return CandidateProfile(name="Jane Doe") if self.calls == 1 else CandidateProfile(name="Jane Doe", skills=[Skill(name="Python")])

    out = await _pipeline(profile_service=Flaky(None)).profile("any.pdf")
    assert [s["name"] for s in out["profile"]["skills"]] == ["Python"]
