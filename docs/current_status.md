# Current Status

**Last updated:** 2026-10-23

Single source of truth for what is built today. Design intent lives in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), the original roadmap in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), and the working rules in [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md). Update this file whenever a feature lands.

## Stack

| Service | Tech | Port | Notes |
| --- | --- | --- | --- |
| `frontend/` | React, Vite, TypeScript, Tailwind | 3000 (dev), 80 in Docker | Orange theme, light/dark, left sidebar |
| `backend/` | Spring Boot, PostgreSQL | 8080 (`/api`) | JWT in HttpOnly cookie, company isolation on every query |
| `ai-service/` | FastAPI, Qdrant, Inngest | 8000 | Local-first: Ollama for LLM and embeddings, no paid API required |
| Infrastructure | Docker Compose | n/a | Base stack plus `docker-compose.dev.yml` (host ports) and `docker-compose.gpu.yml` (NVIDIA) |

## Backend (implemented)

- Company registration, login/logout/profile, roles `ADMIN` and `RECRUITER`.
- Admin: recruiter management, company settings, jobs.
- Jobs: create, edit, delete, skills.
- Candidates: upload, bulk upload, status, shortlist/reject, notes, resume download, company isolation.
- AI actions: score against a job, RAG summary, ranking; results stored via AI callbacks.
- Interviews: schedule, edit, cancel, feedback, candidate email notices.
- Assessments: multi-round, tokenized public candidate links, AI grading of code/essay answers.
- Analytics endpoints.
- Batch resume pipeline (`pipeline/`): durable PostgreSQL-backed task queue, staged processing with retries, partial completion, retention job. See [PIPELINE.md](PIPELINE.md).

## AI service (implemented)

- Resume ingestion workflow: extract text, chunk, embed, store in Qdrant.
- Scoring, reranking, RAG summaries, candidate ranking, answer grading.
- Pipeline endpoints (`app/pipeline/`): text extraction, profile/experience fields, processor.
- Inngest workflows for async work; `/health` reports dependency status.

## Frontend (implemented)

Pages: auth, dashboard, jobs, candidates, pipeline (kanban), interviews, assessments (builder, results, candidate exam), analytics, company, team, settings. Live batch progress with named processing steps in the upload dialog.

## Operations and tooling

- Docs: [API](API.md), [PIPELINE](PIPELINE.md), [DEPLOYMENT](DEPLOYMENT.md), [OPERATIONS](OPERATIONS.md), [BENCHMARKS](BENCHMARKS.md), [ARCHITECTURE_AUDIT](ARCHITECTURE_AUDIT.md).
- `scripts/`: PostgreSQL backup/restore (sh and ps1), `start-inngest.cmd` for running without Docker.
- `benchmarks/`: repeatable 50/100/500 resume benchmark on synthetic data.
- Tests: backend (`./mvnw test`, needs PostgreSQL), AI service (`pytest tests/unit`), benchmark metrics (`benchmarks/test_metrics.py`).

## Known gaps

- No accuracy claim for scoring without a measured benchmark (see BENCHMARKS.md).
- Inngest in Docker has failed on the maintainer's machine; the npx dev server is the fallback.
- Schema is managed by Hibernate (`ddl-auto=update`); there is no migration tool, and `db/migration/V2__normalize_job_skills.sql` is a manual script.
