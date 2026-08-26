from collections import Counter
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.db.base import QualityIssue
from app.schemas.api import AnalysisResponse, IssueView, PriceListView
from app.services.analysis import analyze, list_price_lists, product_history
from app.services.persistence import latest_batch

router = APIRouter(tags=["analysis"])


@router.get("/price-lists", response_model=list[PriceListView])
def price_lists(db: DbSession, user: CurrentUser) -> list[PriceListView]:
    return list_price_lists(db)


@router.get("/analysis", response_model=AnalysisResponse)
def analysis_view(
    db: DbSession,
    user: CurrentUser,
    query_date: date = Query(alias="date"),
    price_list: str = Query(alias="price_list"),
    data_status: str | None = Query(default=None, alias="status"),
) -> AnalysisResponse:
    try:
        response = analyze(db, query_date, price_list)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    if data_status:
        response.rows = [row for row in response.rows if row.data_status == data_status]
        counts = Counter(row.data_status for row in response.rows)
        response.counts = {"total": len(response.rows), "ok": counts["ok"], "warning": counts["warning"], "conflict": counts["conflict"]}
    return response


@router.get("/products/{product_code}/history")
def history(
    product_code: str,
    db: DbSession,
    user: CurrentUser,
    price_list: str = Query(alias="price_list"),
):
    try:
        return product_history(db, product_code, price_list)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/quality/issues", response_model=list[IssueView])
def quality_issues(db: DbSession, user: CurrentUser) -> list[IssueView]:
    batch = latest_batch(db)
    if batch is None:
        return []
    return [
        IssueView.model_validate(
            {
                "issue_type": item.issue_type,
                "severity": item.severity,
                "sheet_name": item.sheet_name,
                "business_key": item.business_key,
                "explanation": item.explanation,
                "source_rows": item.source_rows,
                "values": item.values,
            }
        )
        for item in db.scalars(select(QualityIssue).where(QualityIssue.batch_id == batch.id)).all()
    ]

