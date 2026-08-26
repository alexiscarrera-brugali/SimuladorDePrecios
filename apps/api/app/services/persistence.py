from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import (
    AuditEvent,
    CostFact,
    ImportBatch,
    PriceFact,
    PriceList,
    Product,
    QualityIssue,
    RawRecord,
    TheoreticalMargin,
)
from app.services.importer import parse_workbook


def commit_workbook(db: Session, path: Path, filename: str, actor_id: str) -> ImportBatch:
    parsed = parse_workbook(path)
    batch = ImportBatch(
        filename=filename,
        sha256=parsed.sha256,
        status="committed",
        imported_by=actor_id,
        summary=parsed.summary,
    )
    db.add(batch)
    db.flush()

    for item in parsed.raw_records:
        db.add(RawRecord(batch_id=batch.id, **item))

    existing_lists = {item.code: item for item in db.scalars(select(PriceList)).all()}
    for item in parsed.price_lists:
        if item["code"] in existing_lists:
            existing_lists[item["code"]].description = item["description"]
        else:
            db.add(PriceList(**item))

    existing_products = {item.code: item for item in db.scalars(select(Product)).all()}
    descriptions = {
        item["product_code"]: item["description"]
        for item in parsed.costs
        if item.get("description")
    }
    for product_code in {item["product_code"] for item in parsed.prices + parsed.costs}:
        if product_code in existing_products:
            if descriptions.get(product_code):
                existing_products[product_code].description = descriptions[product_code]
        else:
            db.add(Product(code=product_code, description=descriptions.get(product_code)))

    for item in parsed.prices:
        db.add(PriceFact(batch_id=batch.id, **item))
    for item in parsed.costs:
        db.add(CostFact(batch_id=batch.id, **item))
    for item in parsed.margins:
        db.add(TheoreticalMargin(batch_id=batch.id, **item))
    for issue in parsed.issues:
        db.add(QualityIssue(batch_id=batch.id, **issue.as_dict()))

    db.add(
        AuditEvent(
            actor_id=actor_id,
            action="import.committed",
            entity_type="import_batch",
            entity_id=batch.id,
            details={"filename": filename, "sha256": parsed.sha256, "summary": parsed.summary},
        )
    )
    db.commit()
    db.refresh(batch)
    return batch


def latest_batch(db: Session) -> ImportBatch | None:
    return db.scalar(
        select(ImportBatch)
        .where(ImportBatch.status == "committed")
        .order_by(ImportBatch.imported_at.desc())
        .limit(1)
    )

