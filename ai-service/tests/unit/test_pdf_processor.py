import pytest
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path

from app.services.pdf_processor import PDFProcessingService, CandidateExtractionService
from app.models.schemas import ResumeChunk, CandidateProfile, Skill, Education, EducationLevel
from app.core.exceptions import PDFProcessingError


@pytest.fixture
def pdf_processor():
    return PDFProcessingService()


@pytest.fixture
def candidate_extractor():
    return CandidateExtractionService()


@pytest.mark.asyncio
async def test_chunk_text_basic(pdf_processor):
    text = "This is a test resume. " * 100
    chunks = await pdf_processor.chunk_text(text, "cand-1", "res-1", "job-1", "resume.pdf")

    assert len(chunks) > 0
    for chunk in chunks:
        assert isinstance(chunk, ResumeChunk)
        assert chunk.candidate_id == "cand-1"
        assert chunk.resume_id == "res-1"
        assert chunk.job_id == "job-1"
        assert chunk.source_pdf == "resume.pdf"
        assert len(chunk.text) > 0


@pytest.mark.asyncio
async def test_chunk_text_empty(pdf_processor):
    with pytest.raises(PDFProcessingError):
        await pdf_processor.chunk_text("", "cand-1", "res-1")


def test_infer_section_experience(pdf_processor):
    text = "Experience: Worked as a software engineer at Google for 5 years."
    section = pdf_processor._infer_section(text)
    assert section == "experience"


def test_infer_section_education(pdf_processor):
    text = "Education: Bachelor of Science in Computer Science from Stanford University."
    section = pdf_processor._infer_section(text)
    assert section == "education"


def test_infer_section_skills(pdf_processor):
    text = "Skills: Python, JavaScript, React, Node.js, PostgreSQL."
    section = pdf_processor._infer_section(text)
    assert section == "skills"


def test_infer_section_projects(pdf_processor):
    text = "Projects: Built a scalable web application using React and Django."
    section = pdf_processor._infer_section(text)
    assert section == "projects"


def test_infer_section_certifications(pdf_processor):
    text = "Certifications: AWS Certified Solutions Architect."
    section = pdf_processor._infer_section(text)
    assert section == "certifications"


def test_infer_section_summary(pdf_processor):
    text = "Summary: Experienced software engineer with 10 years of experience."
    section = pdf_processor._infer_section(text)
    assert section == "summary"


def test_infer_section_general(pdf_processor):
    text = "Random text without any section keywords."
    section = pdf_processor._infer_section(text)
    assert section == "general"


@pytest.mark.asyncio
async def test_extract_text_from_pdf_not_found(pdf_processor):
    with pytest.raises(PDFProcessingError):
        await pdf_processor.extract_text_from_pdf("/nonexistent/path.pdf")


@pytest.mark.asyncio
async def test_extract_candidate_profile_success(candidate_extractor):
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = """
    {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1-555-123-4567",
        "location": "San Francisco, CA",
        "skills": [
            {"name": "Python", "level": "advanced", "years_experience": 5.0, "category": "programming"}
        ],
        "total_experience_years": 5.0,
        "education": [
            {"institution": "Stanford", "degree": "MS CS", "level": "master"}
        ],
        "certifications": [],
        "projects": [],
        "summary": "Experienced developer"
    }
    """

    with patch.object(candidate_extractor, '_get_client', return_value=AsyncMock()) as mock_client:
        mock_client.return_value.chat.completions.create = AsyncMock(return_value=mock_response)

        profile = await candidate_extractor.extract_candidate_profile("Test resume text")

        assert isinstance(profile, CandidateProfile)
        assert profile.name == "John Doe"
        assert profile.email == "john@example.com"
        assert len(profile.skills) == 1
        assert profile.skills[0].name == "Python"


@pytest.mark.asyncio
async def test_extract_candidate_profile_empty_text(candidate_extractor):
    with pytest.raises(PDFProcessingError):
        await candidate_extractor.extract_candidate_profile("")


@pytest.mark.asyncio
async def test_extract_candidate_profile_api_error(candidate_extractor):
    with patch.object(candidate_extractor, '_get_client', return_value=AsyncMock()) as mock_client:
        mock_client.return_value.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))

        with pytest.raises(PDFProcessingError):
            await candidate_extractor.extract_candidate_profile("Test resume text")