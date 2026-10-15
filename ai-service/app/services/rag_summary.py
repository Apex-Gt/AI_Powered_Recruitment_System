import json
from typing import Optional

from app.core.config import settings
from app.core.exceptions import RAGError
from app.core.logging import get_logger
from app.models.schemas import (
    CandidateProfile,
    JobDescription,
    MatchScore,
    RAGSummary,
    EvidenceChunk,
    ResumeChunk,
)
from app.services.llm import LLMService, get_llm_service
from app.services.reranker import RerankerService

logger = get_logger(__name__)


class RAGSummaryService:
    def __init__(self, reranker_service: RerankerService, llm: Optional[LLMService] = None):
        self.reranker_service = reranker_service
        self._llm = llm

    @property
    def llm(self) -> LLMService:
        return self._llm or get_llm_service()

    async def generate_summary(
        self,
        candidate: CandidateProfile,
        job: JobDescription,
        retrieved_chunks: list[ResumeChunk],
        match_score: Optional[MatchScore] = None,
        candidate_id: Optional[str] = None,
        query: Optional[str] = None,
    ) -> RAGSummary:
        if not retrieved_chunks:
            raise RAGError("Cannot generate summary without retrieved chunks")

        rerank_query = (query or job.description or job.title or "").strip()
        if not rerank_query:
            raise RAGError("Cannot generate summary without a query or job description")

        try:
            reranked_chunks = await self.reranker_service.rerank(
                query=rerank_query,
                chunks=retrieved_chunks,
                top_k=min(10, len(retrieved_chunks)),
            )

            top_evidence = reranked_chunks[:5]

            prompt = self._build_summary_prompt(candidate, job, top_evidence, match_score)

            data = await self.llm.chat_json(
                system="You are an expert HR analyst. Generate a grounded, evidence-based candidate summary for a job match. Only use information from the provided resume chunks. Never invent information. If information is not in the chunks, state it's not mentioned. Respond with a single JSON object.",
                user=prompt,
            )

            try:
                confidence = max(0.0, min(1.0, float(data.get("confidence_score", 0.5))))
            except (TypeError, ValueError):
                confidence = 0.5

            summary = RAGSummary(
                candidate_id=candidate_id or "",
                job_id=job.job_id,
                strengths=self._as_str_list(data.get("strengths")),
                matched_skills=self._as_str_list(data.get("matched_skills")),
                missing_skills=self._as_str_list(data.get("missing_skills")),
                relevant_experience=self._as_str_list(data.get("relevant_experience")),
                evidence=top_evidence,
                summary_text=str(data.get("summary_text") or ""),
                confidence_score=confidence,
                model_used=self.llm.model_name,
                prompt_version=settings.scoring.prompt_version,
            )

            logger.info("rag_summary_generated", candidate=candidate.name, job=job.job_id, evidence=len(top_evidence))
            return summary

        except Exception as e:
            logger.error("rag_summary_failed", error=str(e))
            raise RAGError(f"Failed to generate RAG summary: {e}") from e

    @staticmethod
    def _as_str_list(value) -> list[str]:
        if not value:
            return []
        if isinstance(value, str):
            return [value]
        return [item if isinstance(item, str) else json.dumps(item, ensure_ascii=False) for item in value]

    def _build_summary_prompt(
        self,
        candidate: CandidateProfile,
        job: JobDescription,
        evidence_chunks: list[EvidenceChunk],
        match_score: Optional[MatchScore] = None,
    ) -> str:
        evidence_text = "\n\n".join(
            [
                f"[EVIDENCE {i+1}] (Section: {ec.section}, Source: {ec.source_pdf}, Relevance: {ec.relevance_score:.2f})\n{ec.text}"
                for i, ec in enumerate(evidence_chunks)
            ]
        )

        candidate_skills = ", ".join([s.name for s in candidate.skills])
        job_required_skills = ", ".join(job.required_skills)
        job_preferred_skills = ", ".join(job.preferred_skills)

        highest_education = candidate.get_highest_education_level()

        match_info = ""
        if match_score:
            match_info = f"""
Match Scores:
- Overall: {match_score.overall_score}/100
- Skills: {match_score.skill_match_score}/100
- Experience: {match_score.experience_match_score}/100
- Education: {match_score.education_match_score}/100
- Semantic: {match_score.semantic_match_score}/100
"""

        return f"""Analyze the candidate's fit for the job based ONLY on the provided evidence chunks. Do not use any external knowledge.

Job: {job.title} at Company {job.company_id}
Job Description: {job.description[:2000]}

Required Skills: {job_required_skills}
Preferred Skills: {job_preferred_skills}
Min Experience: {job.min_experience_years} years
Education Level: {job.education_level.value if job.education_level else "Not specified"}

Candidate: {candidate.name}
Candidate Skills: {candidate_skills}
Total Experience: {candidate.total_experience_years} years
Highest Education: {highest_education.value if highest_education else "Not specified"}

{match_info}

Evidence Chunks (ONLY SOURCE OF TRUTH):
{evidence_text}

Generate a JSON response with:
{{
  "strengths": ["string"],
  "matched_skills": ["string"],
  "missing_skills": ["string"],
  "relevant_experience": ["string"],
  "summary_text": "string (2-3 paragraphs grounded in evidence)",
  "confidence_score": float (0-1, based on evidence coverage)
}}

Rules:
1. Every claim MUST reference specific evidence chunks by number [EVIDENCE X]
2. If a skill/experience is NOT in evidence, list it in missing_skills or state "not mentioned in resume"
3. Do not infer or assume information not in the chunks
4. Be specific and quote relevant text from evidence
5. Confidence score should reflect how well evidence covers the job requirements
"""