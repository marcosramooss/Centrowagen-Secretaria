"""Stored client messages (seller's generated replies) + managed-Resend email sending.

G4 compliance: the send route takes ONLY a record id — the recipient, subject and
HTML body all come from server-side records/templates with escaped interpolation.
"""

import logging
import time
from html import escape

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user
from lib.db import db
from lib.doc import now_utc, prepare
from lib.email import send_email
from models.chat import ClientMessageCreate, ClientMessageRecord

router = APIRouter(tags=["client-messages"])
logger = logging.getLogger(__name__)

# Per-user rate limit for sends — transactional tool, not bulk (G5).
_SEND_LOG: dict[str, list[float]] = {}
_SEND_LIMIT_PER_HOUR = 10


def _email_html(record: dict) -> str:
    """Server-side template — all dynamic content escaped, no links, no forms."""
    paragraphs = [escape(line) for line in record.get("content", "").splitlines() if line.strip()]
    body = "".join(f'<p style="margin:0 0 12px">{p}</p>' for p in paragraphs)
    greeting = escape(record.get("client_name") or "Hola")
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px">'
        '<tr><td align="center">'
        '<table role="presentation" width="600" style="max-width:600px;background:#111c33;border-radius:16px;padding:32px;font-family:Arial,sans-serif;color:#f8fafc">'
        '<tr><td style="color:#38bdf8;font-weight:bold;font-size:18px;padding-bottom:12px">SecretarIA — Centrowagen Don Benito</td></tr>'
        f'<tr><td style="font-size:14px;color:#f8fafc"><p style="margin:0 0 12px"><strong>{greeting}</strong>,</p>{body}</td></tr>'
        '<tr><td style="font-size:11px;color:#94a3b8;padding-top:16px">Enviado por SecretarIA · Centrowagen Don Benito (concesionario oficial Volkswagen). '
        'Datos sujetos a confirmación por jefatura. Nunca te pediremos contraseñas ni datos de tarjeta por email.</td></tr>'
        '</table></td></tr></table>'
    )


@router.get("/client-messages", response_model=list[ClientMessageRecord])
async def list_client_messages(user: dict = Depends(get_current_user)):
    flt = {} if user.get("role") == "admin" else {"seller_id": user["id"]}
    docs = await db.client_messages.find(flt).sort("created_at", -1).to_list(200)
    return [ClientMessageRecord(**prepare(d, "created_at")) for d in docs]


@router.post("/client-messages", response_model=ClientMessageRecord)
async def create_client_message(payload: ClientMessageCreate, user: dict = Depends(get_current_user)):
    obj = ClientMessageRecord(seller_id=user["id"], seller_name=user["name"], **payload.model_dump())
    await db.client_messages.insert_one(obj.model_dump())
    return obj


@router.post("/client-messages/{mid}/send")
async def send_client_message(mid: str, user: dict = Depends(get_current_user)):
    record = await db.client_messages.find_one({"id": mid})
    if not record or (record.get("seller_id") != user["id"] and user.get("role") != "admin"):
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    if not record.get("client_email"):
        raise HTTPException(status_code=400, detail="Este mensaje no tiene email de cliente asignado")

    now = time.time()
    log = [t for t in _SEND_LOG.get(user["id"], []) if now - t < 3600]
    if len(log) >= _SEND_LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail=f"Límite de {_SEND_LIMIT_PER_HOUR} envíos por hora alcanzado")
    log.append(now)
    _SEND_LOG[user["id"]] = log

    subject = f"Tu {escape(record.get('model') or 'Volkswagen')} — Centrowagen Don Benito"
    email_id = await send_email(to=record["client_email"], subject=subject, html=_email_html(record))
    await db.client_messages.update_one({"id": mid}, {"$set": {"sent_at": now_utc()}})
    return {"ok": True, "email_id": email_id}
