"""Generate a SYNTHETIC, labeled resume set for testing and benchmarking the pipeline.

Every resume is built from known parameters, so its ground truth (name, email, skills, years of experience,
relevance to each job) is known by construction. It is NOT a human-verified or real-world sample: figures measured on it
show the pipeline is correct on clean synthetic text, and say little about real, messy resumes. For a number you can
quote, replace data/labels with resumes you have manually checked (the labels.json schema is the same).

    python generate_dataset.py --count 50 --out data/50 --seed 7
"""

from __future__ import annotations

import argparse
import json
import random
import shutil
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

FIRST = ["Aarav", "Meera", "Isha", "Rohan", "Priya", "Kabir", "Ananya", "Vikram", "Sneha", "Arjun", "Diya", "Rahul", "Neha", "Karan", "Pooja",
         "James", "Emily", "Daniel", "Sofia", "Lucas", "Mia", "Noah", "Olivia", "Ethan", "Ava", "Liam", "Grace", "Mateo", "Chloe", "Omar"]
LAST = ["Iyer", "Mehta", "Kapoor", "Sharma", "Nair", "Reddy", "Gupta", "Bose", "Rao", "Verma", "Walker", "Brooks", "Santos", "Kim", "Novak",
        "Fischer", "Okafor", "Silva", "Haddad", "Larsen", "Moreau", "Tanaka", "Costa", "Ibrahim", "Petrov", "Lindqvist"]
COMPANIES = ["Northwind Labs", "Bluepeak Systems", "Kestrel Software", "Harbor Analytics", "Lumen Works", "Orchard Digital", "Vantage Cloud",
             "Redwood Data", "Paperplane Apps", "Granite Payments", "Sable Logistics", "Meridian Health IT"]
UNIVERSITIES = ["State Institute of Technology", "Metropolitan University", "National College of Engineering", "Lakeside University"]

# Skill aliases as they appear in real resumes (canonical name -> written forms).
ALIASES = {
    "Java": ["Java"], "Spring Boot": ["Spring Boot", "SpringBoot"], "SQL": ["SQL"], "PostgreSQL": ["PostgreSQL", "Postgres"],
    "Kafka": ["Kafka", "Apache Kafka"], "Docker": ["Docker"], "Kubernetes": ["Kubernetes", "k8s"],
    "Python": ["Python"], "Spark": ["Spark", "Apache Spark"], "Airflow": ["Airflow", "Apache Airflow"], "AWS": ["AWS"],
    "JavaScript": ["JavaScript", "JS"], "React": ["React", "React.js"], "CSS": ["CSS"], "TypeScript": ["TypeScript"],
    "Git": ["Git"], "REST": ["REST APIs"], "Jenkins": ["Jenkins"], "Terraform": ["Terraform"], "Linux": ["Linux"], "HTML": ["HTML"],
    "Excel": ["Excel"], "Salesforce": ["Salesforce"], "Photoshop": ["Photoshop"],
}

ARCHETYPES = {
    "java_senior": {"skills": ["Java", "Spring Boot", "SQL", "PostgreSQL", "Kafka", "Docker", "Git", "REST"], "titles": ["Senior Java Developer", "Backend Engineer", "Software Engineer"], "years": (6, 11)},
    "java_junior": {"skills": ["Java", "SQL", "Git", "HTML"], "titles": ["Junior Developer", "Software Engineer"], "years": (1, 3)},
    "java_missing_core": {"skills": ["Java", "Docker", "Kubernetes", "Jenkins", "Linux"], "titles": ["DevOps Engineer", "Backend Developer"], "years": (5, 9)},
    "data_senior": {"skills": ["Python", "SQL", "Spark", "Airflow", "AWS", "PostgreSQL", "Git"], "titles": ["Senior Data Engineer", "Data Engineer"], "years": (5, 10)},
    "data_mid": {"skills": ["Python", "SQL", "AWS", "Git"], "titles": ["Data Analyst", "Analytics Engineer"], "years": (2, 5)},
    "frontend_senior": {"skills": ["JavaScript", "React", "CSS", "TypeScript", "HTML", "Git", "REST"], "titles": ["Senior Frontend Engineer", "Frontend Developer"], "years": (5, 9)},
    "frontend_junior": {"skills": ["JavaScript", "HTML", "CSS", "Git"], "titles": ["Junior Web Developer", "Frontend Developer"], "years": (1, 3)},
    "unrelated": {"skills": ["Excel", "Salesforce", "Photoshop"], "titles": ["Sales Associate", "Marketing Executive", "Account Manager"], "years": (2, 8)},
}

JOBS = [
    {"id": "java-senior", "title": "Senior Java Developer", "description": "Design and build backend services in Java with Spring Boot and SQL databases. Kafka and Docker are a plus.",
     "required": ["Java", "Spring Boot", "SQL"], "preferred": ["Kafka", "Docker"], "min_years": 5, "education": "bachelor"},
    {"id": "data-engineer", "title": "Data Engineer", "description": "Build batch data pipelines with Python, SQL and Spark. Airflow and AWS experience preferred.",
     "required": ["Python", "SQL", "Spark"], "preferred": ["Airflow", "AWS"], "min_years": 3, "education": "bachelor"},
    {"id": "frontend", "title": "Frontend Engineer", "description": "Build user interfaces with JavaScript, React and CSS. TypeScript preferred.",
     "required": ["JavaScript", "React", "CSS"], "preferred": ["TypeScript"], "min_years": 3, "education": "bachelor"},
]

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@dataclass
class Role:
    title: str
    company: str
    start: tuple[int, int]
    end: tuple[int, int] | None  # None = present
    bullets: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)  # canonical skills used in this role (ground truth)


def fmt_date(ym: tuple[int, int] | None, style: int) -> str:
    if ym is None:
        return "Present"
    y, m = ym
    return [f"{MONTHS[m - 1]} {y}", f"{y}-{m:02d}", f"{m:02d}/{y}"][style]


def months_between(role: Role, today: date) -> tuple[int, int]:
    s = role.start[0] * 12 + role.start[1] - 1
    e = (today.year * 12 + today.month - 1) if role.end is None else role.end[0] * 12 + role.end[1] - 1
    return s, e + 1


def merged_years(roles: list[Role], today: date) -> float:
    spans = sorted(months_between(r, today) for r in roles)
    total, cur_s, cur_e = 0, None, None
    for s, e in spans:
        if cur_e is None or s > cur_e:
            if cur_e is not None:
                total += cur_e - cur_s
            cur_s, cur_e = s, e
        else:
            cur_e = max(cur_e, e)
    if cur_e is not None:
        total += cur_e - cur_s
    return round(total / 12, 1)


def written(skill: str, rng: random.Random) -> str:
    return rng.choice(ALIASES[skill])


def relevant_years(roles: list[Role], job: dict, today: date) -> float:
    """Years in roles that used at least one of the job's skills, overlaps merged. Known by construction."""
    wanted = set(job["required"]) | set(job["preferred"])
    return merged_years([r for r in roles if wanted & set(r.skills)], today)


def relevance(skills: set[str], years: float, job: dict) -> int:
    """Graded relevance 0-3 by a fixed rubric (required 60%, preferred 20%, experience 20%). Known by construction."""
    req = sum(s in skills for s in job["required"]) / len(job["required"])
    pref = sum(s in skills for s in job["preferred"]) / max(1, len(job["preferred"]))
    exp = min(1.0, years / job["min_years"]) if job["min_years"] else 1.0
    score = 0.6 * req + 0.2 * pref + 0.2 * exp
    return 3 if score >= 0.85 else 2 if score >= 0.6 else 1 if score >= 0.3 else 0


def build_candidate(index: int, archetype: str, rng: random.Random, today: date) -> dict:
    spec = ARCHETYPES[archetype]
    name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
    slug = name.lower().replace(" ", ".")
    email = f"{slug}{index}@example.com"
    phone = f"+1 {rng.randint(200, 989)} 555 {rng.randint(1000, 9999)}"
    years_target = rng.randint(*spec["years"])

    # Build a dated employment history that adds up to roughly years_target, newest first.
    roles: list[Role] = []
    end: tuple[int, int] | None = None
    cursor = today.year * 12 + today.month - 1
    remaining = years_target * 12
    while remaining > 6:
        span = min(remaining, rng.randint(14, 40))
        start_abs = cursor - span
        start = (start_abs // 12, start_abs % 12 + 1)
        title = rng.choice(spec["titles"])
        picked = rng.sample(spec["skills"], k=min(len(spec["skills"]), rng.randint(2, 4)))
        bullets = [f"Delivered features using {', '.join(written(s, rng) for s in picked)} for a team of {rng.randint(3, 12)} engineers."]
        roles.append(Role(title, rng.choice(COMPANIES), start, end, bullets, picked))
        end = (start_abs // 12, start_abs % 12 + 1)
        cursor = start_abs
        remaining -= span
    true_skills = sorted(set(spec["skills"]))
    years = merged_years(roles, today)
    return {
        "name": name, "email": email, "phone": phone, "archetype": archetype, "roles": roles, "skills": true_skills,
        "years": years, "education": ("master" if rng.random() < 0.25 else "bachelor"), "university": rng.choice(UNIVERSITIES),
        "date_style": rng.randint(0, 2), "relevance": {j["id"]: relevance(set(true_skills), years, j) for j in JOBS},
        "relevant_years": {j["id"]: relevant_years(roles, j, today) for j in JOBS},
    }


def render_text(c: dict, rng: random.Random) -> str:
    style = c["date_style"]
    lines = [c["name"], f"{c['email']} | {c['phone']}", f"linkedin.com/in/{c['name'].lower().replace(' ', '-')}", "", "SUMMARY",
             f"{c['roles'][0].title if c['roles'] else 'Professional'} with {c['years']:.0f}+ years of experience.", "", "SKILLS",
             ", ".join(written(s, rng) for s in c["skills"]), "", "EXPERIENCE"]
    for r in c["roles"]:
        lines.append(f"{r.title}, {r.company}")
        lines.append(f"{fmt_date(r.start, style)} - {fmt_date(r.end, style)}")
        lines.extend(f"- {b}" for b in r.bullets)
        lines.append("")
    degree = "M.Sc. Computer Science" if c["education"] == "master" else "B.Tech Computer Science"
    lines += ["EDUCATION", f"{degree}, {c['university']}"]
    return "\n".join(lines)


def write_pdf(text: str, path: Path) -> None:
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(48, 48, 547, 800), text, fontsize=10, fontname="helv")
    doc.save(str(path))
    doc.close()


def write_docx(text: str, path: Path) -> None:
    import docx

    d = docx.Document()
    for line in text.splitlines():
        d.add_paragraph(line)
    d.save(str(path))


def make_noise(out: Path, labels: dict, rng: random.Random) -> None:
    """Files a real bulk upload contains: a corrupt PDF, an encrypted PDF, a blank scan, a resume with no email, an exact copy."""
    import pymupdf

    (out / "noise_corrupt.pdf").write_bytes(b"%PDF-1.7\nthis is not a real pdf at all")
    labels["noise_corrupt.pdf"] = {"expected": "FAILED", "reason": "CORRUPT_FILE"}

    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "Locked resume Jane Locked jane.locked@example.com " * 8)
    doc.save(str(out / "noise_encrypted.pdf"), encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="x", owner_pw="y")
    doc.close()
    labels["noise_encrypted.pdf"] = {"expected": "FAILED", "reason": "ENCRYPTED_FILE"}

    blank = pymupdf.open()
    blank.new_page()
    blank.save(str(out / "noise_blank_scan.pdf"))
    blank.close()
    labels["noise_blank_scan.pdf"] = {"expected": "NEEDS_REVIEW", "reason": "SCANNED_PDF"}

    (out / "noise_no_email.txt").write_text("Casey Noemail\nSenior Java Developer\nSkills: Java, Spring Boot, SQL\n" + "Worked on services. " * 30, encoding="utf-8")
    labels["noise_no_email.txt"] = {"expected": "NEEDS_REVIEW", "reason": "NO_EMAIL"}

    (out / "noise_wrong_type.pdf").write_bytes(b"MZ\x90\x00this is an executable pretending to be a pdf")
    labels["noise_wrong_type.pdf"] = {"expected": "FAILED", "reason": "INVALID_CONTENT"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=50, help="number of real resumes (noise files are added on top)")
    parser.add_argument("--out", default="data/50")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--noise", action="store_true", help="also write corrupt/encrypted/blank/no-email/duplicate files")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    today = date(2026, 10, 1)  # fixed so experience labels do not drift
    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    mix = ["java_senior"] * 3 + ["java_junior", "java_missing_core"] * 2 + ["data_senior"] * 2 + ["data_mid"] + ["frontend_senior"] * 2 + ["frontend_junior"] + ["unrelated"]
    labels: dict[str, dict] = {}
    first_pdf = None
    for i in range(args.count):
        archetype = mix[i % len(mix)]
        cand = build_candidate(i, archetype, rng, today)
        text = render_text(cand, rng)
        kind = ["pdf", "pdf", "docx", "txt"][i % 4]
        name = f"resume_{i:04d}.{kind}"
        path = out / name
        {"pdf": write_pdf, "docx": write_docx, "txt": lambda t, p: p.write_text(t, encoding="utf-8")}[kind](text, path)
        if kind == "pdf" and first_pdf is None:
            first_pdf = path
        labels[name] = {
            "expected": "COMPLETED", "name": cand["name"], "email": cand["email"], "skills": cand["skills"], "years": cand["years"],
            "education": cand["education"], "archetype": archetype, "relevance": cand["relevance"],
            "relevant_years": cand["relevant_years"],
        }
    if args.noise:
        make_noise(out, labels, rng)
        if first_pdf is not None:
            shutil.copyfile(first_pdf, out / "resume_dup_of_first.pdf")
            labels["resume_dup_of_first.pdf"] = {"expected": "DUPLICATE", "reason": "DUPLICATE_FILE"}

    (out / "labels.json").write_text(json.dumps({"synthetic": True, "note": "Labels are known by construction, not human-verified.", "jobs": JOBS, "files": labels}, indent=2))
    print(f"Wrote {len(labels)} files to {out} (synthetic; labels.json holds the ground truth)")


if __name__ == "__main__":
    main()
