# AI Powered Recruitment System

A full-stack AI-driven recruitment platform with resume parsing, candidate scoring, semantic search, and automated ranking.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Spring Boot   │────▶│   AI Service    │
│   (React/Vite)  │     │   (Backend)     │     │   (FastAPI)     │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 ▼                       ▼
                         ┌───────────────┐       ┌───────────────┐
                         │   PostgreSQL  │       │    Qdrant     │
                         │   (pgvector)  │       │  (Vector DB)  │
                         └───────────────┘       └───────────────┘
                                                       │
                                                       ▼
                                              ┌───────────────┐
                                              │   Inngest     │
                                              │  (Workflows)  │
                                              └───────────────┘
```

### Components

| Service | Technology | Port | Description |
|---------|------------|------|-------------|
| **Frontend** | React 18 + TypeScript + Vite + TailwindCSS | 5173 | Candidate/recruiter dashboard |
| **Backend** | Spring Boot 3.4 + Java 21 + Spring Security + JWT | 8080 | REST API, auth, job/candidate management |
| **AI Service** | FastAPI + Python 3.12 + LlamaIndex + Inngest | 8000 | Resume parsing, scoring, RAG, ranking |
| **Database** | PostgreSQL 16 + pgvector | 5433 | Relational data + vector embeddings |
| **Vector DB** | Qdrant v1.9 | 6333 | Resume chunk embeddings (BGE-M3, 1024-dim) |
| **Workflow** | Inngest | 8288 | Async job processing with retries |

---

## Prerequisites

- **Docker & Docker Compose** (v2.20+)
- **Java 21** (for local backend development)
- **Node.js 18+** (for local frontend development)
- **Python 3.12+** (for local AI service development)
- **Maven 3.9+** (for backend build)
- **OpenAI API Key** (for GPT-4o-mini LLM)
- **Git**

---

## Quick Start (Docker - Recommended)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/AI_Powered_Recruitment_System.git
cd AI_Powered_Recruitment_System
```

### 2. Configure Environment Variables

Create `.env` files for each service:

**Backend** (`backend/.env`):
```env
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/ai_resume_db
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
AI_SERVICE_URL=http://localhost:8000
```

**AI Service** (`ai-service/.env`):
```env
# Copy from ai-service/.env.example and fill in:
OPENAI_API_KEY=sk-your-openai-key-here
INNGEST_SIGNING_KEY=your-inngest-signing-key
INNGEST_EVENT_KEY=your-inngest-event-key
SPRING_BOOT_BASE_URL=http://localhost:8080
SPRING_BOOT_API_KEY=your-spring-boot-api-key
```

### 3. Start All Services

```bash
# Start PostgreSQL (backend dependency)
cd backend && docker-compose up -d

# Start AI Service dependencies (Qdrant + Inngest) + AI Service
cd ../ai-service && docker-compose up -d --build

# Start Frontend (in separate terminal)
cd ../frontend && npm install && npm run dev
```

### 4. Start Backend (Local Development)

```bash
cd backend
./mvnw spring-boot:run
```

### 5. Verify Services

| Service | URL | Health Check |
|---------|-----|--------------|
| Frontend | http://localhost:5173 | - |
| Backend API | http://localhost:8080 | http://localhost:8080/actuator/health |
| AI Service | http://localhost:8000 | http://localhost:8000/health |
| Qdrant | http://localhost:6333 | http://localhost:6333/health |
| Inngest | http://localhost:8288 | http://localhost:8288/api/v1/health |
| PostgreSQL | localhost:5433 | `docker exec ai_resume_postgres pg_isready` |

---

## Detailed Setup

### Backend (Spring Boot)

**Prerequisites:** Java 21, Maven 3.9+, PostgreSQL running

```bash
cd backend

# Copy environment template
cp .env.example .env  # Create this file with required vars

# Build and run
./mvnw clean install
./mvnw spring-boot:run
```

**Key Dependencies:**
- Spring Boot 3.4 (Web, Data JPA, Security, Validation, Mail)
- PostgreSQL + pgvector
- JWT (jjwt 0.12.7)
- MapStruct 1.6.3
- Lombok
- Spring AI (Ollama)

**API Base URL:** `http://localhost:8080/api`

### Frontend (React + Vite)

**Prerequisites:** Node.js 18+, npm

```bash
cd frontend

# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Linting
npm run lint
```

**Tech Stack:**
- React 18 + TypeScript
- Vite 5
- TailwindCSS 3.4
- React Router 6
- React Hook Form + Zod
- Recharts, Lucide React, date-fns

### AI Service (FastAPI)

**Prerequisites:** Python 3.12+, Docker (for Qdrant/Inngest), OpenAI API Key

```bash
cd ai-service

# Copy environment template
cp .env.example .env
# Edit .env with your API keys

# Option A: Docker (recommended)
docker-compose up -d --build

# Option B: Local development
# Start dependencies only
docker-compose up -d qdrant inngest

# Install Python dependencies
pip install -e ".[dev]"

# Run service
python main.py
```

**Key Features:**
- Resume ingestion (PDF → chunks → embeddings → Qdrant)
- Candidate profile extraction (GPT-4o-mini)
- Deterministic scoring (40% skills, 20% exp, 10% edu, 30% semantic)
- RAG summaries with evidence (reranked chunks)
- Candidate ranking with explanations
- Async workflows via Inngest

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | JWT signing key (min 32 chars) |
| `MAIL_HOST` | Yes | SMTP host (e.g., smtp.gmail.com) |
| `MAIL_PORT` | Yes | SMTP port (587 for TLS) |
| `MAIL_USERNAME` | Yes | SMTP username |
| `MAIL_PASSWORD` | Yes | SMTP password/app password |
| `SPRING_DATASOURCE_URL` | Yes | PostgreSQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | Yes | DB username |
| `SPRING_DATASOURCE_PASSWORD` | Yes | DB password |
| `AI_SERVICE_URL` | Yes | AI Service base URL |

### AI Service (`ai-service/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key for GPT-4o-mini |
| `INNGEST_SIGNING_KEY` | No | - | Inngest signing key |
| `INNGEST_EVENT_KEY` | No | - | Inngest event key |
| `INNGEST_BASE_URL` | No | http://localhost:8288 | Inngest server URL |
| `SPRING_BOOT_BASE_URL` | Yes | http://localhost:8080 | Backend API URL |
| `SPRING_BOOT_API_KEY` | No | - | API key for Spring Boot calls |
| `EMBEDDING_PROVIDER` | No | local | `local` or `openai` |
| `RERANKER_PROVIDER` | No | local | `local` or `openai` |
| `QDRANT_HOST` | No | localhost | Qdrant host |
| `QDRANT_PORT` | No | 6333 | Qdrant port |

---

## API Endpoints

### Backend (Spring Boot)

```
Authentication:
POST   /api/auth/register           - Register user
POST   /api/auth/login              - Login
POST   /api/auth/refresh            - Refresh token

Jobs:
POST   /api/jobs                    - Create job
GET    /api/jobs                    - List jobs
GET    /api/jobs/{id}               - Get job details
PUT    /api/jobs/{id}               - Update job
DELETE /api/jobs/{id}               - Delete job

Candidates:
POST   /api/candidates              - Create candidate
GET    /api/candidates              - List candidates
GET    /api/candidates/{id}         - Get candidate
POST   /api/candidates/{id}/resume  - Upload resume

AI Integration:
POST   /api/ai/match-scores         - Store match score
GET    /api/ai/match-scores/{candId}/{jobId}
POST   /api/ai/rag-summaries        - Store RAG summary
GET    /api/ai/rag-summaries/{candId}/{jobId}
POST   /api/ai/rankings/{jobId}     - Store ranking
GET    /api/ai/rankings/{jobId}     - Get ranking
```

### AI Service (FastAPI)

```
Health:
GET    /health                      - Service health

Resume Ingestion:
POST   /api/v1/resumes/ingest       - Ingest resume (async via Inngest)

Scoring:
POST   /api/v1/candidates/score-job - Score candidate for job

RAG:
POST   /api/v1/candidates/rag-summary - Generate RAG summary

Ranking:
POST   /api/v1/jobs/rank-candidates - Rank candidates for job

Results (called by Spring Boot):
GET    /api/v1/candidates/{candidate_id}/match-score/{job_id}
GET    /api/v1/candidates/{candidate_id}/rag-summary/{job_id}
GET    /api/v1/jobs/{job_id}/ranking
```

---

## Development Workflow

### Running Tests

**Backend:**
```bash
cd backend
./mvnw test
```

**Frontend:**
```bash
cd frontend
npm test
```

**AI Service:**
```bash
cd ai-service
pytest tests/unit -v           # Unit tests
pytest tests/integration -v    # Integration tests (requires services)
pytest --cov=app tests/        # With coverage
```

### Code Quality

**Backend:**
```bash
cd backend
./mvnw checkstyle:check
./mvnw spotless:check
```

**Frontend:**
```bash
cd frontend
npm run lint
```

**AI Service:**
```bash
cd ai-service
ruff check .
mypy app/
```

---

## Troubleshooting

### Common Issues

**Backend won't start - Database connection failed**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs ai_resume_postgres

# Verify connection
docker exec -it ai_resume_postgres psql -U postgres -d ai_resume_db -c "SELECT 1;"
```

**AI Service - Qdrant connection failed**
```bash
# Check Qdrant health
curl http://localhost:6333/health

# Check collection exists
curl http://localhost:6333/collections/resume_chunks

# Restart Qdrant
cd ai-service && docker-compose restart qdrant
```

**AI Service - Embedding model not loading**
```bash
# For local BGE-M3
pip install FlagEmbedding

# Check GPU
python -c "import torch; print(torch.cuda.is_available())"

# Fallback to CPU: set EMBEDDING_PROVIDER=openai in .env
```

**Inngest workflows not triggering**
```bash
# Check Inngest dev server
curl http://localhost:8288/api/v1/health

# Verify signing key matches between services
# Check INNGEST_SIGNING_KEY in both backend and ai-service .env
```

**Frontend - API calls failing**
- Verify `VITE_API_BASE_URL` in frontend `.env` (create if needed)
- Check CORS configuration in backend
- Ensure backend is running on port 8080

---

## Production Deployment

### Docker Compose (Full Stack)

```bash
# Build all images
docker-compose -f docker-compose.prod.yml build

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

### Environment-Specific Configs

- **Development**: `.env.development` (local URLs, debug logging)
- **Staging**: `.env.staging` (staging URLs, reduced logging)
- **Production**: `.env.production` (prod URLs, minimal logging, secrets from vault)

---

## Contributing

1. **Fork** the repository
2. **Create feature branch**: `git checkout -b feature/your-feature`
3. **Make changes** with tests
4. **Run linting & tests** locally
5. **Commit**: `git commit -m "feat: your feature description"`
6. **Push**: `git push origin feature/your-feature`
7. **Open Pull Request**

### Commit Message Format

```
feat: add candidate ranking endpoint
fix: resolve Qdrant connection timeout
docs: update API documentation
refactor: simplify scoring algorithm
test: add integration tests for resume ingestion
```

---

## License

MIT License - See LICENSE file for details.

---

## Support

- **Documentation**: See `ai-service/README.md` for detailed AI service docs
- **Issues**: GitHub Issues
- **Team Contact**: #recruitment-system on Slack