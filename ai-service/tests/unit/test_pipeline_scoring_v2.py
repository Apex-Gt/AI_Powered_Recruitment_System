from datetime import date

import pytest

from app.models.schemas import CandidateProfile, JobDescription, JobRequirement, ResumeChunk, Skill, WorkExperience
from app.pipeline.experience import merged_months, parse_month, relevant_experience_years, total_experience_years
from app.services.scoring import ScoringService, find_skill_evidence, normalize_skill

TODAY = date(2026, 10, 20)


def test_parse_month_formats():
    assert parse_month("Jan 2020", today=TODAY) == 2020 * 12
    assert parse_month("2020-03", today=TODAY) == 2020 * 12 + 2
    assert parse_month("03/2020", today=TODAY) == 2020 * 12 + 2
    assert parse_month("present", today=TODAY) == 2026 * 12 + 9
    assert parse_month("2019", end=True, today=TODAY) == 2019 * 12 + 11
    assert parse_month("sometime", today=TODAY) is None
    assert parse_month("1890", today=TODAY) is None


def test_overlapping_roles_are_not_double_counted():
    roles = [
        WorkExperience(title="A", start_date="Jan 2020", end_date="Dec 2021"),  # 24 months
        WorkExperience(title="B", start_date="Jul 2021", end_date="Dec 2022"),  # overlaps 6, adds 12
    ]
    profile = CandidateProfile(name="X", experience=roles)
    assert total_experience_years(profile, TODAY) == 3.0


def test_undated_history_returns_none():
    profile = CandidateProfile(name="X", experience=[WorkExperience(title="Dev")])
    assert total_experience_years(profile, TODAY) is None


def test_relevant_experience_counts_only_matching_roles():
    job = JobDescription(job_id="j", title="Python Developer", company_id="c", description="d", required_skills=["Python"])
    profile = CandidateProfile(
        name="X",
        experience=[
            WorkExperience(title="Backend Engineer", description="Built services in Python", start_date="2020-01", end_date="2022-01"),
            WorkExperience(title="Barista", description="Made coffee", start_date="2018-01", end_date="2019-12"),
        ],
    )
    assert relevant_experience_years(profile, job, normalize_skill, TODAY) == 2.1  # 25 inclusive months


def _job(**kw):
    base = dict(job_id="j1", title="Backend Developer", company_id="c", description="Java and Spring Boot services")
    base.update(kw)
    return JobDescription(**base)


def _chunks():
    return [ResumeChunk(candidate_id="c", resume_id="r", chunk_id="r-chunk-0", section="skills", source_pdf="r.pdf", text="Java")]


def test_mandatory_gap_is_flagged_not_hidden():
    job = _job(requirements=[JobRequirement(skill="Java", required=True), JobRequirement(skill="Kubernetes", required=True)])
    candidate = CandidateProfile(name="X", skills=[Skill(name="Java")], total_experience_years=5)
    score = ScoringService().score_candidate_job(candidate, job, _chunks(), [1.0, 0.0], [[1.0, 0.0]], resume_text="Worked with Java daily")
    assert score.meets_mandatory is False
    assert score.mandatory_missing == ["kubernetes"]
    assert any("mandatory" in w.lower() for w in score.warnings)
    assert "java" in score.skill_evidence and "Java" in score.skill_evidence["java"]


def test_all_mandatory_met():
    job = _job(requirements=[JobRequirement(skill="Java", required=True)])
    candidate = CandidateProfile(name="X", skills=[Skill(name="java")])
    score = ScoringService().score_candidate_job(candidate, job, _chunks(), [1.0], [[1.0]])
    assert score.meets_mandatory and score.mandatory_missing == []
    from app.core.config import ScoringConfig, settings

    assert ScoringConfig(_env_file=None).scoring_version == "2.0"  # the code default; a local .env may pin another
    assert score.metadata["scoring_version"] == settings.scoring.scoring_version


def test_no_embeddings_warns_and_zeroes_semantic():
    job = _job(required_skills=["Java"])
    score = ScoringService().score_candidate_job(CandidateProfile(name="X", skills=[Skill(name="Java")]), job, [], [1.0], [])
    assert score.semantic_match_score == 0
    assert any("embedding" in w.lower() for w in score.warnings)


def test_experience_uses_dates_when_available_and_warns_when_not():
    job = _job(required_skills=["Java"], min_experience_years=4)
    dated = CandidateProfile(
        name="X",
        skills=[Skill(name="Java")],
        total_experience_years=10,  # an inflated claim
        experience=[WorkExperience(title="Java Developer", description="Java", start_date="2024-01", end_date="2025-01")],
    )
    undated = CandidateProfile(name="X", skills=[Skill(name="Java")], total_experience_years=10)
    svc = ScoringService()
    dated_score = svc.score_candidate_job(dated, job, _chunks(), [1.0], [[1.0]])
    undated_score = svc.score_candidate_job(undated, job, _chunks(), [1.0], [[1.0]])
    assert dated_score.experience_match_score < undated_score.experience_match_score
    assert any("dated employment" in w for w in undated_score.warnings)


def test_weights_are_configurable_and_default_to_spec():
    svc = ScoringService()
    assert (svc.skill_weight, svc.experience_weight, svc.education_weight, svc.semantic_weight) == (0.4, 0.2, 0.1, 0.3)
    assert svc.calculate_overall_score(100, 0, 0, 0) == pytest.approx(40.0)


def test_skill_evidence_matches_aliases_on_word_boundaries():
    text = "Used Postgres for storage; also JavaScript and Java."
    assert "Postgres" in find_skill_evidence(text, "postgresql")
    assert find_skill_evidence("I like JavaScript", "java") is None
