"""Pruebas del motor de simulación (brief §9 · Dominio)."""

from decimal import Decimal

import pytest

from app.domain.simulation import simulate
from app.domain.types import Driver, Thermometer


def D(value: str) -> Decimal:
    return Decimal(value)


def test_percent_driver_cost_100_plus_25():
    result = simulate(cost=D("100"), driver=Driver.GAIN_PERCENT, driver_value=D("25"))
    assert result.gain_amount == D("25")
    assert result.price == D("125")
    assert result.gain_percent == D("25")


def test_price_driver_cost_100_price_130():
    result = simulate(cost=D("100"), driver=Driver.PRICE, driver_value=D("130"))
    assert result.gain_amount == D("30")
    assert result.gain_percent == D("30")


def test_gain_amount_driver_cost_100_gain_40():
    result = simulate(cost=D("100"), driver=Driver.GAIN_AMOUNT, driver_value=D("40"))
    assert result.price == D("140")
    assert result.gain_percent == D("40")


def test_ideal_above_simulated_is_red():
    result = simulate(
        cost=D("100"), driver=Driver.GAIN_PERCENT, driver_value=D("20"), ideal_percent=D("25")
    )
    assert result.thermometer is Thermometer.RED
    assert result.gap_amount == D("-5")
    assert result.gap_percentage_points == D("-5")


def test_simulated_above_ideal_is_green():
    result = simulate(
        cost=D("100"), driver=Driver.GAIN_PERCENT, driver_value=D("30"), ideal_percent=D("25")
    )
    assert result.thermometer is Thermometer.GREEN
    assert result.gap_amount == D("5")
    assert result.gap_percentage_points == D("5")


def test_zero_cost_price_driver_never_divides():
    result = simulate(cost=D("0"), driver=Driver.PRICE, driver_value=D("500"))
    assert result.price == D("500")
    assert result.gain_amount == D("500")
    assert result.gain_percent is None
    assert "zero_cost" in result.warnings


def test_zero_cost_percent_driver_not_calculable():
    result = simulate(cost=D("0"), driver=Driver.GAIN_PERCENT, driver_value=D("25"))
    assert result.gain_percent is None
    assert "percentage_not_calculable" in result.warnings


def test_missing_cost_only_price_allowed():
    result = simulate(cost=None, driver=Driver.PRICE, driver_value=D("120"))
    assert result.price == D("120")
    assert "missing_cost" in result.warnings

    blocked = simulate(cost=None, driver=Driver.GAIN_PERCENT, driver_value=D("10"))
    assert blocked.price is None
    assert "driver_requires_cost" in blocked.warnings


def test_price_zero_with_valid_cost_is_minus_100():
    result = simulate(cost=D("100"), driver=Driver.PRICE, driver_value=D("0"))
    assert result.gain_percent == D("-100")


def test_percent_below_minus_100_is_rejected():
    with pytest.raises(ValueError):
        simulate(cost=D("100"), driver=Driver.GAIN_PERCENT, driver_value=D("-150"))


def test_negative_price_is_rejected():
    with pytest.raises(ValueError):
        simulate(cost=D("100"), driver=Driver.PRICE, driver_value=D("-1"))


def test_negative_gain_amount_producing_negative_price_is_rejected():
    with pytest.raises(ValueError):
        simulate(cost=D("100"), driver=Driver.GAIN_AMOUNT, driver_value=D("-150"))


def test_missing_ideal_margin_is_neutral():
    result = simulate(cost=D("100"), driver=Driver.PRICE, driver_value=D("130"))
    assert result.thermometer is Thermometer.NEUTRAL
    assert "missing_ideal_margin" in result.warnings


def test_inactive_and_unknown_source_warn_but_allow():
    result = simulate(
        cost=D("100"),
        driver=Driver.PRICE,
        driver_value=D("130"),
        source_inactive=True,
        source_unknown=True,
    )
    assert result.price == D("130")
    assert "inactive_source" in result.warnings
    assert "unknown_source_status" in result.warnings


def test_decimal_precision_no_commercial_rounding():
    # 100 + 33.333% => ganancia 33.333, precio 133.333 sin redondeo comercial.
    result = simulate(cost=D("100"), driver=Driver.GAIN_PERCENT, driver_value=D("33.333"))
    assert result.gain_amount == D("33.333")
    assert result.price == D("133.333")
