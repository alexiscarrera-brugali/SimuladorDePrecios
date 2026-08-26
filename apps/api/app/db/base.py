import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def new_id() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Role(StrEnum):
    ADMIN_IMPORTER = "admin_importer"
    FUNCTIONAL = "functional"
    TESTER = "tester"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(32), default=Role.TESTER.value)
    password_hash: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    filename: Mapped[str] = mapped_column(String(255))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(24), default="preview")
    imported_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)


class RawRecord(Base):
    __tablename__ = "raw_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.id"), index=True)
    sheet_name: Mapped[str] = mapped_column(String(64), index=True)
    source_row: Mapped[int]
    payload: Mapped[dict] = mapped_column(JSON)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(255))


class PriceList(Base):
    __tablename__ = "price_lists"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(160))


class PriceFact(Base):
    __tablename__ = "price_facts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.id"), index=True)
    branch_code: Mapped[str] = mapped_column(String(40), index=True)
    price_list_code: Mapped[str] = mapped_column(String(40), index=True)
    product_code: Mapped[str] = mapped_column(String(80), index=True)
    valid_from: Mapped[date] = mapped_column(Date, index=True)
    value: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    source_status: Mapped[str] = mapped_column(String(16), default="unknown")
    source_row: Mapped[int]


class CostFact(Base):
    __tablename__ = "cost_facts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.id"), index=True)
    branch_code: Mapped[str] = mapped_column(String(40), index=True)
    product_code: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str | None] = mapped_column(String(255))
    valid_from: Mapped[date] = mapped_column(Date, index=True)
    value: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    source_status: Mapped[str] = mapped_column(String(16), default="unknown")
    source_row: Mapped[int]


class TheoreticalMargin(Base):
    __tablename__ = "theoretical_margins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.id"), index=True)
    price_list_name: Mapped[str] = mapped_column(String(160), index=True)
    product_code: Mapped[str] = mapped_column(String(80), index=True)
    percentage: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    is_ambiguous: Mapped[bool] = mapped_column(default=False)
    source_row: Mapped[int]


class QualityIssue(Base):
    __tablename__ = "quality_issues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.id"), index=True)
    issue_type: Mapped[str] = mapped_column(String(80), index=True)
    severity: Mapped[str] = mapped_column(String(16), index=True)
    sheet_name: Mapped[str] = mapped_column(String(64))
    business_key: Mapped[str] = mapped_column(String(320), index=True)
    explanation: Mapped[str] = mapped_column(Text)
    source_rows: Mapped[list] = mapped_column(JSON, default=list)
    values: Mapped[list] = mapped_column(JSON, default=list)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(80))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class SimulationEvent(Base):
    __tablename__ = "simulation_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    product_code: Mapped[str] = mapped_column(String(80), index=True)
    price_list_code: Mapped[str] = mapped_column(String(40), index=True)
    query_date: Mapped[date] = mapped_column(Date)
    input_payload: Mapped[dict] = mapped_column(JSON)
    result_payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
