"""Sales register + commission models."""

from datetime import datetime

from pydantic import BaseModel, Field

from lib.dates import today_iso
from lib.doc import new_id, now_utc


class SaleIn(BaseModel):
    sale_date: str = Field(default_factory=today_iso)  # YYYY-MM-DD
    client_name: str
    vehicle_model: str
    stock_number: str | None = None
    pvp: float
    discount: float = 0.0
    commission_rate: float | None = None  # % — por defecto, el de settings
    status: str = "Reserva"  # Reserva | Cerrada | Entregada | Cancelada
    notes: str = ""


class SaleOut(BaseModel):
    id: str = Field(default_factory=new_id)
    seller_id: str
    seller_name: str
    sale_date: str
    client_name: str
    vehicle_model: str
    stock_number: str | None = None
    pvp: float
    discount: float = 0.0
    commission_rate: float
    commission_estimated: float
    status: str
    notes: str = ""
    created_at: datetime = Field(default_factory=now_utc)


class SettingsOut(BaseModel):
    commission_rate: float
    monthly_target: float


class SettingsIn(BaseModel):
    commission_rate: float | None = None
    monthly_target: float | None = None


class SalesSummary(BaseModel):
    month_sales: int
    month_pvp: float
    month_commission: float
    year_sales: int
    year_commission: float
    commission_rate: float
    monthly_target: float
