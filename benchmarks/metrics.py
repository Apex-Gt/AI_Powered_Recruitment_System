"""Pure metric functions for the benchmark (no network, no files), so they are unit-tested on their own."""

from __future__ import annotations

import math
import re
from typing import Iterable, Optional

from generate_dataset import ALIASES

# written form (lowercase) -> canonical skill name
_CANON = {form.lower(): canon for canon, forms in ALIASES.items() for form in forms}
_CANON.update({canon.lower(): canon for canon in ALIASES})
_VOCAB_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])(" + "|".join(sorted((re.escape(f) for f in _CANON), key=len, reverse=True)) + r")(?![A-Za-z0-9])", re.IGNORECASE
)


def canonical_skill(name: str) -> str:
    """Map a skill as written ("Postgres", "React.js", "k8s") to its canonical name; unknown skills stay as typed."""
    key = re.sub(r"\s+", " ", name.strip().lower())
    return _CANON.get(key, name.strip())


def precision_recall_f1(predicted: Iterable[set[str]], truth: Iterable[set[str]]) -> dict:
    """Micro-averaged over resumes: pool every true/false positive and false negative, then compute once."""
    tp = fp = fn = 0
    for pred, true in zip(predicted, truth):
        tp += len(pred & true)
        fp += len(pred - true)
        fn += len(true - pred)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4), "tp": tp, "fp": fp, "fn": fn}


def dcg(relevances: list[float], k: int) -> float:
    return sum((2**rel - 1) / math.log2(i + 2) for i, rel in enumerate(relevances[:k]))


def ndcg_at_k(ranked_relevances: list[float], k: int = 10) -> Optional[float]:
    """NDCG@k of a ranking given each ranked item's graded relevance. None when nothing is relevant (undefined)."""
    ideal = dcg(sorted(ranked_relevances, reverse=True), k)
    if ideal == 0:
        return None
    return round(dcg(ranked_relevances, k) / ideal, 4)


def precision_at_k(ranked_relevances: list[float], k: int = 10, threshold: float = 2) -> float:
    """Share of the top-k that are relevant (grade >= threshold)."""
    top = ranked_relevances[:k]
    return round(sum(1 for r in top if r >= threshold) / len(top), 4) if top else 0.0


def percentile(values: list[float], p: float) -> Optional[float]:
    """Nearest-rank percentile."""
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(p / 100 * len(ordered)))
    return ordered[min(rank, len(ordered)) - 1]


def within(actual: Optional[float], expected: float, tolerance: float) -> bool:
    return actual is not None and abs(float(actual) - expected) <= tolerance


def normalize_name(value: Optional[str]) -> str:
    return re.sub(r"[^a-z]", "", (value or "").lower())


def skills_in_text(text: str) -> set[str]:
    """Canonical skills from the benchmark vocabulary that a piece of text mentions."""
    return {canonical_skill(m.group(1)) for m in _VOCAB_PATTERN.finditer(text or "")}


def summary_is_grounded(asserted_text: str, matched_skills: list[str], true_skills: set[str]) -> bool:
    """Proxy for factual grounding: every skill a summary asserts the candidate HAS must really be on the resume.

    Only the 'matched' skill list and the strengths text are checked, not 'missing' statements, because naming a
    skill the candidate lacks is the correct way to report a gap. This is an automatic proxy, not a human judgement
    of faithfulness: it catches invented skills, not subtler distortions.
    """
    asserted = {canonical_skill(s) for s in matched_skills} | skills_in_text(asserted_text)
    return asserted <= true_skills
