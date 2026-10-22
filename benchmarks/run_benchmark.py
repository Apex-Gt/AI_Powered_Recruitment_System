"""Run a labeled dataset through a live backend and measure throughput, resource use and accuracy.

    python generate_dataset.py --count 50 --out data/50 --noise
    python run_benchmark.py --dataset data/50 --job java-senior --email you@company.com --password ... \
        --base-url http://localhost:8080 --note "qwen3:4b, concurrency 2"

It needs a running stack (backend, AI service, Ollama, Qdrant, Postgres) and a recruiter/admin login. It writes
results/<timestamp>_<n>files_<job>.json and .md. Nothing here is estimated: every number is measured from the run, and
the report states the environment, the models and the dataset kind (synthetic or not) next to the figures.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import platform
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
import psutil

from metrics import (
    canonical_skill,
    normalize_name,
    ndcg_at_k,
    percentile,
    precision_at_k,
    precision_recall_f1,
    summary_is_grounded,
    within,
)

TERMINAL = {"COMPLETED", "PARTIAL", "FAILED"}
WATCHED = ("ollama", "llama-server", "java", "python", "qdrant")


class ResourceSampler(threading.Thread):
    """Samples RAM, CPU and GPU every couple of seconds and keeps the peaks."""

    def __init__(self, interval: float = 2.0):
        super().__init__(daemon=True)
        self.interval = interval
        self._stop = threading.Event()
        self.peak_ram_gb = 0.0
        self.peak_cpu_pct = 0.0
        self.peak_gpu_util_pct: Optional[float] = None
        self.peak_gpu_mem_mb: Optional[float] = None
        self.peak_watched_rss_gb = 0.0
        self.samples = 0

    def run(self) -> None:
        psutil.cpu_percent(None)
        while not self._stop.is_set():
            vm = psutil.virtual_memory()
            self.peak_ram_gb = max(self.peak_ram_gb, (vm.total - vm.available) / 1e9)
            self.peak_cpu_pct = max(self.peak_cpu_pct, psutil.cpu_percent(None))
            rss = 0
            for proc in psutil.process_iter(["name", "memory_info"]):
                try:
                    if any(w in (proc.info["name"] or "").lower() for w in WATCHED):
                        rss += proc.info["memory_info"].rss
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            self.peak_watched_rss_gb = max(self.peak_watched_rss_gb, rss / 1e9)
            gpu = _gpu()
            if gpu:
                self.peak_gpu_util_pct = max(self.peak_gpu_util_pct or 0, gpu[0])
                self.peak_gpu_mem_mb = max(self.peak_gpu_mem_mb or 0, gpu[1])
            self.samples += 1
            self._stop.wait(self.interval)

    def stop(self) -> None:
        self._stop.set()
        self.join(timeout=5)


def _gpu() -> Optional[tuple[float, float]]:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip().splitlines()[0]
        util, mem = (float(x) for x in out.split(","))
        return util, mem
    except Exception:  # noqa: BLE001 - no NVIDIA GPU / driver: just no GPU numbers
        return None


def environment(ai_url: Optional[str]) -> dict:
    gpu_name = None
    try:
        gpu_name = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"], capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:  # noqa: BLE001
        pass
    env = {
        "platform": platform.platform(), "cpu_logical": psutil.cpu_count(), "ram_gb": round(psutil.virtual_memory().total / 1e9, 1),
        "gpu": gpu_name or "none detected",
    }
    if ai_url:
        try:
            env["ai_service"] = httpx.get(f"{ai_url}/health", timeout=10).json().get("model_config", {})
        except Exception as e:  # noqa: BLE001
            env["ai_service"] = f"unreachable: {e}"
    return env


class Api:
    def __init__(self, base_url: str):
        self.base = base_url.rstrip("/")
        self.client = httpx.Client(timeout=httpx.Timeout(300, connect=15))

    def login(self, email: str, password: str) -> None:
        r = self.client.post(f"{self.base}/api/auth/login", json={"email": email, "password": password})
        r.raise_for_status()

    def data(self, response: httpx.Response):
        response.raise_for_status()
        return response.json().get("data")

    def ensure_job(self, job: dict) -> str:
        listing = self.data(self.client.get(f"{self.base}/api/job/my-jobs", params={"page": 1, "pageSize": 100}))
        items = listing.get("data", listing) if isinstance(listing, dict) else listing
        for existing in items or []:
            if existing.get("title") == job["title"]:
                return existing["id"]
        skills = [{"skillName": s, "type": "REQUIRED", "weight": 30} for s in job["required"]]
        skills += [{"skillName": s, "type": "PREFERRED", "weight": 10} for s in job["preferred"]]
        payload = {
            "title": job["title"], "department": "Engineering", "employmentType": "FULL_TIME", "workMode": "HYBRID", "location": "Bangalore",
            "experienceRequired": job["min_years"], "educationRequired": "B.Tech", "minimumSalary": 1000000, "maximumSalary": 2000000,
            "description": job["description"], "applicationDeadline": "2027-12-31", "vacancies": 3, "skills": skills,
        }
        return self.data(self.client.post(f"{self.base}/api/job", json=payload))["id"]

    def upload(self, job_id: str, files: list[Path]) -> dict:
        parts = [("files", (f.name, f.read_bytes(), mimetypes.guess_type(f.name)[0] or "application/octet-stream")) for f in files]
        return self.data(self.client.post(f"{self.base}/api/recruiter/batches", data={"jobId": job_id}, files=parts))

    def batch(self, batch_id: str) -> dict:
        return self.data(self.client.get(f"{self.base}/api/recruiter/batches/{batch_id}"))

    def tasks(self, batch_id: str) -> list[dict]:
        items, page = [], 0
        while True:
            data = self.data(self.client.get(f"{self.base}/api/recruiter/batches/{batch_id}/tasks", params={"page": page, "size": 200}))
            items += data["items"]
            page += 1
            if page >= data["totalPages"]:
                return items

    def results(self, batch_id: str) -> list[dict]:
        return self.data(self.client.get(f"{self.base}/api/recruiter/batches/{batch_id}/results"))


def evaluate(labels: dict, job: dict, tasks: list[dict], results: list[dict]) -> dict:
    files = labels["files"]
    by_candidate = {r["candidateId"]: r for r in results}
    out: dict = {}

    # Final status of every file against what it should have become.
    status_hits, status_rows = 0, []
    for task in tasks:
        want = files.get(task["fileName"], {}).get("expected")
        if want is None:
            continue
        ok = task["status"] == want or (want == "COMPLETED" and task["status"] == "NEEDS_REVIEW")  # review is a correct, conservative outcome
        status_hits += ok
        if not ok:
            status_rows.append({"file": task["fileName"], "expected": want, "actual": task["status"], "code": task.get("errorCode")})
    judged = [t for t in tasks if t["fileName"] in files]
    out["outcome_accuracy"] = {"correct": status_hits, "total": len(judged), "rate": round(status_hits / len(judged), 4) if judged else None, "misses": status_rows}

    completed = [(t, files[t["fileName"]], by_candidate.get(t.get("candidateId"))) for t in tasks if t["fileName"] in files
                 and files[t["fileName"]].get("expected") == "COMPLETED" and by_candidate.get(t.get("candidateId"))]
    if not completed:
        return out

    out["candidate_fields"] = {
        "name_accuracy": round(sum(normalize_name(r.get("extractedName")) == normalize_name(l["name"]) for _, l, r in completed) / len(completed), 4),
        "email_accuracy": round(sum((r.get("candidateEmail") or "").lower() == l["email"] for _, l, r in completed) / len(completed), 4),
        "n": len(completed),
    }
    out["skill_extraction"] = precision_recall_f1(
        [{canonical_skill(s) for s in r.get("extractedSkills", [])} for _, _, r in completed], [set(l["skills"]) for _, l, _ in completed]
    )
    total_ok = [within(r.get("totalExperienceYears"), l["years"], 0.6) for _, l, r in completed]
    rel_ok = [within(r.get("relevantExperienceYears"), l["relevant_years"][job["id"]], 0.6) for _, l, r in completed if r.get("relevantExperienceYears") is not None]
    out["experience"] = {
        "total_years_within_0.6": round(sum(total_ok) / len(total_ok), 4),
        "relevant_years_within_0.6": round(sum(rel_ok) / len(rel_ok), 4) if rel_ok else None,
        "relevant_years_scored": len(rel_ok),
    }

    ranked = sorted(completed, key=lambda row: row[2].get("overallScore") or -1, reverse=True)
    grades = [row[1]["relevance"][job["id"]] for row in ranked]
    out["ranking"] = {"ndcg_at_10": ndcg_at_k(grades, 10), "precision_at_10": precision_at_k(grades, 10, threshold=2), "ranked": len(ranked)}

    summaries = [(l, r) for _, l, r in completed if r.get("summary")]
    if summaries:
        grounded = [summary_is_grounded(" ".join([r["summary"]] + list(r.get("strengths", []))), r.get("matchedSkills", []), set(l["skills"])) for l, r in summaries]
        out["summary_grounding"] = {"grounded": sum(grounded), "total": len(grounded), "rate": round(sum(grounded) / len(grounded), 4),
                                    "method": "automatic proxy: no asserted skill absent from the resume (not a human faithfulness review)"}
    out["summaries_generated"] = {"with_summary": len(summaries), "completed": len(completed)}
    return out


def markdown(report: dict) -> str:
    t, ev = report["timing"], report["evaluation"]
    lines = [
        f"# Benchmark: {report['files']} files, job `{report['job']}`", "",
        f"- Run: {report['started']}  |  dataset: {report['dataset']} ({'SYNTHETIC, labels known by construction' if report['synthetic'] else 'non-synthetic'})",
        f"- Note: {report.get('note') or '-'}", f"- Environment: {json.dumps(report['environment'])}", "",
        "## Throughput", "",
        f"- Batch wall time: **{t['wall_seconds']:.0f} s**; resumes per minute: **{t['resumes_per_minute']}**",
        f"- Per-resume latency (completed): median **{t['median_seconds']}** s, p95 **{t['p95_seconds']}** s",
        f"- Final states: {json.dumps(report['final_counts'])}", f"- Attempts: {t['total_attempts']} for {t['tasks']} resumes ({t['retries']} retries)", "",
        "## Resources (peak while the batch ran)", "",
        f"- System RAM in use: {report['resources']['peak_ram_gb']:.1f} GB; watched processes RSS: {report['resources']['peak_watched_rss_gb']:.1f} GB",
        f"- CPU: {report['resources']['peak_cpu_pct']:.0f}%; GPU util: {report['resources']['peak_gpu_util_pct']}%; GPU memory: {report['resources']['peak_gpu_mem_mb']} MB", "",
        "## Accuracy", "", "```json", json.dumps(ev, indent=2), "```", "",
        "These figures describe this dataset and run only. The 90% target is met only if the specific metric you chose is at or above it here "
        "on non-synthetic, human-verified data.",
    ]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--job", default="java-senior", help="job id from labels.json")
    ap.add_argument("--base-url", default="http://localhost:8080")
    ap.add_argument("--ai-url", default=None, help="AI service URL, only to record model names in the report")
    ap.add_argument("--email", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--note", default="")
    ap.add_argument("--poll", type=float, default=3.0)
    ap.add_argument("--timeout-minutes", type=float, default=180)
    args = ap.parse_args()

    dataset = Path(args.dataset)
    labels = json.loads((dataset / "labels.json").read_text())
    job = next(j for j in labels["jobs"] if j["id"] == args.job)
    files = sorted(p for p in dataset.iterdir() if p.name != "labels.json")

    api = Api(args.base_url)
    api.login(args.email, args.password)
    job_id = api.ensure_job(job)

    sampler = ResourceSampler()
    sampler.start()
    started = datetime.now()
    t0 = time.monotonic()
    batch = api.upload(job_id, files)
    upload_seconds = time.monotonic() - t0
    print(f"Uploaded {len(files)} files in {upload_seconds:.1f}s -> batch {batch['id']} ({batch['status']})")

    deadline = t0 + args.timeout_minutes * 60
    while True:
        batch = api.batch(batch["id"])
        counts = {k: v for k, v in batch["counts"].items() if v}
        print(f"  {batch['status']:<10} {batch['percentComplete']:>3}%  {counts}")
        if batch["status"] in TERMINAL:
            break
        if time.monotonic() > deadline:
            print("Timed out waiting for the batch")
            break
        time.sleep(args.poll)
    wall = time.monotonic() - t0
    sampler.stop()

    tasks, results = api.tasks(batch["id"]), api.results(batch["id"])
    attempts = sum(t["attempts"] for t in tasks)
    report = {
        "started": started.isoformat(timespec="seconds"), "dataset": str(dataset), "synthetic": labels.get("synthetic", False), "files": len(files),
        "job": args.job, "note": args.note, "environment": environment(args.ai_url), "upload_seconds": round(upload_seconds, 2),
        "final_counts": {k: v for k, v in batch["counts"].items() if v},
        "timing": {
            "wall_seconds": wall, "resumes_per_minute": batch.get("resumesPerMinute"), "median_seconds": batch.get("medianSecondsPerResume"),
            "p95_seconds": batch.get("p95SecondsPerResume"), "tasks": len(tasks), "total_attempts": attempts, "retries": max(0, attempts - len(tasks)),
        },
        "resources": {
            "peak_ram_gb": sampler.peak_ram_gb, "peak_watched_rss_gb": sampler.peak_watched_rss_gb, "peak_cpu_pct": sampler.peak_cpu_pct,
            "peak_gpu_util_pct": sampler.peak_gpu_util_pct, "peak_gpu_mem_mb": sampler.peak_gpu_mem_mb, "samples": sampler.samples,
        },
        "evaluation": evaluate(labels, job, tasks, results),
    }
    out_dir = Path(__file__).parent / "results"
    out_dir.mkdir(exist_ok=True)
    stem = f"{started:%Y%m%d-%H%M%S}_{len(files)}files_{args.job}"
    (out_dir / f"{stem}.json").write_text(json.dumps(report, indent=2))
    (out_dir / f"{stem}.md").write_text(markdown(report))
    print(f"\nWrote results/{stem}.json and .md")
    print(markdown(report))


if __name__ == "__main__":
    main()
