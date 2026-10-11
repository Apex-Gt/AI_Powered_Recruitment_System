from typing import Optional
import structlog

from app.core.config import settings
from app.core.exceptions import RAGError
from app.core.logging import get_logger
from app.models.schemas import (
    CandidateProfile,
    JobDescription,
    RAGSummary,
    EvidenceChunk,
    ResumeChunk,
)
from app.services.reranker import RerankerService

logger = get_logger(__name__)


class RAGSummaryService:
    def __init__(self, reranker_service: RerankerService):
        self.reranker_service = reranker_service
        self._client = None

    async def _get_client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=settings.openai.api_key,
                base_url=settings.openai.base_url,
                timeout=60.0,
            )
        return self._client

    async def generate_summary(
        self,
        candidate: CandidateProfile,
        job: JobDescription,
        retrieved_chunks: list[ResumeChunk],
        match_score=None,
    ) -> RAGSummary:
        if not retrieved_chunks:
            raise RAGError("Cannot generate summary without retrieved chunks")

        try:
            reranked_chunks = await self.reranker_service.rerank(
                query=job.description,
                chunks=retrieved_chunks,
                top_k=min(10, len(retrieved_chunks)),
            )

            top_evidence = reranked_chunks[:5]

            prompt = self._build_summary_prompt(candidate, job, top_evidence, match_score)

            client = await self._get_client()
            response = await client.chat.completions.create(
                model=settings.model.llm_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert HR analyst. Generate a grounded, evidence-based candidate summary for a job match. Only use information from the provided resume chunks. Never invent information. If information is not in the chunks, state it's not mentioned.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=settings.model.llm_temperature,
                max_tokens=settings.model.llm_max_tokens,
                response_format={"type": "json_object"},
            )

            import json
            content = response.choices[0].message.content
            data = json.loads(content)

            summary = RAGSummary(
                candidate_id=candidate.name,  # Will be set by caller
                job_id=job.job_id,
                strengths=data.get("strengths", []),
                matched_skills=data.get("matched_skills", []),
                missing_skills=data.get("missing_skills", []),
                relevant_experience=data.get("relevant_experience", []),
                evidence=top_evidence,
                summary_text=data.get("summary_text", ""),
                confidence_score=data.get("confidence_score", 0.5),
                model_used=settings.model.llm_model,
                prompt_version=settings.scoring.prompt_version,
            )

            logger.info("rag_summary_generated", candidate=candidate.name, job=job.job_id, evidence=len(top_evidence))
            return summary

        except Exception as e:
            logger.error("rag_summary_failed", error=str(e))
            raise RAGError(f"Failed to generate RAG summary: {e}") from e

    def _build_summary_prompt(
        self,
        candidate: CandidateProfile,
        job: JobDescription,
        evidence_chunks: list[EvidenceChunk],
        match_score=None,
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
Highest Education: {candidate.get_highest_education_level().value if candidate.get_highest_education_level() else "Not specified"}

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