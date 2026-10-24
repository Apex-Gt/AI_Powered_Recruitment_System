"""Evidence behind candidate/job explanations: attribution, missing and partial evidence, unsupported claims."""

import pytest

from app.models.schemas import (
    CandidateProfile,
    Certification,
    Education,
    EducationLevel,
    EvidenceChunk,
    JobDescription,
    JobRequirement,
    Project,
    ResumeChunk,
    Skill,
    WorkExperience,
)
from app.services.evidence import (
    analyse,
    confidence_from,
    fallback_narrative,
    overall_from,
    relevant_experience_from,
    strengths_from,
    strip_placeholders,
    verify_narrative,
    word_count,
)
from app.services.rag_summary import RAGSummaryService

RESUME = """Jane Doe
jane@example.com

SKILLS
Java, Spring Boot, Python, SQL, Docker, Git

EXPERIENCE
Backend Intern, Beta Labs
Jun 2023 - Aug 2023
Built REST APIs with Python and FastAPI for an internal tool.

PROJECTS
Shop Tracker
Built an inventory app using Spring Boot and PostgreSQL with Docker deployment.

Chat Service
Developed a chat backend in Node.js with WebSockets.

EDUCATION
B.S. Computer Science, State University
"""


def profile() -> CandidateProfile:
    return CandidateProfile(
        name="Jane Doe",
        skills=[Skill(name=n) for n in ("Java", "Spring Boot", "Python", "SQL", "Docker", "Git")],
        experience=[
            WorkExperience(
                title="Backend Intern", company="Beta Labs", start_date="Jun 2023", end_date="Aug 2023",
                description="Built REST APIs with Python and FastAPI for an internal tool.",
            )
        ],
        total_experience_years=0.25,
        projects=[
            Project(name="Shop Tracker", description="Built an inventory app using Spring Boot and PostgreSQL with Docker deployment.",
                    technologies=["Spring Boot", "PostgreSQL", "Docker"]),
            Project(name="Chat Service", description="Developed a chat backend in Node.js with WebSockets.", technologies=["Node.js", "WebSockets"]),
        ],
        education=[Education(institution="State University", degree="B.S.", field_of_study="Computer Science", level=EducationLevel.BACHELOR)],
    )


def job(**over) -> JobDescription:
    base = dict(
        job_id="j1", title="Backend Engineer", company_id="c1",
        description="We build payment services.\n\nResponsibilities:\n- Build REST APIs for payment services\n- Run Kafka pipelines for settlement data\n",
        requirements=[
            JobRequirement(skill="Spring Boot", required=True),
            JobRequirement(skill="Kafka", required=True),
            JobRequirement(skill="Python", required=True),
            JobRequirement(skill="SQL", required=False),
            JobRequirement(skill="Docker", required=False),
            JobRequirement(skill="Kubernetes", required=False),
            JobRequirement(skill="Git", required=False),
        ],
        min_experience_years=2,
        education_level=EducationLevel.BACHELOR,
    )
    base.update(over)
    return JobDescription(**base)


def chunks() -> list[ResumeChunk]:
    return [
        ResumeChunk(candidate_id="c", resume_id="r", chunk_id="chunk-projects", section="projects", source_pdf="cv.pdf",
                    text="Shop Tracker\nBuilt an inventory app using Spring Boot and PostgreSQL with Docker deployment."),
        ResumeChunk(candidate_id="c", resume_id="r", chunk_id="chunk-exp", section="experience", source_pdf="cv.pdf",
                    text="Backend Intern, Beta Labs\nJun 2023 - Aug 2023\nBuilt REST APIs with Python and FastAPI for an internal tool."),
    ]


def by_name(analysis):
    return {a.requirement: a for a in analysis.assessments}


# ---------------------------------------------------------------- attribution and traceable evidence

def test_a_skill_is_attributed_to_the_entry_that_actually_mentions_it():
    a = by_name(analyse(profile(), job(), RESUME, chunks()))

    spring = a["Spring Boot"]
    assert spring.status == "demonstrated"
    assert [(r.source, r.source_type) for r in spring.evidence] == [("Shop Tracker", "project")]
    assert "Chat Service" not in [r.source for r in spring.evidence]

    python = a["Python"]
    assert python.status == "demonstrated"
    assert python.evidence[0].source_type == "internship"  # an internship is not presented as professional experience
    assert python.evidence[0].source == "Backend Intern at Beta Labs"


def test_quotes_are_copied_from_the_resume_and_point_at_a_real_chunk():
    analysis = analyse(profile(), job(), RESUME, chunks())
    flattened = " ".join(RESUME.split())
    refs = [r for a in analysis.assessments for r in a.evidence if r.quote]
    assert refs, "expected at least one quoted piece of evidence"
    for ref in refs:
        assert ref.quote in flattened, f"quote is not verbatim resume text: {ref.quote!r}"
    spring = by_name(analysis)["Spring Boot"].evidence[0]
    assert spring.chunk_id == "chunk-projects" and spring.section == "projects"
    assert all(r.chunk_id in (None, "chunk-projects", "chunk-exp") for r in refs)  # never an invented id


def test_no_placeholder_references_are_produced():
    analysis = analyse(profile(), job(), RESUME, chunks())
    text = " ".join(strengths_from(analysis)) + fallback_narrative(job(), analysis)
    assert "[EVIDENCE" not in text.upper()
    assert strip_placeholders("Used Spring Boot [EVIDENCE 2] well [3].") == "Used Spring Boot well."


def test_strengths_and_experience_name_the_entry_where_the_skill_was_shown():
    analysis = analyse(profile(), job(), RESUME, chunks())
    strengths = strengths_from(analysis)
    assert any(s.startswith("Spring Boot: used in project 'Shop Tracker'") for s in strengths)
    assert "Project: Shop Tracker" in relevant_experience_from(analysis)
    assert "Project: Chat Service" not in relevant_experience_from(analysis)  # evidences no requirement


# ---------------------------------------------------------------- missing skills

def test_a_skill_the_resume_never_mentions_is_not_evidenced_not_disproved():
    a = by_name(analyse(profile(), job(), RESUME, chunks()))
    kafka = a["Kafka"]
    assert kafka.status == "not_evidenced"
    assert "Not mentioned in the resume" in kafka.explanation
    assert not any(w in kafka.explanation.lower() for w in ("cannot", "unable", "lacks the ability"))
    assert kafka.evidence == []


def test_a_narrative_that_calls_missing_evidence_an_inability_is_rejected():
    analysis = analyse(profile(), job(), RESUME, chunks())
    bad = "The candidate cannot work with Kafka."
    violations = verify_narrative(bad, analysis, RESUME, job())
    assert any("inability" in v for v in violations)


def test_naming_a_missing_requirement_without_saying_it_is_missing_is_rejected():
    analysis = analyse(profile(), job(), RESUME, chunks())
    assert verify_narrative("Kafka experience is a clear strength here.", analysis, RESUME, job())
    assert not verify_narrative("Kafka is not mentioned in the resume.", analysis, RESUME, job())


# ---------------------------------------------------------------- partial matches

def test_a_related_term_is_a_partial_match_not_direct_experience():
    sql = by_name(analyse(profile(), job(), RESUME, chunks()))["SQL"]
    assert sql.status == "partial"
    assert "not 'SQL' itself" in sql.explanation or "not 'sql' itself" in sql.explanation.lower()


def test_a_skill_that_is_only_listed_is_partial_and_says_so():
    git = by_name(analyse(profile(), job(), RESUME, chunks()))["Git"]
    assert git.status == "partial"
    assert "skills section only" in git.explanation
    assert git.evidence[0].source_type == "listed skills"


def test_overstating_a_partial_skill_is_rejected():
    analysis = analyse(profile(), job(), RESUME, chunks())
    assert any("Overstates 'SQL'" in v for v in verify_narrative("She is an expert in SQL.", analysis, RESUME, job()))
    assert not verify_narrative("SQL is only partly shown, named through PostgreSQL.", analysis, RESUME, job())


def test_internship_only_experience_is_partial_against_a_years_requirement():
    exp = [a for a in analyse(profile(), job(), RESUME, chunks()).assessments if a.category == "experience"][0]
    assert exp.status == "partial"
    assert "internships" in exp.explanation


def test_responsibilities_are_compared_by_wording_and_never_marked_demonstrated():
    rows = [a for a in analyse(profile(), job(), RESUME, chunks()).assessments if a.category == "responsibility"]
    assert {r.requirement: r.status for r in rows}["Build REST APIs for payment services"] == "partial"
    assert {r.requirement: r.status for r in rows}["Run Kafka pipelines for settlement data"] == "not_evidenced"
    assert all(r.status != "demonstrated" for r in rows)


# ---------------------------------------------------------------- unsupported claims and wrong attribution

def test_a_skill_moved_to_the_wrong_project_is_rejected():
    analysis = analyse(profile(), job(), RESUME, chunks())
    wrong = "In the Chat Service project the candidate used Spring Boot."
    right = "In the Shop Tracker project the candidate used Spring Boot."
    assert any("Attributes 'Spring Boot' to 'Chat Service'" in v for v in verify_narrative(wrong, analysis, RESUME, job()))
    assert not verify_narrative(right, analysis, RESUME, job())


def test_invented_years_and_unknown_technologies_are_rejected():
    analysis = analyse(profile(), job(), RESUME, chunks())
    assert any("8 years" in v for v in verify_narrative("She has 8 years of backend experience.", analysis, RESUME, job()))
    assert any("Terraform" in v for v in verify_narrative("She also automated infrastructure with Terraform.", analysis, RESUME, job()))
    assert not verify_narrative("She built REST APIs with FastAPI.", analysis, RESUME, job())  # FastAPI is in the resume


def test_placeholder_references_are_rejected():
    analysis = analyse(profile(), job(), RESUME, chunks())
    assert any("placeholders" in v for v in verify_narrative("Used Spring Boot [EVIDENCE 3].", analysis, RESUME, job()))


# ---------------------------------------------------------------- not enough evidence

def test_a_thin_resume_reports_its_limits_and_lowers_confidence():
    thin = CandidateProfile(name="Sam")
    text = "Sam. Developer."
    analysis = analyse(thin, job(), text, [], None)
    assert analysis.limitations and "very short" in analysis.limitations[0]
    assert any("No jobs or projects" in x for x in analysis.limitations)
    assert all(a.status == "not_evidenced" for a in analysis.assessments)
    assert confidence_from(analysis) < confidence_from(analyse(profile(), job(), RESUME, chunks()))
    narrative = fallback_narrative(job(), analysis)
    assert "does not show any required skill" in narrative and "cannot" not in narrative.lower()
    assert "none" not in overall_from(analysis).lower() or "evidences none" in overall_from(analysis)


def test_a_job_without_requirements_is_acknowledged():
    empty = job(requirements=[], description="", min_experience_years=0, education_level=None)
    analysis = analyse(profile(), empty, RESUME, chunks())
    assert analysis.assessments == []
    assert any("no required or preferred skills" in x for x in analysis.limitations)
    assert any("no description" in x for x in analysis.limitations)
    assert "not enough information" in overall_from(analysis)


def test_the_fallback_narrative_passes_its_own_verification():
    analysis = analyse(profile(), job(), RESUME, chunks())
    assert verify_narrative(fallback_narrative(job(), analysis), analysis, RESUME, job()) == []


# ---------------------------------------------------------------- the service end to end

GOOD = (
    "For the Backend Engineer role, the strongest evidence is the Shop Tracker project, where the candidate used Spring Boot "
    "and Docker for an inventory application. Python appears in the Backend Intern role at Beta Labs, which is an internship "
    "rather than professional employment, so it shows early hands-on work with REST APIs. SQL is only partly shown, because "
    "the resume names PostgreSQL rather than SQL, and Git is only listed in the skills section. Kafka and Kubernetes are not "
    "mentioned in the resume, which may be a gap in the document rather than in the candidate. The dated experience is short "
    "compared with the two years asked for. Overall the candidate looks relevant for a junior position, with the Kafka "
    "requirement still to be confirmed at interview."
)


class FakeLLM:
    model_name = "fake"

    def __init__(self, *answers):
        self.answers = list(answers)
        self.prompts = []

    async def chat_json(self, system, user, schema=None, max_tokens=None):
        self.prompts.append(user)
        return {"summary_text": self.answers.pop(0)}


class FakeReranker:
    async def rerank(self, query, chunks, top_k):
        return [EvidenceChunk(chunk_id=c.chunk_id, text=c.text, section=c.section, relevance_score=0.9, source_pdf=c.source_pdf) for c in chunks][:top_k]


async def summarise(llm):
    return await RAGSummaryService(FakeReranker(), llm).generate_summary(
        candidate=profile(), job=job(), retrieved_chunks=chunks(), candidate_id="cand", query="Backend Engineer", resume_text=RESUME,
    )


def test_the_good_narrative_used_in_these_tests_is_within_the_word_limit():
    assert 100 <= word_count(GOOD) <= 150, word_count(GOOD)


async def test_a_grounded_narrative_is_kept_and_the_response_carries_the_evidence():
    llm = FakeLLM(GOOD)
    result = await summarise(llm)

    assert result.summary_text == GOOD
    assert result.verification == {"passed": True, "fallback": False, "attempts": 1, "violations": []}
    assert result.not_evidenced and "Kafka" in result.not_evidenced
    assert any(a.requirement == "Spring Boot" and a.evidence[0].chunk_id == "chunk-projects" for a in result.requirement_assessments)
    assert result.overall_assessment and all("very short" in n for n in result.limitations)  # only the fixture's brevity
    assert "[EVIDENCE" not in llm.prompts[0].upper()  # the prompt no longer asks for tags that map to nothing
    wire = result.to_wire()
    assert "requirementAssessments" in wire and "notEvidenced" in wire and wire["summaryText"] == GOOD  # existing contract intact


async def test_an_unsupported_answer_is_retried_with_the_reasons_and_then_accepted():
    bad = GOOD.replace("Shop Tracker project, where", "Chat Service project, where")
    llm = FakeLLM(bad, GOOD)
    result = await summarise(llm)

    assert result.summary_text == GOOD and result.verification["attempts"] == 2
    assert "Attributes 'Spring Boot' to 'Chat Service'" in llm.prompts[1]


async def test_two_unsupported_answers_fall_back_to_a_plain_statement_of_the_facts():
    bad = "She is an expert in Terraform with 9 years of experience and cannot be faulted on Kafka [EVIDENCE 1]."
    result = await summarise(FakeLLM(bad, bad))

    assert result.verification["fallback"] is True and result.verification["passed"] is False
    assert result.verification["violations"]
    assert "Terraform" not in result.summary_text and "[EVIDENCE" not in result.summary_text
    assert "Spring Boot" in result.summary_text and "Kafka" in result.summary_text


async def test_a_wrong_length_answer_is_rejected():
    result = await summarise(FakeLLM("Spring Boot was used in the Shop Tracker project.", GOOD))
    assert result.summary_text == GOOD and result.verification["attempts"] == 2
