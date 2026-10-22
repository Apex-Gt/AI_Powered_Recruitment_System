# Deployment

Two paths: the **local Docker stack** (complete, supported, the fallback for everything) and **free cloud hosting**
(partial, with honest limits below). No path uses a paid or metered AI API.

## 1. Local Docker stack (works anywhere Docker runs)

Services: `postgres` (pgvector), `qdrant`, `ollama`, `ai-service`, `backend`, `frontend` (nginx). Only the frontend
publishes a port (`HTTP_PORT`, default 8080); everything else is on an internal network with no route out.
(`ollama`, `backend` and `frontend` also join an `egress` network, for model downloads, email and the web port.
Nothing besides the frontend is published to the host.)

```bash
cp .env.example .env            # set POSTGRES_PASSWORD, JWT_SECRET, PIPELINE_API_KEY (openssl rand -hex 32)
docker compose up -d --build    # first start pulls the models; allow several minutes
docker compose logs -f ollama-init   # shows the model download
```

Open `http://localhost:8080`, register a company, create a job, **Add candidates**. Check health with
`docker compose ps` (every service becomes `healthy`) and `docker compose exec ai-service curl -s localhost:8000/health`.

| Flag | Use |
| --- | --- |
| *(none)* | Production-shaped: one published port. |
| `-f docker-compose.dev.yml` | Publishes Postgres 5433, Qdrant 6333, Ollama 11434, AI service 8000 on `127.0.0.1` so you can run the backend or Vite on the host. Never on a server. |
| `-f docker-compose.gpu.yml` | Gives Ollama the NVIDIA GPU. |

Not verified in this repository's test environment: the full `docker compose up` was **not** run end to end here
(see the status table at the end). The Compose files parse and resolve (`docker compose config`), and the pieces
were exercised individually; run the stack once on your target machine before relying on it.

### Models

```bash
docker compose exec ollama ollama list          # what is installed
# or on a host install:  ollama pull qwen3:4b && ollama pull bge-m3
```

| Role | Default | Why |
| --- | --- | --- |
| Chat (profile, summary) | `qwen3:4b` (about 2.6 GB at 4-bit) | Smallest Qwen3 that is a reasonable starting point. **Not yet benchmarked here**; choose by measuring, per [BENCHMARKS.md](BENCHMARKS.md). |
| Embeddings | `bge-m3` (1024-d, about 1.2 GB) | The same model and dimension as the existing Qdrant collection, served by Ollama so no PyTorch install is needed. |
| Reranker | none | `RERANKER_PROVIDER=none` keeps vector order. `local` (cross-encoder) needs `--build-arg WITH_LOCAL_EMBEDDINGS=true`. |

To compare `qwen3:4b` and `qwen3:8b`: set `LLM_MODEL`, restart `ai-service`/`ollama-init`, run the benchmark on the same
dataset, pick the **smallest that meets your quality bar**. On a 6 GB GPU `qwen3:8b` (about 5.2 GB) leaves almost no room for
context and partly runs on CPU, which is much slower; on a larger GPU or a machine with enough RAM it may be worth it.

Changing the embedding model to one with a different size needs a new Qdrant collection. The AI service refuses to start
against a collection of the wrong size rather than write bad vectors.

### Windows notes (the development machine)

- Docker Desktop and Ollama keep their data on `C:` by default. Models are large: this machine's `C:` had under 2 GB free
  with 17 GB of models already there. Point the model store elsewhere: set `OLLAMA_MODELS_DIR=D:/ollama` in `.env`
  (Compose), and for the Windows Ollama app set the user environment variable `OLLAMA_MODELS=D:\ollama\models`, then
  restart Ollama and move or re-pull the models.
- Run the backend from the repo with `mvnw spring-boot:run`, or from Docker, not both on port 8080.
- If VS Code's Java extension is open it also compiles into `backend/target/classes`, and the two can leave a stale class file
  (a `JobService` "bean not found" at startup was caused by this). Fix: `mvnw clean compile` with the IDE's Java server stopped,
  or build in Docker.

## 2. Free hosting: what is realistic

Checked against provider documentation in October 2026. Figures change; confirm on the provider's page before committing.

### Static frontend

| Provider | Free tier | Fit |
| --- | --- | --- |
| Cloudflare Pages | Static assets and bandwidth are not metered on the free plan. | Good, if the frontend and API share an origin (see below). |
| Vercel Hobby | About 100 GB/month, but **non-commercial use only**. | Not for a business tool. |
| Netlify | Credit-based since 2026 (about 300 credits/month, roughly 30 GB); exceeding it pauses every project on the team. | Tight. |

The frontend calls `/api/...` on its own origin and the login cookie is first-party. Hosting the SPA on a different origin
from the API needs CORS (the backend currently allows only `localhost:3000`) and `SameSite=None; Secure` cookies. The
simplest correct setup serves the SPA from the same nginx that proxies `/api`, as the Compose stack does.

### Compute for the backend, database and model

| Provider | Verified facts | Can it run the stack? |
| --- | --- | --- |
| **Oracle Cloud Always Free (Arm A1)** | Oracle's documentation: **2 OCPUs and 12 GB RAM** (1,500 OCPU-hours and 9,000 GB-hours/month), 200 GB block/boot storage, 10 TB/month outbound. Reduced from 4 OCPU / 24 GB on 15 June 2026 (InfoQ); free-only tenancies above the new limit are shut down until resized. Idle rule: a VM is reclaimable if for 7 days CPU p95 < 20%, network < 20% **and (A1) memory < 20%**. No GPU. Arm64. | **Partly.** Postgres + backend + AI service + Qdrant fit in 12 GB with a small model. Inference on 2 Arm cores with no GPU is far slower than a desktop GPU: expect hours, not minutes, for 500 resumes. This is an expectation, **not a measurement**: benchmark on the instance. A lightly used tool can also trip the idle rule and be reclaimed. |
| Hugging Face Spaces (free CPU) | 2 vCPU, 16 GB; sleeps after about 48 h idle; local disk is not persistent; running compute Spaces may need a paid plan, per the current docs. | **No** for a database-backed 24/7 system. Possibly for a demo of the model alone. |
| Render free web service | 512 MB RAM, spins down after 15 min idle, about a minute to wake (secondary sources; check Render). | **No.** A JVM plus a database plus a model does not fit, and queues need a running worker. |
| Fly.io / Koyeb | Sources disagree on whether a free compute tier still exists; reported trial or very small (256 to 512 MB) instances. | **No.** |
| A free managed Postgres | Several exist with small storage and idle pausing. | Could host the database only; the queue is in Postgres, so pausing delays processing. |

**Conclusion.** No free tier reviewed can run the whole pipeline with a language model at a useful speed, and the one
that can host the whole stack (Oracle A1) is slow, was halved this year, and can be reclaimed when idle. So:

1. **Run it locally** (section 1) on a machine with a GPU, or on any machine accepting slower processing, as the primary deployment.
2. **If you want an always-on free site**, put the Compose stack on an Oracle A1 instance (no GPU, `qwen3:4b`, concurrency 1),
   keep it busy enough to avoid the idle rule, and benchmark first. Treat it as a demo, not a service you depend on.
3. **If throughput matters**, the cheapest honest route is a small paid GPU or a bigger CPU box. This repository does not
   assume or require one.

Nothing in the application changes between these: it is configuration (`LLM_MODEL`, `PIPELINE_WORKER_CONCURRENCY`).

### If the model server is down

Resumes still upload and become candidates (deterministic fields are saved at PERSIST). Stages that need the model wait
in the queue and retry with backoff, then stop at `FAILED` with `LLM_UNAVAILABLE` and the stage preserved. Start Ollama
and press **Retry failed** (or `POST /recruiter/batches/{id}/retry`): processing resumes at the stage it stopped.

## 3. Secrets and exposure

- Required secrets are `POSTGRES_PASSWORD`, `JWT_SECRET`, `PIPELINE_API_KEY`; Compose refuses to start without them.
  `.env` is git-ignored; `.env.example` holds no real values.
- Do not publish Postgres, Qdrant or Ollama. The base Compose file does not; `docker-compose.dev.yml` does, bound to localhost.
- Terminate HTTPS in front of the frontend (a reverse proxy such as Caddy) and set `COOKIE_SECURE=true`, `PUBLIC_URL=https://...`.
- **Rotate the credentials committed earlier.** `backend/src/main/resources/application.properties` contains a Gmail app password,
  a Geoapify key, the JWT secret and the AI-service API key in plain text, and they are in git history. Rotate each, then supply
  them through environment variables (Spring reads `SPRING_MAIL_PASSWORD`, `GEOAPIFY_API_KEY`, `JWT_SECRET` and so on over the file).
  The file can only be cleaned up by you; removing the values does not remove them from history.

## What was and was not verified

| Check | Status |
| --- | --- |
| AI service: 125 unit tests (extraction, scoring, processor, LLM client, HTTP contract) | Passed |
| Backend: 103 unit tests including queue state machine, retries, idempotency, access control, upload validation | Passed |
| `docker compose config` for base, dev and GPU files; only the frontend publishes a port | Passed |
| Database dump and restore round trip (scratch database) | Passed |
| Backend starts against PostgreSQL and creates the new tables; AI service starts, enforces its API key, embeds through Ollama | Passed (live) |
| Full upload → batch → score → summary run with a real model | See [BENCHMARKS.md](BENCHMARKS.md) |
| `docker compose up --build` end to end, image builds, `ollama-init` model pull, GPU override | **Not run** here |
| Behaviour on Oracle A1 or any free host | **Not run** |
