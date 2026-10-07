"""Dealer data-plane models: vehicles, stock, prices, financing, promotions."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from lib.doc import new_id, now_utc


class Dimensions(BaseModel):
    length_mm: float | None = None
    width_mm: float | None = None
    height_mm: float | None = None
    wheelbase_mm: float | None = None


class Vehicle(BaseModel):
    id: str = Field(default_factory=new_id)
    brand: str = "Volkswagen"
    model: str
    generation: str | None = None
    body_type: str = "No confirmado"
    trim: str = ""
    engine: str | None = None
    fuel: str = "No confirmado"
    hybrid_type: str | None = None
    power_cv: int | None = None
    transmission: str | None = None
    drivetrain: str | None = None
    consumption: float | None = None  # l/100 km (kWh/100 km en eléctricos)
    co2_g: int | None = None
    electric_range_km: int | None = None
    trunk_l: int | None = None
    seats: int | None = None
    dimensions: Dimensions | None = None
    technical_data: dict[str, Any] = Field(default_factory=dict)
    equipment: list[str] = Field(default_factory=list)
    image: str | None = None
    active: bool = True
    source: str = "Tarifa Volkswagen"
    source_url: str | None = None
    verification_status: str = 'pending'
    last_updated: datetime = Field(default_factory=now_utc)


class VehicleIn(BaseModel):
    model: str
    generation: str | None = None
    body_type: str = "No confirmado"
    trim: str = ""
    engine: str | None = None
    fuel: str = "No confirmado"
    hybrid_type: str | None = None
    power_cv: int | None = None
    transmission: str | None = None
    drivetrain: str | None = None
    consumption: float | None = None
    co2_g: int | None = None
    electric_range_km: int | None = None
    trunk_l: int | None = None
    seats: int | None = None
    dimensions: Dimensions | None = None
    technical_data: dict[str, Any] = Field(default_factory=dict)
    equipment: list[str] = Field(default_factory=list)
    image: str | None = None
    source: str = "Tarifa Volkswagen"
    source_url: str | None = None


class StockUnit(BaseModel):
    verification_status: str = 'pending'
    source: str = 'Registro del concesionario'
    id: str = Field(default_factory=new_id)
    vehicle_id: str
    stock_number: str
    vin: str | None = None
    model: str
    trim: str = ""
    engine: str | None = None
    power: int | None = None
    transmission: str | None = None
    exterior_color: str = ""
    interior_color: str | None = None
    options: list[str] = Field(default_factory=list)
    pvp: float | None = None
    promotional_price: float | None = None
    financing_price: float | None = None
    availability: str = "No confirmado"
    location: str = "Don Benito"
    delivery_estimate: str | None = None
    last_updated: datetime = Field(default_factory=now_utc)


class StockIn(BaseModel):
    vehicle_id: str
    stock_number: str
    vin: str | None = None
    model: str
    trim: str = ""
    engine: str | None = None
    power: int | None = None
    transmission: str | None = None
    exterior_color: str = ""
    interior_color: str | None = None
    options: list[str] = Field(default_factory=list)
    pvp: float | None = None
    promotional_price: float | None = None
    financing_price: float | None = None
    availability: str = "No confirmado"
    location: str = "Don Benito"
    delivery_estimate: str | None = None


class PriceEntry(BaseModel):
    verification_status: str = 'pending'
    id: str = Field(default_factory=new_id)
    vehicle_id: str
    base_price: float
    promotional_price: float | None = None
    financing_price: float | None = None
    discount: float | None = None  # %
    campaign: str | None = None
    valid_from: str | None = None  # YYYY-MM-DD
    valid_until: str | None = None
    source: str = "Tarifa Volkswagen"
    last_updated: datetime = Field(default_factory=now_utc)


class PriceIn(BaseModel):
    vehicle_id: str
    base_price: float
    promotional_price: float | None = None
    financing_price: float | None = None
    discount: float | None = None
    campaign: str | None = None
    valid_from: str | None = None
    valid_until: str | None = None
    source: str = "Tarifa Volkswagen"


class FinancingOffer(BaseModel):
    id: str = Field(default_factory=new_id)
    vehicle_id: str | None = None  # None → campaña genérica
    campaign: str
    entry_payment: float
    financed_amount: float
    monthly_payment: float
    number_of_payments: int
    final_payment: float | None = None
    tin: float
    tae: float
    opening_fee: float | None = None
    total_amount: float | None = None
    conditions: str = ""
    valid_from: str | None = None
    valid_until: str | None = None
    source: str = "Volkswagen Financial Services"
    last_updated: datetime = Field(default_factory=now_utc)


class FinancingIn(BaseModel):
    vehicle_id: str | None = None
    campaign: str
    entry_payment: float
    financed_amount: float
    monthly_payment: float
    number_of_payments: int
    final_payment: float | None = None
    tin: float
    tae: float
    opening_fee: float | None = None
    total_amount: float | None = None
    conditions: str = ""
    valid_from: str | None = None
    valid_until: str | None = None
    source: str = "Volkswagen Financial Services"


class Promotion(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    model: str
    description: str = ""
    discount: str | None = None
    conditions: str = ""
    financing_required: bool = False
    valid_from: str | None = None
    valid_until: str | None = None
    source: str = "Volkswagen España"
    last_updated: datetime = Field(default_factory=now_utc)
    status: str = "activa"  # calculado en el servidor, nunca confiado del cliente


class PromotionIn(BaseModel):
    name: str
    model: str
    description: str = ""
    discount: str | None = None
    conditions: str = ""
    financing_required: bool = False
    valid_from: str | None = None
    valid_until: str | None = None
    source: str = "Volkswagen España"


class VehicleDetail(BaseModel):
    vehicle: Vehicle
    price: PriceEntry | None = None
    financing: list[FinancingOffer] = Field(default_factory=list)
    promotions: list[Promotion] = Field(default_factory=list)
    stock: list[StockUnit] = Field(default_factory=list)
    argumentario: Any | None = None
    related_faq: list[Any] = Field(default_factory=list)
