from decimal import Decimal, InvalidOperation

HUNDRED = Decimal("100")


def parse_decimal(value: object) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, bool):
        raise ValueError("Boolean is not a monetary value")
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    raw = str(value).strip().replace("$", "").replace(" ", "")
    if not raw:
        return None
    if raw.endswith("%"):
        raw = raw[:-1]
    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "," in raw:
        raw = raw.replace(",", ".")
    try:
        return Decimal(raw)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid decimal value: {value!r}") from exc


def parse_percentage(value: object) -> Decimal | None:
    return parse_decimal(value)


def decimal_to_str(value: Decimal | None) -> str | None:
    return format(value, "f") if value is not None else None

