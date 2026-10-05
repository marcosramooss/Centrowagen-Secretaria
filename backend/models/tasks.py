"""Follow-up tasks / reminders — "que ninguna oportunidad se quede sin llamar"."""

from datetime import datetime

from pydantic import BaseModel, Field

from lib.dates import today_iso
from lib.doc import new_id, now_utc

KINDS = ["Llamada", "Email", "WhatsApp", "Visita", "Prueba dinámica", "Entrega", "Seguimiento", "Otro"]
PRIORITIES = ["alta", "media", "baja"]


class TaskIn(BaseModel):
    title: str
    kind: str = "Llamada"
    client_name: str = ""
    client_phone: str = ""
    client_email: str | None = None
    vehicle_model: str = ""
    due_date: str = Field(default_factory=today_iso)  # YYYY-MM-DD
    due_time: str | None = None  # HH:MM
    priority: str = "media"
    notes: str = ""


class TaskUpdate(BaseModel):
    title: str | None = None
    kind: str | None = None
    client_name: str | None = None
    client_phone: str | None = None
    client_email: str | None = None
    vehicle_model: str | None = None
    due_date: str | None = None
    due_time: str | None = None
    priority: str | None = None
    notes: str | None = None
    status: str | None = None  # pendiente | hecha


class Task(BaseModel):
    id: str = Field(default_factory=new_id)
    owner_id: str
    owner_name: str
    title: str
    kind: str = "Llamada"
    client_name: str = ""
    client_phone: str = ""
    client_email: str | None = None
    vehicle_model: str = ""
    due_date: str
    due_time: str | None = None
    priority: str = "media"
    notes: str = ""
    status: str = "pendiente"  # pendiente | hecha
    created_at: datetime = Field(default_factory=now_utc)
    completed_at: datetime | None = None


class TaskSummary(BaseModel):
    overdue: int
    today: int
    upcoming: int  # próximos 7 días (sin contar hoy)
    pending: int
    done: int
    next_tasks: list[Task] = Field(default_factory=list)
