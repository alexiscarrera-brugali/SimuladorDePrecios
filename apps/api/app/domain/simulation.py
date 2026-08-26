from decimal import Decimal

from app.domain.decimal_utils import HUNDRED
from app.domain.types import Driver, SimulationResult, Thermometer


def simulate(
    *,
    cost: Decimal | None,
    driver: Driver,
    driver_value: Decimal,
    ideal_percent: Decimal | None = None,
    source_inactive: bool = False,
    source_unknown: bool = False,
) -> SimulationResult:
    warnings: list[str] = []
    if source_inactive:
        warnings.append("inactive_source")
    if source_unknown:
        warnings.append("unknown_source_status")

    if driver is Driver.PRICE and driver_value < 0:
        raise ValueError("Price cannot be negative")

    price: Decimal | None = None
    gain_amount: Decimal | None = None
    gain_percent: Decimal | None = None

    if cost is None:
        warnings.append("missing_cost")
        if driver is Driver.PRICE:
            price = driver_value
        else:
            warnings.append("driver_requires_cost")
    elif cost == 0:
        warnings.append("zero_cost")
        if driver is Driver.PRICE:
            price = driver_value
            gain_amount = price
        elif driver is Driver.GAIN_AMOUNT:
            gain_amount = driver_value
            if gain_amount < 0:
                raise ValueError("Gain cannot produce a negative price")
            price = gain_amount
        else:
            warnings.append("percentage_not_calculable")
    else:
        if driver is Driver.PRICE:
            price = driver_value
            gain_amount = price - cost
            gain_percent = gain_amount / cost * HUNDRED
        elif driver is Driver.GAIN_AMOUNT:
            gain_amount = driver_value
            price = cost + gain_amount
            if price < 0:
                raise ValueError("Gain cannot produce a negative price")
            gain_percent = gain_amount / cost * HUNDRED
        else:
            if driver_value < -HUNDRED:
                raise ValueError("Percentage cannot be lower than -100")
            gain_percent = driver_value
            gain_amount = cost * gain_percent / HUNDRED
            price = cost + gain_amount

    ideal_amount = None
    ideal_price = None
    gap_amount = None
    gap_percentage_points = None
    thermometer = Thermometer.NEUTRAL

    if ideal_percent is None:
        warnings.append("missing_ideal_margin")
    elif cost is None or cost == 0:
        warnings.append("ideal_not_calculable")
    else:
        ideal_amount = cost * ideal_percent / HUNDRED
        ideal_price = cost + ideal_amount
        if gain_amount is not None:
            gap_amount = gain_amount - ideal_amount
        if gain_percent is not None:
            gap_percentage_points = gain_percent - ideal_percent
            thermometer = Thermometer.GREEN if gap_percentage_points >= 0 else Thermometer.RED

    return SimulationResult(
        price=price,
        gain_amount=gain_amount,
        gain_percent=gain_percent,
        ideal_amount=ideal_amount,
        ideal_price=ideal_price,
        gap_amount=gap_amount,
        gap_percentage_points=gap_percentage_points,
        thermometer=thermometer,
        warnings=tuple(dict.fromkeys(warnings)),
    )

