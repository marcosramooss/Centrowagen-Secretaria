"""Emergent object storage — durable file/media storage (local disk does not survive deploys).

The DB is the source of truth: every upload is recorded in Mongo with a
`storage_path` and an `is_deleted` flag (the storage API has no delete).
"""

import asyncio
import logging
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

# `or`, not a default= argument: the platform sets this to "" when it has no value.
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "secretaria-centrowagen"

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
    "json": "application/json", "csv": "text/csv", "txt": "text/plain",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
}

storage_key: str | None = None  # Module-level, set once and reused globally


def content_type_for(filename: str, fallback: str | None = None) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    return MIME_TYPES.get(ext) or fallback or "application/octet-stream"


def init_storage(force: bool = False) -> str:
    """Call ONCE at startup. Returns a session-scoped, reusable storage_key."""
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def _put(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 404:  # unknown/inactive storage key — mint a new one and retry once
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def _get(path: str) -> tuple[bytes, str]:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# requests is sync — keep the event loop free.
async def put_object(path: str, data: bytes, content_type: str) -> dict:
    if not EMERGENT_KEY:
        from motor.motor_asyncio import AsyncIOMotorGridFSBucket
        from lib.db import db
        oid = await AsyncIOMotorGridFSBucket(db).upload_from_stream(path, data, metadata={'content_type': content_type})
        return {'path': f'gridfs:{oid}'}
    return await asyncio.to_thread(_put, path, data, content_type)


async def get_object(path: str) -> tuple[bytes, str]:
    if path.startswith('gridfs:'):
        from bson import ObjectId
        from motor.motor_asyncio import AsyncIOMotorGridFSBucket
        from lib.db import db
        stream = await AsyncIOMotorGridFSBucket(db).open_download_stream(ObjectId(path.split(':', 1)[1]))
        return await stream.read(), (stream.metadata or {}).get('content_type', 'application/octet-stream')
    return await asyncio.to_thread(_get, path)


async def init_storage_async(force: bool = False) -> str:
    if not EMERGENT_KEY:
        return 'gridfs'
    return await asyncio.to_thread(init_storage, force)
