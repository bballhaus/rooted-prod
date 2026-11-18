"""Small, dependency-free statistics for the eval reports.

Eval sets are small (tens of cases, a few trials each), so every rate is
reported with an interval, not just a point estimate:

- Wilson score interval for a pass rate: well behaved at 0% and 100% and
  for small n, unlike the normal approximation.
- Cluster bootstrap for rates whose trials aren't independent (several
  decisions in one Slack thread, several trials of one scenario): resample
  whole clusters, not single trials.
- Cohen's kappa (and quadratic-weighted kappa for 1–5 scores) for agreement
  between two judges beyond what chance alone would give.
"""

from __future__ import annotations

import math
import random
from collections import Counter
from typing import Callable, Sequence, TypeVar

T = TypeVar("T")

Z95 = 1.959963984540054


def wilson(successes: int, n: int, z: float = Z95) -> tuple[float, float]:
    """95% Wilson score interval for successes / n. (0, 1) when n is 0."""
    if n == 0:
        return (0.0, 1.0)
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    lo = 0.0 if successes == 0 else max(0.0, centre - half)
    hi = 1.0 if successes == n else min(1.0, centre + half)
    return (lo, hi)


def bootstrap(clusters: Sequence[T], statistic: Callable[[Sequence[T]], float], *, reps: int = 2000, seed: int = 177) -> tuple[float, float]:
    """95% percentile interval for statistic(clusters), resampling whole clusters with replacement."""
    if not clusters:
        return (0.0, 1.0)
    rng = random.Random(seed)
    values = sorted(statistic([rng.choice(clusters) for _ in clusters]) for _ in range(reps))
    return (values[int(0.025 * (reps - 1))], values[int(0.975 * (reps - 1))])


def mean(xs: Sequence[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def percentile(xs: Sequence[float], q: float) -> float:
    """Linear-interpolated percentile, q in [0, 100]."""
    if not xs:
        return 0.0
    s = sorted(xs)
    k = (len(s) - 1) * q / 100
    lo, hi = math.floor(k), math.ceil(k)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def cohen_kappa(a: Sequence[object], b: Sequence[object]) -> float:
    """Agreement between two raters on the same items, corrected for chance. 1 is perfect, 0 is chance."""
    if len(a) != len(b):
        raise ValueError("raters must rate the same items")
    n = len(a)
    if n == 0:
        return float("nan")
    observed = sum(x == y for x, y in zip(a, b)) / n
    ca, cb = Counter(a), Counter(b)
    expected = sum(ca[k] * cb[k] for k in set(ca) | set(cb)) / (n * n)
    if expected == 1:
        return 1.0 if observed == 1 else 0.0
    return (observed - expected) / (1 - expected)


def weighted_kappa(a: Sequence[int], b: Sequence[int], lo: int = 1, hi: int = 5) -> float:
    """Quadratic-weighted kappa for ordinal scores: a 4 vs 5 disagreement costs less than 1 vs 5."""
    if len(a) != len(b):
        raise ValueError("raters must rate the same items")
    n = len(a)
    if n == 0:
        return float("nan")
    k = hi - lo + 1
    w = [[((i - j) ** 2) / ((k - 1) ** 2) for j in range(k)] for i in range(k)]
    obs = [[0.0] * k for _ in range(k)]
    for x, y in zip(a, b):
        obs[x - lo][y - lo] += 1 / n
    pa = [sum(row) for row in obs]
    pb = [sum(obs[i][j] for i in range(k)) for j in range(k)]
    num = sum(w[i][j] * obs[i][j] for i in range(k) for j in range(k))
    den = sum(w[i][j] * pa[i] * pb[j] for i in range(k) for j in range(k))
    return 1.0 if den == 0 else 1 - num / den


def kappa_label(k: float) -> str:
    """Landis and Koch's conventional reading of a kappa value."""
    if math.isnan(k):
        return "n/a"
    for bound, label in ((0.0, "poor"), (0.2, "slight"), (0.4, "fair"), (0.6, "moderate"), (0.8, "substantial")):
        if k <= bound:
            return label
    return "almost perfect"


def pct(x: float) -> str:
    return f"{100 * x:.0f}%"


def interval(lo_hi: tuple[float, float]) -> str:
    return f"{pct(lo_hi[0])}–{pct(lo_hi[1])}"
