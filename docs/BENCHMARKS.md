# Benchmarks

**Nothing here claims 90% accuracy or any guaranteed speed.** The workflow below measures the pipeline on labeled data;
a number is only as good as the data behind it, and the data in this repository is synthetic (see "Data").

## Running it

```bash
cd benchmarks
python generate_dataset.py --count 50  --out data/50  --noise --seed 7     # also 100 and 500
python run_benchmark.py --dataset data/50 --job java-senior \
    --base-url http://localhost:8080 --ai-url http://localhost:8000 \
    --email you@company.com --password '...' --note "qwen3:4b, workers 2"
```

Needs a running stack (see [DEPLOYMENT.md](DEPLOYMENT.md)). The runner creates the job if missing, uploads the whole
dataset as one batch, polls until it ends, and writes `results/<time>_<n>files_<job>.json` and `.md`. Run it for
50, 100 and 500 resumes, for each model you are comparing, and for each of the three jobs (`java-senior`, `data-engineer`,
`frontend`). `python -m pytest test_metrics.py` checks the metric code itself.

## What is measured

| Measure | How |
| --- | --- |
| Total batch time, resumes per minute | Wall clock from upload to the batch ending; throughput from the backend's own counters |
| Median and p95 latency per resume | `startedAt` to `finishedAt` of each completed task (nearest-rank percentiles) |
| Peak RAM, CPU, GPU utilisation and GPU memory | Sampled every 2 s while the batch runs (`psutil`, `nvidia-smi`); also RSS of the watched processes (Ollama, Java, Python, Qdrant) |
| Extraction failures and retry rate | Final counts by status; `attempts` summed over tasks minus one per task |
| Candidate-field accuracy | Name (letters only, case-insensitive) and email exact match against labels |
| Skill extraction precision, recall, F1 | Micro-averaged over resumes after alias normalisation (`Postgres` = `PostgreSQL`). An extracted skill outside the vocabulary counts as a false positive |
| Experience accuracy | Computed total years, and years relevant to the job, within 0.6 years of the labels |
| Ranking quality | NDCG@10 and Precision@10 (relevant = grade 2 or 3) of the candidates ordered by overall score, against labeled graded relevance 0 to 3 |
| Summary factual grounding | **Automatic proxy:** a summary is grounded if every skill it asserts the candidate has (matched list and strengths text) is really on the resume. Catches invented skills, not subtler distortions; it is not a human faithfulness review |
| Outcome accuracy | Whether noise files ended as expected (corrupt/encrypted/wrong-type → `FAILED`, blank scan and missing email → `NEEDS_REVIEW`, exact copy → `DUPLICATE`) |

Extraction accuracy, ranking agreement and summary faithfulness are reported separately and never averaged together.

## Data

`generate_dataset.py` builds **synthetic** resumes (PDF, DOCX, TXT) in several date and alias styles, with a known truth for
each: name, email, skills, employment dates (so total and per-job relevant years), and relevance to each of the three jobs
by a fixed rubric (required skills 60%, preferred 20%, experience 20%). `--noise` adds a corrupt PDF, an encrypted PDF, a
blank scan, a resume with no email, an executable renamed `.pdf`, and an exact duplicate.

What this tells you: the pipeline reads clean, well-formed resumes correctly and handles bad files safely. What it does
not tell you: how it performs on real resumes (tables, columns, creative layouts, other languages, unusual skill names) or
whether its rankings agree with your recruiters. For a number you can stand behind, replace `data/` with resumes you have
**manually verified** (the `labels.json` schema is documented in the generator's header) and keep it out of git; the
benchmark code does not change. The 90% target is met only if the specific metric you chose is at or above it on that data.

## Results

Run on the development laptop (RTX 3050 6 GB, 8 logical CPUs, 23.7 GB RAM, Windows).

**No benchmark figures are published, because no valid run completed.** Reporting a number from the run below would be
inventing one.

What happened: a 16-file smoke run (10 synthetic resumes plus 6 noise files) was started against a live stack with
`mistral:latest` (chat) and `nomic-embed-text` (embeddings, 768-d, in-memory Qdrant), the only models already installed.
Together with Docker Desktop, VS Code's Java language server and a browser, the machine ran out of memory: free RAM fell
under 3 GB, `C:` dropped to 0 GB free as Windows paged, Ollama's embedding runner failed with `std::bad_alloc`, and the Docker
CLI itself crashed. The run was stopped and its numbers discarded. The run was also contaminated: a stale second listener from
an earlier launch was bound to the AI service's port, and 11 files failed with `FILE_NOT_FOUND` that I could not reproduce
(the extractor reads the same stored files correctly when called directly). Treat that as an open question until a clean rerun.

What the partial run did show, with the AI-service log as evidence:

- An encrypted PDF ended as `FAILED` `ENCRYPTED_FILE` after one attempt; a binary file renamed `.pdf` was rejected at upload
  as `INVALID_CONTENT` (never stored); an exact copy was recorded as `DUPLICATE`.
- A real resume went EXTRACT → PERSIST → PROFILE (8 skills from `mistral`), then **its first INDEX attempts failed when the
  embedding runner ran out of memory. The AI service answered `503` `VECTOR_STORE_UNAVAILABLE` and the queue retried**; a later
  attempt upserted its chunks. That is the retry path working on a real outage, not a measurement.

To produce real numbers on this machine: free memory first (close the IDE's Java server and browser, or run on a machine with
more RAM), move the Ollama store off `C:` ([DEPLOYMENT.md](DEPLOYMENT.md)), pull `qwen3:4b` and `bge-m3`, regenerate the
dataset, run each size and each model, and commit the generated `results/*.md`.
