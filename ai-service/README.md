# AI Recruitment Service

AI-powered microservice for resume processing, candidate scoring, and ranking. Built with Python 3.12, FastAPI, Inngest, Qdrant, LlamaIndex, and Pydantic.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Spring Boot   │────▶│   Inngest       │────▶│   AI Service    │
│   (Auth, Jobs,  │     │   (Workflows)   │     │   (FastAPI)     │
│   Candidates)   │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌──────────────────────────┼──────────────────────────┐
                              │                          │                          │
                              ▼                          ▼                          ▼
                        ┌───────────┐              ┌───────────┐              ┌───────────┐
                        │  Qdrant   │              │  OpenAI   │              │  Local    │
                        │  (Vector  │              │  (LLM)    │              │  Models   │
                        │   Store)  │              │           │              │  (BGE-M3) │
                        └───────────┘              └───────────┘              └───────────┘
```

## Features

- **Resume Ingestion**: Parse PDF resumes using LlamaIndex, chunk with SentenceSplitter (1000/200)
- **Candidate Extraction**: Structured profile extraction using GPT-4o-mini with Pydantic validation
- **Vector Storage**: BGE-M3 embeddings (1024-dim) stored in Qdrant with cosine similarity
- **Candidate-Job Scoring**: Deterministic scoring (40% skills, 20% experience, 10% education, 30% semantic)
- **RAG Summaries**: Evidence-based explanations with reranking (top 3-5 chunks)
- **Candidate Ranking**: Deterministic ranking with RAG explanations attached
- **Async Workflows**: All long-running operations via Inngest with retries and idempotency

## Model Configuration

| Component | Model | Purpose |
|-----------|-------|---------|
| Foundation | Qwen3-Embedding-8B | Reference model |
| Embeddings | BGE-M3 | Resume chunks, job descriptions, semantic search |
| LLM | GPT-4o-mini | Candidate extraction, RAG summaries, AI explanations |

## Quick Start

### Prerequisites

- Python 3.12+
- Docker & Docker Compose
- OpenAI API key (for GPT-4o-mini)
- Spring Boot backend running on port 8080

### Local Development

```bash
# Clone and navigate
cd ai-service

# Copy environment template
cp .env.example .env

# Edit .env: set LLM_API_KEY (free key from https://console.groq.com/keys)

# Start Qdrant
docker-compose up -d qdrant

# Install dependencies (includes torch + FlagEmbedding for the default local
# BGE-M3 embedder/reranker; on CPU-only machines install torch first with
#   pip install torch --index-url https://download.pytorch.org/whl/cpu)
pip install -e ".[dev]"

# Run the service
python main.py

# In a second terminal: Inngest dev server pointed at the *host* service.
# (The compose `inngest` service targets http://ai-service:8000, which only
#  resolves when the service itself runs inside compose.)
npx --yes inngest-cli@latest dev -u http://localhost:8000/api/inngest
```

The first request that needs embeddings downloads `BAAI/bge-m3` (~2.3 GB) and the
reranker (~2.3 GB) from Hugging Face; both run locally and free.

Resume profile extraction and RAG summaries use the `LLM_*` settings: any OpenAI-compatible
API. The default is **Groq's free tier** (`llama-3.3-70b-versatile`). Without a key, ingestion
still stores and embeds the chunks but skips the structured profile.

| Provider | `LLM_BASE_URL` | `LLM_MODEL` | Notes |
|----------|----------------|-------------|-------|
| Groq (default) | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | free key, fast, JSON mode |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.5-flash` | free tier, large context |
| OpenRouter | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct:free` | free models, lower rate limits |
| Ollama (local) | `http://localhost:11434/v1` | `qwen2.5:7b-instruct` | no key, resumes never leave your machine |

Hosted free tiers send resume text to the provider; use Ollama if that is not acceptable.

The Spring backend talks to this service in camelCase JSON (snake_case is accepted too)
and its default `ai-service.base-url` is `http://localhost:8001`, so either set it to
`http://localhost:8000` or run the service with `API_PORT=8001`.

### Docker Deployment

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f ai-service

# Stop services
docker-compose down
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment (development/staging/production) | `development` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `API_HOST` | API bind host | `0.0.0.0` |
| `API_PORT` | API port | `8000` |
| `LLM_API_KEY` | Key for the LLM provider (not needed for local Ollama) | **Required** for hosted LLMs |
| `LLM_BASE_URL` / `LLM_MODEL` | OpenAI-compatible endpoint and model | Groq / `llama-3.3-70b-versatile` |
| `OPENAI_API_KEY` | Only if `EMBEDDING_PROVIDER`/`RERANKER_PROVIDER` is `openai` | Optional |
| `QDRANT_HOST` | Qdrant host | `localhost` |
| `QDRANT_PORT` | Qdrant port | `6333` |
| `INNGEST_SIGNING_KEY` | Inngest signing key | Optional |
| `INNGEST_BASE_URL` | Inngest server URL | `http://localhost:8288` |
| `EMBEDDING_PROVIDER` | `local` or `openai` | `local` |
| `RERANKER_PROVIDER` | `local` or `openai` | `local` |
| `SPRING_BOOT_BASE_URL` | Spring Boot API URL | `http://localhost:8080` |
| `SPRING_BOOT_API_KEY` | Sent as `X-API-Key` on callbacks to Spring | Optional |
| `CORS_ORIGINS` | Comma-separated allowed browser origins | `http://localhost:3000,http://localhost:5173,http://localhost:8080` |
| `QDRANT_LOCATION` | e.g. `:memory:` for an in-process Qdrant (tests) | unset |

See `.env.example` for complete list.

## API Endpoints

### Health Check
```
GET /health
```

### Resume Ingestion
```
POST /api/v1/resumes/ingest
{
  "candidate_id": "cand-123",
  "resume_id": "res-456",
  "job_id": "job-789",
  "pdf_path": "/data/resumes/resume.pdf",
  "source_pdf": "resume.pdf"
}
```

### Candidate-Job Scoring
```
POST /api/v1/candidates/score-job
{
  "candidate_id": "cand-123",
  "job_id": "job-789",
  "job_description": { ... }
}
```

### RAG Summary Generation
```
POST /api/v1/candidates/rag-summary
{
  "candidate_id": "cand-123",
  "job_id": "job-789",
  "query": "optional custom query",
  "top_k": 10
}
```

### Candidate Ranking
```
POST /api/v1/jobs/rank-candidates
{
  "job_id": "job-789",
  "candidate_ids": ["cand-1", "cand-2", "cand-3"]
}
```

### Get Results (from Spring Boot)
```
GET /api/v1/candidates/{candidate_id}/match-score/{job_id}
GET /api/v1/candidates/{candidate_id}/rag-summary/{job_id}
GET /api/v1/jobs/{job_id}/ranking
```

## Inngest Workflows

### candidate/ingest-resume
Triggers: `candidate/ingest-resume` event
1. Extract text from PDF (LlamaIndex PDFReader)
2. Chunk text (SentenceSplitter, 1000/200)
3. Extract candidate profile (GPT-4o-mini)
4. Generate BGE-M3 embeddings for chunks
5. Store chunks in Qdrant with metadata

### candidate/score-job
Triggers: `candidate/score-job` event
1. Embed job description
2. Retrieve candidate chunks from Qdrant
3. Fetch candidate profile from Spring Boot
4. Calculate match scores (deterministic)
5. Store MatchScore in Spring Boot

### candidate/rag-summary
Triggers: `candidate/rag-summary` event
1. Embed query
2. Retrieve top 20 chunks from Qdrant
3. Rerank with BGE-reranker (top 10)
4. Select top 5 evidence chunks
5. Generate grounded summary (GPT-4o-mini)
6. Store RAGSummary in Spring Boot

### job/rank-candidates
Triggers: `job/rank-candidates` event
1. Fetch all MatchScores for job/candidates
2. Sort by overall_score (descending)
3. Assign rank positions
4. Fetch RAG summaries
5. Store RankingResult in Spring Boot

## Qdrant Collection Schema

Collection: `resume_chunks`

| Field | Type | Description |
|-------|------|-------------|
| `candidate_id` | keyword | Candidate UUID |
| `resume_id` | keyword | Resume UUID |
| `job_id` | keyword | Job UUID (nullable) |
| `chunk_id` | keyword | Unique chunk identifier |
| `section` | keyword | Resume section (experience/education/skills/...) |
| `source_pdf` | keyword | Original PDF filename |
| `text` | text | Chunk text content |
| `metadata` | json | Additional metadata |
| `created_at` | datetime | Ingestion timestamp |

Vector: 1024 dimensions, Cosine distance

## Spring Boot Integration

The AI service **does not** store candidate, job, or user data. It only processes AI tasks.

### Required Spring Boot Endpoints

```
GET    /api/candidates/{id}/profile          → CandidateProfile
POST   /api/ai/match-scores                  → Store MatchScore
GET    /api/ai/match-scores/{candId}/{jobId} → Get MatchScore
POST   /api/ai/rag-summaries                 → Store RAGSummary
GET    /api/ai/rag-summaries/{candId}/{jobId}→ Get RAGSummary
GET    /api/jobs/{id}/description            → JobDescription
POST   /api/ai/rankings/{jobId}              → Store RankingResult
GET    /api/ai/rankings/{jobId}              → Get RankingResult
```

### Data Flow

1. Spring Boot receives resume upload
2. Spring Boot calls `POST /api/v1/resumes/ingest` (async via Inngest)
3. AI Service processes resume, stores vectors in Qdrant
4. Spring Boot triggers scoring for candidate-job pairs
5. AI Service computes scores, returns MatchScore to Spring Boot
6. Spring Boot triggers RAG summary generation
7. AI Service generates evidence-based summary
8. Spring Boot triggers ranking for job
9. AI Service ranks candidates deterministically

## Scoring Algorithm

```
overall_score = (
    skill_match_score * 0.40 +
    experience_match_score * 0.20 +
    education_match_score * 0.10 +
    semantic_match_score * 0.30
) / 1.0
```

### Skill Matching
- Required skills: 70% weight
- Preferred skills: 30% weight
- Coverage = matched_skills / total_required_and_preferred

### Experience Matching
- ≥ required years: 100%
- Within 2 years: 90%
- Within 5 years: 80%
- Below: (candidate_years / required_years) * 100

### Education Matching
- Meets/exceeds required level: 100%
- One level below: 70%
- Two levels below: 40%
- More: 10%

### Semantic Matching
- Average cosine similarity of top 10 chunks × 100

## Testing

```bash
# Run unit tests
pytest tests/unit -v

# Run integration tests (requires services)
pytest tests/integration -v

# Run with coverage
pytest --cov=app tests/
```

## Project Structure

```
ai-service/
├── app/
│   ├── api/              # FastAPI endpoints
│   ├── core/             # Config, logging, exceptions
│   ├── models/           # Pydantic schemas
│   ├── services/         # Business logic (embedding, qdrant, scoring, rag)
│   ├── workflows/        # Inngest workflow definitions
│   └── utils/            # Utilities
├── tests/
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── config/               # Configuration files
├── data/                 # Local data storage (PDFs)
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
├── .env.example
├── main.py
└── README.md
```

## Monitoring & Observability

- Structured JSON logging via structlog
- Health check endpoint with dependency status
- Inngest dashboard for workflow monitoring
- Qdrant dashboard for vector store metrics

## Troubleshooting

### Qdrant Connection Failed
```bash
# Check Qdrant is running
curl http://localhost:6333/health

# Verify collection exists
curl http://localhost:6333/collections/resume_chunks
```

### Embedding Model Not Loading
```bash
# For local BGE-M3, ensure FlagEmbedding is installed
pip install FlagEmbedding

# Check GPU availability
python -c "import torch; print(torch.cuda.is_available())"
```

### Inngest Workflows Not Triggering
```bash
# Check Inngest dev server
curl http://localhost:8288/api/v1/health

# Verify signing key matches
```

## License

MIT License - See LICENSE file for details.