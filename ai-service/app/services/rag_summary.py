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
    ResumeChunk,
)
from app.services.evidence import (
    Analysis,
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
from app.services.llm import LLMService, get_llm_service
from app.services.reranker import RerankerService

logger = get_logger(__name__)

MAX_ATTEMPTS = 2
MIN_WORDS, MAX_WORDS = 90, 160  # the prompt asks for 100-150; a little slack so a good answer is not rejected over a word
SYSTEM_PROMPT = (
    "You are a careful recruiting analyst. You explain how a resume matches a job using only the verified facts you are given. "
    "You never invent or assume anything, and you never treat a missing mention as proof that someone cannot do something. "
    "Respond with a single JSON object."
)


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
        resume_text: str = "",
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

            # The resume text is the source of truth; the stored chunks are its retrievable pieces.
            text = resume_text or "\n\n".join(c.text for c in retrieved_chunks)
            analysis = analyse(candidate, job, text, retrieved_chunks, match_score)

            narrative, verification = await self._write_narrative(job, analysis, text)

            skill_rows = [a for a in analysis.assessments if a.category.endswith("skill")]
            summary = RAGSummary(
                candidate_id=candidate_id or "",
                job_id=job.job_id,
                strengths=strengths_from(analysis),
                # The score is computed deterministically from the resume; its lists are authoritative.
                matched_skills=list(match_score.matched_skills) if match_score else [a.requirement for a in skill_rows if a.status == "demonstrated"],
                missing_skills=list(match_score.missing_skills) if match_score else [a.requirement for a in skill_rows if a.status == "not_evidenced"],
                relevant_experience=relevant_experience_from(analysis),
                evidence=top_evidence,
                requirement_assessments=analysis.assessments,
                not_evidenced=analysis.not_evidenced,
                overall_assessment=overall_from(analysis),
                limitations=analysis.limitations,
                verification=verification,
                summary_text=narrative,
                confidence_score=confidence_from(analysis),
                model_used=self.llm.model_name,
                prompt_version=settings.scoring.prompt_version,
            )

            logger.info(
                "rag_summary_generated",
                candidate=candidate.name,
                job=job.job_id,
                evidence=len(top_evidence),
                verified=verification["passed"],
                fallback=verification["fallback"],
            )
            return summary

        except Exception as e:
            logger.error("rag_summary_failed", error=str(e))
            raise RAGError(f"Failed to generate RAG summary: {e}") from e

    async def _write_narrative(self, job: JobDescription, analysis: Analysis, resume_text: str) -> tuple[str, dict]:
        """The model words the explanation from verified facts; anything it adds that the facts do not support is rejected."""
        violations: list[str] = []
        for attempt in range(MAX_ATTEMPTS):
            data = await self.llm.chat_json(
                system=SYSTEM_PROMPT,
                user=self._build_narrative_prompt(job, analysis, violations),
                max_tokens=600,
            )
            text = strip_placeholders(str(data.get("summary_text") or ""))
            violations = verify_narrative(text, analysis, resume_text, job)
            words = word_count(text)
            if words and not MIN_WORDS <= words <= MAX_WORDS:
                violations.append(f"The explanation is {words} words; it must be between 100 and 150")
            if not violations:
                return text, {"passed": True, "fallback": False, "attempts": attempt + 1, "violations": []}
            logger.warning("rag_summary_rejected", attempt=attempt + 1, violations=violations[:5])
        return (
            fallback_narrative(job, analysis),
            {"passed": False, "fallback": True, "attempts": MAX_ATTEMPTS, "violations": violations[:10]},
        )

    @staticmethod
    def _as_str_list(value) -> list[str]:
        if not value:
            return []
        if isinstance(value, str):
            return [value]
        return [item if isinstance(item, str) else json.dumps(item, ensure_ascii=False) for item in value]

    def _build_narrative_prompt(self, job: JobDescription, analysis: Analysis, violations: list[str]) -> str:
        def line(a) -> str:
            sources = "; ".join(f"{r.source_type} '{r.source}'" for r in a.evidence) or "none"
            return f"- [{a.status.upper()}] {a.category}: {a.requirement} | {a.explanation} | evidence from: {sources}"

        facts = "\n".join(line(a) for a in analysis.assessments) or "- (the job gave nothing to compare)"
        limits = "\n".join(f"- {x}" for x in analysis.limitations) or "- none"
        retry = ""
        if violations:
            retry = "\nYour previous answer was rejected for these reasons. Fix every one:\n" + "\n".join(f"- {v}" for v in violations[:8]) + "\n"
        return f"""Write a short explanation for a recruiter of how this resume matches the job "{job.title}".

VERIFIED FACTS (the only source of truth; each was checked against the resume):
{facts}

LIMITATIONS OF THE DATA:
{limits}
{retry}
Rules:
1. About 120 words, between 100 and 150, in plain language for a non-technical recruiter. No lists, no headings.
2. Use only the facts above. Do not add skills, tools, employers, projects, responsibilities, numbers or years that are not listed.
3. DEMONSTRATED means used in the named project, job or internship; say where. Never move a skill to a different project or employer.
4. PARTIAL means only listed or named by a related term: say it is not confirmed as hands-on experience. Do not call it expertise.
5. NOT_EVIDENCED means the resume does not mention it. Say "not mentioned in the resume", never that the candidate cannot do it.
6. Prefer mandatory requirements over preferred ones. Keep project, internship and professional experience distinct.
7. Do not write reference tags or numbered citations, and do not quote.
8. End with one balanced sentence on how relevant the candidate looks for the role, acknowledging any data limitation.

Respond with one JSON object: {{"summary_text": "string"}}"""
