import asyncio
from contextlib import asynccontextmanager

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from lib.db import client, ensure_indexes
from lib.storage import init_storage_async
from routers.auth import router as auth_router
from routers.dealer import router as dealer_router
from routers.knowledge import router as knowledge_router
from routers.chat import router as chat_router
from routers.client_message import router as client_message_router
from routers.client_messages import router as client_messages_router
from routers.sales import router as sales_router
from routers.audit import router as audit_router
from routers.stats import router as stats_router
from routers.tasks import router as tasks_router
from routers.tariff import router as tariff_router
from routers.offers import router as offers_router
from routers.ai import router as ai_router


# Startup runs before the yield, shutdown after it. Add your own setup/teardown here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())  # background: a big index build must not block boot

    async def _init_storage():
        try:
            await init_storage_async()
            logging.getLogger(__name__).info("Object storage initialized")
        except Exception as exc:  # storage must never block boot
            logging.getLogger(__name__).error("Storage init failed: %s", exc)

    app.state.storage_task = asyncio.create_task(_init_storage())
    yield
    client.close()


# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"app": "SecretarIA", "message": "Asistente comercial Volkswagen — Centrowagen Don Benito", "demo": True}


for _router in (auth_router, dealer_router, knowledge_router, chat_router, client_message_router, client_messages_router, sales_router, audit_router, stats_router, tasks_router, tariff_router, offers_router, ai_router):
    api_router.include_router(_router)

# Include the router in the main app — keep this the last routing statement
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
