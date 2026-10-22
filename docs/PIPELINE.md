# Bulk resume pipeline

How a batch of 50 to 500 resumes becomes scored, summarised candidates, using only locally hosted open-weight
models. API details and sample requests are in [API.md](API.md); deployment is in [DEPLOYMENT.md](DEPLOYMENT.md).

## The workflow

```
Recruiter ──POST /recruiter/batches (files)──▶ Backend ──▶ answers 202 + batch id immediately
                                                   │ validates, hashes, stores, queues (PostgreSQL)
                                                   ▼
                              resume_tasks (the queue)  ◀── claimed by workers with FOR UPDATE SKIP LOCKED
                                                   │
        per resume, in order, each stage saved before the next starts:
        EXTRACT ─▶ PERSIST ─▶ PROFILE ─▶ INDEX ─▶ SCORE ─▶ SUMMARY ─▶ DONE
        (no LLM)   (Spring)   (LLM)      (embed)   (rules)   (LLM)
                                                   │
                           GET /recruiter/batches/{id}  (polled by the UI every 2.5 s)
```

| Stage | Where | What it does | Uses |
| --- | --- | --- | --- |
| EXTRACT | AI service | Reads the file (PyMuPDF for PDF, python-docx for DOCX, text for TXT; Tesseract OCR only when a PDF has almost no embedded text). Takes name, email, phone and links with regexes. | CPU only |
| PERSIST | Backend | Creates the `Resume` and `Candidate` rows. Skips if this task already made them. Refuses a second candidate with the same email for the job. | PostgreSQL |
| PROFILE | AI service | Local LLM returns a JSON profile constrained to the `CandidateProfile` schema (skills, dated employment history, education, certifications, projects). Output is validated, then **grounded**: deterministic fields override the model, and skills the resume text never mentions are dropped. | Ollama (chat) |
| INDEX | AI service | Chunks the text, embeds the chunks, upserts them into Qdrant. Point ids are derived from candidate, resume and chunk, so a repeat overwrites instead of duplicating. | Ollama (embeddings), Qdrant |
| SCORE | AI service | Deterministic, explainable score (below). | embeddings + rules, **no LLM** |
| SUMMARY | AI service | Retrieves the best-matching chunks and asks the LLM for a grounded summary: alignment, evidence, gaps, uncertainties. | Ollama (chat), Qdrant |

Because the candidate is saved at PERSIST and every later stage is independent, an Ollama or Qdrant outage never
loses a candidate: the task waits at the failed stage and resumes there.

## Statuses

Resume (task) status: `QUEUED` → `PROCESSING` → one of

| Final status | Meaning | Retry? |
| --- | --- | --- |
| `COMPLETED` | Every stage finished. | n/a |
| `NEEDS_REVIEW` | Processed (or parked) but a person should look: no email found (no candidate is created), very little text, scanned PDF without OCR. | Upload a better file |
| `FAILED` | The file is unusable (corrupt, encrypted, wrong type, too large) **or** a dependency stayed down for every attempt. The message says which. | Dependency failures: `POST .../retry`. Bad files: no |
| `DUPLICATE` | Identical file already in this job, or the same applicant (same email) already applied. Nothing is processed. | n/a |

Batch status is derived from its resumes: `UPLOADED` (still receiving) → `QUEUED` → `PROCESSING` →
`COMPLETED` (all clean) / `PARTIAL` (some failed or need review, the rest are done and usable) / `FAILED` (none worked).
A batch is never "completed" while any resume failed.

## Failure handling

| Situation | What happens |
| --- | --- |
| Ollama, Qdrant or the embedding model is down or times out | Transient: the task returns to `QUEUED` at the same stage with exponential backoff (15 s, 30 s, 60 s, 2 min, 4 min, 8 min, 15 min, ±20% jitter), up to 8 attempts per stage, which rides out roughly 30 minutes of outage. After that it is `FAILED` with the reason, and **keeps its stage**, so `retry` resumes there. |
| Corrupt, encrypted, empty, unsupported or oversized file | Permanent: `FAILED` immediately, never retried. Other resumes in the batch are unaffected. |
| Model returns invalid or truncated JSON | Treated as transient (the next attempt usually differs); bounded by the same attempt cap. |
| Gave up after the cap | `FAILED` with `Gave up after N attempts: <reason>`. Press **Retry failed**: the attempt budget resets and work resumes at that stage. |
| Backend or worker killed mid-resume | The task's lease (15 min, renewed before each stage) expires; the next poll puts it back in the queue at its stage. A resume that kills the worker every time is failed after the attempt cap. |
| Two workers, or a retry racing a crash | Row-level locks (`SKIP LOCKED`) give each task to one worker. PERSIST is idempotent (the task remembers its candidate) and takes a per-applicant advisory lock. INDEX uses deterministic point ids. |
| Same file uploaded twice | SHA-256 per job with a unique database constraint: recorded as `DUPLICATE`, never stored twice. A failed file releases its key, so a fixed copy can be uploaded. |
| Graceful shutdown | The worker stops claiming, waits up to 60 s for in-flight tasks, and leaves the rest to lease recovery. |

Nothing marks failed work as completed. Every task keeps `attempts`, timestamps, the last error code and message.

## Concurrency

- The backend worker processes **2 resumes at once** (`PIPELINE_WORKER_CONCURRENCY`).
- The AI service lets **1 chat request** run at a time (`LLM_CONCURRENCY`) and 1 embedding batch at a time
  (`PIPELINE_EMBED_CONCURRENCY`), so a burst never becomes an unbounded pile of model calls.
- Ollama keeps the chat and embedding models loaded (`OLLAMA_KEEP_ALIVE=30m`): weights are read once, not per resume.

These are conservative starting values for a 6 GB GPU. Raise them only after measuring (see
[BENCHMARKS.md](BENCHMARKS.md)). More workers than the model server can feed just lengthens the queue.

## Scoring (version 2.0)

Each component is 0 to 100; the overall score is their weighted mean. Weights are configurable
(`SCORING_*_WEIGHT`) and default to the specification.

| Component | Weight | How it is computed |
| --- | --- | --- |
| Skills | 40% | 70% required-skill coverage + 30% preferred-skill coverage, after normalising aliases (`Postgres` = `PostgreSQL`, `React.js` = `React`, `k8s` = `Kubernetes`). |
| Relevant experience | 20% | Years in roles whose title or description mentions a job skill or a job-title word, from **dated** employment entries with overlapping roles merged. If the resume has no readable dates it falls back to the stated total and says so in `warnings`. |
| Education | 10% | Highest degree level against the job's required level. |
| Semantic relevance | 30% | Mean cosine similarity of the job text to the candidate's top chunks (embeddings). |

Not hidden in the aggregate: the response also carries `meetsMandatory` and `mandatoryMissing` (required skills the
resume does not show), `skillEvidence` (a resume snippet for each matched skill), `relevantExperienceYears`,
`totalExperienceYears`, `warnings`, and the scoring version and weights. A candidate missing a mandatory requirement
is flagged, not just ranked lower.

Scores are decision support. Nothing in the pipeline rejects or advances a candidate. The skills, experience and
education components use only skills, dated roles and degrees; the profile prompt does not ask the model for gender,
age, nationality or similar characteristics, and the score never reads a name.

**Known gap:** the semantic component embeds the resume's text, and that text can contain such details (a name, a
photo caption, "he/she", a date of birth). The effect on similarity is unmeasured. If this matters for your hiring
process, redact the header block before indexing and audit score differences across groups; do not treat the
absence of an explicit field as proof of neutrality.

Honest limits: the semantic component is raw embedding similarity and has not been calibrated against human
judgement; the 40/20/10/30 weights are the specified defaults, not tuned values. Tune them against labeled data
before relying on rankings.

## Summaries

The summary prompt only receives the profile, the score and the retrieved resume chunks, and is told to state when
something is not mentioned. The model can still be wrong; this is why the response keeps the evidence chunks next to
the text. The benchmark reports an automatic grounding proxy, not a human faithfulness judgement.

Summaries and scores are not recomputed for an unchanged resume and job description: each task stores a key of
`resume hash + job description + analysis version (+ model for summaries)` and skips the stage when it matches.
Editing the job, or bumping `pipeline.analysis-version`, invalidates it.

## Data kept

| Data | Where | Lifetime |
| --- | --- | --- |
| Resume file | `/data/uploads` volume | With the candidate. For uploads that never became a candidate (failed, needs review, duplicate): deleted after `pipeline.retention.unusable-days` (30). |
| Extracted text | `resumes.extracted_text` (candidate) and `resume_tasks.extract_json` (a copy) | The copy is cleared after `pipeline.retention.extracted-text-days` (90); a daily job at 03:30 does both. `0` disables a purge. |
| Profile, score, summary | `ai_results` | With the candidate; deleting the candidate or job removes them, the stored file, the queue rows' duplicate keys and the Qdrant vectors. |
| Logs | stdout | File names, names and email addresses are not written by the pipeline (ids and error codes only). The older email service still logs recipient addresses. |

## What this does not do

- It does not claim 90% accuracy. Measure it: [BENCHMARKS.md](BENCHMARKS.md).
- Legacy `.doc`, images and archives are rejected. Scanned PDFs need Tesseract (in the Docker image, optional on Windows).
- Resumes are parsed as text. Multi-column layouts can interleave; PyMuPDF handles most, not all.
- The older single-resume upload and the Inngest workflows still exist and are unchanged. The frontend upload dialog uses the batch endpoint.
