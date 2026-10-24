"""Evidence behind a candidate/job explanation: what the resume shows for each job requirement, and where.

Everything here is deterministic. A requirement is *demonstrated* only when the resume describes using the skill in a
project, job, internship or certification; *partial* when it is only listed, only named by a related term, or only
seen in coursework; *not evidenced* when the resume never mentions it (which is not the same as the candidate being
unable to do it). Quotes are copied from the resume text, never paraphrased, and each skill is attributed to the
entry whose own text contains it.

``verify_narrative`` checks a written explanation against these facts before it is shown.
"""

import re
from dataclasses import dataclass, field
from typing import Optional

from app.models.schemas import (
    CandidateProfile,
    EducationLevel,
    EvidenceRef,
    JobDescription,
    JobRequirement,
    MatchScore,
    RequirementAssessment,
    ResumeChunk,
)
from app.services.scoring import _skill_forms, _skill_patterns, mentions_skill, normalize_skill

_HEADING = re.compile(
    r"^[ \t]*(?:education|academics?|skills?|technical skills?|core competencies|projects?|academic projects?|personal projects?|"
    r"experience|work experience|professional experience|employment|internships?|certifications?|achievements?|awards?|"
    r"summary|profile|objective|languages|interests|publications|references)\b[^\n]{0,30}$",
    re.IGNORECASE | re.MULTILINE,
)
_SKILLS_HEADING = re.compile(r"^[ \t]*(?:technical skills?|core competencies|skills?)\b[^\n]{0,30}$", re.IGNORECASE | re.MULTILINE)
_INTERN = re.compile(r"\bintern(?:ship)?\b", re.IGNORECASE)
_LEVEL_ORDER = {
    EducationLevel.HIGH_SCHOOL: 1,
    EducationLevel.ASSOCIATE: 2,
    EducationLevel.BACHELOR: 3,
    EducationLevel.MASTER: 4,
    EducationLevel.PHD: 5,
    EducationLevel.OTHER: 0,
}
_STOPWORDS = {
    "with", "that", "this", "from", "have", "will", "your", "their", "and", "the", "for", "are", "our", "you", "who",
    "work", "working", "team", "teams", "using", "use", "strong", "ability", "experience", "knowledge", "skills",
    "years", "must", "should", "other", "such", "including", "across", "within", "into", "able", "good",
}

CONTEXT_KINDS = ("professional experience", "internship", "project", "certification")


@dataclass
class Entry:
    """One place in the resume that can hold evidence: a job, an internship, a project, a degree or the skills list."""

    kind: str
    label: str
    text: str  # verbatim resume text of this entry when it could be located, else the parsed fields
    located: bool = False
    supported: set[str] = field(default_factory=set)  # normalised vocabulary skills this entry's own text mentions


@dataclass
class Analysis:
    assessments: list[RequirementAssessment]
    entries: list[Entry]
    vocabulary: list[str]
    demonstrated: list[str]
    partial: list[str]
    not_evidenced: list[str]
    limitations: list[str]
    years: Optional[float]


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _find_label(lowered: str, label: str) -> int:
    label = _clean(label).lower()
    if len(label) < 3:
        return -1
    match = re.search(rf"(?<![a-z0-9]){re.escape(label)}(?![a-z0-9])", lowered)
    return match.start() if match else -1


def build_entries(profile: CandidateProfile, resume_text: str) -> list[Entry]:
    """Parsed jobs, projects, certifications, degrees and the skills list, each with its own stretch of resume text."""
    text = resume_text or ""
    lowered = text.lower()
    headings = sorted(m.start() for m in _HEADING.finditer(text))

    raw: list[tuple[str, str, str, int]] = []  # kind, label, fallback text, position of its label in the resume (-1 = unknown)
    for job in profile.experience:
        kind = "internship" if _INTERN.search(f"{job.title} {job.company or ''}") else "professional experience"
        label = f"{job.title} at {job.company}" if job.company else job.title
        pos = max(_find_label(lowered, job.company or ""), -1) if job.company else -1
        if pos < 0:
            pos = _find_label(lowered, job.title)
        raw.append((kind, label, " ".join(filter(None, [job.title, job.company, job.description])), pos))
    for project in profile.projects:
        fallback = " ".join(filter(None, [project.name, project.description, ", ".join(project.technologies)]))
        raw.append(("project", project.name, fallback, _find_label(lowered, project.name)))
    for cert in profile.certifications:
        raw.append(("certification", cert.name, " ".join(filter(None, [cert.name, cert.issuer])), _find_label(lowered, cert.name)))
    for edu in profile.education:
        label = " ".join(filter(None, [edu.degree, edu.field_of_study, edu.institution]))
        raw.append(("education", label, label, _find_label(lowered, edu.institution)))

    located = sorted((pos, i) for i, (_, _, _, pos) in enumerate(raw) if pos >= 0)
    spans: dict[int, tuple[int, int]] = {}
    for n, (pos, i) in enumerate(located):
        following = [p for p, _ in located[n + 1 :] if p > pos] + [h for h in headings if h > pos]
        spans[i] = (pos, min(following) if following else len(text))

    entries: list[Entry] = []
    for i, (kind, label, fallback, _) in enumerate(raw):
        if i in spans:
            start, end = spans[i]
            entries.append(Entry(kind, label, text[start:end], located=True))
        else:
            entries.append(Entry(kind, label, fallback))

    skills_span = None
    for m in _SKILLS_HEADING.finditer(text):
        after = [h for h in headings if h > m.start()]
        skills_span = text[m.start() : (after[0] if after else len(text))]
        break
    if skills_span is not None:
        entries.append(Entry("listed skills", "Skills section", skills_span, located=True))
    elif profile.skills:
        entries.append(Entry("listed skills", "Skills section", ", ".join(s.name for s in profile.skills)))
    return entries


def _snippet(text: str, match: re.Match, width: int = 110) -> str:
    start = max(0, match.start() - width)
    end = min(len(text), match.end() + width)
    return _clean(text[start:end])


def _chunk_for(quote: str, chunks: list[ResumeChunk]) -> tuple[Optional[str], Optional[str]]:
    """The stored chunk (id, section) that contains this quote, so the reference points at a retrievable record."""
    needle = _clean(quote).lower()
    core = needle[len(needle) // 4 : -(len(needle) // 4) or None] if len(needle) > 40 else needle
    for chunk in chunks:
        if core and core in _clean(chunk.text).lower():
            return chunk.chunk_id, chunk.section
    return None, None


def _ref(entry: Entry, skill: str, chunks: list[ResumeChunk]) -> EvidenceRef:
    match = mentions_skill(entry.text, skill)
    quote = _snippet(entry.text, match) if (match and entry.located) else None
    chunk_id, section = _chunk_for(quote, chunks) if quote else (None, None)
    return EvidenceRef(source=entry.label, source_type=entry.kind, section=section, chunk_id=chunk_id, quote=quote)


def _literal(entry: Entry, skill: str) -> bool:
    """True when the entry names the skill itself, not only a related term (Docker vs 'containerization')."""
    forms = {f for f in _skill_forms(skill) if len(f) >= 2}
    lowered = entry.text.lower()
    return any(re.search(rf"(?<![a-z0-9]){re.escape(f)}(?![a-z0-9])", lowered) for f in forms)


def _assess_skill(skill: str, mandatory: bool, entries: list[Entry], resume_text: str, chunks: list[ResumeChunk]) -> RequirementAssessment:
    category = "mandatory skill" if mandatory else "preferred skill"
    context = [e for e in entries if e.kind in CONTEXT_KINDS and mentions_skill(e.text, skill)]
    literal = [e for e in context if _literal(e, skill)]
    if literal:
        shown = literal[:2]
        where = "; ".join(f"{e.kind}: {e.label}" for e in shown)
        return RequirementAssessment(
            requirement=skill, category=category, status="demonstrated",
            explanation=f"Used in {where}.", evidence=[_ref(e, skill, chunks) for e in shown],
        )
    if context:
        e = context[0]
        match = mentions_skill(e.text, skill)
        found = match.group(0) if match else "a related term"
        return RequirementAssessment(
            requirement=skill, category=category, status="partial",
            explanation=f"The resume names '{found}' in {e.kind} {e.label}, not '{skill}' itself, so direct experience is not confirmed.",
            evidence=[_ref(e, skill, chunks)],
        )
    listed = [e for e in entries if e.kind == "listed skills" and mentions_skill(e.text, skill)]
    if listed:
        return RequirementAssessment(
            requirement=skill, category=category, status="partial",
            explanation="Listed in the skills section only; no project or job in the resume describes using it.",
            evidence=[_ref(listed[0], skill, chunks)],
        )
    education = [e for e in entries if e.kind == "education" and mentions_skill(e.text, skill)]
    if education:
        return RequirementAssessment(
            requirement=skill, category=category, status="partial",
            explanation="Appears only in the education entry (coursework or degree), not in any project or job.",
            evidence=[_ref(education[0], skill, chunks)],
        )
    match = mentions_skill(resume_text, skill)
    if match:
        return RequirementAssessment(
            requirement=skill, category=category, status="partial",
            explanation="Mentioned in the resume, but the project or job it belongs to could not be determined.",
            evidence=[EvidenceRef(source="Resume text", source_type="resume", quote=_snippet(resume_text, match))],
        )
    return RequirementAssessment(
        requirement=skill, category=category, status="not_evidenced",
        explanation="Not mentioned in the resume. That does not show the candidate lacks it; it may be missing from the document.",
    )


def _content_words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z][a-z+#.]{3,}", text.lower()) if w not in _STOPWORDS}


def job_responsibilities(job: JobDescription, limit: int = 5) -> list[str]:
    """Bullet lines under a Responsibilities-style heading of the job description (empty when it has none)."""
    lines = (job.description or "").splitlines()
    out: list[str] = []
    capture = False
    for raw in lines:
        line = raw.strip()
        if re.match(r"^(key )?(responsibilit(?:y|ies)|duties|what you(?:'|’)?ll do|what you will do|role)\b.{0,25}:?$", line, re.IGNORECASE):
            capture = True
            continue
        if capture:
            if not line:
                if out:
                    break
                continue
            if re.match(r"^[A-Za-z ]{3,30}:$", line):
                break
            bullet = re.sub(r"^[\-\*•\d.)\s]+", "", line)
            if len(bullet) > 12:
                out.append(bullet[:200])
            if len(out) >= limit:
                break
    return out


def _assess_responsibility(text: str, entries: list[Entry]) -> RequirementAssessment:
    wanted = _content_words(text)
    best, best_share = None, 0.0
    for e in entries:
        if e.kind not in CONTEXT_KINDS or not wanted:
            continue
        share = len(wanted & _content_words(e.text)) / len(wanted)
        if share > best_share:
            best, best_share = e, share
    if best is not None and best_share >= 0.4:
        return RequirementAssessment(
            requirement=text, category="responsibility", status="partial",
            explanation=f"{best.kind.capitalize()} {best.label} describes related work (wording overlap only; a recruiter should judge the fit).",
            evidence=[EvidenceRef(source=best.label, source_type=best.kind)],
        )
    return RequirementAssessment(
        requirement=text, category="responsibility", status="not_evidenced",
        explanation="No similar work is described in the resume.",
    )


def _assess_experience(job: JobDescription, profile: CandidateProfile, match: Optional[MatchScore], entries: list[Entry]) -> Optional[RequirementAssessment]:
    if job.min_experience_years <= 0:
        return None
    years = None
    if match is not None:
        years = match.relevant_experience_years if match.relevant_experience_years is not None else match.total_experience_years
    if years is None:
        years = profile.total_experience_years or None
    jobs = [e for e in entries if e.kind in ("professional experience", "internship")]
    refs = [EvidenceRef(source=e.label, source_type=e.kind) for e in jobs[:3]]
    need = f"{job.min_experience_years:g}+ years of experience"
    if not years:
        return RequirementAssessment(
            requirement=need, category="experience", status="not_evidenced",
            explanation="No dated work history was found in the resume, so the length of experience is not confirmed.",
        )
    only_interns = bool(jobs) and all(e.kind == "internship" for e in jobs)
    if years >= job.min_experience_years and not only_interns:
        status, text = "demonstrated", f"About {years:g} years of dated experience against {job.min_experience_years:g} required."
    else:
        status = "partial"
        text = (
            f"The resume shows about {years:g} years against {job.min_experience_years:g} required"
            + (", all of it internships rather than professional roles." if only_interns else ".")
        )
    return RequirementAssessment(requirement=need, category="experience", status=status, explanation=text, evidence=refs)


def _assess_education(job: JobDescription, profile: CandidateProfile) -> Optional[RequirementAssessment]:
    if job.education_level is None:
        return None
    need = f"{job.education_level.value.replace('_', ' ')} degree or higher"
    best = profile.get_highest_education_level()
    if best is None:
        return RequirementAssessment(
            requirement=need, category="education", status="not_evidenced",
            explanation="No degree level could be read from the resume.",
        )
    ok = _LEVEL_ORDER.get(best, 0) >= _LEVEL_ORDER.get(job.education_level, 0)
    entry = next((e for e in profile.education if e.level == best), None)
    refs = [EvidenceRef(source=" ".join(filter(None, [entry.degree, entry.institution])), source_type="education")] if entry else []
    return RequirementAssessment(
        requirement=need, category="education", status="demonstrated" if ok else "partial",
        explanation=f"Highest level found: {best.value.replace('_', ' ')}.", evidence=refs,
    )


def analyse(
    profile: CandidateProfile,
    job: JobDescription,
    resume_text: str,
    chunks: list[ResumeChunk],
    match: Optional[MatchScore] = None,
) -> Analysis:
    entries = build_entries(profile, resume_text)

    requirements = list(job.requirements)
    if not requirements:
        requirements = [JobRequirement(skill=n, required=True) for n in job.required_skills]
        requirements += [JobRequirement(skill=n, required=False) for n in job.preferred_skills]

    seen: set[str] = set()
    assessments: list[RequirementAssessment] = []
    for req in sorted(requirements, key=lambda r: (not r.required, -r.weight)):  # mandatory and heavier first
        key = normalize_skill(req.skill)
        if key in seen:
            continue
        seen.add(key)
        assessments.append(_assess_skill(req.skill, req.required, entries, resume_text, chunks))

    for extra in (_assess_experience(job, profile, match, entries), _assess_education(job, profile)):
        if extra is not None:
            assessments.append(extra)
    for line in job_responsibilities(job):
        assessments.append(_assess_responsibility(line, entries))

    vocabulary = list(dict.fromkeys([r.skill for r in requirements] + [s.name for s in profile.skills]))
    for entry in entries:
        entry.supported = {normalize_skill(v) for v in vocabulary if mentions_skill(entry.text, v)}

    limitations: list[str] = []
    if len(_clean(resume_text)) < 500:
        limitations.append("The resume text is very short, so missing evidence may reflect an incomplete document.")
    if not requirements:
        limitations.append("The job lists no required or preferred skills, so skills could not be compared.")
    if not (job.description or "").strip():
        limitations.append("The job has no description, so responsibilities could not be compared.")
    if not profile.experience and not profile.projects:
        limitations.append("No jobs or projects were extracted from the resume, so skills cannot be tied to specific work.")

    years = None
    if match is not None:
        years = match.relevant_experience_years if match.relevant_experience_years is not None else match.total_experience_years
    if not years:
        years = profile.total_experience_years or None

    return Analysis(
        assessments=assessments,
        entries=entries,
        vocabulary=vocabulary,
        demonstrated=[a.requirement for a in assessments if a.status == "demonstrated"],
        partial=[a.requirement for a in assessments if a.status == "partial"],
        not_evidenced=[a.requirement for a in assessments if a.status == "not_evidenced"],
        limitations=limitations,
        years=years,
    )


def strengths_from(analysis: Analysis) -> list[str]:
    """One line per demonstrated requirement, each naming where it was shown and quoting the resume."""
    out = []
    for a in analysis.assessments:
        if a.status != "demonstrated" or a.category not in ("mandatory skill", "preferred skill") or not a.evidence:
            continue
        ref = a.evidence[0]
        line = f"{a.requirement}: used in {ref.source_type} '{ref.source}'"
        out.append(f"{line} - \"{ref.quote}\"" if ref.quote else line)
    return out


def relevant_experience_from(analysis: Analysis) -> list[str]:
    """The jobs, internships and projects that evidence at least one requirement, labelled by what they are."""
    useful = {e for a in analysis.assessments if a.status != "not_evidenced" for e in (r.source for r in a.evidence)}
    return [f"{e.kind.capitalize()}: {e.label}" for e in analysis.entries if e.kind in CONTEXT_KINDS and e.label in useful]


def confidence_from(analysis: Analysis) -> float:
    """How much of the job the resume lets us judge, not how good the candidate is. Falls with thin or missing data."""
    graded = [a for a in analysis.assessments]
    if not graded:
        return 0.2
    weight = {"demonstrated": 1.0, "partial": 0.6, "not_evidenced": 0.3}
    value = sum(weight[a.status] for a in graded) / len(graded)
    value -= 0.15 * len(analysis.limitations)
    return round(max(0.1, min(0.95, value)), 2)


# --------------------------------------------------------------------------- narrative

def fallback_narrative(job: JobDescription, analysis: Analysis, candidate_name: str = "The candidate") -> str:
    """A plain explanation built only from verified facts; used when the model's text fails verification."""
    demo = [a for a in analysis.assessments if a.status == "demonstrated" and a.category.endswith("skill") and a.evidence]
    parts = []
    if demo:
        shown = []
        for a in demo[:4]:
            ref = a.evidence[0]
            shown.append(f"{a.requirement} ({ref.source_type}: {ref.source})")
        parts.append(f"For the {job.title} role, the resume shows hands-on use of " + ", ".join(shown) + ".")
    else:
        parts.append(f"For the {job.title} role, the resume does not show any required skill being used in a project or job.")
    skills = [a for a in analysis.assessments if a.category.endswith("skill")]
    partial = [a.requirement for a in skills if a.status == "partial"][:4]
    if partial:
        parts.append("These are only partly shown (listed, or named by a related term): " + ", ".join(partial) + ".")
    missing = [a.requirement for a in skills if a.status == "not_evidenced"][:5]
    if missing:
        parts.append("Not mentioned in the resume: " + ", ".join(missing) + ". This may be a gap in the document rather than in the candidate.")
    experience = next((a for a in analysis.assessments if a.category == "experience"), None)
    if experience is not None:
        parts.append(experience.explanation)
    elif analysis.years:
        parts.append("The resume shows about " + (f"{analysis.years:g} years" if analysis.years >= 1 else "less than a year") + " of experience.")
    return " ".join(parts)


def overall_from(analysis: Analysis) -> str:
    total = len(analysis.assessments)
    if total == 0:
        return "There was not enough information in the job description to compare against the resume."
    d, p, n = len(analysis.demonstrated), len(analysis.partial), len(analysis.not_evidenced)
    if d == total:
        tone = "The resume evidences every requirement that could be checked."
    elif d + p == 0:
        tone = "The resume evidences none of the requirements that could be checked."
    elif d >= total / 2:
        tone = "The resume evidences most of the requirements that could be checked."
    else:
        tone = "The resume evidences only some of the requirements that could be checked."
    return f"{tone} {d} demonstrated, {p} partly shown and {n} not mentioned out of {total}."


_NEGATION = re.compile(
    r"\b(not|no|nor|without|lack|lacks|lacking|missing|absent|unclear|unconfirmed|unverified|neither|isn't|aren't|doesn't|does not|"
    r"hasn't|has not|never|limited|only listed|only partly|partly|partially|gap|gaps|to be confirmed|to confirm|still to|yet to|not yet|unproven)\b",
    re.IGNORECASE,
)
_INABILITY = re.compile(
    r"\b(cannot(?! be (?:confirmed|verified|determined|judged|checked))|can't|unable to|incapable|lacks the ability|does not know|doesn't know|has no experience|has never|no ability|"
    r"is not capable|not qualified|unqualified)\b",
    re.IGNORECASE,
)
_OVERCLAIM = re.compile(r"\b(expert|expertise|extensive|extensively|proficient|mastered|mastery|deep|strong command|excellent|outstanding|exceptional)\b", re.IGNORECASE)
_PLACEHOLDER = re.compile(r"\s*\[\s*(?:evidence|source|ref)?\s*#?\d+\s*\]", re.IGNORECASE)
_YEARS = re.compile(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b", re.IGNORECASE)
_TERM = re.compile(r"\b(?:[A-Za-z]+\.js|[A-Z][a-z]+[A-Z][A-Za-z0-9]*|[A-Z]{2,}[A-Za-z0-9+#]*|[A-Za-z]+[+#]{1,2})\b")
_PROPER = re.compile(r"\b[A-Z][a-z]{2,}\b")
_COMMON_CAPS = {
    "AI", "HR", "CV", "JD", "IT", "US", "UK", "ATS", "NOT", "NO", "OK", "AND", "THE", "FOR", "ML",
}


def strip_placeholders(text: str) -> str:
    return _PLACEHOLDER.sub("", text or "").strip()


def word_count(text: str) -> int:
    return len(re.findall(r"\S+", text or ""))


def _mentions(sentence: str, name: str) -> bool:
    lowered = sentence.lower()
    return any(re.search(rf"(?<![a-z0-9]){re.escape(p)}(?![a-z0-9])", lowered) for p in _skill_patterns(name) | {name.lower()} if len(p) >= 2)


def verify_narrative(text: str, analysis: Analysis, resume_text: str, job: JobDescription) -> list[str]:
    """Reasons the written explanation cannot be shown as is. Empty means every check passed."""
    violations: list[str] = []
    if not text.strip():
        return ["The explanation is empty"]
    text = text.replace("’", "'").replace("‘", "'")

    if re.search(r"\[\s*evidence\s*\d+\s*\]", text, re.IGNORECASE):
        violations.append("Contains evidence placeholders that do not map to a record")

    by_requirement = {a.requirement: a for a in analysis.assessments if a.category.endswith("skill")}
    resume_lower = (resume_text or "").lower()
    job_lower = " ".join(
        [job.title, job.description, *job.required_skills, *job.preferred_skills, *(r.skill for r in job.requirements), *analysis.vocabulary]
    ).lower()
    allowed_years = {round(v, 1) for v in (analysis.years, job.min_experience_years) if v}

    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if not sentence.strip():
            continue
        lowered = sentence.lower()

        if _INABILITY.search(sentence):
            violations.append(f"Treats missing evidence as inability: '{sentence.strip()[:90]}'")

        for name, assessment in by_requirement.items():
            if not _mentions(sentence, name):
                continue
            if assessment.status == "not_evidenced" and not _NEGATION.search(sentence):
                violations.append(f"Mentions '{name}' without saying the resume does not evidence it")
            if assessment.status != "demonstrated" and _OVERCLAIM.search(sentence):
                violations.append(f"Overstates '{name}', which the resume only partly or never shows")

        # A skill named next to a project or employer must really appear in that entry: check it against the
        # nearest label on either side of the mention.
        labels = []  # (position, entry)
        for entry in analysis.entries:
            if entry.kind == "listed skills" or len(entry.label) < 3:
                continue
            names = {entry.label.lower()} | {part.lower() for part in re.split(r"\s+at\s+", entry.label) if len(part) >= 3}
            for n in names:
                for m in re.finditer(rf"(?<![a-z0-9]){re.escape(n)}(?![a-z0-9])", lowered):
                    labels.append((m.start(), entry))
        if labels and not _NEGATION.search(sentence):
            for vocab in analysis.vocabulary:
                found = mentions_skill(sentence, vocab)
                if not found:
                    continue
                before = max(((pos, e) for pos, e in labels if pos < found.start()), key=lambda t: t[0], default=None)
                after = min(((pos, e) for pos, e in labels if pos > found.start()), key=lambda t: t[0], default=None)
                neighbours = [x[1] for x in (before, after) if x]
                if neighbours and not any(normalize_skill(vocab) in e.supported for e in neighbours):
                    violations.append(f"Attributes '{vocab}' to '{neighbours[0].label}', whose text does not mention it")

        for match in _YEARS.finditer(sentence):
            value = float(match.group(1))
            in_resume = re.search(rf"\b{re.escape(match.group(1))}\s*\+?\s*(?:years?|yrs?)\b", resume_lower) is not None
            if not in_resume and not any(abs(value - a) <= 0.6 for a in allowed_years):
                violations.append(f"States {match.group(1)} years, which the resume and job do not support")

    terms = set(_TERM.findall(text))
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        # A capitalised word in mid-sentence is a name (tool, employer, school); the first word of a sentence is not.
        terms.update(m.group(0) for m in _PROPER.finditer(sentence) if m.start() > 0 and sentence[: m.start()].strip())
    for term in sorted(terms):
        lowered_term = term.lower()
        # A word form built on one the resume or job already uses (Internship / intern) is not a new name.
        stem = lowered_term[:6] if len(lowered_term) >= 6 else lowered_term
        if term.upper() in _COMMON_CAPS or lowered_term in resume_lower or lowered_term in job_lower:
            continue
        if len(lowered_term) >= 6 and (stem in resume_lower or stem in job_lower):
            continue
        violations.append(f"Names '{term}', which appears in neither the resume nor the job description")

    return list(dict.fromkeys(violations))
