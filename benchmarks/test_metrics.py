import math

import pytest

from metrics import (
    canonical_skill,
    ndcg_at_k,
    percentile,
    precision_at_k,
    precision_recall_f1,
    skills_in_text,
    summary_is_grounded,
    within,
)


def test_aliases_map_to_one_canonical_name():
    assert canonical_skill("Postgres") == "PostgreSQL"
    assert canonical_skill("react.js") == "React"
    assert canonical_skill("k8s") == "Kubernetes"
    assert canonical_skill("Teamwork") == "Teamwork"  # unknown stays as typed, so it counts as a false positive


def test_precision_recall_f1_micro_average():
    result = precision_recall_f1([{"a", "b", "x"}, {"c"}], [{"a", "b", "c"}, {"c", "d"}])
    # resume 1: tp=2 (a,b) fp=1 (x) fn=1 (c); resume 2: tp=1 (c) fp=0 fn=1 (d)
    assert (result["tp"], result["fp"], result["fn"]) == (3, 1, 2)
    assert result["precision"] == 0.75 and result["recall"] == 0.6
    assert result["f1"] == pytest.approx(2 * 0.75 * 0.6 / (0.75 + 0.6), abs=1e-4)


def test_perfect_and_empty_predictions():
    assert precision_recall_f1([{"a"}], [{"a"}])["f1"] == 1.0
    assert precision_recall_f1([set()], [{"a"}]) == {"precision": 0.0, "recall": 0.0, "f1": 0.0, "tp": 0, "fp": 0, "fn": 1}


def test_ndcg_is_one_for_ideal_order_and_lower_when_swapped():
    assert ndcg_at_k([3, 2, 1, 0]) == 1.0
    worse = ndcg_at_k([0, 1, 2, 3])
    assert worse < 1.0 and worse == pytest.approx(
        (sum((2**r - 1) / math.log2(i + 2) for i, r in enumerate([0, 1, 2, 3]))) / (sum((2**r - 1) / math.log2(i + 2) for i, r in enumerate([3, 2, 1, 0]))), abs=1e-4
    )


def test_ndcg_is_undefined_when_nothing_is_relevant():
    assert ndcg_at_k([0, 0, 0]) is None


def test_precision_at_k_uses_the_threshold_and_the_top_k_only():
    assert precision_at_k([3, 2, 0, 0, 3], k=2) == 1.0
    assert precision_at_k([3, 2, 0, 0, 3], k=4) == 0.5
    assert precision_at_k([], k=10) == 0.0
    assert precision_at_k([1, 1], k=2, threshold=1) == 1.0


def test_nearest_rank_percentile():
    values = [5.0, 1.0, 3.0, 2.0, 4.0]
    assert percentile(values, 50) == 3.0 and percentile(values, 95) == 5.0 and percentile([], 50) is None


def test_within_tolerance():
    assert within(7.9, 8.1, 0.6) and not within(6.0, 8.1, 0.6) and not within(None, 1, 1)


def test_vocabulary_skills_found_in_text_on_word_boundaries():
    assert skills_in_text("Built Spring Boot services on Postgres with k8s") == {"Spring Boot", "PostgreSQL", "Kubernetes"}
    assert "Java" not in skills_in_text("expert in JavaScript only")


def test_a_summary_inventing_a_skill_is_ungrounded():
    truth = {"Java", "SQL"}
    assert summary_is_grounded("Strong Java and SQL background.", ["Java", "SQL"], truth)
    assert not summary_is_grounded("Strong Java and Kubernetes background.", ["Java"], truth)
    assert not summary_is_grounded("Good fit.", ["Java", "Kafka"], truth)


def test_naming_a_gap_is_not_a_grounding_failure():
    # "matched" skills and strengths are what is checked; a separate "missing" list may name any job skill.
    assert summary_is_grounded("Solid Java engineer.", ["Java"], {"Java"})
