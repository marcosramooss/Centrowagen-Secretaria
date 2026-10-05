"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("user_id", ASCENDING)], name="user_id"),
    ],
    "google_sessions": [IndexModel([("session_token", ASCENDING)], name="session_token", unique=True)],
    "vehicles": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("model", ASCENDING), ("trim", ASCENDING)], name="model_trim"),
    ],
    "stock": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("vehicle_id", ASCENDING)], name="vehicle_id"),
        IndexModel([("model", ASCENDING)], name="model"),
    ],
    "prices": [IndexModel([("vehicle_id", ASCENDING)], name="vehicle_id")],
    "financing": [IndexModel([("vehicle_id", ASCENDING)], name="vehicle_id")],
    "promotions": [
        IndexModel([("model", ASCENDING)], name="model"),
        IndexModel([("valid_until", ASCENDING)], name="valid_until"),
    ],
    "documents": [
        IndexModel([("category", ASCENDING)], name="category"),
        IndexModel([("is_deleted", ASCENDING)], name="is_deleted"),
    ],
    "faq": [IndexModel([("category", ASCENDING)], name="category")],
    "memory": [IndexModel([("category", ASCENDING)], name="category")],
    "argumentario": [IndexModel([("model", ASCENDING)], name="model")],
    "chats": [IndexModel([("user_id", ASCENDING), ("updated_at", DESCENDING)], name="user_updated")],
    "messages": [IndexModel([("chat_id", ASCENDING), ("created_at", ASCENDING)], name="chat_created")],
    "sales": [IndexModel([("user_id", ASCENDING), ("sale_date", DESCENDING)], name="user_sale_date")],
    "tasks": [
        IndexModel([("owner_id", ASCENDING), ("due_date", ASCENDING)], name="owner_due"),
        IndexModel([("status", ASCENDING)], name="status"),
    ],
    "cron_runs": [IndexModel([("run_id", ASCENDING)], name="run_id", unique=True)],
    "settings": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
