"""Local evidence lookup over the dealership database, delivered using SSE; no LLM calls."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from lib.auth import get_current_user
from lib.db import db
from lib.doc import new_id, now_utc, prepare
from lib.local_assistant import answer_local
from models.local_chat import LocalAnswer
from models.chat import ChatMeta, ChatMsg, ChatSend

router = APIRouter(tags=["chat"])


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(payload: ChatSend, user: dict = Depends(get_current_user)):
    if not payload.message.strip():
        raise HTTPException(422, 'Escribe una consulta')
    chat_id = payload.chat_id or new_id()
    now = now_utc()
    if payload.chat_id:
        existing = await db.chats.find_one({'id': chat_id, 'user_id': user['id']})
        if not existing:
            raise HTTPException(404, 'Conversación no encontrada')
    previous = await db.messages.find_one({'chat_id': chat_id, 'role': 'user'}, sort=[('created_at', -1)])
    if not payload.chat_id:
        await db.chats.insert_one(
            {
                "id": chat_id,
                "user_id": user["id"],
                "title": payload.message[:70],
                "created_at": now,
                "updated_at": now,
            }
        )
    await db.messages.insert_one(
        {
            "id": new_id(),
            "chat_id": chat_id,
            "role": "user",
            "content": payload.message,
            "sources": [],
            "created_at": now,
        }
    )

    try:
        answer = await answer_local(payload.message, payload.mode, (previous or {}).get('content', ''))
    except Exception:
        logging.getLogger(__name__).exception('Local lookup failed')
        answer = LocalAnswer(content='No se pudo consultar la información local. Inténtalo de nuevo o abre las secciones del panel. No se ha llamado a ningún servicio de IA.', external_help=True)
    sources = [s.model_dump() for s in answer.sources]

    async def gen():
        yield _sse({"type": "meta", "chat_id": chat_id, "sources": sources, "engine": answer.engine, 'external_help': answer.external_help})
        content = answer.content
        for start in range(0, len(content), 240):
            yield _sse({'type': 'delta', 'content': content[start:start + 240]})
        await db.messages.insert_one(
            {
                "id": new_id(),
                "chat_id": chat_id,
                "role": "assistant",
                "content": content,
                "sources": sources,
                "created_at": now_utc(),
                'engine': answer.engine,
                'external_help': answer.external_help,
            }
        )
        await db.chats.update_one({"id": chat_id}, {"$set": {"updated_at": now_utc()}})
        yield _sse({"type": "done"})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/chats", response_model=list[ChatMeta])
async def list_chats(user: dict = Depends(get_current_user)):
    docs = await db.chats.find({"user_id": user["id"]}).sort("updated_at", -1).to_list(50)
    return [ChatMeta(**prepare(d, "created_at", "updated_at")) for d in docs]


@router.get("/chats/{cid}/messages", response_model=list[ChatMsg])
async def list_messages(cid: str, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"id": cid})
    if not chat or (chat.get("user_id") != user["id"] and user.get("role") != "admin"):
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    docs = await db.messages.find({"chat_id": cid}).sort("created_at", 1).to_list(500)
    return [ChatMsg(**prepare(d, "created_at")) for d in docs]


@router.delete("/chats/{cid}")
async def delete_chat(cid: str, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"id": cid})
    if not chat or (chat.get("user_id") != user["id"] and user.get("role") != "admin"):
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    await db.messages.delete_many({"chat_id": cid})
    await db.chats.delete_one({"id": cid})
    return {"ok": True}
