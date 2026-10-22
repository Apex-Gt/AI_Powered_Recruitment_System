# Architecture audit and implementation plan

Audited on 2026-10-20 against the repository as it stood at commit `4ec8d527`.

## What exists today

| Area | Current implementation |
| --- | --- |
| Backend | Spring Boot (context path `/api`), JWT cookie auth, company/job ownership via `CandidateService.requireOwnedJob`. PostgreSQL (pgvector image), `ddl-auto=update`, no migration tool. |
| AI service | FastAPI. Four Inngest workflows (`ingest`, `score-job`, `rag-summary`, `rank`). Qdrant collection `resume_chunks` (1024 dims, cosine). `ScoringService` is already deterministic (skills 40 / experience 20 / education 10 / semantic 30). |
| Embeddings | `BAAI/bge-m3` through `FlagEmbedding` + `torch`, loaded in-process. 1024 dimensions, matching the Qdrant collection (dimension mismatch is already guarded in `QdrantService.initialize_collection`). |
| LLM | OpenAI-compatible client. **Default is hosted Groq** (`api.groq.com`, key required). Local Ollama is possible by changing `LLM_BASE_URL`, but nothing configures it. |
| Queue | Inngest dev server (a separate Node process). `docker-compose` image fails on the maintainer's machine; the service reports `unreachable` when it is not running. |
| Upload | `POST /recruiter/candidates/bulk-upload` and `/upload` (reactive `Mono`, but all blocking inside one `@Transactional`). |

## The three biggest bottlenecks

1. **The upload request does the AI work.** `createFromResume` calls `extractContact(...).block()` once per file, and that endpoint runs a full-resume LLM profile extraction. A 500-resume bulk upload is one HTTP request, one database transaction and 500 sequential LLM calls. It hits the 90 s per-file timeout and the proxy/client timeouts first. One bad file throws and rolls back every candidate already saved in the batch (their stored files are orphaned). There is no batch id, no per-file status and no progress.
2. **Hosted, unbounded LLM use.** The default LLM is a metered/rate-limited hosted API (not zero-cost, not local). The Inngest functions set no `concurrency` limit, so ingest events fan out into as many parallel LLM and embedding calls as the dev server dispatches. The profile is extracted twice in the worst case (once at upload, once in `ingest_resume_handler` when the event carries no profile). Output is "JSON mode", not schema-constrained.
3. **Work is lost silently and is not idempotent.** After the candidate row is saved, ingestion is fire-and-forget (`.subscribe(...)` with a log line on error). If the AI service or Inngest is down at that instant the candidate exists with no vectors, no score and no summary, and nothing records that or retries it. Duplicate detection is `(job, email)` only: an identical file with a different parsed email, or a retried request, creates a second candidate and a second Resume. Only `.pdf` (LlamaIndex `PDFReader`) is supported; no DOCX, no scanned-PDF fallback.

## Other findings

- **Committed credentials:** `backend/src/main/resources/application.properties` contains a real Gmail app password and Geoapify key (plus the JWT secret and AI-service API key). These should be rotated and moved to environment variables. This change adds `.env.example` and environment overrides but cannot rotate secrets for you.
- Multipart limits are 20 MB per request, which cannot carry a 50–500 resume batch. Tomcat also caps the number of multipart parts.
- `torch` + BGE-M3 + `bge-reranker-v2-m3` inside the API process: roughly 4 GB of model weights on the C: drive, which has about 5 GB free. Ollama's model store (17 GB) is also on C:.
- Scoring gaps: no explicit flag for unmet **mandatory** requirements, no per-skill evidence, experience is the declared total only (no employment-date calculation).
- `AiResult` stores each result as a JSON `TEXT` row keyed by `refKey`: fine for this scale, and reused here.

## Plan (reuse first)

Reuse: Spring entities/repositories/security, `AiResultStore`, Qdrant + BGE-M3 (1024 dims), `ScoringService`, Pydantic profile models, Ollama.

1. **PostgreSQL-backed work queue in Spring** (`resume_batches`, `resume_tasks`): claimed with `FOR UPDATE SKIP LOCKED`, leased, retried with exponential backoff, resumed after a restart. Chosen over Inngest because it adds no new infrastructure, survives restarts in the database the app already needs, and works in plain Docker Compose.
2. **Staged, independently retryable pipeline** (each stage persisted): `EXTRACT` (deterministic text + contact fields, no LLM) → `PERSIST` (candidate row) → `PROFILE` (local LLM, schema-constrained) → `INDEX` (embed + Qdrant upsert with deterministic ids) → `ANALYZE` (deterministic score + grounded summary). If the LLM or Qdrant is down, the candidate and the queued work are kept and resumed later.
3. **AI service stage endpoints** (synchronous, bounded by semaphores, optional shared-key auth): PyMuPDF / python-docx / OCR fallback, Ollama for chat and embeddings, schema-validated output.
4. **Scoring v2**: mandatory-requirement flags, per-skill evidence, experience from employment dates; every component and warning is stored.
5. **Bulk API + frontend progress** (polling), **Compose stack**, **tests**, **benchmark harness**, **deployment and operations docs**.

Existing endpoints and Inngest workflows are left in place. The new batch endpoints are additive; the only behaviour change is that the frontend upload modal moves to the batch endpoint.

## What changed (summary)

| Bottleneck | Change |
| --- | --- |
| 1. Upload request did the AI work | `POST /recruiter/batches` validates, hashes, stores and queues, then answers `202` with a batch id. No AI call, no long transaction. One bad file is recorded against its own row instead of aborting the batch. |
| 2. Hosted, unbounded LLM use | Defaults are local Ollama models (`qwen3:4b` chat, `bge-m3` embeddings). The AI service serialises model calls (`LLM_CONCURRENCY=1`), the worker is bounded (2), profile extraction happens once, output is schema-constrained and validated. |
| 3. Silent loss, no idempotency | A PostgreSQL queue (`resume_tasks`) with leases, `SKIP LOCKED` claiming, stage checkpoints, exponential backoff, a permanent/transient/needs-review split, SHA-256 duplicate guard, advisory-locked candidate creation and deterministic vector ids. |

New code: `backend/.../pipeline/` (queue, worker, batch API, retention), `ai-service/app/pipeline/` and `app/api/pipeline.py`
(extraction, grounding, staged endpoints), scoring v2 in `app/services/scoring.py`, `frontend/.../BatchProgress.tsx`,
`docker-compose*.yml`, `benchmarks/`, `scripts/` (backup and restore), and `docs/`.

Existing code kept: entities and repositories, `AiResultStore`, Qdrant and BGE-M3 (1024-d), `ScoringService`'s weights, the
Inngest workflows and the single-resume upload (unchanged, no longer used by the upload dialog).

Breaking or behavioural changes: none to existing endpoints. `Resume` gains a `sha256` column and two tables are added
(`resume_batches`, `resume_tasks`); `ddl-auto=update` creates them. The AI service's default LLM changed from hosted Groq to
local Ollama (an existing `ai-service/.env` that names Groq keeps using Groq until you change it); the default
`SCORING_SCORING_VERSION` is `2.0` (a local `.env` that pins `1.0` keeps `1.0`).
