"""Available AI engines — lets the UI offer Claude / ChatGPT at runtime."""

from fastapi import APIRouter, Depends

from lib.auth import get_current_user
from models.local_chat import AiModel

router = APIRouter(tags=["ai"])




@router.get("/ai/models", response_model=list[AiModel])
async def list_models(_: dict = Depends(get_current_user)):
    return [AiModel(key='local', provider='local', model='local-lookup', label='Consulta local · sin créditos de IA',
        description='Busca datos y extractos en el proyecto. Sin IA generativa ni llamadas a proveedores de pago.', default=True)]
