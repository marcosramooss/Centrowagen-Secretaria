"""Client-message generator — stream a ready-to-send WhatsApp/email/copy."""

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from lib.auth import get_current_user
from lib.doc import new_id
from lib.llm import stream_completion
from lib.rag import build_system_prompt, retrieve
from models.chat import ClientMessageIn

router = APIRouter(tags=["client-message"])


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/client-message")
async def client_message(payload: ClientMessageIn, user: dict = Depends(get_current_user)):
    context = await retrieve(f"{payload.model or ''} {payload.question}".strip())
    # Always generated in client mode: no internal information may leak into a customer message.
    system = build_system_prompt("cliente", context, user_name=user.get("name", ""))
    instruction = (
        "Genera un mensaje para un cliente.\n"
        f"Canal: {payload.channel}. Tono: {payload.tone}.\n"
        f"Cliente: {payload.client_name or 'sin nombre'}.\n"
        f"Modelo de interés: {payload.model or 'el que mejor encaje según los datos disponibles'}.\n"
        f"Consulta o contexto del cliente: {payload.question or 'interés por el vehículo'}.\n\n"
        "Reglas: usa SOLO precios, promociones y financiación presentes en los DATOS RECUPERADOS del system prompt. "
        "Si falta un dato comercial, escribe [DATO PENDIENTE DE CONFIRMACIÓN] en su lugar. No inventes nada. "
        "Devuelve ÚNICAMENTE el mensaje listo para copiar y enviar, sin comentarios adicionales."
    )

    async def gen():
        async for delta in stream_completion(system, instruction, session_id=f"clientmsg-{new_id()}"):
            yield _sse({"type": "delta", "content": delta})
        yield _sse({"type": "done"})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
