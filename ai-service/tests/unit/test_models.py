import pytest
from pydantic import ValidationError
from app.models.schemas import (
    Skill,
    Education,
    EducationLevel,
    Certification,
    Project,
    CandidateProfile,
    ResumeChunk,
    JobRequirement,
    JobDescription,
    MatchScore,
    EvidenceChunk,
    RAGSummary,
    RankedCandidate,
    RankingResult,
    IngestResumeEvent,
    ScoreJobEvent,
    RAGSummaryEvent,
    RankCandidatesEvent,
)


def test_skill_creation():
    skill = Skill(name="Python", level="advanced", years_experience=5.0, category="programming")
    assert skill.name == "Python"
    assert skill.level == "advanced"
    assert skill.years_experience == 5.0
    assert skill.category == "programming"


def test_skill_validation():
    with pytest.raises(ValidationError):
        Skill(name="")  # Empty name should fail

    with pytest.raises(ValidationError):
        Skill(name="Python", years_experience=-1)  # Negative years should fail


def test_education_creation():
    edu = Education(
        institution="Stanford University",
        degree="Master of Science",
        field_of_study="Computer Science",
        level=EducationLevel.MASTER,
        start_date="2020-09-01",
        end_date="2022-06-15",
        gpa=3.8,
    )
    assert edu.institution == "Stanford University"
    assert edu.level == EducationLevel.MASTER


def test_candidate_profile_creation():
    profile = CandidateProfile(
        name="John Doe",
        email="john@example.com",
        phone="+1-555-123-4567",
        location="San Francisco, CA",
        skills=[Skill(name="Python", level="advanced")],
        total_experience_years=5.0,
        education=[Education(institution="Stanford", degree="MS CS", level=EducationLevel.MASTER)],
    )
    assert profile.name == "John Doe"
    assert profile.email == "john@example.com"
    assert profile.get_total_skills() == 1
    assert profile.get_highest_education_level() == EducationLevel.MASTER


def test_candidate_profile_get_skill_names():
    profile = CandidateProfile(
        name="Jane Doe",
        skills=[Skill(name="Python"), Skill(name="JavaScript"), Skill(name="React")],
    )
    skills = profile.get_skill_names()
    assert "python" in skills
    assert "javascript" in skills
    assert "react" in skills


def test_resume_chunk_creation():
    chunk = ResumeChunk(
        candidate_id="cand-123",
        resume_id="res-456",
        job_id="job-789",
        chunk_id="chunk-001",
        section="experience",
        source_pdf="resume.pdf",
        text="Worked as a software engineer...",
    )
    assert chunk.candidate_id == "cand-123"
    assert chunk.section == "experience"


def test_job_requirement_creation():
    req = JobRequirement(skill="Python", required=True, min_years_experience=3.0, weight=1.5)
    assert req.skill == "Python"
    assert req.required is True
    assert req.min_years_experience == 3.0


def test_job_description_creation():
    job = JobDescription(
        job_id="job-123",
        title="Senior Python Developer",
        company_id="comp-456",
        description="We are looking for a senior Python developer...",
        required_skills=["Python", "Django", "PostgreSQL"],
        preferred_skills=["AWS", "Kubernetes"],
        min_experience_years=5.0,
        education_level=EducationLevel.BACHELOR,
    )
    assert job.job_id == "job-123"
    assert job.title == "Senior Python Developer"
    assert len(job.required_skills) == 3


def test_match_score_creation():
    score = MatchScore(
        candidate_id="cand-123",
        job_id="job-456",
        overall_score=85.5,
        skill_match_score=90.0,
        experience_match_score=80.0,
        education_match_score=100.0,
        semantic_match_score=75.0,
        matched_skills=["Python", "Django"],
        missing_skills=["AWS"],
        skill_coverage=66.67,
        evidence_chunks=["chunk-1", "chunk-2"],
    )
    assert score.overall_score == 85.5
    assert len(score.matched_skills) == 2
    assert len(score.missing_skills) == 1


def test_evidence_chunk_creation():
    evidence = EvidenceChunk(
        chunk_id="chunk-1",
        text="Relevant experience...",
        section="experience",
        relevance_score=0.95,
        source_pdf="resume.pdf",
    )
    assert evidence.relevance_score == 0.95


def test_rag_summary_creation():
    summary = RAGSummary(
        candidate_id="cand-123",
        job_id="job-456",
        strengths=["Strong Python skills", "5+ years experience"],
        matched_skills=["Python", "Django"],
        missing_skills=["AWS"],
        relevant_experience=["Senior developer at TechCorp"],
        evidence=[],
        summary_text="Candidate is a strong match...",
        confidence_score=0.85,
        model_used="gpt-4o-mini",
        prompt_version="1.0",
    )
    assert summary.confidence_score == 0.85
    assert len(summary.strengths) == 2


def test_ranked_candidate_creation():
    ranked = RankedCandidate(
        candidate_id="cand-123",
        job_id="job-456",
        rank=1,
        overall_score=85.5,
        match_score=MatchScore(
            candidate_id="cand-123",
            job_id="job-456",
            overall_score=85.5,
        ),
    )
    assert ranked.rank == 1


def test_ranking_result_creation():
    ranking = RankingResult(
        job_id="job-456",
        candidates=[],
        total_candidates=0,
        scoring_version="1.0",
    )
    assert ranking.total_candidates == 0


def test_workflow_events():
    ingest_event = IngestResumeEvent(
        candidate_id="cand-123",
        resume_id="res-456",
        pdf_path="/path/to/resume.pdf",
        source_pdf="resume.pdf",
    )
    assert ingest_event.candidate_id == "cand-123"

    score_event = ScoreJobEvent(
        candidate_id="cand-123",
        job_id="job-456",
        job_description=JobDescription(
            job_id="job-456",
            title="Developer",
            company_id="comp-123",
            description="Job desc",
        ),
    )
    assert score_event.job_id == "job-456"