"""Session helpers — httpOnly cookie sessions stored in Mongo (no tokens in JSON)."""

from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request, Response
from passlib.hash import pbkdf2_sha256

from lib.db import db

COOKIE_NAME = "secretaria_session"
SESSION_DAYS = 7


def hash_password(plain: str) -> str:
    return pbkdf2_sha256.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pbkdf2_sha256.verify(plain, hashed)
    except Exception:
        return False


async def create_session(response: Response, user_id: str) -> None:
    token = f"{user_id[:8]}-{__import__('uuid').uuid4().hex}"
    now = datetime.utcnow()
    await db.sessions.insert_one(
        {
            "token": token,
            "user_id": user_id,
            "created_at": now,
            "expires_at": now + timedelta(days=SESSION_DAYS),
        }
    )
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        path="/",
    )


async def destroy_session(request: Request) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await db.sessions.delete_one({"token": token})


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="No hay sesión activa")
    sess = await db.sessions.find_one({"token": token})
    if not sess:
        raise HTTPException(status_code=401, detail="Sesión no válida")
    expires = sess.get("expires_at")
    # Mongo returns naive UTC — compare naive vs naive (never mix aware/naive).
    if expires is not None and expires.tzinfo is None and expires < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Sesión caducada")
    user = await db.users.find_one({"id": sess["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Esta acción requiere perfil ADMIN")
    return user
