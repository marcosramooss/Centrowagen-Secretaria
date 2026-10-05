"""LLM wrapper — Claude via the Emergent universal key (emergentintegrations)."""

import os

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-5-5"


def llm_key() -> str:
    return os.environ.get("EMERGENT_LLM_KEY", "")


async def stream_completion(system_message: str, user_text: str, session_id: str):
    """Yield text deltas. Streaming is the default path for all user-facing responses."""
    if not llm_key():
        yield "⚠️ El motor de IA no está configurado (falta EMERGENT_LLM_KEY en backend/.env)."
        return
    chat = LlmChat(
        api_key=llm_key(),
        session_id=session_id,
        system_message=system_message,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)
    async for event in chat.stream_message(UserMessage(text=user_text)):
        if isinstance(event, TextDelta):
            yield event.content
        elif isinstance(event, StreamDone):
            break
