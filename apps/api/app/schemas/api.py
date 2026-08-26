from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=256)


class UserView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserView


class IssueView(BaseModel):
    issue_type: str
    severity: str
    sheet_name: str
    business_key: str
    explanation: str
    source_rows: list[int] = []
    values: list[str | None] = []


class PreviewResponse(BaseModel):
    preview_id: str
    filename: str
    sha256: str
    summary: dict[str, int]
    issues: list[IssueView]


class CommitResponse(BaseModel):
    batch_id: str
    summary: dict[str, int]


class PriceListView(BaseModel):
    code: str
    description: str


class EffectiveView(BaseModel):
    value: str | None
    valid_from: date | None
    status: str
    warnings: list[str]


class AnalysisRow(BaseModel):
    product_code: str
    description: str | None
    branch_code: str
    price_list_code: str
    price_list_name: str
    price: EffectiveView
    cost: EffectiveView
    ideal_percent: str | None
    actual_gain_amount: str | None
    actual_gain_percent: str | None
    data_status: str
    warnings: list[str]
    simulation_blocked: bool


class AnalysisResponse(BaseModel):
    query_date: date
    price_list: PriceListView
    rows: list[AnalysisRow]
    counts: dict[str, int]


class SimulationInput(BaseModel):
    product_code: str
    price_list_code: str
    query_date: date
    cost: Decimal | None
    ideal_percent: Decimal | None
    driver: Literal["price", "gain_amount", "gain_percent"]
    driver_value: Decimal
    source_inactive: bool = False
    source_unknown: bool = False


class SimulationOutput(BaseModel):
    id: str | None = None
    price: str | None
    gain_amount: str | None
    gain_percent: str | None
    ideal_amount: str | None
    ideal_price: str | None
    gap_amount: str | None
    gap_percentage_points: str | None
    thermometer: str
    warnings: list[str]


class ExportRequest(BaseModel):
    query_date: date
    price_list_code: str
    simulations: dict[str, SimulationInput] = {}

