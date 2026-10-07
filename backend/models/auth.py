"""Auth models."""

from pydantic import BaseModel, EmailStr, Field


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SetupStatus(BaseModel):
    required: bool


class SetupIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=5, max_length=128)
    setup_token: str = Field(min_length=16, max_length=200)


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str  # admin | vendedor
