from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import StrEnum


class Driver(StrEnum):
    PRICE = "price"
    GAIN_AMOUNT = "gain_amount"
    GAIN_PERCENT = "gain_percent"


class Thermometer(StrEnum):
    GREEN = "green"
    RED = "red"
    NEUTRAL = "neutral"


class SourceStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNKNOWN = "unknown"


class Severity(StrEnum):
    WARNING = "warning"
    CONFLICT = "conflict"


@dataclass(frozen=True)
class EffectiveCandidate:
    value: Decimal | None
    valid_from: date
    source_row: int
    batch_id: str | None = None
    source_status: SourceStatus = SourceStatus.UNKNOWN


@dataclass(frozen=True)
class EffectiveValue:
    value: Decimal | None
    valid_from: date | None
    status: str
    candidates: tuple[EffectiveCandidate, ...] = ()
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class SimulationResult:
    price: Decimal | None
    gain_amount: Decimal | None
    gain_percent: Decimal | None
    ideal_amount: Decimal | None
    ideal_price: Decimal | None
    gap_amount: Decimal | None
    gap_percentage_points: Decimal | None
    thermometer: Thermometer
    warnings: tuple[str, ...] = field(default_factory=tuple)

