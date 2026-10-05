"""Tariff import models — Excel/CSV → precios y stock."""

from pydantic import BaseModel, Field


class TariffRow(BaseModel):
    row: int
    model: str = ""
    trim: str = ""
    base_price: float | None = None
    promotional_price: float | None = None
    financing_price: float | None = None
    discount: float | None = None
    campaign: str | None = None
    status: str  # actualizable | nueva | no_reconocida
    vehicle_id: str | None = None
    current_price: float | None = None
    message: str = ""


class TariffPreview(BaseModel):
    filename: str
    detected_columns: dict[str, str]  # campo lógico → cabecera encontrada
    total_rows: int
    updatable: int
    new_rows: int
    unrecognized: int
    rows: list[TariffRow] = Field(default_factory=list)


class TariffApplyIn(BaseModel):
    source: str = "Tarifa Volkswagen"
    update_stock: bool = True
    rows: list[TariffRow] = Field(default_factory=list)


class TariffApplyResult(BaseModel):
    prices_updated: int
    prices_created: int
    stock_updated: int
    skipped: int
    messages: list[str] = Field(default_factory=list)
