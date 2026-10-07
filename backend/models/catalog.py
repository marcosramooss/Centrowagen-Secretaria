from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class OfficialModel(BaseModel):
    id: str
    name: str
    category: Literal['turismos', 'comerciales']
    image: str | None = None
    source_url: str
    detail_url: str
    body_types: list[str] = Field(default_factory=list)
    fuels: list[str] = Field(default_factory=list)
    transmissions: list[str] = Field(default_factory=list)
    trims: list[str] = Field(default_factory=list)
    power_cv: list[int] = Field(default_factory=list)
    status: str = 'Listado en la gama oficial'


class OfficialCatalog(BaseModel):
    checked_at: datetime | None = None
    models: list[OfficialModel] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    stale: bool = False
    sync_status: str = 'pending'
    last_attempt_at: datetime | None = None
    sync_error: str | None = None
    automatic_schedule: str = 'Diariamente a las 08:00 · Europe/Madrid'
    next_sync_at: datetime | None = None
    added_model_ids: list[str] = Field(default_factory=list)


class CatalogCronEnvelope(BaseModel):
    event: Literal['schedule.triggered']
    schedule_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1, max_length=200)
    dispatch_time: str | None = None
    job_id: str | None = None
    data: None = None


class CatalogCronAck(BaseModel):
    accepted: bool = True
    duplicate: bool = False
    run_id: str