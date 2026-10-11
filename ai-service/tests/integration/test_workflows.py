import pytest
from unittest.mock import Mock, AsyncMock, patch

from app.workflows.ingest_resume import (
    ingest_resume_workflow,
    score_job_workflow,
    rag_summary_workflow,
    rank_candidates_workflow,
)
from app.models.schemas import (
    IngestResumeEvent,
    ScoreJobEvent,
    RAGSummaryEvent,
    RankCandidatesEvent,
    CandidateProfile,
    JobDescription,
    MatchScore,
    ResumeChunk,
)


@pytest.mark.integration
class TestWorkflowsIntegration:
    @pytest.fixture
    def mock_ctx(self):
        ctx = Mock()
        ctx.event.data = {}
        return ctx

    @pytest.fixture
    def mock_step(self):
        step = Mock()
        step.run = AsyncMock()
        return step

    @pytest.mark.asyncio
    async def test_ingest_resume_workflow(self, mock_ctx, mock_step):
        mock_ctx.event.data = {
            "candidate_id": "cand-123",
            "resume_id": "res-456",
            "job_id": "job-789",
            "pdf_path": "/data/resume.pdf",
            "source_pdf": "resume.pdf",
        }

        mock_step.run.side_effect = [
            "Extracted resume text content",
            [
                ResumeChunk(
                    candidate_id="cand-123",
                    resume_id="res-456",
                    job_id="job-789",
                    chunk_id="chunk-1",
                    section="experience",
                    source_pdf="resume.pdf",
                    text="Experience text",
                )
            ],
            CandidateProfile(
                name="John Doe",
                skills=[],
                total_experience_years=5.0,
            ),
            None,
        ]

        with patch('app.workflows.ingest_resume.pdf_processor') as mock_pdf, \
             patch('app.workflows.ingest_resume.candidate_extractor') as mock_extractor, \
             patch('app.workflows.ingest_resume.qdrant_service') as mock_qdrant:

            mock_pdf.extract_text_from_pdf = AsyncMock(return_value="Extracted resume text content")
            mock_pdf.chunk_text = AsyncMock(return_value=[
                ResumeChunk(
                    candidate_id="cand-123",
                    resume_id="res-456",
                    job_id="job-789",
                    chunk_id="chunk-1",
                    section="experience",
                    source_pdf="resume.pdf",
                    text="Experience text",
                )
            ])
            mock_extractor.extract_candidate_profile = AsyncMock(return_value=CandidateProfile(
                name="John Doe",
                skills=[],
                total_experience_years=5.0,
            ))
            mock_qdrant.upsert_chunks = AsyncMock(return_value=["id-1"])

            result = await ingest_resume_workflow(mock_ctx, mock_step)

            assert result["status"] == "completed"
            assert result["candidate_id"] == "cand-123"
            assert result["chunks_stored"] == 1

    @pytest.mark.asyncio
    async def test_score_job_workflow(self, mock_ctx, mock_step):
        mock_ctx.event.data = {
            "candidate_id": "cand-123",
            "job_id": "job-789",
            "job_description": {
                "job_id": "job-789",
                "title": "Python Developer",
                "company_id": "comp-1",
                "description": "Python developer needed",
                "requirements": [],
                "required_skills": ["Python"],
                "preferred_skills": ["Django"],
                "min_experience_years": 3.0,
            },
        }

        mock_step.run.side_effect = [
            [0.1] * 1024,
            [
                ResumeChunk(
                    candidate_id="cand-123",
                    resume_id="res-1",
                    chunk_id="chunk-1",
                    section="experience",
                    source_pdf="resume.pdf",
                    text="Python experience",
                )
            ],
            CandidateProfile(name="John Doe", skills=[], total_experience_years=5.0),
            [[0.1] * 1024],
            MatchScore(
                candidate_id="cand-123",
                job_id="job-789",
                overall_score=85.0,
                skill_match_score=90.0,
                experience_match_score=80.0,
                education_match_score=100.0,
                semantic_match_score=75.0,
            ),
            None,
        ]

        with patch('app.workflows.ingest_resume.embedding_service') as mock_emb, \
             patch('app.workflows.ingest_resume.qdrant_service') as mock_qdrant, \
             patch('app.workflows.ingest_resume.scoring_service') as mock_scoring, \
             patch('app.workflows.ingest_resume._fetch_candidate_profile', return_value=None), \
             patch('app.workflows.ingest_resume._extract_profile_from_chunks') as mock_extract, \
             patch('app.workflows.ingest_resume._get_chunk_embeddings') as mock_chunk_emb, \
             patch('app.workflows.ingest_resume._store_match_score') as mock_store:

            mock_emb.embed_text = AsyncMock(return_value=[0.1] * 1024)
            mock_qdrant.search_similar = AsyncMock(return_value=[
                ResumeChunk(
                    candidate_id="cand-123",
                    resume_id="res-1",
                    chunk_id="chunk-1",
                    section="experience",
                    source_pdf="resume.pdf",
                    text="Python experience",
                )
            ])
            mock_extract.return_value = CandidateProfile(name="John Doe", skills=[], total_experience_years=5.0)
            mock_chunk_emb.return_value = [[0.1] * 1024]
            mock_scoring.score_candidate_job = Mock(return_value=MatchScore(
                candidate_id="cand-123",
                job_id="job-789",
                overall_score=85.0,
                skill_match_score=90.0,
                experience_match_score=80.0,
                education_match_score=100.0,
                semantic_match_score=75.0,
            ))

            result = await score_job_workflow(mock_ctx, mock_step)

            assert result["status"] == "completed"
            assert result["match_score"]["overall_score"] == 85.0

    @pytest.mark.asyncio
    async def test_rag_summary_workflow(self, mock_ctx, mock_step):
        mock_ctx.event.data = {
            "candidate_id": "cand-123",
            "job_id": "job-789",
            "query": "Python experience",
            "top_k": 10,
        }

        from app.models.schemas import EvidenceChunk, RAGSummary

        mock_step.run.side_effect = [
            [0.1] * 1024,
            [
                ResumeChunk(
                    candidate_id="cand-123",
                    resume_id="res-1",
                    chunk_id="chunk-1",
                    section="experience",
                    source_pdf="resume.pdf",
                    text="Python experience",
                )
            ],
            CandidateProfile(name="John Doe", skills=[], total_experience_years=5.0),
            JobDescription(job_id="job-789", title="Dev", company_id="comp-1", description="Desc"),
            None,
            RAGSummary(
                candidate_id="cand-123",
                job_id="job-789",
                strengths=["Python"],
                matched_skills=["Python"],
                missing_skills=[],
                relevant_experience=["5 years Python"],
                evidence=[
                    EvidenceChunk(
                        chunk_id="chunk-1",
                        text="Python experience",
                        section="experience",
                        relevance_score=0.9,
                        source_pdf="resume.pdf",
                    )
                ],
                summary_text="Strong Python candidate",
                confidence_score=0.9,
                model_used="gpt-4o-mini",
                prompt_version="1.0",
            ),
            None,
        ]

        with patch('app.workflows.ingest_resume.embedding_service') as mock_emb, \
             patch('app.workflows.ingest_resume.qdrant_service') as mock_qdrant, \
             patch('app.workflows.ingest_resume.rag_service') as mock_rag, \
             patch('app.workflows.ingest_resume._fetch_candidate_profile') as mock_fetch_profile, \
             patch('app.workflows.ingest_resume._fetch_job_description') as mock_fetch_job, \
             patch('app.workflows.ingest_resume._fetch_match_score') as mock_fetch_score, \
             patch('app.workflows.ingest_resume._store_rag_summary') as mock_store:

            mock_emb.embed_text = AsyncMock(return_value=[0.1] * 1024)
            mock_qdrant.search_similar = AsyncMock(return_value=[
                ResumeChunk(
                    candidate_id="cand-123",
                    resume_id="res-1",
                    chunk_id="chunk-1",
                    section="experience",
                    source_pdf="resume.pdf",
                    text="Python experience",
                )
            ])
            mock_fetch_profile.return_value = CandidateProfile(name="John Doe", skills=[], total_experience_years=5.0)
            mock_fetch_job.return_value = JobDescription(job_id="job-789", title="Dev", company_id="comp-1", description="Desc")
            mock_fetch_score.return_value = None
            mock_rag.generate_summary = AsyncMock(return_value=RAGSummary(
                candidate_id="cand-123",
                job_id="job-789",
                strengths=["Python"],
                matched_skills=["Python"],
                missing_skills=[],
                relevant_experience=["5 years Python"],
                evidence=[
                    EvidenceChunk(
                        chunk_id="chunk-1",
                        text="Python experience",
                        section="experience",
                        relevance_score=0.9,
                        source_pdf="resume.pdf",
                    )
                ],
                summary_text="Strong Python candidate",
                confidence_score=0.9,
                model_used="gpt-4o-mini",
                prompt_version="1.0",
            ))

            result = await rag_summary_workflow(mock_ctx, mock_step)

            assert result["status"] == "completed"
            assert result["rag_summary"]["summary_text"] == "Strong Python candidate"

    @pytest.mark.asyncio
    async def test_rank_candidates_workflow(self, mock_ctx, mock_step):
        mock_ctx.event.data = {
            "job_id": "job-789",
            "candidate_ids": ["cand-1", "cand-2"],
        }

        mock_step.run.side_effect = [
            [
                MatchScore(
                    candidate_id="cand-1",
                    job_id="job-789",
                    overall_score=90.0,
                ),
                MatchScore(
                    candidate_id="cand-2",
                    job_id="job-789",
                    overall_score=80.0,
                ),
            ],
            None,
            None,
            None,
        ]

        with patch('app.workflows.ingest_resume._fetch_all_match_scores') as mock_fetch, \
             patch('app.workflows.ingest_resume._fetch_rag_summary') as mock_fetch_rag, \
             patch('app.workflows.ingest_resume._store_ranking_results') as mock_store:

            mock_fetch.return_value = [
                MatchScore(candidate_id="cand-1", job_id="job-789", overall_score=90.0),
                MatchScore(candidate_id="cand-2", job_id="job-789", overall_score=80.0),
            ]
            mock_fetch_rag.return_value = None

            result = await rank_candidates_workflow(mock_ctx, mock_step)

            assert result["status"] == "completed"
            assert len(result["ranked_candidates"]) == 2
            assert result["ranked_candidates"][0]["candidate_id"] == "cand-1"
            assert result["ranked_candidates"][0]["rank"] == 1
            assert result["ranked_candidates"][1]["candidate_id"] == "cand-2"
            assert result["ranked_candidates"][1]["rank"] == 2