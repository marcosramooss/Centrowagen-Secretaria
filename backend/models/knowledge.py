"""Knowledge-plane models: documents, FAQ, memory, argumentario."""

from datetime import datetime

from pydantic import BaseModel, Field

from lib.dates import today_iso
from lib.doc import new_id, now_utc


class DocumentItem(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    category: str = "General"
    file_url: str | None = None
    document_type: str = "PDF"
    upload_date: str = Field(default_factory=today_iso)  # YYYY-MM-DD
    version: str = "1.0"
    source: str = "Centrowagen"
    active: bool = True
    content_text: str = ""  # texto extraíble para el RAG
    size_bytes: int | None = None
    verification_status: str = 'pending'


class FaqItem(BaseModel):
    id: str = Field(default_factory=new_id)
    category: str = "Vehículos"
    question: str
    answer: str
    source: str = "Volkswagen España"
    last_updated: datetime = Field(default_factory=now_utc)


class FaqIn(BaseModel):
    category: str = "Vehículos"
    question: str
    answer: str
    source: str = "Volkswagen España"


class MemoryItem(BaseModel):
    id: str = Field(default_factory=new_id)
    category: str = "Información comercial"
    content: str
    importance: str = "media"  # alta | media | baja
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class MemoryIn(BaseModel):
    category: str = "Información comercial"
    content: str
    importance: str = "media"


class Objection(BaseModel):
    objection: str
    response: str


class Argumentario(BaseModel):
    id: str = Field(default_factory=new_id)
    model: str
    strong_points: list[str] = Field(default_factory=list)
    ideal_customer: str = ""
    sales_arguments: list[str] = Field(default_factory=list)
    objections: list[Objection] = Field(default_factory=list)
    differences: list[str] = Field(default_factory=list)
    discovery_questions: list[str] = Field(default_factory=list)
    source: str = "Centrowagen Don Benito"
    last_updated: datetime = Field(default_factory=now_utc)


class ArgumentarioIn(BaseModel):
    model: str
    strong_points: list[str] = Field(default_factory=list)
    ideal_customer: str = ""
    sales_arguments: list[str] = Field(default_factory=list)
    objections: list[Objection] = Field(default_factory=list)
    differences: list[str] = Field(default_factory=list)
    discovery_questions: list[str] = Field(default_factory=list)
    source: str = "Centrowagen Don Benito"
