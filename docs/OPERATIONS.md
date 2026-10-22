# Operations

Day-to-day running, backup and recovery. All commands assume the Docker stack from [DEPLOYMENT.md](DEPLOYMENT.md), run from the repo root.

## Is it healthy?

```bash
docker compose ps                                              # every service should be "healthy"
docker compose exec ai-service curl -s localhost:8000/health   # qdrant, embedding model, reranker
docker compose exec ollama ollama list                         # models present
docker compose exec ollama ollama ps                           # models currently loaded, and GPU/CPU split
```

Queue state straight from the database (the queue *is* the `resume_tasks` table):

```bash
docker compose exec postgres psql -U postgres -d ai_resume_db -c \
  "select status, stage, count(*), min(next_attempt_at) from resume_tasks group by 1,2 order by 1,2;"
# why resumes are failing
docker compose exec postgres psql -U postgres -d ai_resume_db -c \
  "select error_code, count(*), max(error_message) from resume_tasks where status='FAILED' group by 1;"
```

## Common situations

| Symptom | Cause and fix |
| --- | --- |
| Batch stays `QUEUED` or very slow | Normal for a CPU or small GPU: models serve one request at a time. Watch `percentComplete`/`resumesPerMinute`. Check `ollama ps`: if the model shows a large CPU share it is spilling out of VRAM; use a smaller model. |
| Many `FAILED` with `LLM_UNAVAILABLE`, `EMBEDDING_UNAVAILABLE` or `VECTOR_STORE_UNAVAILABLE` | A model server or Qdrant was down for longer than the retry window (about 30 min across 8 attempts). Fix it, then **Retry failed** in the UI or `POST /recruiter/batches/{id}/retry`. Work resumes at the stage it stopped; nothing is redone. |
| `AI_SERVICE_AUTH` | `PIPELINE_API_KEY` (AI service) and `PIPELINE_AI_API_KEY` (backend) differ. Tasks stay queued and retry until they match; fix and restart the backend. |
| `FAILED` `ENCRYPTED_FILE`, `CORRUPT_FILE`, `UNSUPPORTED_TYPE`, `INVALID_CONTENT` | The file itself. Not retryable; upload a fixed copy (a failed file does not block a re-upload). |
| `NEEDS_REVIEW` `NO_EMAIL` | No email found, so no candidate was created. Open the file; add the candidate by hand or upload a corrected resume. |
| `NEEDS_REVIEW` `SCANNED_PDF` | Scan with no text and OCR unavailable. The Docker image includes Tesseract; on a host install it and `pip install pytesseract`. |
| Tasks stuck in `PROCESSING` | A worker died. They return to `QUEUED` when the 15-minute lease expires, at their stage. Nothing to do. |
| Backend will not start: "required a bean of type ... that could not be found" | Stale `target/classes` from an IDE build colliding with Maven. Stop the IDE's Java server and run `mvnw clean compile`, or use the Docker build. |

## Backup and restore

What cannot be rebuilt: the **PostgreSQL database** (candidates, jobs, queue, scores, summaries) and the **uploaded resume
files**. Qdrant vectors and Ollama models are derived data.

```bash
./scripts/backup.sh [dir]        # Windows: .\scripts\backup.ps1 [-Out dir]
# writes db-<time>.dump (pg_dump custom format) and uploads-<time>.tar, refuses to leave an empty file
./scripts/restore.sh backups/db-<time>.dump backups/uploads-<time>.tar     # asks you to type "restore"
```

Restore stops the backend and frontend, restores the database with `--clean --if-exists`, replaces the uploads, then
starts them again. Resumes that were mid-flight when the backup was taken continue automatically after their lease expires.

Verified here: `pg_dump -Fc` followed by `pg_restore --clean --if-exists --no-owner` into a scratch database reproduced
identical row counts. The scripts' Compose wrappers (`docker compose exec`/`run`) were not exercised in this environment;
try a restore into a spare stack before you need it. Schedule `backup.sh` (cron, or Task Scheduler on Windows) and copy
the output **off the machine**: a backup on the same disk does not survive the disk.

## Rebuilding the vector index

If the Qdrant volume is lost, or you change the embedding model (new collection), re-run INDEX, SCORE and SUMMARY for
finished resumes by moving their tasks back to the INDEX stage; the worker does the rest:

```sql
update resume_tasks
   set status='QUEUED', stage='INDEX', stage_attempts=0, next_attempt_at=now(), finished_at=null,
       score_key=null, summary_key=null, error_code=null, error_message=null
 where status in ('COMPLETED','NEEDS_REVIEW') and candidate_id is not null and file_url is not null;
```

It needs the stored files (so it skips resumes whose file the retention job removed) and covers only resumes uploaded
through the batch pipeline. Candidates created with the older single-resume upload have no queue row; re-upload them.

## Retention and deletion

A job at 03:30 daily (`pipeline.retention.cron`) removes the stored file and extracted text of uploads that never became a
candidate, after 30 days (`PIPELINE_RETENTION_UNUSABLE_DAYS`), and the extracted-text copy of finished tasks after 90
(`PIPELINE_RETENTION_EXTRACTED_TEXT_DAYS`). `0` keeps data. Deleting a candidate or a job removes its resume file,
extracted text, profile, score, summary, queue references and Qdrant vectors.

To delete a person's data on request: delete the candidate in the app (that covers all of the above), then delete matching
rows in `resume_tasks` by `candidate_id` if you also want the queue history gone, and remove them from your backups.

## Scaling and tuning

Change one thing at a time and re-run the benchmark.

| Knob | Default | Notes |
| --- | --- | --- |
| `PIPELINE_WORKER_CONCURRENCY` | 2 | Resumes in flight. Useful up to what Ollama can feed; beyond that it only lengthens the queue. |
| `LLM_CONCURRENCY` | 1 | Simultaneous chat requests per AI-service process. Match it to `OLLAMA_NUM_PARALLEL`. |
| `OLLAMA_NUM_PARALLEL` | 1 | More parallel requests multiply the context memory the model needs. |
| `OLLAMA_KEEP_ALIVE` | 30m | Keeps weights resident between resumes. |
| `LLM_MODEL` | `qwen3:4b` | Choose the smallest model that meets your measured quality bar. |
| Several backend instances | 1 | Safe against one database: claiming uses `FOR UPDATE SKIP LOCKED`. They all still share one model server. |
