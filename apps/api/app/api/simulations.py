from fastapi import APIRouter, HTTPException

from app.api.dependencies import CurrentUser, DbSession
from app.db.base import AuditEvent, SimulationEvent
from app.domain.decimal_utils import decimal_to_str
from app.domain.simulation import simulate
from app.domain.types import Driver
from app.schemas.api import SimulationInput, SimulationOutput

router = APIRouter(prefix="/simulations", tags=["simulations"])


def serialize_result(result, event_id: str | None = None) -> SimulationOutput:
    return SimulationOutput(
        id=event_id,
        price=decimal_to_str(result.price),
        gain_amount=decimal_to_str(result.gain_amount),
        gain_percent=decimal_to_str(result.gain_percent),
        ideal_amount=decimal_to_str(result.ideal_amount),
        ideal_price=decimal_to_str(result.ideal_price),
        gap_amount=decimal_to_str(result.gap_amount),
        gap_percentage_points=decimal_to_str(result.gap_percentage_points),
        thermometer=result.thermometer.value,
        warnings=list(result.warnings),
    )


@router.post("/evaluate", response_model=SimulationOutput)
def evaluate(payload: SimulationInput, user: CurrentUser) -> SimulationOutput:
    try:
        return serialize_result(
            simulate(
                cost=payload.cost,
                driver=Driver(payload.driver),
                driver_value=payload.driver_value,
                ideal_percent=payload.ideal_percent,
                source_inactive=payload.source_inactive,
                source_unknown=payload.source_unknown,
            )
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/save", response_model=SimulationOutput)
def save(payload: SimulationInput, db: DbSession, user: CurrentUser) -> SimulationOutput:
    try:
        result = simulate(
            cost=payload.cost,
            driver=Driver(payload.driver),
            driver_value=payload.driver_value,
            ideal_percent=payload.ideal_percent,
            source_inactive=payload.source_inactive,
            source_unknown=payload.source_unknown,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    event = SimulationEvent(
        actor_id=user.id,
        product_code=payload.product_code,
        price_list_code=payload.price_list_code,
        query_date=payload.query_date,
        input_payload=payload.model_dump(mode="json"),
        result_payload=serialize_result(result).model_dump(mode="json"),
    )
    db.add(event)
    db.flush()
    db.add(AuditEvent(actor_id=user.id, action="simulation.saved", entity_type="simulation", entity_id=event.id, details={"product_code": payload.product_code, "price_list_code": payload.price_list_code}))
    db.commit()
    return serialize_result(result, event.id)

