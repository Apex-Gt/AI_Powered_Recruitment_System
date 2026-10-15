from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api import main
from app.core.config import AppConfig
from app.models.schemas import EducationLevel, JobDescription, ScoreJobEvent

UUID_A = "11111111-1111-1111-1111-111111111111"
UUID_B = "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def client():
    # No `with` block: skip the lifespan so no Qdrant / model is touched.
    return TestClient(main.app)


@pytest.fixture
def sent_events():
    with patch.object(main.inngest_client, "send", new=AsyncMock()) as send:
        yield send


def test_inngest_endpoint_is_served(client):
    body = client.get("/api/inngest").json()
    assert body["function_count"] == 4


def test_ingest_accepts_camel_case_from_spring(client, sent_events):
    response = client.post(
        "/api/v1/resumes/ingest",
        json={"candidateId": UUID_A, "resumeId": UUID_B, "jobId": None, "pdfPath": "/data/r.pdf", "sourcePdf": "r.pdf"},
    )
    assert response.status_code == 200 and response.json()["status"] == "accepted"
    event = sent_events.await_args.args[0]
    assert event.name == "candidate/ingest-resume"
    assert event.data["candidate_id"] == UUID_A and event.data["job_id"] is None


def test_score_job_accepts_spring_job_description(client, sent_events):
    response = client.post(
        "/api/v1/candidates/score-job",
        json={
            "candidateId": UUID_A,
            "jobId": UUID_B,
            "jobDescription": {
                "jobId": UUID_B,
                "title": "Dev",
                "companyId": "co",
                "description": "d",
                "requirements": None,
                "minExperienceYears": None,
                "educationLevel": "BACHELOR",
            },
        },
    )
    assert response.status_code == 200
    data = sent_events.await_args.args[0].data
    assert data["job_description"]["education_level"] == "bachelor"
    assert JobDescription.model_validate(data["job_description"]).min_experience_years == 0.0


def test_rag_summary_and_rank_events(client, sent_events):
    assert client.post("/api/v1/candidates/rag-summary", json={"candidateId": UUID_A, "jobId": UUID_B}).status_code == 200
    assert sent_events.await_args.args[0].data["top_k"] == 10
    assert client.post("/api/v1/jobs/rank-candidates", json={"jobId": UUID_B, "candidateIds": [UUID_A]}).status_code == 200


def test_validation_errors_are_422(client, sent_events):
    assert client.post("/api/v1/jobs/rank-candidates", json={"jobId": UUID_B, "candidateIds": []}).status_code == 422
    assert client.post("/api/v1/resumes/ingest", json={}).status_code == 422
    sent_events.assert_not_awaited()


def test_inngest_unavailable_is_502(client):
    with patch.object(main.inngest_client, "send", new=AsyncMock(side_effect=RuntimeError("down"))):
        response = client.post("/api/v1/jobs/rank-candidates", json={"jobId": UUID_B, "candidateIds": [UUID_A]})
    assert response.status_code == 502


def test_health_degrades_instead_of_crashing(client):
    healthy = AsyncMock(health_check=AsyncMock(return_value=True))
    broken = AsyncMock(health_check=AsyncMock(return_value=False))
    with patch.object(main, "get_qdrant_service", return_value=healthy), patch.object(
        main, "get_embedding_service", return_value=broken
    ), patch.object(main, "get_reranker_service", return_value=healthy):
        body = client.get("/health").json()
    assert body["status"] == "degraded"
    assert body["dependencies"]["embedding"] == "unhealthy"


def test_education_level_parses_backend_enum_names():
    assert EducationLevel("BACHELOR") is EducationLevel.BACHELOR
    assert EducationLevel("HIGH_SCHOOL") is EducationLevel.HIGH_SCHOOL


def test_wire_models_round_trip_camel_case():
    event = ScoreJobEvent.model_validate({"candidate_id": "c", "job_id": "j", "job_description": {
        "job_id": "j", "title": "t", "company_id": "x", "description": "d"}})
    assert event.to_wire()["jobDescription"]["companyId"] == "x"


def test_settings_prefixes_match_env_names(monkeypatch):
    monkeypatch.setenv("SPRING_BOOT_BASE_URL", "http://backend:9090")
    monkeypatch.setenv("QDRANT_HOST", "qdrant")
    config = AppConfig()
    assert config.spring_boot.base_url == "http://backend:9090"
    assert config.qdrant.host == "qdrant"


def test_nested_settings_read_dotenv(tmp_path, monkeypatch):
    (tmp_path / ".env").write_text("QDRANT_HOST=from-dotenv\nSPRING_BOOT_BASE_URL=http://dotenv:1\n")
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("QDRANT_HOST", raising=False)
    monkeypatch.delenv("SPRING_BOOT_BASE_URL", raising=False)
    config = AppConfig()
    assert config.qdrant.host == "from-dotenv"
    assert config.spring_boot.base_url == "http://dotenv:1"
