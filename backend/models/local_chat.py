from pydantic import BaseModel, Field


class LocalSource(BaseModel):
    name: str
    updated: str
    estado: str
    url: str | None = None


class LocalAnswer(BaseModel):
    content: str
    sources: list[LocalSource] = Field(default_factory=list)
    external_help: bool = False
    engine: str = 'Consulta local · sin IA generativa'


class AiModel(BaseModel):
    key: str
    provider: str
    model: str
    label: str
    description: str
    default: bool