from collections import Counter, defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import CostFact, PriceFact, PriceList, Product, TheoreticalMargin
from app.domain.decimal_utils import decimal_to_str
from app.domain.effective import resolve_effective
from app.domain.simulation import simulate
from app.domain.types import Driver, EffectiveCandidate, SourceStatus
from app.schemas.api import AnalysisResponse, AnalysisRow, EffectiveView, PriceListView
from app.services.persistence import latest_batch


def _effective_view(value) -> EffectiveView:
    return EffectiveView(
        value=decimal_to_str(value.value),
        valid_from=value.valid_from,
        status=value.status,
        warnings=list(value.warnings),
    )


def list_price_lists(db: Session) -> list[PriceListView]:
    return [
        PriceListView(code=item.code, description=item.description)
        for item in db.scalars(select(PriceList).order_by(PriceList.code)).all()
    ]


def analyze(db: Session, query_date: date, price_list_code: str) -> AnalysisResponse:
    batch = latest_batch(db)
    if batch is None:
        raise ValueError("No committed import is available")
    price_list = db.scalar(select(PriceList).where(PriceList.code == price_list_code))
    if price_list is None:
        raise ValueError("Unknown price list")

    prices = db.scalars(
        select(PriceFact).where(
            PriceFact.batch_id == batch.id,
            PriceFact.price_list_code == price_list_code,
        )
    ).all()
    costs = db.scalars(select(CostFact).where(CostFact.batch_id == batch.id)).all()
    objectives = db.scalars(
        select(TheoreticalMargin).where(
            TheoreticalMargin.batch_id == batch.id,
            TheoreticalMargin.price_list_name == price_list.description,
            TheoreticalMargin.is_ambiguous.is_(False),
        )
    ).all()
    products = {item.code: item for item in db.scalars(select(Product)).all()}

    price_groups = defaultdict(list)
    for item in prices:
        price_groups[(item.branch_code, item.product_code)].append(item)
    cost_groups = defaultdict(list)
    for item in costs:
        cost_groups[(item.branch_code, item.product_code)].append(item)
    objective_map = {item.product_code: item.percentage for item in objectives}
    product_codes = {item.product_code for item in prices} | set(objective_map)

    rows: list[AnalysisRow] = []
    for product_code in sorted(product_codes):
        branches = {key[0] for key in price_groups if key[1] == product_code} or {"1"}
        for branch_code in sorted(branches):
            price_value = resolve_effective(
                [
                    EffectiveCandidate(
                        value=item.value,
                        valid_from=item.valid_from,
                        source_row=item.source_row,
                        batch_id=item.batch_id,
                        source_status=SourceStatus(item.source_status),
                    )
                    for item in price_groups[(branch_code, product_code)]
                ],
                query_date,
            )
            matching_costs = cost_groups.get((branch_code, product_code)) or [
                item for (branch, code), values in cost_groups.items() if code == product_code for item in values
            ]
            cost_value = resolve_effective(
                [
                    EffectiveCandidate(
                        value=item.value,
                        valid_from=item.valid_from,
                        source_row=item.source_row,
                        batch_id=item.batch_id,
                        source_status=SourceStatus(item.source_status),
                    )
                    for item in matching_costs
                ],
                query_date,
            )
            warnings = list(dict.fromkeys(price_value.warnings + cost_value.warnings))
            blocked = price_value.status == "conflict" or cost_value.status == "conflict"
            ideal_percent = objective_map.get(product_code)
            actual_gain_amount = None
            actual_gain_percent = None
            if not blocked and price_value.value is not None:
                actual = simulate(
                    cost=cost_value.value,
                    driver=Driver.PRICE,
                    driver_value=price_value.value,
                    ideal_percent=ideal_percent,
                    source_inactive="inactive_source" in warnings,
                    source_unknown="unknown_source_status" in warnings,
                )
                actual_gain_amount = decimal_to_str(actual.gain_amount)
                actual_gain_percent = decimal_to_str(actual.gain_percent)
                warnings.extend(actual.warnings)
            if ideal_percent is None:
                warnings.append("missing_ideal_margin")
            warnings = list(dict.fromkeys(warnings))
            data_status = "conflict" if blocked else "warning" if warnings else "ok"
            rows.append(
                AnalysisRow(
                    product_code=product_code,
                    description=products.get(product_code).description if products.get(product_code) else None,
                    branch_code=branch_code,
                    price_list_code=price_list.code,
                    price_list_name=price_list.description,
                    price=_effective_view(price_value),
                    cost=_effective_view(cost_value),
                    ideal_percent=decimal_to_str(ideal_percent),
                    actual_gain_amount=actual_gain_amount,
                    actual_gain_percent=actual_gain_percent,
                    data_status=data_status,
                    warnings=warnings,
                    simulation_blocked=blocked,
                )
            )

    counts = Counter(row.data_status for row in rows)
    return AnalysisResponse(
        query_date=query_date,
        price_list=PriceListView(code=price_list.code, description=price_list.description),
        rows=rows,
        counts={"total": len(rows), "ok": counts["ok"], "warning": counts["warning"], "conflict": counts["conflict"]},
    )


def product_history(db: Session, product_code: str, price_list_code: str) -> dict:
    batch = latest_batch(db)
    if batch is None:
        raise ValueError("No committed import is available")
    prices = db.scalars(
        select(PriceFact)
        .where(
            PriceFact.batch_id == batch.id,
            PriceFact.product_code == product_code,
            PriceFact.price_list_code == price_list_code,
        )
        .order_by(PriceFact.valid_from)
    ).all()
    costs = db.scalars(
        select(CostFact)
        .where(CostFact.batch_id == batch.id, CostFact.product_code == product_code)
        .order_by(CostFact.valid_from)
    ).all()
    return {
        "product_code": product_code,
        "price_list_code": price_list_code,
        "prices": [
            {"date": item.valid_from, "value": decimal_to_str(item.value), "source_row": item.source_row}
            for item in prices
        ],
        "costs": [
            {"date": item.valid_from, "value": decimal_to_str(item.value), "source_row": item.source_row}
            for item in costs
        ],
    }

