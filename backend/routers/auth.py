"""Auth router — httpOnly cookie sessions (no tokens in JSON bodies)."""

import uuid
import os
import secrets
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
    hash_password,
    require_admin,
)
from lib.db import db
from models.auth import LoginIn, UserOut, SetupIn, SetupStatus
from pymongo.errors import DuplicateKeyError

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(doc: dict) -> UserOut:
    return UserOut(id=doc["id"], name=doc["name"], email=doc["email"], role=doc["role"])


@router.get('/setup', response_model=SetupStatus)
async def setup_status():
    return SetupStatus(required=await db.users.count_documents({}) == 0)


@router.post('/setup', response_model=UserOut)
async def setup_admin(payload: SetupIn, response: Response):
    expected = os.environ.get('BOOTSTRAP_TOKEN', '')
    if not expected or not secrets.compare_digest(payload.setup_token, expected):
        raise HTTPException(403, 'Código de configuración incorrecto')
    if await db.users.count_documents({}):
        raise HTTPException(409, 'El acceso ya está configurado')
    # Mongo's unique _id closes the concurrent-first-admin race without a transaction.
    user = {'_id': 'initial-admin', 'id': str(uuid.uuid4()), 'name': payload.name.strip(),
            'email': str(payload.email).lower(), 'password_hash': hash_password(payload.password),
            'role': 'admin', 'created_at': datetime.now(timezone.utc)}
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(409, 'El acceso ya está configurado')
    await create_session(response, user['id'])
    return _user_out(user)


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


@router.post('/users/{user_id}/promote', response_model=UserOut)
async def promote_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(404, 'Usuario no encontrado')
    if user.get('role') != 'admin':
        result = await db.users.update_one({'id': user_id, 'role': {'$ne': 'admin'}}, {'$set': {'role': 'admin'}})
        if result.modified_count:
            await db.role_changes.insert_one({'user_id': user_id, 'actor_id': admin['id'], 'previous_role': user.get('role'),
                'role': 'admin', 'created_at': datetime.now(timezone.utc)})
    user['role'] = 'admin'
    return _user_out(user)


class GoogleAuthIn(BaseModel):
    session_id: str


@router.post("/google", response_model=UserOut)
async def google_auth(payload: GoogleAuthIn, response: Response):
    if await db.users.count_documents({}) == 0:
        raise HTTPException(409, 'Configura primero el administrador')
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
