# NexHire — AI Powered Recruitment System: Project Summary

A full-stack recruitment platform. Recruiters create jobs and upload resumes in bulk; an AI pipeline parses each resume, scores the candidate against the job, explains the score with evidence quoted from the resume (RAG), and ranks candidates. The default configuration runs entirely on local, open-weight models (Ollama), with no paid API.

Deeper references live in [docs/](docs/): [PIPELINE](docs/PIPELINE.md), [API](docs/API.md), [DEPLOYMENT](docs/DEPLOYMENT.md), [OPERATIONS](docs/OPERATIONS.md), [BENCHMARKS](docs/BENCHMARKS.md), [ARCHITECTURE_AUDIT](docs/ARCHITECTURE_AUDIT.md), [current_status](docs/current_status.md).

---

## 1. Problem this project solves

Screening is the slowest part of hiring. A single opening can draw hundreds of resumes in different formats, and recruiters end up skimming them by hand, which is slow, inconsistent and easy to get wrong.

NexHire addresses that by:

- **Taking resumes in bulk** (50–500 per upload, PDF/DOCX/TXT) without making the recruiter wait on the request.
- **Turning unstructured resumes into structured profiles** (skills, dated work history, education, certifications, projects).
- **Scoring each candidate against a specific job** with a transparent formula rather than a black-box number, and flagging missing mandatory requirements.
- **Showing the evidence** behind a score and summary, so the recruiter can verify it instead of trusting it.
- **Covering the rest of the funnel** in one tool: shortlist/reject, notes, interviews, skill assessments and analytics.
- **Keeping data and cost under control**: local models, per-company data isolation, and no per-call API fees.

Scores are decision support. Nothing in the system rejects or advances a candidate automatically.

## 2. Features

**Account and team**
- Company registration, login/logout, profile; JWT in an HttpOnly cookie.
- Roles: `ADMIN` (company owner: manages recruiters, company settings, all jobs) and `RECRUITER` (sees only their own jobs). Every query is scoped to the user's company.

**Jobs**
- Create, edit, delete jobs with required/preferred skills, employment type, work mode, location (Geoapify city autocomplete).

**Bulk resume pipeline**
- One multipart request uploads up to 500 files / 600 MB; the server answers `202` with a batch id immediately.
- Live per-resume status and plain-language progress in the upload dialog (polled every ~2.5 s), with time estimates measured from the batch itself.
- Retry for a whole batch or a single resume; cancel; partial completion (`PARTIAL`) instead of all-or-nothing.
- Duplicate detection by SHA-256 per job and by applicant email.

**AI analysis**
- Local-LLM profile extraction, grounded against the resume text.
- Deterministic, explainable score (skills 40 / experience 20 / education 10 / semantic 30) with mandatory-requirement flags and a resume snippet per matched skill.
- RAG summary: alignment, evidence, gaps, uncertainties.
- Candidate ranking per job.

**Candidate management**
- Candidate list/profile, status changes, shortlist/reject, recruiter notes, resume download, kanban-style hiring pipeline view.

**Interviews**
- Schedule, edit, cancel, feedback with recommendation; email notices to candidates.

**Assessments**
- Multi-round assessments with a builder, tokenized public links for candidates (`/assess/:token`), timed exams, auto/AI grading of code and essay answers, manual grade override, bulk assignment.

**Analytics**
- Dashboard overview, hiring funnel, time-to-hire, AI match-score distribution.

**Operations**
- Docker Compose stack (CPU or NVIDIA GPU overlay), health endpoints, PostgreSQL backup/restore scripts, retention job, repeatable benchmark harness.

## 3. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3.4, React Router 6, react-hook-form + zod, Recharts, dnd-kit (kanban), react-hot-toast, lucide-react, date-fns |
| Backend | Java 21, Spring Boot 4.x (web MVC, Data JPA, Security), JWT, Lombok, Spring Mail, Spring AI (Ollama starter) |
| AI service | Python 3.12, FastAPI + Uvicorn, Pydantic v2, LlamaIndex, OpenAI-compatible client (`openai`), `httpx`, `tenacity`, `structlog`, PyMuPDF, pypdf, python-docx, pytesseract (OCR fallback) |
| LLM / embeddings | Ollama: `qwen3:4b` for chat, `bge-m3` (1024-d) for embeddings. Any OpenAI-compatible endpoint (OpenRouter, NVIDIA NIM, Groq) can be swapped in via env vars |
| Relational DB | PostgreSQL 16 (`pgvector/pgvector:pg16` image) |
| Vector DB | Qdrant (server in Docker, or embedded on-disk via `QDRANT_PATH`) |
| Workflow (legacy) | Inngest — still present, but the batch pipeline does not use it |
| Infra | Docker, Docker Compose (base + `dev` + `gpu` overlays), nginx for the frontend container |
| Testing | JUnit/Spring Boot Test (backend), pytest (AI service, benchmark metrics) |

## 4. Architecture and folder structure

```
┌──────────────┐  /api (proxy)   ┌────────────────┐   REST    ┌────────────────┐
│  Frontend    │────────────────▶│  Backend       │──────────▶│  AI Service    │
│  React/Vite  │◀────────────────│  Spring Boot   │◀──────────│  FastAPI       │
│  :3000       │  HttpOnly JWT   │  :8080 (/api)  │ callbacks │  :8000         │
└──────────────┘     cookie      └───────┬────────┘           └───┬────────┬───┘
                                         ▼                        ▼        ▼
                                 ┌──────────────┐          ┌─────────┐ ┌─────────┐
                                 │ PostgreSQL   │          │ Qdrant  │ │ Ollama  │
                                 │ data + queue │          │ vectors │ │ LLM+emb │
                                 └──────────────┘          └─────────┘ └─────────┘
```

Responsibilities are split on purpose: the **backend owns state and orchestration** (users, jobs, candidates, the work queue, retries); the **AI service is stateless per stage** (each call does one unit of work and returns); **Ollama** serves models; **Qdrant** holds resume-chunk embeddings. In the Docker stack only the frontend port is published; everything else sits on an internal network.

```
AI_Powered_Recruitment_System/
├── frontend/                  React + Vite SPA
│   └── src/
│       ├── pages/             analytics, assess, assessments, auth, candidates, company,
│       │                      dashboard, interviews, jobs, pipeline, settings, team
│       ├── components/        assessments, auth, candidates, charts, layout, ui
│       ├── context/           AuthContext, ThemeContext (light/dark)
│       └── utils/             api client, assessment helpers, exam timer, question import
├── backend/                   Spring Boot (context path /api)
│   └── src/main/java/com/project/ai_resumerag_be/
│       ├── config/            Security, JWT filter, API-key filter, AI client config
│       ├── controller/        Auth, Admin, Company, Job, Candidate, Resume, Interview,
│       │                      Assessment (+Public), Analytics, Places, AICallback
│       ├── pipeline/          Bulk-upload queue: BatchController/Service, ResumeTask(+Processor,
│       │                      Repository, Stage, Status), worker, RetryPolicy, RetentionJob,
│       │                      UploadValidator, PipelineAiClient
│       ├── service/ (+impl/)  Business logic, AI client, email, file storage, embeddings
│       ├── entity/ repository/ dto/ mapper/ enums/ exception/
├── ai-service/                FastAPI
│   ├── main.py                entry point
│   └── app/
│       ├── api/               main.py (v1 + legacy routes, health), pipeline.py (stage routes)
│       ├── pipeline/          text_extraction, fields (deterministic contact), experience, processor, errors
│       ├── services/          llm, embedding, qdrant, scoring, rag_summary, evidence, reranker,
│       │                      pdf_processor, contact_extractor, answer_grader, registry
│       ├── workflows/         ingest_resume (legacy Inngest)
│       ├── core/              config, logging, exceptions
│       └── models/            Pydantic schemas
├── benchmarks/                Synthetic 50/100/500-resume benchmark + metrics
├── scripts/                   PostgreSQL backup/restore (sh + ps1), Inngest launcher
├── docs/                      Pipeline, API, deployment, operations, benchmarks, audit
├── docker-compose.yml         Full stack (+ .dev.yml host ports, .gpu.yml NVIDIA)
└── graphify-out/              Generated knowledge graph of the codebase
```

## 5. Key modules and how they work

### 5.1 Bulk resume pipeline (backend `pipeline/` + AI service `app/pipeline/`)

The central design decision: **the upload request does no AI work.** The earlier design ran an LLM call per file inside one HTTP request and one DB transaction, so a 500-file upload timed out and one bad file rolled back everything. It was replaced with a durable queue.

1. `POST /recruiter/batches` validates (type, size, count), SHA-256-hashes, stores files, writes one `resume_tasks` row per file and returns `202`.
2. Worker threads (default 2) claim tasks with `SELECT … FOR UPDATE SKIP LOCKED` and hold a renewable **lease** (15 min), so a crashed worker's tasks return to the queue.
3. Each resume moves through stages, with every stage saved before the next begins:

| Stage | Where | What happens |
|---|---|---|
| EXTRACT | AI service | PyMuPDF / python-docx / text; Tesseract OCR only when a PDF has almost no text. Name, email, phone, links by regex. No LLM. |
| PERSIST | Backend | Creates `Resume` + `Candidate`; idempotent; takes a per-applicant advisory lock. |
| PROFILE | AI service | Local LLM returns JSON for the `CandidateProfile` schema; output is validated, then **grounded** (deterministic fields override the model; skills the resume never mentions are dropped). |
| INDEX | AI service | Chunk, embed (bge-m3), upsert into Qdrant with deterministic point ids so repeats overwrite. |
| SCORE | AI service | Deterministic scoring, no LLM. |
| SUMMARY | AI service | Retrieve best chunks, ask the LLM for a grounded summary. |

4. **Failure handling** separates three cases: *permanent* (corrupt/encrypted/oversized file → `FAILED` at once), *needs review* (no email, scanned PDF without OCR, almost no text), and *transient* (Ollama/Qdrant down, bad JSON → requeue at the same stage with exponential backoff and jitter, up to 8 attempts, roughly 30 minutes of outage tolerated). A failed task keeps its stage, so **Retry** resumes where it stopped. Batch status is derived (`QUEUED → PROCESSING → COMPLETED / PARTIAL / FAILED`) and is never "completed" while a resume failed.
5. Scores and summaries are cached by a key of resume hash + job description + analysis version (+ model for summaries), so unchanged inputs are not recomputed.
6. `RetentionJob` (daily 03:30) purges unusable uploads and old extracted text.

### 5.2 Scoring (`ai-service/app/services/scoring.py`, version 2.0)

Each component is 0–100; overall is a weighted mean (weights configurable via `SCORING_*_WEIGHT`).

| Component | Weight | Method |
|---|---|---|
| Skills | 40% | 70% required-skill coverage + 30% preferred, after alias normalisation (`Postgres` = `PostgreSQL`, `k8s` = `Kubernetes`); matched from the resume text |
| Relevant experience | 20% | Years in dated roles whose title/description matches the job; overlapping roles merged; falls back to stated total with a warning |
| Education | 10% | Highest degree vs. required level |
| Semantic relevance | 30% | Mean cosine similarity of the job text to the candidate's top chunks |

The response also returns `meetsMandatory`, `mandatoryMissing`, `skillEvidence`, `relevantExperienceYears`, `warnings`, and the version and weights used. The prompt does not ask the model for gender, age or nationality, and the score never reads a name. The docs state two honest limits: the weights are specified defaults rather than tuned values, and the semantic component could be influenced by identity details present in resume text (unmeasured).

### 5.3 RAG summary and evidence (`rag_summary.py`, `evidence.py`, `qdrant.py`, `reranker.py`)
Retrieves the highest-matching resume chunks from Qdrant (optionally reranked) and prompts the LLM with only the profile, score and chunks, instructing it to say when something is not mentioned. Evidence chunks are stored beside the text so claims can be checked.

### 5.4 LLM and embedding layer (`llm.py`, `embedding.py`)
An OpenAI-compatible client with a concurrency semaphore (`LLM_CONCURRENCY`), timeouts and retries, so a burst never becomes unbounded model calls. Embeddings go through Ollama (`bge-m3`, 1024-d) by default; in-process BGE-M3 (torch) is optional.

### 5.5 Backend security
`SecurityConfig` + `JwtAuthenticationFilter` (cookie or `Authorization: Bearer`) for users; `ApiKeyAuthenticationFilter` for AI-service callbacks (`X-API-Key`). Ownership checks (`requireOwnedJob`) enforce company isolation; another company's resource answers `404`.

### 5.6 Assessments
Assessment → rounds → questions; a candidate gets a token link, starts an attempt, submits answers. Objective questions are auto-graded; code/essay answers go to the AI service's `/assessments/grade`, and recruiters can override manually.

### 5.7 Frontend
Protected routes under a layout with sidebar/top bar; `AuthContext` for session, `ThemeContext` for light/dark; a typed API client in `utils/api.ts`. `BatchProgress` polls the batch and task endpoints to show per-resume stages.

## 6. Database and data flow

### 6.1 Stores
| Store | Holds |
|---|---|
| PostgreSQL | Users, companies, jobs, skills, candidates, resumes, notes, interviews, assessments/attempts/answers, `ai_results`, `resume_batches`, `resume_tasks` (the queue) |
| Qdrant (`resume_chunks`, 1024-d, cosine) | Resume chunk embeddings, keyed by candidate/resume/job |
| File volume (`/data/uploads`) | Original resume files |

Main entities: `Company` 1—* `User`; `Company` 1—* `Job` *—* `Skill` (via `JobSkill`, required vs preferred); `Job` 1—* `Candidate` 1—* `Resume`; `Candidate` 1—* `CandidateNote`, `Interview`, `AssessmentAttempt`; `Assessment` 1—* `AssessmentRound` 1—* `AssessmentQuestion`; `ResumeBatch` 1—* `ResumeTask`. `AiResult` stores each AI output (profile, match score, RAG summary, ranking) as JSON text keyed by a reference key and type.

The schema is managed by Hibernate `ddl-auto=update` (no migration tool).

### 6.2 End-to-end data flow
```
Recruiter uploads files ─▶ Backend: validate, hash, store file, insert resume_tasks ─▶ 202 + batch id
Worker claims task (SKIP LOCKED, lease) ─▶ AI /extract ─▶ Backend creates Candidate+Resume
   ─▶ AI /profile (Ollama chat) ─▶ AI /index (Ollama embed ─▶ Qdrant)
   ─▶ AI /score (rules + embeddings) ─▶ AI /summary (Qdrant retrieve + Ollama chat)
   ─▶ results saved to ai_results ─▶ task DONE ─▶ batch status recomputed
UI polls GET /recruiter/batches/{id} ─▶ progress, then /results ranked best-first
```

## 7. APIs

All backend routes are under `/api`. Responses use an envelope: `{ code, status, data, message, timestamp }`.

**Backend (public to the frontend)**
| Area | Routes (abridged) |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`; `GET/PUT /auth/me` |
| Admin / company | `/admin/recruiters` (CRUD), `/admin/jobs/{id}` delete, `GET/PUT /company` |
| Jobs | `/job` CRUD, `PUT /job/{id}/skills`, `GET /job/{id}/description`, `GET /job/{id}/ranking`, `POST /job/{id}/rank-candidates` |
| Candidates | `/recruiter/candidates` upload, bulk-upload, `GET/PUT/DELETE /{id}`, `PATCH /{id}/status`, `/shortlist`, `/reject`, `/notes`, `/score-job/{jobId}`, `/rag-summary/{jobId}`, `/ai-analysis` |
| Batches | `POST /recruiter/batches`, `GET /{id}`, `/{id}/tasks`, `/{id}/results`, `POST /{id}/retry`, `/{id}/cancel`, `/{id}/tasks/{taskId}/retry` |
| Resumes | `GET /resumes/{id}`, `/resumes/{id}/file` |
| Interviews | `/interviews` CRUD, `/{id}/cancel`, `/{id}/feedback` |
| Assessments | `/assessments` CRUD, `/{id}/assign`, `/assign-many`, `/attempts`, manual grading; public `GET /public/assessments/{token}`, `POST /{token}/start`, `/{token}/submit` |
| Analytics | `/analytics/overview`, `/funnel`, `/time-to-hire`, `/ai-match-distribution` |
| Places | `/places/search` (Geoapify proxy) |
| AI proxy | `/ai/match-scores`, `/ai/rag-summaries`, `/ai/rankings/{jobId}`, `/ai-service/health` |

**AI service (called by the backend)**
- Pipeline stages (`X-API-Key`): `POST /api/v1/pipeline/{extract,profile,index,score,summary}`. `422` = document problem (not retryable), `503` = dependency down (retryable).
- Legacy/v1: `/api/v1/resumes/ingest`, `/resumes/extract-contact`, `/candidates/score-job`, `/candidates/rag-summary`, `/jobs/rank-candidates`, `/assessments/grade`, plus internal profile/match/summary/ranking routes.
- Health: `GET /health/live`, `GET /health` (checks Qdrant, embedding model, reranker).

**External services**: Ollama (OpenAI-compatible `/v1` chat and native embeddings), Qdrant, Geoapify (city autocomplete), SMTP (Gmail) for email; optional hosted LLMs (OpenRouter, NVIDIA NIM, Groq).

Full request/response samples: [docs/API.md](docs/API.md).

## 8. Setup

**Prerequisites:** Git; Docker with Compose v2 (for the full stack); for local dev also JDK 21, Node 18+, Python 3.12, Ollama. Tesseract is optional (scanned PDFs).

### Option A — Docker (whole stack)
```bash
cp .env.example .env            # set POSTGRES_PASSWORD, JWT_SECRET, PIPELINE_API_KEY (marked REQUIRED)
docker compose up -d --build    # pulls qwen3:4b and bge-m3 via the ollama-init job
# NVIDIA GPU:   docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
# Host ports:   add -f docker-compose.dev.yml
```
Open http://localhost:8080 (only the web UI is published). Register a company on first visit.

### Option B — Per-service local development
1. **Models:** install Ollama, then `ollama pull qwen3:4b` and `ollama pull bge-m3`. On a 6 GB GPU set `OLLAMA_CONTEXT_LENGTH=8192`, `OLLAMA_KEEP_ALIVE=30m`, `OLLAMA_MAX_LOADED_MODELS=1`.
2. **PostgreSQL:** run `pgvector/pgvector:pg16` on host port 5433, database `ai_resume_db`.
3. **AI service:**
   ```bash
   cd ai-service
   python -m venv venv && source venv/bin/activate     # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env     # QDRANT_PATH=./data/qdrant runs Qdrant embedded, no server needed
   python main.py           # http://localhost:8000
   ```
4. **Backend:** `cd backend && ./mvnw spring-boot:run` (reads `backend/.env` for secrets such as `GEOAPIFY_API_KEY`).
5. **Frontend:** `cd frontend && npm install && npm run dev` → http://localhost:3000 (proxies `/api`).

### Tests and tooling
```bash
cd backend && ./mvnw test          # needs PostgreSQL
cd ai-service && pytest tests/unit
python benchmarks/run_benchmark.py # 50/100/500-resume synthetic benchmark
scripts/backup.sh | scripts/restore.sh   # (.ps1 on Windows)
```

## 9. Challenges faced

1. **Upload request did the AI work.** One HTTP request ran 500 sequential LLM calls inside one transaction; it timed out, and one bad file rolled back the whole batch. *Solution:* a PostgreSQL-backed queue with leases, `SKIP LOCKED` claiming, stage checkpoints and `202`-immediately uploads.
2. **Silent loss and no idempotency.** After saving a candidate, ingestion was fire-and-forget, so an outage left candidates with no vectors or score. *Solution:* independent persisted stages, transient vs permanent error split, deterministic Qdrant point ids, SHA-256 and advisory-lock duplicate guards.
3. **Hosted, unbounded LLM cost and rate limits.** Default was a metered API with uncapped fan-out. *Solution:* local Ollama defaults, `LLM_CONCURRENCY` and worker limits, schema-validated output, profile extracted once.
4. **Small local model quirks (RTX 3050 6 GB).** A 7B model spilled to CPU (~2–3× slower), so `qwen3:4b` was chosen. `qwen3` "thinks" until max tokens and returns empty content unless reasoning is disabled, and strict `json_schema` made it stop after the contact fields. Fixes live in `llm.py` (reasoning disabled for local qwen3, `json_schema` off). A single resume once took 15+ minutes until these and stale uvicorn reload workers still holding port 8000 were fixed; it is now ~16–26 s per profile.
5. **LLM hallucination.** Models invented skills and wrote unsupported claims. *Solution:* grounding (drop skills the text never mentions, deterministic fields override the model), scoring that does not depend on the LLM, and summaries kept next to their evidence chunks.
6. **Messy documents.** Multi-column PDFs, scanned PDFs, encrypted/corrupt files, resumes with no email. *Solution:* PyMuPDF with an OCR fallback and explicit `NEEDS_REVIEW` / `FAILED` outcomes with error codes.
7. **Resource constraints on the dev machine.** The C: drive was nearly full, so models live on D:, torch + BGE-M3 (~4 GB) was replaced by Ollama embeddings, and Qdrant gained an embedded on-disk mode.
8. **Infrastructure fragility.** The Inngest Docker image failed on the maintainer's machine; the queue moved into PostgreSQL, and Inngest remains only for legacy workflows.
9. **Skill scoring accuracy.** Scoring was changed to match skills from the resume text, drop constant components, and keep summaries consistent with scores (latest commit `d691d0fd`).
10. **Security hygiene.** The audit found secrets (mail password, API keys, JWT secret) committed in `application.properties`. They should be rotated and moved to environment variables; `.env.example` files and env overrides were added, but rotation is still the owner's task.
11. **Schema management.** Hibernate `ddl-auto=update` works but there is no migration tool, and one SQL script is run by hand.

## 10. Future scope

- **Measure accuracy:** build a labelled dataset and calibrate the weights and semantic component against human judgement (the project deliberately makes no accuracy claim yet); audit score differences across groups and redact identity details before embedding.
- **Schema migrations:** adopt Flyway or Liquibase and turn off `ddl-auto=update`.
- **Secrets management:** rotate the committed credentials, move all secrets to environment variables or a vault.
- **Better parsing:** legacy `.doc`, layout-aware parsing for multi-column resumes, and a vision/OCR model for scans.
- **Larger or hosted models:** optional stronger LLM and reranker for better accuracy, with a redaction step before any data leaves the machine.
- **Scale-out:** more workers and model servers behind the same queue, metrics and alerting (Prometheus/Grafana), tuned concurrency from benchmark results.
- **Product features:** candidate-facing portal and applications, job-board/ATS integrations, calendar sync for interviews, email templates, bias/fairness dashboards, side-by-side candidate comparison, and feedback loops that learn from recruiter decisions.
- **Testing and CI:** end-to-end tests, CI running the unit suites and benchmarks, and removing the legacy Inngest workflows once nothing depends on them.
