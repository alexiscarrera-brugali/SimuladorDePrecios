"""Pruebas de vigencia y duplicados (brief §9 · Datos)."""

from datetime import date
from decimal import Decimal

from app.domain.effective import resolve_effective
from app.domain.types import EffectiveCandidate, SourceStatus


def candidate(value, day, row=1, status=SourceStatus.ACTIVE):
    val = None if value is None else Decimal(value)
    return EffectiveCandidate(value=val, valid_from=date(2026, 1, day), source_row=row, source_status=status)


def test_effective_picks_latest_not_after_query():
    candidates = [candidate("100", 1), candidate("120", 10), candidate("140", 20)]
    # Antes del segundo cambio.
    before = resolve_effective(candidates, date(2026, 1, 5))
    assert before.value == Decimal("100")
    assert before.valid_from == date(2026, 1, 1)
    # Exactamente en el cambio.
    on = resolve_effective(candidates, date(2026, 1, 10))
    assert on.value == Decimal("120")
    # Después del último cambio.
    after = resolve_effective(candidates, date(2026, 1, 25))
    assert after.value == Decimal("140")


def test_no_eligible_candidate_is_missing():
    result = resolve_effective([candidate("100", 10)], date(2026, 1, 5))
    assert result.status == "missing"
    assert result.value is None


def test_identical_duplicate_consolidates_and_warns():
    result = resolve_effective(
        [candidate("100", 10, row=2), candidate("100", 10, row=5)], date(2026, 1, 15)
    )
    assert result.value == Decimal("100")
    assert result.status == "warning"
    assert "identical_duplicate" in result.warnings


def test_conflicting_duplicate_blocks():
    result = resolve_effective(
        [candidate("100", 10, row=2), candidate("130", 10, row=5)], date(2026, 1, 15)
    )
    assert result.status == "conflict"
    assert result.value is None
    assert "conflicting_duplicate" in result.warnings


def test_zero_value_is_flagged_but_visible():
    result = resolve_effective([candidate("0", 10)], date(2026, 1, 15))
    assert result.value == Decimal("0")
    assert "zero_value" in result.warnings


def test_inactive_and_unknown_status_warn():
    inactive = resolve_effective(
        [candidate("100", 10, status=SourceStatus.INACTIVE)], date(2026, 1, 15)
    )
    assert "inactive_source" in inactive.warnings
    unknown = resolve_effective(
        [candidate("100", 10, status=SourceStatus.UNKNOWN)], date(2026, 1, 15)
    )
    assert "unknown_source_status" in unknown.warnings
