"""Modelos del importador genérico (vehículos y stock) y de la biblioteca de fotos."""

from pydantic import BaseModel, Field
from typing import Any, Literal


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


class PreviewRow(BaseModel):
    row: int
    label: str
    action: Literal['crear', 'actualizar', 'rechazada']
    message: str = ''
    values: dict[str, Any] = Field(default_factory=dict)
    changes: dict[str, Any] = Field(default_factory=dict)


class ImportPreview(BaseModel):
    id: str
    kind: Literal['vehicles', 'stock']
    filename: str
    detected_columns: dict[str, str]
    rows: list[PreviewRow]
    valid_rows: int
    rejected_rows: int


class ConfirmImport(BaseModel):
    preview_id: str
    confirm: Literal[True]
