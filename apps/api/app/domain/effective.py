from collections.abc import Iterable
from datetime import date

from app.domain.types import EffectiveCandidate, EffectiveValue, SourceStatus


def resolve_effective(
    candidates: Iterable[EffectiveCandidate], query_date: date
) -> EffectiveValue:
    eligible = [item for item in candidates if item.valid_from <= query_date]
    if not eligible:
        return EffectiveValue(value=None, valid_from=None, status="missing")

    effective_date = max(item.valid_from for item in eligible)
    same_date = tuple(item for item in eligible if item.valid_from == effective_date)
    distinct = {item.value for item in same_date}

    if len(distinct) > 1:
        return EffectiveValue(
            value=None,
            valid_from=effective_date,
            status="conflict",
            candidates=same_date,
            warnings=("conflicting_duplicate",),
        )

    value = next(iter(distinct))
    warnings: list[str] = []
    if len(same_date) > 1:
        warnings.append("identical_duplicate")
    if value is None:
        warnings.append("missing_value")
    elif value == 0:
        warnings.append("zero_value")
    statuses = {item.source_status for item in same_date}
    if len(statuses) > 1:
        warnings.append("mixed_source_status")
    if SourceStatus.INACTIVE in statuses:
        warnings.append("inactive_source")
    if SourceStatus.UNKNOWN in statuses:
        warnings.append("unknown_source_status")

    return EffectiveValue(
        value=value,
        valid_from=effective_date,
        status="warning" if warnings else "ok",
        candidates=same_date,
        warnings=tuple(warnings),
    )
