"""Available AI engines — lets the UI offer Claude / ChatGPT at runtime."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from lib.auth import get_current_user
from lib.llm import DEFAULT_MODEL, MODELS

router = APIRouter(tags=["ai"])


class AiModel(BaseModel):
    key: str
    provider: str
    model: str
    label: str
    description: str
    default: bool


@router.get("/ai/models", response_model=list[AiModel])
async def list_models(_: dict = Depends(get_current_user)):
    return [
        AiModel(
            key=key,
            provider=provider,
            model=model,
            label=label,
            description=description,
            default=key == DEFAULT_MODEL,
        )
        for key, (provider, model, label, description) in MODELS.items()
    ]
