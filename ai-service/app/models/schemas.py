from enum import Enum
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, EmailStr, model_validator
from pydantic.alias_generators import to_camel
from datetime import datetime, timezone


class EducationLevel(str, Enum):
    HIGH_SCHOOL = "high_school"
    ASSOCIATE = "associate"
    BACHELOR = "bachelor"
    MASTER = "master"
    PHD = "phd"
    OTHER = "other"

    @classmethod
    def _missing_(cls, value: object):
        # The Spring backend sends enum names such as "BACHELOR" / "HIGH_SCHOOL".
        if isinstance(value, str):
            normalized = value.strip().lower().replace(" ", "_").replace("-", "_")
            for member in cls:
                if member.value == normalized:
                    return member
            if normalized in {"bachelors", "bachelor's", "undergraduate"}:
                return cls.BACHELOR
            if normalized in {"masters", "master's", "postgraduate"}:
                return cls.MASTER
            if normalized in {"doctorate", "doctoral", "ph.d", "ph_d"}:
                return cls.PHD
        return None


class CamelModel(BaseModel):
    """Wire model shared with the Spring backend (camelCase JSON).

    Accepts camelCase or snake_case on input, ignores explicit nulls so field defaults
    apply, and should be serialised with ``by_alias=True`` when sent to Spring.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def _drop_nulls(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if v is not None}
        return data

    def to_wire(self) -> dict:
        return self.model_dump(mode="json", by_alias=True)


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


class WorkExperience(BaseModel):
    """One employment entry as written in the resume; years are computed from the dates, not asked of the model."""

    title: str = Field(..., min_length=1, max_length=200)
    company: str | None = None
    start_date: str | None = None
    end_date: str | None = None  # "present" (or empty) for a current role
    description: str | None = None


class CandidateProfile(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    location: str | None = Field(None, max_length=200)
    skills: list[Skill] = Field(default_factory=list)
    experience: list[WorkExperience] = Field(default_factory=list)
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
        levels = [e.level for e in self.education if e.level is not None]
        if not levels:
            return None
        level_order = {
            EducationLevel.HIGH_SCHOOL: 1,
            EducationLevel.ASSOCIATE: 2,
            EducationLevel.BACHELOR: 3,
            EducationLevel.MASTER: 4,
            EducationLevel.PHD: 5,
            EducationLevel.OTHER: 0,
        }
        return max(levels, key=lambda level: level_order.get(level, 0))


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


class JobRequirement(CamelModel):
    skill: str
    required: bool = True
    min_years_experience: float | None = None
    weight: float = Field(1.0, ge=0, le=10)


class JobDescription(CamelModel):
    job_id: str
    title: str
    company_id: str
    description: str
    requirements: list[JobRequirement] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    min_experience_years: float = Field(0.0, ge=0)
    education_level: EducationLevel | None = None
    location: str | None = None
    employment_type: str | None = None


class MatchScore(CamelModel):
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
    # Explainability (scoring v2). All optional so older stored scores and clients keep working.
    meets_mandatory: bool = True
    mandatory_missing: list[str] = Field(default_factory=list)
    skill_evidence: dict[str, str] = Field(default_factory=dict)  # matched skill -> resume snippet containing it
    relevant_experience_years: float | None = None
    total_experience_years: float | None = None
    warnings: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EvidenceChunk(CamelModel):
    chunk_id: str
    text: str
    section: str
    relevance_score: float
    source_pdf: str


class EvidenceRef(CamelModel):
    """Where in the parsed resume a claim comes from. Every field is real: nothing here is invented."""

    source: str  # the project, employer or section the text sits in, as written in the resume
    source_type: str  # project | professional experience | internship | listed skills | education | certification | resume
    section: str | None = None  # section of the retrieved chunk that holds the quote
    chunk_id: str | None = None  # id of a stored resume chunk that contains the quote, when one does
    quote: str | None = None  # text copied verbatim from the resume; None when only the parsed field is known


class RequirementAssessment(CamelModel):
    requirement: str
    category: str  # mandatory skill | preferred skill | experience | education | responsibility
    status: Literal["demonstrated", "partial", "not_evidenced"]
    explanation: str
    evidence: list[EvidenceRef] = Field(default_factory=list)


class RAGSummary(CamelModel):
    candidate_id: str
    job_id: str
    strengths: list[str] = Field(default_factory=list)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    relevant_experience: list[str] = Field(default_factory=list)
    evidence: list[EvidenceChunk] = Field(default_factory=list)
    # Requirement-by-requirement comparison with traceable evidence. Optional so results stored before it existed still load.
    requirement_assessments: list[RequirementAssessment] = Field(default_factory=list)
    not_evidenced: list[str] = Field(default_factory=list)
    overall_assessment: str = ""
    limitations: list[str] = Field(default_factory=list)
    verification: dict = Field(default_factory=dict)  # {"passed": bool, "fallback": bool, "violations": [...]}
    summary_text: str
    confidence_score: float = Field(0.0, ge=0, le=1)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    model_used: str
    prompt_version: str


class RankedCandidate(CamelModel):
    candidate_id: str
    job_id: str
    rank: int
    overall_score: float
    match_score: MatchScore
    rag_summary: RAGSummary | None = None


class RankingResult(CamelModel):
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


class IngestResumeEvent(CamelModel):
    candidate_id: str
    resume_id: str
    job_id: str | None = None
    pdf_path: str
    source_pdf: str
    # Filled in when the profile was already extracted at upload, so ingestion does not ask the LLM again.
    profile: CandidateProfile | None = None


class ScoreJobEvent(CamelModel):
    candidate_id: str
    job_id: str
    job_description: JobDescription


class RAGSummaryEvent(CamelModel):
    candidate_id: str
    job_id: str
    query: str = ""
    top_k: int = Field(10, ge=1, le=100)
    job_description: JobDescription | None = None


class RankCandidatesEvent(CamelModel):
    job_id: str
    candidate_ids: list[str] = Field(..., min_length=1)


class HealthCheckResponse(BaseModel):
    status: str
    version: str
    environment: str
    dependencies: dict[str, str]
    model_config_info: dict = Field(alias="model_config", serialization_alias="model_config")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"populate_by_name": True}


class GradeAnswerRequest(CamelModel):
    question: str = Field(min_length=1, max_length=8000)
    answer: str = Field(max_length=50000)
    question_type: Literal["CODE", "ESSAY"] = "CODE"
    language: str | None = None
    rubric: str | None = Field(default=None, max_length=4000)


class GradeAnswerResult(CamelModel):
    score: float = Field(ge=0, le=100)
    feedback: str

