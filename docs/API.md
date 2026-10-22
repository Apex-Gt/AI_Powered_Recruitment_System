# Batch API

All routes are under the backend's `/api` context path, need a logged-in recruiter or admin (the `access_token`
cookie, or `Authorization: Bearer`), and answer with the usual envelope:
`{ "code": 202, "status": "SUCCESS", "data": ..., "message": "...", "timestamp": "..." }`.

Access control: the job must belong to your company, and a recruiter sees only the jobs they created (admins see the
company's). A batch of another company or another recruiter's job answers `404`, the same as a batch that does not exist.

```bash
# log in once, keep the cookie
curl -c jar.txt -H 'Content-Type: application/json' \
  -d '{"email":"recruiter@acme.com","password":"..."}' http://localhost:8080/api/auth/login
```

## Create a batch

`POST /recruiter/batches` (multipart). Returns `202` as soon as the files are stored and queued, whatever the size.

| Field | Notes |
| --- | --- |
| `jobId` | The job the resumes apply to. |
| `files` | Repeat the field once per resume. PDF, DOCX or TXT, up to 10 MB each, up to 500 files and 600 MB per batch. |

```bash
curl -b jar.txt -X POST http://localhost:8080/api/recruiter/batches \
  -F jobId=6fe910d2-12b0-480e-a6e0-c8a318a9a960 \
  -F files=@resumes/a.pdf -F files=@resumes/b.docx -F files=@resumes/c.txt
```

```json
{ "code": 202, "status": "SUCCESS", "message": "Batch accepted. Resumes are being processed in the background; poll the batch for progress.",
  "data": { "id": "0e70d821-b82c-4a91-97b4-95ef4984e8d9", "jobId": "6fe9...", "status": "QUEUED", "totalFiles": 3, "percentComplete": 0,
            "counts": { "QUEUED": 3, "PROCESSING": 0, "COMPLETED": 0, "FAILED": 0, "NEEDS_REVIEW": 0, "DUPLICATE": 0, "UPLOADED": 0 } } }
```

Problems with one file never reject the batch. That file gets its own row: `FAILED` (`UNSUPPORTED_TYPE`, `INVALID_CONTENT`,
`EMPTY_FILE`, `FILE_TOO_LARGE`) or `DUPLICATE` (`DUPLICATE_FILE`). Request-level problems answer `400`: no files, more than
500, or more than 600 MB in total. `404` for a job you cannot access.

## Batch progress

`GET /recruiter/batches/{batchId}`

```json
{ "data": { "id": "0e70...", "status": "PROCESSING", "totalFiles": 120, "percentComplete": 31,
            "counts": { "COMPLETED": 36, "PROCESSING": 2, "QUEUED": 80, "FAILED": 1, "NEEDS_REVIEW": 1, "DUPLICATE": 0, "UPLOADED": 0 },
            "createdAt": "2026-10-20T10:00:00", "completedAt": null, "elapsedSeconds": 412.3,
            "resumesPerMinute": 5.8, "medianSecondsPerResume": 19.4, "p95SecondsPerResume": 41.0, "estimatedSecondsRemaining": 870 } }
```

`status` is `UPLOADED`, `QUEUED`, `PROCESSING`, `COMPLETED`, `PARTIAL` or `FAILED`. Poll every few seconds until it is
`COMPLETED`, `PARTIAL` or `FAILED`. The timing figures are measured from this batch's own tasks.

## Resumes in a batch

`GET /recruiter/batches/{batchId}/tasks?status=FAILED&page=0&size=50` (size up to 200)

```json
{ "data": { "items": [
    { "id": "c4a1...", "fileName": "cv.pdf", "status": "FAILED", "stage": "PROFILE", "attempts": 8,
      "errorCode": "LLM_UNAVAILABLE", "errorMessage": "Gave up after 8 attempts: The language model is unavailable: ...",
      "needsReview": false, "warnings": [], "candidateId": "9d2e...", "createdAt": "...", "finishedAt": "..." } ],
  "page": 0, "totalPages": 1, "totalItems": 1 } }
```

`stage` is the stage the resume is at or stopped at: `EXTRACT`, `PERSIST`, `PROFILE`, `INDEX`, `SCORE`, `SUMMARY`, `DONE`.
`status` filter: `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `NEEDS_REVIEW`, `DUPLICATE`.

Error codes: `ENCRYPTED_FILE`, `CORRUPT_FILE`, `UNSUPPORTED_TYPE`, `INVALID_CONTENT`, `EMPTY_FILE`, `FILE_TOO_LARGE`, `NO_EMAIL`,
`SCANNED_PDF`, `NO_TEXT`, `DUPLICATE_FILE`, `DUPLICATE_APPLICANT` (permanent or needs review);
`LLM_UNAVAILABLE`, `LLM_BAD_OUTPUT`, `EMBEDDING_UNAVAILABLE`, `VECTOR_STORE_UNAVAILABLE`, `MODEL_UNAVAILABLE`, `NOT_INDEXED`,
`AI_SERVICE_UNAVAILABLE`, `AI_SERVICE_AUTH`, `WORKER_LOST`, `INTERNAL_ERROR` (transient: retried, then `FAILED` if it persists).

## Completed analyses

`GET /recruiter/batches/{batchId}/results` returns the candidates this batch produced, **best match first**
(`COMPLETED` and `NEEDS_REVIEW` resumes that have a candidate).

```json
{ "data": [ {
    "taskId": "c4a1...", "candidateId": "9d2e...", "candidateName": "Meera Iyer", "candidateEmail": "meera@example.com", "status": "COMPLETED",
    "overallScore": 87.4, "skillMatchScore": 100, "experienceMatchScore": 100, "educationMatchScore": 100, "semanticMatchScore": 62.1,
    "meetsMandatory": true, "mandatoryMissing": [],
    "matchedSkills": ["java", "spring boot", "sql", "kafka"], "missingSkills": ["docker"],
    "skillEvidence": { "java": "...led a payments migration in Java for a team of 6 engineers..." },
    "totalExperienceYears": 8.1, "relevantExperienceYears": 8.1, "scoreWarnings": [],
    "extractedName": "Meera Iyer", "extractedSkills": ["Java", "Spring Boot", "SQL", "Kafka"], "statedExperienceYears": 8.0,
    "summary": "Strong alignment: ...", "strengths": ["..."], "warnings": [] } ] }
```

A candidate's score and summary are also stored with the candidate and appear in the existing candidate endpoints and pages.

## Retry

| Route | Effect |
| --- | --- |
| `POST /recruiter/batches/{batchId}/retry` | Re-queues every `FAILED` resume at the stage it stopped. Resumes whose file was rejected before storage, and files re-uploaded since, are skipped. `{ "requeued": 3 }`. |
| `POST /recruiter/batches/{batchId}/tasks/{taskId}/retry` | The same for one resume. `409` if it is not a retryable failed resume. |

## Recent batches of a job

`GET /recruiter/batches?jobId={jobId}` returns the last 20 batches with the same shape as batch progress. The job page
uses it to show batches still running after the upload dialog is closed.

## Internal AI-service endpoints

Called by the backend, not by browsers; not published by the Compose stack. Each is one synchronous stage and sends
`X-API-Key: $PIPELINE_API_KEY` (401 without it when a key is configured).

| Route | Body | Answers |
| --- | --- | --- |
| `POST /api/v1/pipeline/extract` | `{ "filePath", "fileName" }` | text, `textHash`, `contact`, `warnings`, `needsReview` |
| `POST /api/v1/pipeline/profile` | `{ "filePath", "fileName" }` | grounded `profile`, `inputHash`, `model`, `warnings` |
| `POST /api/v1/pipeline/index` | `{ "candidateId", "resumeId", "jobId", "filePath" }` | `chunksStored` |
| `POST /api/v1/pipeline/score` | `{ "candidateId", "filePath", "job", "profile" }` | `matchScore`, `inputHash` |
| `POST /api/v1/pipeline/summary` | `{ "candidateId", "filePath", "job", "profile", "matchScore" }` | `ragSummary`, `inputHash` |

Errors: `422` = the document is the problem (`retryable: false`; `needsReview: true` for scans and the like),
`503` = a dependency is (`retryable: true`). Body: `{ "code", "message", "retryable", "needsReview", "details" }`.
`GET /health/live` is a cheap liveness check; `GET /health` checks Qdrant, the embedding model and the reranker.
