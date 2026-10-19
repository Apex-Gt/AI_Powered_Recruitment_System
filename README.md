# AI Powered Recruitment System

A full-stack recruitment platform. Recruiters upload resumes, and an AI pipeline parses them, scores each candidate against a job, explains the score with evidence from the resume (RAG), and ranks candidates.

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [First login](#first-login)
- [Configuration](#configuration)
- [Running the AI service without Docker](#running-the-ai-service-without-docker-alternative)
- [How authentication works](#how-authentication-works)
- [API overview](#api-overview)
- [Project structure](#project-structure)
- [Development commands](#development-commands)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌──────────────┐  /api (Vite proxy)  ┌────────────────┐   REST    ┌────────────────┐
│  Frontend    │────────────────────▶│  Backend       │──────────▶│  AI Service    │
│  React/Vite  │◀────────────────────│  Spring Boot   │◀──────────│  FastAPI       │
│  :3000       │   HttpOnly cookie   │  :8080 (/api)  │ callbacks │  :8000         │
└──────────────┘                     └───────┬────────┘           └───┬────────┬───┘
                                             │                        │        │
                                             ▼                        ▼        ▼
                                     ┌──────────────┐          ┌─────────┐ ┌─────────┐
                                     │ PostgreSQL   │          │ Qdrant  │ │ Inngest │
                                     │ :5433        │          │ :6333   │ │ :8288   │
                                     └──────────────┘          └─────────┘ └─────────┘
```

| Service | Tech | Port | Notes |
|---|---|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind 3.4 | **3000** | Proxies `/api` to the backend |
| Backend | Spring Boot 4.1, Java 21, Spring Security, JWT | **8080** | Context path is `/api`, so URLs look like `http://localhost:8080/api/...` |
| AI service | FastAPI, Python 3.12, LlamaIndex, Inngest | **8000** | Resume parsing, scoring, RAG summaries, ranking |
| PostgreSQL | `pgvector/pgvector:pg16` | **5433** (host) | Database `ai_resume_db`, user and password `postgres` |
| Qdrant | `qdrant/qdrant` | **6333** | Resume chunk embeddings (BGE-M3, 1024-dim) |
| Inngest | `inngest/inngest` (dev server) | **8288** | Runs the AI workflows with retries. The dashboard is at http://localhost:8288 |

Roles: `ADMIN` (company owner: manages recruiters, company, all jobs) and `RECRUITER`. Every query is scoped to the user's company.

---

## Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Git | any | cloning |
| Docker + Docker Compose | Compose v2 | PostgreSQL, Qdrant, Inngest, AI service |
| Java (JDK) | **21** | backend (Maven wrapper is included, so no Maven install is needed) |
| Node.js + npm | 18 or newer (22 tested) | frontend |
| Python | 3.12 | only if you run the AI service outside Docker |
| Groq API key | free | the LLM that extracts candidate profiles and writes summaries: https://console.groq.com/keys |

Disk and RAM: the AI service downloads two models on first use, `BAAI/bge-m3` and `BAAI/bge-reranker-v2-m3`, about **2.3 GB each**, and the Docker image is large too. Keep roughly **10 GB free**.

---

## Quick start

Open **four terminals** (or run the first two commands in one). Order matters: database, then AI service, then backend, then frontend.

### 1. Clone

```bash
git clone https://github.com/Apex-Gt/AI_Powered_Recruitment_System.git
cd AI_Powered_Recruitment_System
```

### 2. Start PostgreSQL

```bash
cd backend
docker compose up -d
```

This creates the `ai_resume_db` database on host port **5433**. Tables are created automatically by Hibernate (`ddl-auto=update`) when the backend starts.

### 3. Start the AI service stack (Qdrant + Inngest + AI service)

Create `ai-service/.env` with your LLM key. This file is git-ignored, so everybody makes their own:

```env
LLM_API_KEY=gsk_your_groq_key_here
```

Everything else has working defaults in `ai-service/docker-compose.yml`. See [AI service variables](#ai-service-ai-serviceenv) for optional overrides.

```bash
cd ai-service
docker compose up -d --build
```

The first build takes a few minutes. Check it is up: http://localhost:8000/health.

### 4. Start the backend

The backend reads `backend/src/main/resources/application.properties`. One default needs overriding for local use: that file points at the AI service on port `8001`, but it runs on **8000**. Override it with an environment variable (no file edit needed):

macOS / Linux / Git Bash:
```bash
cd backend
export AI_SERVICE_BASE_URL=http://localhost:8000
./mvnw spring-boot:run
```

Windows PowerShell:
```powershell
cd backend
$env:AI_SERVICE_BASE_URL = "http://localhost:8000"
.\mvnw.cmd spring-boot:run
```

Wait for `Started AiResumeRagBeApplication`. The API is now at http://localhost:8080/api.

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**. No frontend `.env` is needed, because Vite proxies `/api` to `localhost:8080`.

### 6. Check everything is running

| What | Check |
|---|---|
| Frontend | http://localhost:3000 shows the login page |
| Backend | `curl -i http://localhost:8080/api/auth/me` returns `401` (it is running and rejecting unauthenticated requests) |
| AI service | http://localhost:8000/health |
| Backend to AI service | after logging in, `GET /api/recruiter/candidates/ai-service/health` |
| Qdrant | http://localhost:6333/dashboard |
| Inngest | http://localhost:8288 (should list the AI service functions) |
| PostgreSQL | `docker exec ai_resume_postgres pg_isready` |

---

## First login

There is no seeded user. Create one:

1. Go to http://localhost:3000/register and register a **company**. This creates the company and its `ADMIN` user.
2. Log in with the admin email and password you just entered.
3. As admin, open **Team** to create `RECRUITER` accounts. The system emails the recruiter their credentials. If SMTP isn't configured the account is still created, but the email fails and is logged by the backend. Share the credentials manually in that case.
4. Create a job, then upload resumes under **Candidates**. Parsing, scoring and ranking run asynchronously through Inngest, so watch http://localhost:8288 if results are slow to appear. The first resume is slowest because the models download then.

---

## Configuration

### Backend (`backend/src/main/resources/application.properties`)

Any property can be overridden with an environment variable. Uppercase it and replace `.` and `-` with `_`. Prefer environment variables for secrets so they don't end up in commits.

| Property | Env override | Purpose |
|---|---|---|
| `spring.datasource.url` / `.username` / `.password` | `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | PostgreSQL. Default `jdbc:postgresql://localhost:5433/ai_resume_db`, `postgres` |
| `jwt.secret` | `JWT_SECRET` | JWT signing key. Must be **Base64-encoded** and at least 256 bits. Generate one with `openssl rand -base64 48` |
| `jwt.expiration` | `JWT_EXPIRATION` | Token and cookie lifetime in ms. Default `86400000` (24 h) |
| `ai-service.base-url` | `AI_SERVICE_BASE_URL` | AI service URL. **Set to `http://localhost:8000`** (see step 4) |
| `inngest.base-url`, `inngest.dev-mode`, `inngest.signing-key` | `INNGEST_BASE_URL`, `INNGEST_DEV_MODE`, `INNGEST_SIGNING_KEY` | Inngest. Dev mode is on by default |
| `spring.mail.*` | `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD`, ... | SMTP, used only to email recruiter credentials. For Gmail use an app password |
| `app.frontend.url` | `APP_FRONTEND_URL` | Login link placed in emails. Default `http://localhost:3000` |
| `app.cookie.secure` | `APP_COOKIE_SECURE` | Set `true` when served over HTTPS (production) |
| `app.cookie.same-site` | `APP_COOKIE_SAME_SITE` | Default `Lax` |

### AI service (`ai-service/.env`)

`docker-compose.yml` already sets sensible values for Docker. Only these normally need your input:

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_API_KEY` | **Yes** | none | Groq key (or any OpenAI-compatible provider) |
| `LLM_BASE_URL` | No | `https://api.groq.com/openai/v1` | LLM endpoint |
| `LLM_MODEL` | No | `llama-3.3-70b-versatile` | LLM model name |
| `OPENAI_API_KEY` | No | empty | Only if you switch embeddings or reranking to `openai` |
| `INNGEST_SIGNING_KEY` / `INNGEST_EVENT_KEY` | No | empty | Not needed for the local dev server |
| `SPRING_BOOT_API_KEY` | No | empty | Reserved for AI-service-to-backend calls |
| `EMBEDDING_PROVIDER` / `RERANKER_PROVIDER` | No | `local` | `local` (BGE models, free, large download) or `openai` |

Scoring weights (`SCORING_*`) default to 40% skills, 20% experience, 10% education, 30% semantic similarity.

### Frontend

No environment variables. The dev server port (3000) and the `/api` proxy are set in `frontend/vite.config.ts`.

---

## Running the AI service without Docker (alternative)

Useful when you are changing AI service code. Qdrant still runs in Docker.

```bash
cd ai-service
docker compose up -d qdrant                  # vector DB only

python -m venv venv
source venv/bin/activate                     # Windows: venv\Scripts\activate
# CPU-only machines: install torch first to avoid a huge CUDA download
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -e ".[dev]"
```

Create `ai-service/.env` with at least:

```env
LLM_API_KEY=gsk_your_groq_key_here
SPRING_BOOT_BASE_URL=http://localhost:8080
```

Then run the service and, in a second terminal, an Inngest dev server that points at it on the host:

```bash
python main.py                                                        # terminal 1, port 8000
npx --yes inngest-cli@latest dev -u http://localhost:8000/api/inngest # terminal 2, port 8288
```

`start-inngest.cmd` in the repo root runs the second command for you (and does nothing if Inngest is already up). If scoring or upload returns a 502 saying it could not queue a workflow, Inngest is not running; `/health` on the AI service also reports it as `unreachable`.

Do not also start the compose `inngest` or `ai-service` containers. They would clash on ports 8288 and 8000.

---

## How authentication works

- `POST /api/auth/login` returns the user and sets an **`HttpOnly` cookie** named `jwt` (`Path=/api`, `SameSite=Lax`, `Max-Age` = 24 h). The token is never stored in `localStorage`.
- A session lasts **24 hours from login, per browser profile**. Refreshing the page or opening a new tab restores it by calling `GET /api/auth/me`.
- After 24 hours, or after logout, protected requests return `401` and the app redirects to the login page. If the server is merely unreachable, the app shows a retry screen and does not log the user out.
- CORS allows `http://localhost:3000` and `http://127.0.0.1:3000` with credentials (`SecurityConfig`). If you serve the frontend from another origin, add it there and set `app.cookie.secure=true` behind HTTPS.

---

## API overview

All backend routes are prefixed with `/api`. Everything except login and company registration needs the `jwt` cookie.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `PUT /auth/me`, `POST /auth/logout` |
| Company | `POST /company/register` (public) |
| Jobs (recruiter) | `POST /job`, `GET /job/my-jobs`, `GET/PUT/DELETE /recruiter/jobs/{id}`, `PUT /recruiter/jobs/{id}/skills`, `GET /recruiter/me` |
| Admin | `/admin/recruiters` (create, list, get, update, delete), `/admin/company`, `/admin/jobs`, `/admin/jobs/{id}`, `/admin/jobs/{id}/skills` |
| Candidates | `/recruiter/candidates` (list), `/{id}`, `/upload`, `/bulk-upload`, `/{id}/status`, `/{id}/shortlist`, `/{id}/reject` |
| AI actions | `POST /recruiter/candidates/{id}/score-job/{jobId}`, `.../rag-summary/{jobId}`, `/jobs/{jobId}/rank-candidates`; results via `GET .../match-score/{jobId}`, `.../rag-summary/{jobId}`, `/jobs/{jobId}/ranking`; `GET .../ai-service/health` |
| AI callbacks (internal) | `POST /api/ai/match-scores`, `/rag-summaries`, `/rankings/{jobId}`, `/candidate-profile`: the AI service posts results here |

AI service (`http://localhost:8000`): `GET /health`, `POST /api/v1/resumes/ingest`, `/api/v1/candidates/score-job`, `/api/v1/candidates/rag-summary`, `/api/v1/jobs/rank-candidates`, and the matching `GET` result routes under `/api/v1/...`.

---

## Project structure

```
.
├── frontend/          React + Vite app
│   └── src/           pages/, components/, context/ (Auth, Theme), utils/api.ts, styles/globals.css
├── backend/           Spring Boot app
│   ├── docker-compose.yml          PostgreSQL + pgvector
│   └── src/main/java/com/project/ai_resumerag_be/
│       ├── controller/  config/ (security, JWT filter)  service/  repository/  entity/  dto/
├── ai-service/        FastAPI service
│   ├── docker-compose.yml          Qdrant + Inngest + AI service
│   ├── app/           api/, services/, workflows/, core/ (config), models/
│   └── tests/         unit/, integration/
└── *.md               design and status notes (PROJECT_CONTEXT, IMPLEMENTATION_PLAN, DEVELOPMENT_RULES, ...)
```

---

## Development commands

```bash
# Frontend (frontend/)
npm run dev          # dev server on :3000
npm run build        # type-check (tsc) + production build
npm run lint         # ESLint

# Backend (backend/); tests need PostgreSQL running (step 2)
./mvnw test          # Windows: .\mvnw.cmd test
./mvnw clean package

# AI service (ai-service/)
pytest tests/unit -v
pytest tests/integration -v   # needs Qdrant etc. running
```

Housekeeping: do not commit secrets, and `backend/target/`, `frontend/dist/` and `hs_err_pid*.log` files are build or crash artifacts.

---

## Troubleshooting

**Login works but a refresh sends me back to login**
Make sure you're on the latest `main`. Old builds skipped JWT validation on `/auth/me`. Also check that the browser accepts cookies for `localhost`, and that you open the app as `localhost:3000` (not a LAN IP, which is not in the CORS list).

**Backend fails at startup with a database connection error**
PostgreSQL isn't running or is on a different port. Run `docker ps`, then `docker logs ai_resume_postgres`. The host port is **5433**, not 5432. If something else uses 5433, change the mapping in `backend/docker-compose.yml` and set `SPRING_DATASOURCE_URL` to match.

**Uploads are accepted but scores or summaries never appear**
- Check that `AI_SERVICE_BASE_URL` points to `http://localhost:8000`. The default in `application.properties` (8001) is wrong for this setup.
- Open http://localhost:8288 and look at failed runs. Inngest must be able to reach the AI service (`ai-service:8000` in Docker, or `localhost:8000` in the no-Docker setup).
- `docker logs ai-service`. A missing or invalid `LLM_API_KEY` shows up here.

**First resume is very slow, or the AI container looks stuck**
It is downloading the BGE-M3 and reranker models (about 4.6 GB total, cached in the `hf_cache` volume). Watch `docker logs -f ai-service`. To avoid the download, set `EMBEDDING_PROVIDER=openai` and `RERANKER_PROVIDER=openai` with an `OPENAI_API_KEY`.

**AI service can't reach the backend (Docker)**
The container calls the backend at `http://host.docker.internal:8080`. Make sure the backend is running on the host on port 8080.

**`JWT secret` / `Illegal base64 character` error on startup**
`jwt.secret` must be valid Base64 and long enough for HS256 (256 bits or more). Generate one with `openssl rand -base64 48`.

**Port already in use**
Frontend 3000, backend 8080, AI service 8000, PostgreSQL 5433, Qdrant 6333/6334, Inngest 8288. Stop the other process, or change the mapping.

**Start from a clean database**
```bash
cd backend && docker compose down -v && docker compose up -d
```
Add `-v` to the AI service `docker compose down` as well to also wipe Qdrant and Inngest data.

**Windows**
Use `.\mvnw.cmd` instead of `./mvnw`. If the C: drive is nearly full, Docker's data lives there by default, and the model downloads alone are about 5 GB.
