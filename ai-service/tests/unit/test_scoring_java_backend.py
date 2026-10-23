"""Regressions from scoring real resumes against the 'Java Backend Developer' job (fresher-friendly, no degree bar)."""

import pytest

from app.models.schemas import CandidateProfile, JobDescription, JobRequirement, Skill
from app.services.scoring import ScoringService, mentions_skill

SKILLS = [
    "Spring Boot", "SQL", "Git", "Spring Data JPA", "PostgreSQL", "Data Structures", "REST APIs",
    "Hibernate", "Java", "Object-Oriented Programming (OOP)", "Spring Security", "JWT", "Docker",
]

JOB = JobDescription(
    job_id="j", title="Java Backend Developer", company_id="c", description="Java and Spring Boot backend",
    requirements=[JobRequirement(skill=s, required=True) for s in SKILLS],
    min_experience_years=0,
)

NISCHAY = (
    "Nischay Jain. Full Stack Developer with 6 years of hands-on experience in Angular, Java, Spring Boot and Hibernate. "
    "Strong experience in designing, developing and supporting REST services using Spring Boot and Java. "
    "Strong understanding of Cloud Technologies like Docker and IBM Cloud. "
    "Good knowledge of Data Structures and Algorithms and good problem solving skills."
)
KEWIN = (
    "Languages: Java, Python, SQL. Backend: Spring Boot, Spring Security, REST APIs, JWT Authentication. "
    "Databases: PostgreSQL, MySQL. Tools: Git, Docker. Concepts: Data Structures & Algorithms, Object-Oriented Programming."
)


@pytest.fixture
def svc():
    return ScoringService()


def test_phrasing_variants_in_the_resume_text_count_as_the_skill():
    assert mentions_skill(NISCHAY, "REST APIs")  # "REST services"
    assert mentions_skill(NISCHAY, "Data Structures")  # "Data Structures and Algorithms"
    assert mentions_skill(KEWIN, "JWT")  # "JWT Authentication"
    assert mentions_skill(KEWIN, "Object-Oriented Programming (OOP)")


def test_substrings_of_other_words_do_not_count():
    assert not mentions_skill("Wrote JavaScript and TypeScript only", "Java")
    assert not mentions_skill("Takes the rest of the day off", "REST APIs")


def test_a_skill_the_model_missed_is_found_in_the_text(svc):
    profile = CandidateProfile(name="K", skills=[Skill(name="Java")])  # extraction dropped everything else
    _, matched, missing, _ = svc.calculate_skill_match(profile, JOB, KEWIN)
    assert {"jwt", "data structures", "docker", "spring boot"} <= set(matched)
    assert "hibernate" in missing  # not in this resume: still missing


def test_no_matches_means_a_zero_skill_score_not_thirty(svc):
    profile = CandidateProfile(name="F", skills=[Skill(name="React")])
    score, matched, _, _ = svc.calculate_skill_match(profile, JOB, "React and Tailwind only")
    assert matched == [] and score == 0.0


def test_required_and_preferred_still_blend_when_both_exist(svc):
    job = JobDescription(
        job_id="j", title="t", company_id="c", description="d",
        requirements=[JobRequirement(skill="Java", required=True), JobRequirement(skill="Docker", required=False)],
    )
    score, _, _, _ = svc.calculate_skill_match(CandidateProfile(name="x", skills=[Skill(name="Java")]), job)
    assert score == pytest.approx(70.0)


def test_components_with_no_bar_are_left_out_of_the_overall(svc):
    # The job asks for no experience and no degree, so only skills (0.4) and semantic (0.3) count.
    assert svc.calculate_overall_score(100, None, None, 50) == pytest.approx((100 * 0.4 + 50 * 0.3) / 0.7, abs=0.01)


def test_strong_java_resume_outranks_a_frontend_resume_with_java_familiar(svc):
    java = CandidateProfile(name="N", skills=[Skill(name="Java"), Skill(name="Spring Boot"), Skill(name="Hibernate")], total_experience_years=11)
    frontend = CandidateProfile(name="M", skills=[Skill(name="Angular"), Skill(name="Java")], total_experience_years=8)
    frontend_text = "Angular, React, TypeScript, Jest, Cypress, Git. Java (familiar)."
    chunks, q, e = [], [1.0, 0.0], []
    a = svc.score_candidate_job(java, JOB, chunks, q, e, resume_text=NISCHAY)
    b = svc.score_candidate_job(frontend, JOB, chunks, q, e, resume_text=frontend_text)
    assert a.skill_match_score > b.skill_match_score + 25
    assert a.overall_score > b.overall_score
    assert a.metadata["effective_weights"]["experience"] == 0.0
