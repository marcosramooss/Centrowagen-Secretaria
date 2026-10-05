"""Auth router — httpOnly cookie sessions (no tokens in JSON bodies)."""

import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from lib.auth import (
    COOKIE_NAME,
    create_session,
    destroy_session,
    get_current_user,
    verify_password,
)
from lib.db import db
from models.auth import LoginIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(doc: dict) -> UserOut:
    return UserOut(id=doc["id"], name=doc["name"], email=doc["email"], role=doc["role"])


@router.post("/login", response_model=UserOut)
async def login(payload: LoginIn, response: Response):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    await create_session(response, user["id"])
    return _user_out(user)


@router.post("/logout")
async def logout(request: Request, response: Response):
    await destroy_session(request)
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return _user_out(user)


@router.get("/users", response_model=list[UserOut])
async def list_users(_: dict = Depends(get_current_user)):
    docs = await db.users.find({}, {"password_hash": 0}).to_list(200)
    return [_user_out(d) for d in docs]


class GoogleAuthIn(BaseModel):
    session_id: str


@router.post("/google", response_model=UserOut)
async def google_auth(payload: GoogleAuthIn, response: Response):
    # Emergent managed Google Auth — the session_id exchange MUST happen backend-side.
    async with httpx.AsyncClient(timeout=30) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="La sesión de Google no es válida o ha caducado")
    data = r.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=401, detail="Google no devolvió un email válido")

    # Store the platform session token server-side with timezone-aware expiry (7 days).
    await db.google_sessions.insert_one(
        {
            "session_token": data.get("session_token"),
            "email": email,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        }
    )

    # Reuse the existing user when the email matches; Google users default to VENDEDOR.
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "name": data.get("name") or email.split("@")[0],
            "email": email,
            "role": "vendedor",
            "password_hash": "",
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)

    await create_session(response, user["id"])
    return _user_out(user)
