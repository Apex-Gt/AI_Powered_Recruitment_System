import pytest
import numpy as np
from app.models.schemas import (
    CandidateProfile,
    Skill,
    Education,
    EducationLevel,
    JobDescription,
    JobRequirement,
)
from app.services.scoring import ScoringService


@pytest.fixture
def scoring_service():
    return ScoringService()


@pytest.fixture
def candidate_profile():
    return CandidateProfile(
        name="John Doe",
        skills=[
            Skill(name="Python", level="advanced", years_experience=5.0),
            Skill(name="Django", level="advanced", years_experience=4.0),
            Skill(name="PostgreSQL", level="intermediate", years_experience=3.0),
            Skill(name="AWS", level="beginner", years_experience=1.0),
            Skill(name="React", level="intermediate", years_experience=2.0),
        ],
        total_experience_years=6.0,
        education=[
            Education(institution="Stanford", degree="MS CS", level=EducationLevel.MASTER),
        ],
    )


@pytest.fixture
def job_description():
    return JobDescription(
        job_id="job-123",
        title="Senior Python Developer",
        company_id="comp-456",
        description="Senior Python developer with Django and PostgreSQL experience",
        requirements=[
            JobRequirement(skill="Python", required=True, min_years_experience=3.0, weight=2.0),
            JobRequirement(skill="Django", required=True, min_years_experience=2.0, weight=1.5),
            JobRequirement(skill="PostgreSQL", required=True, min_years_experience=2.0, weight=1.0),
            JobRequirement(skill="AWS", required=False, min_years_experience=1.0, weight=1.0),
            JobRequirement(skill="React", required=False, min_years_experience=1.0, weight=0.5),
        ],
        required_skills=["Python", "Django", "PostgreSQL"],
        preferred_skills=["AWS", "React"],
        min_experience_years=5.0,
        education_level=EducationLevel.BACHELOR,
    )


def test_calculate_skill_match_full_match(scoring_service, candidate_profile, job_description):
    score, matched, missing, coverage = scoring_service.calculate_skill_match(candidate_profile, job_description)

    assert score > 80
    assert "python" in matched
    assert "django" in matched
    assert "postgresql" in matched
    assert len(missing) == 0
    assert coverage == 100.0


def test_calculate_skill_match_partial_match(scoring_service, job_description):
    candidate = CandidateProfile(
        name="Jane Doe",
        skills=[
            Skill(name="Python", level="advanced"),
            Skill(name="Django", level="intermediate"),
        ],
        total_experience_years=4.0,
    )

    score, matched, missing, coverage = scoring_service.calculate_skill_match(candidate, job_description)

    assert "python" in matched
    assert "django" in matched
    assert "postgresql" in missing
    assert coverage < 100


def test_calculate_skill_match_no_requirements(scoring_service):
    candidate = CandidateProfile(name="Test", skills=[Skill(name="Python")], total_experience_years=2.0)
    job = JobDescription(
        job_id="job-1",
        title="Test",
        company_id="comp-1",
        description="Test job",
        requirements=[],
    )

    score, matched, missing, coverage = scoring_service.calculate_skill_match(candidate, job)
    assert score == 0.0
    assert coverage == 0.0


def test_calculate_experience_match_exceeds_requirement(scoring_service, candidate_profile, job_description):
    score = scoring_service.calculate_experience_match(candidate_profile, job_description)
    assert score == 100.0


def test_calculate_experience_match_meets_requirement(scoring_service, job_description):
    candidate = CandidateProfile(
        name="Test",
        skills=[],
        total_experience_years=5.0,
    )
    score = scoring_service.calculate_experience_match(candidate, job_description)
    assert score == 100.0


def test_calculate_experience_match_below_requirement(scoring_service, job_description):
    candidate = CandidateProfile(
        name="Test",
        skills=[],
        total_experience_years=2.5,
    )
    score = scoring_service.calculate_experience_match(candidate, job_description)
    assert score == 50.0


def test_calculate_experience_match_no_requirement(scoring_service):
    candidate = CandidateProfile(name="Test", skills=[], total_experience_years=2.0)
    job = JobDescription(
        job_id="job-1",
        title="Test",
        company_id="comp-1",
        description="Test",
        min_experience_years=0.0,
    )
    score = scoring_service.calculate_experience_match(candidate, job)
    assert score == 100.0


def test_calculate_education_match_exceeds(scoring_service, candidate_profile, job_description):
    score = scoring_service.calculate_education_match(candidate_profile, job_description)
    assert score == 100.0


def test_calculate_education_match_meets(scoring_service, job_description):
    candidate = CandidateProfile(
        name="Test",
        skills=[],
        total_experience_years=5.0,
        education=[Education(institution="State U", degree="BS CS", level=EducationLevel.BACHELOR)],
    )
    score = scoring_service.calculate_education_match(candidate, job_description)
    assert score == 100.0


def test_calculate_education_match_below(scoring_service, job_description):
    candidate = CandidateProfile(
        name="Test",
        skills=[],
        total_experience_years=5.0,
        education=[Education(institution="Community College", degree="AS CS", level=EducationLevel.ASSOCIATE)],
    )
    score = scoring_service.calculate_education_match(candidate, job_description)
    assert score == 70.0


def test_calculate_education_match_no_education(scoring_service, job_description):
    candidate = CandidateProfile(name="Test", skills=[], total_experience_years=5.0, education=[])
    score = scoring_service.calculate_education_match(candidate, job_description)
    assert score == 0.0


def test_calculate_education_match_no_requirement(scoring_service):
    candidate = CandidateProfile(name="Test", skills=[], total_experience_years=5.0, education=[])
    job = JobDescription(
        job_id="job-1",
        title="Test",
        company_id="comp-1",
        description="Test",
        education_level=None,
    )
    score = scoring_service.calculate_education_match(candidate, job)
    assert score == 100.0


def test_calculate_semantic_match(scoring_service):
    query_embedding = [1.0] * 1024
    chunk_embeddings = [
        [0.9] * 1024,
        [0.8] * 1024,
        [0.7] * 1024,
    ]
    # Provide dummy candidate_chunks (non-empty) to test semantic match calculation
    from app.models.schemas import ResumeChunk
    candidate_chunks = [
        ResumeChunk(candidate_id="c1", resume_id="r1", chunk_id="c1", section="experience", source_pdf="r1.pdf", text="text1"),
        ResumeChunk(candidate_id="c1", resume_id="r1", chunk_id="c2", section="skills", source_pdf="r1.pdf", text="text2"),
        ResumeChunk(candidate_id="c1", resume_id="r1", chunk_id="c3", section="education", source_pdf="r1.pdf", text="text3"),
    ]

    score = scoring_service.calculate_semantic_match(candidate_chunks, "job desc", query_embedding, chunk_embeddings)
    # With very similar embeddings, score approaches 100
    assert 90 < score <= 100


def test_calculate_semantic_match_empty(scoring_service):
    score = scoring_service.calculate_semantic_match([], "job desc", [1.0]*1024, [])
    assert score == 0.0


def test_calculate_overall_score(scoring_service):
    score = scoring_service.calculate_overall_score(
        skill_score=90.0,
        experience_score=80.0,
        education_score=100.0,
        semantic_score=75.0,
    )
    expected = (90*0.4 + 80*0.2 + 100*0.1 + 75*0.3) / 1.0
    assert abs(score - expected) < 0.01


def test_score_candidate_job_integration(scoring_service, candidate_profile, job_description):
    from app.models.schemas import ResumeChunk
    candidate_chunks = [
        ResumeChunk(candidate_id="c1", resume_id="r1", chunk_id="c1", section="experience", source_pdf="r1.pdf", text="Senior Python developer with 5 years experience"),
        ResumeChunk(candidate_id="c1", resume_id="r1", chunk_id="c2", section="skills", source_pdf="r1.pdf", text="Python Django PostgreSQL AWS React"),
        ResumeChunk(candidate_id="c1", resume_id="r1", chunk_id="c3", section="education", source_pdf="r1.pdf", text="Master of Science in Computer Science"),
    ]
    query_embedding = [0.8] * 1024
    chunk_embeddings = [[0.75] * 1024 for _ in range(3)]

    match_score = scoring_service.score_candidate_job(
        candidate=candidate_profile,
        job=job_description,
        candidate_chunks=candidate_chunks,
        query_embedding=query_embedding,
        chunk_embeddings=chunk_embeddings,
    )

    assert match_score.overall_score > 0
    assert match_score.skill_match_score > 0
    assert match_score.experience_match_score > 0
    assert match_score.education_match_score > 0
    assert match_score.semantic_match_score > 0
    assert len(match_score.matched_skills) > 0
    assert match_score.skill_coverage >= 0