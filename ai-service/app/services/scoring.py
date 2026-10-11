from typing import Optional
from collections import Counter
import structlog

from app.core.config import settings
from app.core.exceptions import ScoringError
from app.core.logging import get_logger
from app.models.schemas import (
    CandidateProfile,
    JobDescription,
    MatchScore,
    JobRequirement,
    EducationLevel,
)

logger = get_logger(__name__)


class ScoringService:
    def __init__(self):
        self.skill_weight = settings.scoring.skill_weight
        self.experience_weight = settings.scoring.experience_weight
        self.education_weight = settings.scoring.education_weight
        self.semantic_weight = settings.scoring.semantic_weight
        self.min_skill_match_threshold = settings.scoring.min_skill_match_threshold

    def calculate_skill_match(
        self,
        candidate: CandidateProfile,
        job: JobDescription,
    ) -> tuple[float, list[str], list[str], float]:
        candidate_skills = {s.name.lower(): s for s in candidate.skills}
        required_skills = {req.skill.lower(): req for req in job.requirements if req.required}
        preferred_skills = {req.skill.lower(): req for req in job.requirements if not req.required}
        all_job_skills = {**required_skills, **preferred_skills}

        matched_skills = []
        missing_skills = []

        for skill_name, req in required_skills.items():
            if skill_name in candidate_skills:
                matched_skills.append(skill_name)
            else:
                missing_skills.append(skill_name)

        for skill_name, req in preferred_skills.items():
            if skill_name in candidate_skills:
                matched_skills.append(skill_name)
            else:
                missing_skills.append(skill_name)

        total_required = len(required_skills)
        total_preferred = len(preferred_skills)
        total_skills = total_required + total_preferred

        if total_skills == 0:
            return 0.0, [], [], 0.0

        required_matched = sum(1 for s in required_skills if s in candidate_skills)
        preferred_matched = sum(1 for s in preferred_skills if s in candidate_skills)

        required_score = (required_matched / total_required * 100) if total_required > 0 else 100
        preferred_score = (preferred_matched / total_preferred * 100) if total_preferred > 0 else 100

        overall_skill_score = (required_score * 0.7) + (preferred_score * 0.3)
        coverage = (len(matched_skills) / total_skills * 100) if total_skills > 0 else 0

        return overall_skill_score, matched_skills, missing_skills, coverage

    def calculate_experience_match(
        self,
        candidate: CandidateProfile,
        job: JobDescription,
    ) -> float:
        min_years = job.min_experience_years
        candidate_years = candidate.total_experience_years

        if min_years <= 0:
            return 100.0

        if candidate_years >= min_years:
            excess = candidate_years - min_years
            if excess <= 2:
                return 100.0
            elif excess <= 5:
                return 90.0
            else:
                return 80.0
        else:
            ratio = candidate_years / min_years
            return max(0.0, ratio * 100)

    def calculate_education_match(
        self,
        candidate: CandidateProfile,
        job: JobDescription,
    ) -> float:
        required_level = job.education_level
        if required_level is None:
            return 100.0

        candidate_level = candidate.get_highest_education_level()
        if candidate_level is None:
            return 0.0

        level_order = {
            EducationLevel.HIGH_SCHOOL: 1,
            EducationLevel.ASSOCIATE: 2,
            EducationLevel.BACHELOR: 3,
            EducationLevel.MASTER: 4,
            EducationLevel.PHD: 5,
            EducationLevel.OTHER: 0,
        }

        required_rank = level_order.get(required_level, 0)
        candidate_rank = level_order.get(candidate_level, 0)

        if candidate_rank >= required_rank:
            return 100.0
        elif candidate_rank == required_rank - 1:
            return 70.0
        elif candidate_rank == required_rank - 2:
            return 40.0
        else:
            return 10.0

    def calculate_semantic_match(
        self,
        candidate_chunks: list,
        job_description: str,
        query_embedding: list[float],
        chunk_embeddings: list[list[float]],
    ) -> float:
        if not candidate_chunks or not chunk_embeddings:
            return 0.0

        import numpy as np

        query_vec = np.array(query_embedding)
        chunk_vecs = np.array(chunk_embeddings)

        similarities = np.dot(chunk_vecs, query_vec) / (
            np.linalg.norm(chunk_vecs, axis=1) * np.linalg.norm(query_vec) + 1e-8
        )

        top_similarities = np.sort(similarities)[::-1][:10]
        avg_similarity = float(np.mean(top_similarities)) if len(top_similarities) > 0 else 0.0

        return max(0.0, min(100.0, avg_similarity * 100))

    def calculate_overall_score(
        self,
        skill_score: float,
        experience_score: float,
        education_score: float,
        semantic_score: float,
    ) -> float:
        total_weight = (
            self.skill_weight
            + self.experience_weight
            + self.education_weight
            + self.semantic_weight
        )

        if total_weight == 0:
            return 0.0

        weighted_score = (
            skill_score * self.skill_weight
            + experience_score * self.experience_weight
            + education_score * self.education_weight
            + semantic_score * self.semantic_weight
        ) / total_weight

        return round(max(0.0, min(100.0, weighted_score)), 2)

    def score_candidate_job(
        self,
        candidate: CandidateProfile,
        job: JobDescription,
        candidate_chunks: list,
        query_embedding: list[float],
        chunk_embeddings: list[list[float]],
    ) -> MatchScore:
        try:
            skill_score, matched_skills, missing_skills, coverage = self.calculate_skill_match(candidate, job)
            experience_score = self.calculate_experience_match(candidate, job)
            education_score = self.calculate_education_match(candidate, job)
            semantic_score = self.calculate_semantic_match(
                candidate_chunks, job.description, query_embedding, chunk_embeddings
            )

            overall_score = self.calculate_overall_score(
                skill_score, experience_score, education_score, semantic_score
            )

            evidence_chunks = [chunk.chunk_id for chunk in candidate_chunks[:5]]

            return MatchScore(
                candidate_id="",  # Set by caller
                job_id="",  # Set by caller
                overall_score=overall_score,
                skill_match_score=round(skill_score, 2),
                experience_match_score=round(experience_score, 2),
                education_match_score=round(education_score, 2),
                semantic_match_score=round(semantic_score, 2),
                matched_skills=matched_skills,
                missing_skills=missing_skills,
                skill_coverage=round(coverage, 2),
                evidence_chunks=evidence_chunks,
                metadata={
                    "scoring_version": settings.scoring.scoring_version,
                    "prompt_version": settings.scoring.prompt_version,
                    "weights": {
                        "skill": self.skill_weight,
                        "experience": self.experience_weight,
                        "education": self.education_weight,
                        "semantic": self.semantic_weight,
                    },
                },
            )
        except Exception as e:
            logger.error("scoring_failed", error=str(e))
            raise ScoringError(f"Failed to calculate match score: {e}") from e