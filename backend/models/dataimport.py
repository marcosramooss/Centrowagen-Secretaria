"""Modelos del importador genérico (vehículos y stock) y de la biblioteca de fotos."""

from pydantic import BaseModel, Field


class ImportRowResult(BaseModel):
    row: int
    label: str = ""
    action: str = "ignorada"  # creada | actualizada | ignorada
    message: str = ""


class ImportResult(BaseModel):
    filename: str
    detected_columns: dict[str, str] = Field(default_factory=dict)
    created: int = 0
    updated: int = 0
    skipped: int = 0
    rows: list[ImportRowResult] = Field(default_factory=list)


class ModelImage(BaseModel):
    model_name: str
    image: str
