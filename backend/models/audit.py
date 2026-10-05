"""Audit models — verify a commercial datum against the stored information."""

from typing import Any

from pydantic import BaseModel


class AuditIn(BaseModel):
    kind: str = "precio"  # precio | promocion | dato
    model: str | None = None
    claim: str = ""
    value: float | None = None


class AuditResult(BaseModel):
    estado: str  # confirmado | verificar | incorrecto
    mensaje: str
    coincidencias: list[dict[str, Any]] = []
    fuentes: list[dict[str, Any]] = []
