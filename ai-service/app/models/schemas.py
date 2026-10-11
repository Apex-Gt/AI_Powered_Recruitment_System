from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, timezone


class EducationLevel(str, Enum):
    HIGH_SCHOOL = "high_school"
    ASSOCIATE = "associate"
    BACHELOR = "bachelor"
    MASTER = "master"
    PHD = "phd"
    OTHER = "other"


class Skill(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    level: Literal["beginner", "intermediate", "advanced", "expert"] | None = None
    years_experience: float | None = Field(None, ge=0, le=50)
    category: str | None = None


class Education(BaseModel):
    institution: str = Field(..., min_length=1, max_length=200)
    degree: str = Field(..., min_length=1, max_length=200)
    field_of_study: str | None = None
    level: EducationLevel | None = None
    start_date: str | None = None
    end_date: str | None = None
    gpa: float | None = Field(None, ge=0, le=4.0)
    location: str | None = None


class Certification(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    issuer: str | None = None
    issue_date: str | None = None
    expiry_date: str | None = None
    credential_id: str | None = None
    url: str | None = None


class Project(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    technologies: list[str] = Field(default_factory=list)
    start_date: str | None = None
    end_date: str | None = None
    url: str | None = None
    role: str | None = None


class CandidateProfile(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    location: str | None = Field(None, max_length=200)
    skills: list[Skill] = Field(default_factory=list)
    total_experience_years: float = Field(0.0, ge=0, le=50)
    education: list[Education] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    summary: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None

    def get_skill_names(self) -> list[str]:
        return [s.name.lower() for s in self.skills]

    def get_total_skills(self) -> int:
        return len(self.skills)

    def get_highest_education_level(self) -> EducationLevel | None:
        if not self.education:
            return None
        level_order = {
            EducationLevel.HIGH_SCHOOL: 1,
            EducationLevel.ASSOCIATE: 2,
            EducationLevel.BACHELOR: 3,
            EducationLevel.MASTER: 4,
            EducationLevel.PHD: 5,
            EducationLevel.OTHER: 0,
        }
        return max(self.education, key=lambda e: level_order.get(e.level, 0)).level if self.education else None


class ResumeChunk(BaseModel):
    candidate_id: str
    resume_id: str
    job_id: str | None = None
    chunk_id: str
    section: str
    source_pdf: str
    text: str
    embedding: list[float] | None = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class JobRequirement(BaseModel):
    skill: str
    required: bool = True
    min_years_experience: float | None = None
    weight: float = Field(1.0, ge=0, le=10)


class JobDescription(BaseModel):
    job_id: str
    title: str
    company_id: str
    description: str
    requirements: list[JobRequirement] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    min_experience_years: float = 0.0
    education_level: EducationLevel | None = None
    location: str | None = None
    employment_type: str | None = None


class MatchScore(BaseModel):
    candidate_id: str
    job_id: str
    overall_score: float = Field(0.0, ge=0, le=100)
    skill_match_score: float = Field(0.0, ge=0, le=100)
    experience_match_score: float = Field(0.0, ge=0, le=100)
    education_match_score: float = Field(0.0, ge=0, le=100)
    semantic_match_score: float = Field(0.0, ge=0, le=100)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    skill_coverage: float = Field(0.0, ge=0, le=100)
    evidence_chunks: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EvidenceChunk(BaseModel):
    chunk_id: str
    text: str
    section: str
    relevance_score: float
    source_pdf: str


class RAGSummary(BaseModel):
    candidate_id: str
    job_id: str
    strengths: list[str] = Field(default_factory=list)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    relevant_experience: list[str] = Field(default_factory=list)
    evidence: list[EvidenceChunk] = Field(default_factory=list)
    summary_text: str
    confidence_score: float = Field(0.0, ge=0, le=1)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    model_used: str
    prompt_version: str


class RankedCandidate(BaseModel):
    candidate_id: str
    job_id: str
    rank: int
    overall_score: float
    match_score: MatchScore
    rag_summary: RAGSummary | None = None


class RankingResult(BaseModel):
    job_id: str
    candidates: list[RankedCandidate]
    total_candidates: int
    ranked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    scoring_version: str


class WorkflowEvent(BaseModel):
    workflow_id: str
    event_type: str
    payload: dict
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IngestResumeEvent(BaseModel):
    candidate_id: str
    resume_id: str
    job_id: str | None = None
    pdf_path: str
    source_pdf: str


class ScoreJobEvent(BaseModel):
    candidate_id: str
    job_id: str
    job_description: JobDescription


class RAGSummaryEvent(BaseModel):
    candidate_id: str
    job_id: str
    query: str
    top_k: int = 10


class RankCandidatesEvent(BaseModel):
    job_id: str
    candidate_ids: list[str]


class HealthCheckResponse(BaseModel):
    status: str
    version: str
    environment: str
    dependencies: dict[str, str]
    model_config_info: dict = Field(alias="model_config", serialization_alias="model_config")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"populate_by_name": True}