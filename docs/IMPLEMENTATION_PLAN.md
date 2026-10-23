# AI-Powered Resume Screening & Ranking - Implementation Plan

## Overview
Implement end-to-end flow: **Resume Upload → Extract Details → Create Candidate → AI Scoring (Python) → RAG Summary → Ranking**

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Spring Boot     │────▶│  Python AI      │
│   (React)       │     │  (Java)          │     │  Service        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │                         │
                              ▼                         ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  PostgreSQL      │     │  Vector DB /    │
                        │  (pgvector)      │     │  LLM (Ollama)   │
                        └──────────────────┘     └─────────────────┘
```

---

## Phase 1: Backend (Java) - Resume & Candidate Management

### 1.1 New Entities & Repository
- **CandidateRepository** - CRUD for candidates
- **ResumeRepository** - CRUD for resumes
- Add `resume_embedding` column to Resume entity (vector(768))

### 1.2 DTOs
```java
// Request
ResumeUploadRequest (multipart: file + jobId)
CandidateCreateRequest (extracted fields)

// Response
CandidateResponse (with aiMatchScore, matchingSkills, gaps, summary)
ResumeResponse (with extractedText)
```

### 1.3 Services
- **ResumeService** - Upload, parse (PDF/DOCX), extract text, store
- **CandidateService** - Create candidate, link to job/resume, trigger AI analysis
- **FileStorageService** - Local/S3 file storage

### 1.4 Controllers
- `POST /api/resumes/upload` - Upload resume for a job
- `GET /api/candidates` - List candidates (with filters)
- `GET /api/candidates/{id}` - Get candidate details
- `GET /api/candidates/{id}/ai-analysis` - Get AI analysis
- `POST /api/candidates/{id}/analyze` - Trigger AI analysis
- `POST /api/candidates/{id}/shortlist` - Shortlist candidate
- `POST /api/candidates/{id}/reject` - Reject candidate

---

## Phase 2: Python AI Service

### 2.1 Service Structure
```
python-ai-service/
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── config.py            # Settings
│   ├── models/
│   │   ├── request.py       # Pydantic models
│   │   └── response.py
│   ├── services/
│   │   ├── resume_parser.py # PDF/DOCX text extraction
│   │   ├── embedder.py      # Generate embeddings (Ollama/SentenceTransformers)
│   │   ├── scorer.py        # Job-Resume matching & scoring
│   │   ├── rag_summary.py   # RAG-based AI summary
│   │   └── ranker.py        # Candidate ranking
│   └── utils/
│       └── text_processing.py
├── requirements.txt
├── Dockerfile
└── .env.example
```

### 2.2 API Endpoints (FastAPI)
```
POST /api/v1/parse-resume          # Extract structured data from resume
POST /api/v1/generate-embedding    # Generate resume embedding
POST /api/v1/score-candidate       # Score resume against job
POST /api/v1/generate-summary      # RAG-based AI summary
POST /api/v1/rank-candidates       # Rank candidates for a job
```

### 2.3 Scoring Algorithm
```python
# Weighted scoring (configurable)
weights = {
    "skills_match": 0.40,      # Semantic + keyword overlap
    "experience_match": 0.25,  # Years + relevance
    "education_match": 0.15,   # Degree level + field
    "job_relevance": 0.20      # Semantic similarity (embeddings)
}

# Score = sum(weight_i * score_i) * 100
```

### 2.4 RAG Summary Pipeline
1. Retrieve job description + requirements
2. Retrieve candidate resume text
3. Build context: `Job Requirements + Candidate Profile`
4. Prompt LLM with structured prompt for:
   - Overall fit assessment
   - Matching skills
   - Relevant experience highlights
   - Potential gaps/concerns
   - Hiring recommendation

---

## Phase 3: Integration (Java ↔ Python)

### 3.1 Communication
- **Async**: Java publishes to message queue (RabbitMQ/Kafka) → Python consumes → callback/webhook
- **Sync**: Java calls Python REST API (for real-time needs)

### 3.2 Java Client for Python Service
```java
@Service
public class PythonAiClient {
    private final WebClient webClient;
    
    public CandidateScoreResponse scoreCandidate(UUID candidateId, UUID jobId);
    public AiSummaryResponse generateSummary(UUID candidateId, UUID jobId);
    public RankingResponse rankCandidates(UUID jobId, List<UUID> candidateIds);
}
```

### 3.3 Flow Orchestration
```
1. Frontend uploads resume → POST /api/resumes/upload (jobId + file)
2. Java: Save file → Extract text (Apache Tika) → Create Resume entity
3. Java: Create Candidate entity (linked to job + resume)
4. Java: Call Python /parse-resume → Get structured data (skills, exp, edu)
5. Java: Update Candidate with parsed data
6. Java: Call Python /score-candidate → Get score + breakdown
7. Java: Update Candidate with aiMatchScore
8. Java: Call Python /generate-summary → Get RAG summary
9. Java: Store summary in Candidate or separate Analysis entity
10. Frontend: Poll or WebSocket for completion → Show results
```

---

## Phase 4: Ranking Endpoint

### 4.1 Java Endpoint
```
GET /api/jobs/{jobId}/candidates/ranked
Query params: page, pageSize, minScore
Response: Paginated list sorted by aiMatchScore DESC
```

### 4.2 Python Ranking
- Batch score all candidates for a job
- Return sorted list with scores
- Cache embeddings for performance

---

## Database Migrations

### V3__add_resume_embedding.sql
```sql
ALTER TABLE resumes ADD COLUMN resume_embedding vector(768);
CREATE INDEX idx_resume_embedding ON resumes USING ivfflat (resume_embedding vector_cosine_ops);
```

### V4__add_candidate_ai_fields.sql
```sql
ALTER TABLE candidates ADD COLUMN ai_match_score DECIMAL(5,2);
ALTER TABLE candidates ADD COLUMN matching_skills JSONB;
ALTER TABLE candidates ADD COLUMN potential_gaps JSONB;
ALTER TABLE candidates ADD COLUMN ai_summary TEXT;
ALTER TABLE candidates ADD COLUMN ai_analyzed_at TIMESTAMP;
```

---

## Frontend Updates

### 4.1 Candidates Page (Already has UI for aiMatchScore)
- Connect to real API endpoints
- Add "Upload Resume" button → Modal with file picker + job selector
- Show analysis status (pending/analyzing/complete)
- Add "Analyze with AI" button for existing candidates

### 4.2 Candidate Profile Page
- Show detailed AI analysis breakdown
- Skills match visualization
- RAG summary display
- Action buttons: Shortlist, Reject, Schedule Interview

---

## Configuration

### Java (application.properties)
```properties
# Python AI Service
ai.service.url=http://localhost:8000
ai.service.timeout=30s
ai.service.api-key=${AI_SERVICE_API_KEY}

# File Storage
storage.type=local
storage.local.path=./uploads/resumes
```

### Python (.env)
```env
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=llama3.1
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_resume_db
JAVA_BACKEND_URL=http://localhost:8080/api
```

---

## Implementation Order

| Step | Task | Owner | Est. Days |
|------|------|-------|-----------|
| 1 | DB migrations + Resume/Candidate entities + repositories | Java | 1 |
| 2 | Resume upload + text extraction (Apache Tika) | Java | 1 |
| 3 | Python service skeleton + resume parser | Python | 1 |
| 4 | Embedding generation (Ollama) | Python | 1 |
| 5 | Scoring algorithm | Python | 2 |
| 6 | RAG summary generation | Python | 2 |
| 7 | Java ↔ Python integration (WebClient + async) | Java | 2 |
| 8 | Candidate CRUD + AI analysis endpoints | Java | 1 |
| 9 | Ranking endpoint | Java/Python | 1 |
| 10 | Frontend integration | Frontend | 2 |
| 11 | Testing & refinement | All | 2 |

**Total: ~14 days**

---

## Key Technical Decisions

1. **Text Extraction**: Apache Tika (Java) for initial extract → Python for structured parsing
2. **Embeddings**: Ollama (nomic-embed-text) via Spring AI (Java) + direct Ollama (Python)
3. **Vector Search**: pgvector in PostgreSQL (already configured)
4. **Async Processing**: Use `@Async` in Java + CompletableFuture for Python calls
5. **Error Handling**: Retry logic, dead letter queue for failed AI analyses
6. **Caching**: Cache job embeddings; cache resume embeddings after first generation

---

## API Contracts (Java ↔ Python)

### Score Candidate Request
```json
{
  "job": {
    "id": "uuid",
    "title": "Senior Java Developer",
    "description": "...",
    "requiredSkills": [{"name": "Java", "weight": 30}, ...],
    "preferredSkills": [{"name": "AWS", "weight": 10}, ...],
    "experienceRequired": 5,
    "educationRequired": "B.Tech",
    "jdEmbedding": [0.1, 0.2, ...]
  },
  "resume": {
    "id": "uuid",
    "extractedText": "...",
    "parsedSkills": ["Java", "Spring Boot", ...],
    "experienceYears": 6,
    "education": "M.Tech",
    "resumeEmbedding": [0.15, 0.25, ...]
  }
}
```

### Score Candidate Response
```json
{
  "overallScore": 82.5,
  "breakdown": {
    "skillsMatch": 85.0,
    "experienceMatch": 90.0,
    "educationMatch": 100.0,
    "jobRelevance": 75.0
  },
  "matchingSkills": ["Java", "Spring Boot", "PostgreSQL"],
  "missingSkills": ["AWS", "Kubernetes"],
  "relevantExperience": ["5 years Java backend", "Spring Boot microservices"],
  "gaps": ["No cloud experience", "Limited Kubernetes"]
}
```

---

## Next Steps

1. **Create Python service repo** (separate folder or submodule)
2. **Add DB migrations** for new columns
3. **Implement Resume upload endpoint** in Java
4. **Build Python scoring engine** with unit tests
5. **Integrate and test end-to-end**

---

*Generated: 2026-10-07*