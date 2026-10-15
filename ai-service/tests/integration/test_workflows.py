"""Workflow tests.

``FakeStep.run`` mimics Inngest's memoisation: every step result is serialised to JSON and
deserialised again (with the same ``PydanticSerializer`` the real client uses), so a step that
returns a non-JSON-serialisable value, or forgets ``output_type=`` for a model, fails here.
"""

import inspect
import json
from types import SimpleNamespace

import inngest
import pytest

from app.core.config import settings
from app.models.schemas import (
    CandidateProfile,
    JobDescription,
    JobRequirement,
    MatchScore,
    RAGSummary,
    Skill,
)
from app.services.qdrant import QdrantService
from app.workflows import ingest_resume as wf

_UNSET = object()


class FakeStep:
    def __init__(self):
        self.serializer = inngest.PydanticSerializer()
        self.step_ids: list[str] = []

    async def run(self, step_id, handler, *args, output_type=_UNSET):
        assert step_id not in self.step_ids, f"duplicate step id {step_id}"
        self.step_ids.append(step_id)
        result = handler(*args)
        if inspect.isawaitable(result):
            result = await result
        if output_type is _UNSET:
            return json.loads(json.dumps(result))
        data = self.serializer.serialize(result, output_type)
        return self.serializer.deserialize(json.loads(json.dumps(data)), output_type)


def make_ctx(data: dict):
    return SimpleNamespace(event=SimpleNamespace(data=data))


class FakeEmbedder:
    """4-dim embedder: 'python' texts point along x, everything else along y."""

    def get_dimensions(self):
        return 4

    async def embed_text(self, text):
        return [1.0, 0.0, 0.0, 0.0] if "python" in text.lower() else [0.0, 1.0, 0.0, 0.0]

    async def embed_batch(self, texts):
        return [await self.embed_text(t) for t in texts]


class FakeExtractor:
    async def extract_candidate_profile(self, text):
        return CandidateProfile(
            name="Jane Doe",
            skills=[Skill(name="Python"), Skill(name="Postgres")],
            total_experience_years=6.0,
        )


class FakePdf:
    async def extract_text_from_pdf(self, path):
        return "Jane Doe\n\nExperience\nSix years of Python and Postgres backend work.\n\nEducation\nBSc."

    async def chunk_text(self, text, candidate_id, resume_id, job_id, source_pdf):
        from app.models.schemas import ResumeChunk

        return [
            ResumeChunk(
                candidate_id=candidate_id,
                resume_id=resume_id,
                job_id=job_id,
                chunk_id=f"{resume_id}-chunk-{i}",
                section="experience",
                source_pdf=source_pdf,
                text=part,
            )
            for i, part in enumerate(["Six years of Python backend work.", "Led a Java migration."])
        ]


class FakeRag:
    async def generate_summary(self, candidate, job, retrieved_chunks, match_score=None, candidate_id=None, query=None):
        return RAGSummary(
            candidate_id=candidate_id or "",
            job_id=job.job_id,
            summary_text="Strong Python candidate [EVIDENCE 1]",
            confidence_score=0.8,
            model_used="fake",
            prompt_version="1.0",
        )


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setattr(settings.qdrant, "location", ":memory:")
    monkeypatch.setattr(settings.llm, "api_key", "test-key")

    embedder = FakeEmbedder()
    qdrant = QdrantService(embedder)
    posts: list[tuple[str, dict]] = []
    spring_gets: dict[str, dict] = {}

    async def fake_post(path, payload):
        posts.append((path, payload))

    async def fake_get(path):
        return spring_gets.get(path)

    monkeypatch.setattr(wf, "embedding_service", embedder)
    monkeypatch.setattr(wf, "qdrant_service", qdrant)
    monkeypatch.setattr(wf, "pdf_processor", FakePdf())
    monkeypatch.setattr(wf, "candidate_extractor", FakeExtractor())
    monkeypatch.setattr(wf, "rag_service", FakeRag())
    monkeypatch.setattr(wf, "_spring_post", fake_post)
    monkeypatch.setattr(wf, "_spring_get_json", fake_get)
    return SimpleNamespace(posts=posts, gets=spring_gets, qdrant=qdrant)


JOB = {
    "jobId": "job-1",
    "title": "Backend Engineer",
    "companyId": "co-1",
    "description": "Python backend engineer",
    "requirements": [{"skill": "Python", "required": True}, {"skill": "PostgreSQL", "required": True}],
    "minExperienceYears": 3,
}


async def ingest(step):
    return await wf.ingest_resume_handler(
        make_ctx(
            {
                "candidate_id": "cand-1",
                "resume_id": "res-1",
                "job_id": "job-1",
                "pdf_path": "/data/resume.pdf",
                "source_pdf": "resume.pdf",
            }
        ),
        step,
    )


@pytest.mark.integration
class TestWorkflows:
    async def test_all_functions_registered(self):
        assert len(wf.ALL_FUNCTIONS) == 4

    async def test_ingest_stores_chunks_and_profile(self, env):
        step = FakeStep()
        result = await ingest(step)

        assert result["status"] == "completed"
        assert result["chunks_stored"] == 2
        assert result["candidate_profile"]["name"] == "Jane Doe"
        assert len(await env.qdrant.search_by_candidate("cand-1")) == 2
        assert [p for p, _ in env.posts] == ["/api/ai/candidate-profile"]
        assert env.posts[0][1]["candidateId"] == "cand-1"

    async def test_ingest_skips_profile_without_llm_key(self, env, monkeypatch):
        monkeypatch.setattr(settings.llm, "api_key", "")
        result = await ingest(FakeStep())
        assert result["candidate_profile"] is None
        assert result["chunks_stored"] == 2
        assert env.posts == []

    async def test_score_job_end_to_end(self, env):
        await ingest(FakeStep())
        env.posts.clear()

        step = FakeStep()
        result = await wf.score_job_handler(
            make_ctx({"candidate_id": "cand-1", "job_id": "job-1", "job_description": JOB}), step
        )

        score = result["match_score"]
        assert result["status"] == "completed"
        assert score["candidate_id"] == "cand-1" and score["job_id"] == "job-1"
        assert score["matched_skills"] == ["python", "postgresql"]  # "Postgres" == "PostgreSQL"
        assert score["skill_match_score"] == 100.0
        assert 0 < score["overall_score"] <= 100
        path, payload = env.posts[0]
        assert path == "/api/ai/match-scores"
        assert payload["candidateId"] == "cand-1" and "overallScore" in payload  # camelCase to Spring

    async def test_score_job_without_chunks_returns_warning(self, env):
        result = await wf.score_job_handler(
            make_ctx({"candidate_id": "nobody", "job_id": "job-1", "job_description": JOB}), FakeStep()
        )
        assert result["match_score"] is None and "warning" in result
        assert env.posts == []

    async def test_rag_summary_with_job_in_event(self, env):
        await ingest(FakeStep())
        env.posts.clear()

        result = await wf.rag_summary_handler(
            make_ctx({"candidate_id": "cand-1", "job_id": "job-1", "job_description": JOB}), FakeStep()
        )

        assert result["rag_summary"]["candidate_id"] == "cand-1"
        assert env.posts[0][0] == "/api/ai/rag-summaries"
        assert env.posts[0][1]["summaryText"].startswith("Strong Python")

    async def test_rag_summary_fetches_job_from_backend(self, env):
        await ingest(FakeStep())
        env.gets["/api/jobs/job-1/description"] = JOB
        result = await wf.rag_summary_handler(make_ctx({"candidate_id": "cand-1", "job_id": "job-1"}), FakeStep())
        assert result["status"] == "completed"

    async def test_rag_summary_without_any_job_is_non_retriable(self, env):
        await ingest(FakeStep())
        with pytest.raises(inngest.NonRetriableError):
            await wf.rag_summary_handler(make_ctx({"candidate_id": "cand-1", "job_id": "job-1"}), FakeStep())

    async def test_rank_candidates(self, env):
        def score(cid, overall):
            return MatchScore(candidate_id=cid, job_id="job-1", overall_score=overall).model_dump(mode="json")

        env.gets["/api/ai/match-scores/cand-1/job-1"] = score("cand-1", 61.5)
        env.gets["/api/ai/match-scores/cand-2/job-1"] = score("cand-2", 88.0)
        # cand-3 has no score yet and must be skipped, not abort the ranking

        result = await wf.rank_candidates_handler(
            make_ctx({"job_id": "job-1", "candidate_ids": ["cand-1", "cand-2", "cand-3"]}), FakeStep()
        )

        ranked = result["ranked_candidates"]
        assert [(r["candidate_id"], r["rank"]) for r in ranked] == [("cand-2", 1), ("cand-1", 2)]
        path, payload = env.posts[0]
        assert path == "/api/ai/rankings/job-1"
        assert payload["totalCandidates"] == 2 and payload["jobId"] == "job-1"

    async def test_rank_candidates_with_no_scores(self, env):
        result = await wf.rank_candidates_handler(
            make_ctx({"job_id": "job-1", "candidate_ids": ["cand-1"]}), FakeStep()
        )
        assert result["ranked_candidates"] == [] and env.posts == []

    async def test_store_failures_propagate_so_inngest_retries(self, env, monkeypatch):
        async def failing_post(path, payload):
            raise RuntimeError("spring down")

        await ingest(FakeStep())
        monkeypatch.setattr(wf, "_spring_post", failing_post)
        with pytest.raises(RuntimeError):
            await wf.score_job_handler(
                make_ctx({"candidate_id": "cand-1", "job_id": "job-1", "job_description": JOB}), FakeStep()
            )
