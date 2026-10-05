"""SecretarIA chat — SSE streaming with RAG over the dealer database."""

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from lib.auth import get_current_user
from lib.db import db
from lib.doc import new_id, now_utc, prepare
from lib.llm import stream_completion
from lib.rag import build_system_prompt, context_sources, retrieve
from models.chat import ChatMeta, ChatMsg, ChatSend

router = APIRouter(tags=["chat"])


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(payload: ChatSend, user: dict = Depends(get_current_user)):
    chat_id = payload.chat_id or new_id()
    now = now_utc()
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

    context = await retrieve(payload.message)
    sources = context_sources(context)
    stripped = payload.message.strip()
    command = stripped.split(" ", 1)[0] if stripped.startswith("/") else None
    system = build_system_prompt(payload.mode, context, command=command, user_name=user.get("name", ""))

    history_docs = await db.messages.find({"chat_id": chat_id}).sort("created_at", -1).to_list(9)
    history_docs = list(reversed(history_docs))[:-1]  # exclude the message stored just above
    history_block = "\n".join(
        f"{'Vendedor' if m.get('role') == 'user' else 'SecretarIA'}: {str(m.get('content', ''))[:500]}"
        for m in history_docs
    )
    user_text = (
        f"Conversación previa:\n{history_block}\n\nPregunta actual: {payload.message}"
        if history_block
        else payload.message
    )

    async def gen():
        yield _sse({"type": "meta", "chat_id": chat_id, "sources": sources})
        chunks: list[str] = []
        try:
            async for delta in stream_completion(system, user_text, session_id=f"secretaria-{new_id()}"):
                chunks.append(delta)
                yield _sse({"type": "delta", "content": delta})
        except Exception as exc:  # never strand the UI without a close event
            yield _sse(
                {
                    "type": "delta",
                    "content": f"\n\n⚠️ No he podido completar la respuesta ({exc}). Inténtalo de nuevo o consulta los datos en las secciones del panel.",
                }
            )
        content = "".join(chunks)
        await db.messages.insert_one(
            {
                "id": new_id(),
                "chat_id": chat_id,
                "role": "assistant",
                "content": content,
                "sources": sources,
                "created_at": now_utc(),
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
