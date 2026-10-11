from pathlib import Path
from typing import Optional
from llama_index.readers.file import PDFReader
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import Document
import structlog

from app.core.config import settings
from app.core.exceptions import PDFProcessingError
from app.core.logging import get_logger
from app.models.schemas import ResumeChunk, CandidateProfile

logger = get_logger(__name__)


class PDFProcessingService:
    def __init__(self):
        self.reader = PDFReader()
        self.splitter = SentenceSplitter(
            chunk_size=settings.chunking.chunk_size,
            chunk_overlap=settings.chunking.chunk_overlap,
            paragraph_separator="\n\n",
            secondary_chunking_regex="[.!?]\\s+",
        )

    async def extract_text_from_pdf(self, pdf_path: str) -> str:
        path = Path(pdf_path)
        if not path.exists():
            raise PDFProcessingError(f"PDF file not found: {pdf_path}")

        try:
            documents = self.reader.load_data(path)
            full_text = "\n\n".join([doc.text for doc in documents])
            logger.info("pdf_text_extracted", path=pdf_path, length=len(full_text))
            return full_text
        except Exception as e:
            raise PDFProcessingError(f"Failed to extract text from PDF: {e}") from e

    async def chunk_text(
        self,
        text: str,
        candidate_id: str,
        resume_id: str,
        job_id: Optional[str] = None,
        source_pdf: str = "",
    ) -> list[ResumeChunk]:
        if not text or not text.strip():
            raise PDFProcessingError("Cannot chunk empty text")

        try:
            documents = [Document(text=text.strip(), metadata={"source": source_pdf})]
            nodes = self.splitter.get_nodes_from_documents(documents)

            chunks = []
            for i, node in enumerate(nodes):
                section = self._infer_section(node.text)
                chunk = ResumeChunk(
                    candidate_id=candidate_id,
                    resume_id=resume_id,
                    job_id=job_id,
                    chunk_id=f"{resume_id}-chunk-{i}",
                    section=section,
                    source_pdf=source_pdf,
                    text=node.text,
                    metadata={
                        "node_id": node.node_id,
                        "start_char_idx": node.start_char_idx,
                        "end_char_idx": node.end_char_idx,
                    },
                )
                chunks.append(chunk)

            logger.info("text_chunked", candidate_id=candidate_id, resume_id=resume_id, chunks=len(chunks))
            return chunks
        except Exception as e:
            raise PDFProcessingError(f"Failed to chunk text: {e}") from e

    def _infer_section(self, text: str) -> str:
        text_lower = text.lower().strip()
        if any(kw in text_lower[:100] for kw in ["summary", "objective", "profile", "about"]):
            return "summary"
        elif any(kw in text_lower[:100] for kw in ["experience", "employment", "work history", "professional experience"]):
            return "experience"
        elif any(kw in text_lower[:100] for kw in ["education", "academic", "university", "college", "degree"]):
            return "education"
        elif any(kw in text_lower[:100] for kw in ["skill", "technical", "technology", "tool", "language", "framework"]):
            return "skills"
        elif any(kw in text_lower[:100] for kw in ["project", "portfolio", "github", "repository"]):
            return "projects"
        elif any(kw in text_lower[:100] for kw in ["certification", "license", "credential", "certificate"]):
            return "certifications"
        else:
            return "general"


class CandidateExtractionService:
    def __init__(self):
        self._client = None

    async def _get_client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=settings.openai.api_key,
                base_url=settings.openai.base_url,
                timeout=settings.openai.timeout if hasattr(settings.openai, "timeout") else 60.0,
            )
        return self._client

    async def extract_candidate_profile(self, text: str) -> CandidateProfile:
        if not text or not text.strip():
            raise PDFProcessingError("Cannot extract profile from empty text")

        client = await self._get_client()
        try:
            prompt = self._build_extraction_prompt(text)
            response = await client.chat.completions.create(
                model=settings.model.llm_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert HR assistant that extracts structured candidate information from resumes. Return only valid JSON matching the specified schema.",
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
            profile = CandidateProfile(**data)
            logger.info("candidate_profile_extracted", name=profile.name, skills=len(profile.skills))
            return profile
        except Exception as e:
            logger.error("candidate_extraction_failed", error=str(e))
            raise PDFProcessingError(f"Failed to extract candidate profile: {e}") from e

    def _build_extraction_prompt(self, text: str) -> str:
        return f"""Extract structured candidate information from the following resume text. Return a JSON object with the following schema:

{{
  "name": "string (required)",
  "email": "string (email format, optional)",
  "phone": "string (optional)",
  "location": "string (optional)",
  "skills": [
    {{"name": "string", "level": "beginner|intermediate|advanced|expert", "years_experience": float, "category": "string"}}
  ],
  "total_experience_years": float,
  "education": [
    {{"institution": "string", "degree": "string", "field_of_study": "string", "level": "high_school|associate|bachelor|master|phd|other", "start_date": "string", "end_date": "string", "gpa": float, "location": "string"}}
  ],
  "certifications": [
    {{"name": "string", "issuer": "string", "issue_date": "string", "expiry_date": "string", "credential_id": "string", "url": "string"}}
  ],
  "projects": [
    {{"name": "string", "description": "string", "technologies": ["string"], "start_date": "string", "end_date": "string", "url": "string", "role": "string"}}
  ],
  "summary": "string",
  "linkedin_url": "string",
  "github_url": "string",
  "portfolio_url": "string"
}}

Guidelines:
- Extract only information explicitly stated in the resume
- For skills, infer level and years if not explicitly stated
- For education, determine level from degree type
- If information is not present, use null or empty array
- Be conservative with estimates
- Return valid JSON only

Resume text:
{text[:15000]}"""  # Limit text length for token limits