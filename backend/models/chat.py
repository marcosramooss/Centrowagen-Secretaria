"""Chat + client-message-generator models + stored client-message records."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from lib.doc import new_id, now_utc


class ChatSend(BaseModel):
    message: str
    chat_id: str | None = None
    mode: str = "vendedor"  # vendedor | cliente


class ChatMeta(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime | None = None


class ChatMsg(BaseModel):
    id: str
    chat_id: str
    role: str  # user | assistant
    content: str
    sources: list[dict[str, Any]] = []
    created_at: datetime


class ClientMessageIn(BaseModel):
    channel: str = "whatsapp"  # whatsapp | email | corto
    tone: str = "profesional"  # entusiasta | profesional | urgente
    client_name: str | None = None
    model: str | None = None
    question: str = ""


class ClientMessageCreate(BaseModel):
    client_name: str
    client_email: EmailStr | None = None
    model: str | None = None
    channel: str = "whatsapp"
    tone: str = "profesional"
    question: str = ""
    content: str = ""


class ClientMessageRecord(BaseModel):
    id: str = Field(default_factory=new_id)
    seller_id: str
    seller_name: str
    client_name: str
    client_email: str | None = None
    model: str | None = None
    channel: str = "whatsapp"
    tone: str = "profesional"
    question: str = ""
    content: str = ""
    created_at: datetime = Field(default_factory=now_utc)
