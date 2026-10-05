"""LLM wrapper — Claude and ChatGPT via the Emergent universal key (emergentintegrations).

Streaming is the default path for every user-facing response. The model is
switchable at runtime: the frontend sends a model key, we resolve it here.
"""

import os

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

# key → (provider, model, etiqueta, descripción)
MODELS: dict[str, tuple[str, str, str, str]] = {
    "claude": ("anthropic", "claude-sonnet-5-5", "Claude Sonnet 5.5", "Equilibrado y muy preciso con los datos (recomendado)"),
    "chatgpt": ("openai", "gpt-5.6-terra", "ChatGPT GPT-5.6", "Respuestas comerciales ágiles y naturales"),
    "chatgpt-mini": ("openai", "gpt-5.4-mini", "ChatGPT GPT-5.4 mini", "El más rápido y económico"),
    "claude-opus": ("anthropic", "claude-opus-5-5", "Claude Opus 5.5", "Máximo razonamiento para comparativas complejas"),
}

DEFAULT_MODEL = "claude"


def resolve(model_key: str | None) -> tuple[str, str]:
    provider, model, _, _ = MODELS.get(model_key or DEFAULT_MODEL, MODELS[DEFAULT_MODEL])
    return provider, model


def model_label(model_key: str | None) -> str:
    return MODELS.get(model_key or DEFAULT_MODEL, MODELS[DEFAULT_MODEL])[2]


def llm_key() -> str:
    return os.environ.get("EMERGENT_LLM_KEY", "")


async def stream_completion(
    system_message: str,
    user_text: str,
    session_id: str,
    model_key: str | None = None,
):
    """Yield text deltas from the selected provider."""
    if not llm_key():
        yield "⚠️ El motor de IA no está configurado (falta EMERGENT_LLM_KEY en backend/.env)."
        return
    provider, model = resolve(model_key)
    chat = LlmChat(
        api_key=llm_key(),
        session_id=session_id,
        system_message=system_message,
    ).with_model(provider, model)
    async for event in chat.stream_message(UserMessage(text=user_text)):
        if isinstance(event, TextDelta):
            yield event.content
        elif isinstance(event, StreamDone):
            break
