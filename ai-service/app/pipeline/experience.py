"""Employment-date arithmetic.

The LLM reads the roles out of the resume (title, company, start, end, description); the years are computed
here from the dates, merging overlapping roles so two jobs held at once are not counted twice.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Iterable, Optional

from app.models.schemas import CandidateProfile, JobDescription, WorkExperience

_MONTHS = {
    m: i
    for i, names in enumerate(
        [
            ("jan", "january"), ("feb", "february"), ("mar", "march"), ("apr", "april"), ("may",), ("jun", "june"),
            ("jul", "july"), ("aug", "august"), ("sep", "sept", "september"), ("oct", "october"),
            ("nov", "november"), ("dec", "december"),
        ],
        start=1,
    )
    for m in names
}
_PRESENT = {"present", "current", "now", "ongoing", "till date", "to date", "today"}
_YEAR_MONTH = re.compile(r"^(?P<y>\d{4})[-/.](?P<m>\d{1,2})$")
_MONTH_YEAR = re.compile(r"^(?P<m>\d{1,2})[-/.](?P<y>\d{4})$")
_NAME_YEAR = re.compile(r"^(?P<mon>[a-z]+)\.?,?\s+(?P<y>\d{4})$")
_YEAR = re.compile(r"^(?P<y>\d{4})$")


def parse_month(value: Optional[str], *, end: bool = False, today: Optional[date] = None) -> Optional[int]:
    """Parse a resume date into a month index (year*12 + month-1). ``None`` when it cannot be read."""
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None
    today = today or date.today()
    if text in _PRESENT:
        return today.year * 12 + today.month - 1

    year = month = None
    if match := _YEAR_MONTH.match(text):
        year, month = int(match["y"]), int(match["m"])
    elif match := _MONTH_YEAR.match(text):
        year, month = int(match["y"]), int(match["m"])
    elif match := _NAME_YEAR.match(text):
        month, year = _MONTHS.get(match["mon"]), int(match["y"])
    elif match := _YEAR.match(text):
        year = int(match["y"])
        month = 12 if end else 1  # a bare year spans the whole year when it is an end date
    if year is None or month is None or not (1 <= month <= 12) or not (1950 <= year <= today.year + 1):
        return None
    return year * 12 + month - 1


def role_span(role: WorkExperience, today: Optional[date] = None) -> Optional[tuple[int, int]]:
    start = parse_month(role.start_date, today=today)
    if start is None:
        return None
    end = parse_month(role.end_date, end=True, today=today) if role.end_date else parse_month("present", today=today)
    if end is None:
        end = parse_month("present", today=today)
    if end is None or end < start:
        return None
    return start, end + 1  # inclusive months


def merged_months(spans: Iterable[tuple[int, int]]) -> int:
    total = 0
    cur_start = cur_end = None
    for start, end in sorted(spans):
        if cur_end is None or start > cur_end:
            if cur_end is not None:
                total += cur_end - cur_start
            cur_start, cur_end = start, end
        else:
            cur_end = max(cur_end, end)
    if cur_end is not None:
        total += cur_end - cur_start
    return total


def total_experience_years(profile: CandidateProfile, today: Optional[date] = None) -> Optional[float]:
    """Years of employment from dated roles (overlaps merged); ``None`` if no role has a readable start date."""
    spans = [s for r in profile.experience if (s := role_span(r, today))]
    if not spans:
        return None
    return round(merged_months(spans) / 12, 1)


def _tokens(*values: Optional[str]) -> set[str]:
    return {t for v in values if v for t in re.findall(r"[a-z0-9+#.]{2,}", v.lower())}


def relevant_experience_years(
    profile: CandidateProfile,
    job: JobDescription,
    normalize,
    today: Optional[date] = None,
) -> Optional[float]:
    """Years in roles that mention a job skill or share a meaningful word with the job title.

    Returns ``None`` when no dated roles exist, so the scorer can fall back to the declared total and warn.
    """
    skills = {normalize(r.skill) for r in job.requirements} | {normalize(s) for s in job.required_skills + job.preferred_skills}
    skills.discard("")
    title_words = {w for w in _tokens(job.title) if len(w) > 3 and w not in {"senior", "junior", "lead", "staff", "engineer", "developer"}}

    relevant: list[tuple[int, int]] = []
    dated = 0
    for role in profile.experience:
        span = role_span(role, today)
        if not span:
            continue
        dated += 1
        blob = f"{role.title} {role.company or ''} {role.description or ''}".lower()
        if any(skill and re.search(rf"(?<![a-z0-9]){re.escape(skill)}(?![a-z0-9])", blob) for skill in skills) or (
            title_words and title_words & _tokens(role.title)
        ):
            relevant.append(span)
    if not dated:
        return None
    return round(merged_months(relevant) / 12, 1)
