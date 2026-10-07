"""Client-message generator — stream a ready-to-send WhatsApp/email/copy."""

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from lib.auth import get_current_user
from lib.local_assistant import answer_local, text
from models.chat import ClientMessageIn

router = APIRouter(tags=["client-message"])


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/client-message")
async def client_message(payload: ClientMessageIn, user: dict = Depends(get_current_user)):
    answer = await answer_local(f'{payload.model or ""} {payload.question}'.strip(), mode='cliente')
    greeting = f'Hola{", " + text(payload.client_name) if payload.client_name else ""}.'
    if payload.channel == 'email':
        greeting = f'Buenos días{", " + text(payload.client_name) if payload.client_name else ""}.'
    content = f'{greeting}\n\n{answer.content}\n\nQuedamos a tu disposición en Centrowagen Don Benito.'

    async def gen():
        for start in range(0, len(content), 240):
            yield _sse({'type': 'delta', 'content': content[start:start + 240]})
        yield _sse({"type": "done"})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
