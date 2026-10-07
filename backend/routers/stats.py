"""Dashboard stats — counts + last-sync per collection."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from lib.auth import get_current_user
from lib.db import db
from lib.rag import promo_status
from models.stats import StatsOut

router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=StatsOut)
async def stats(_: dict = Depends(get_current_user)):
    stock_units = await db.stock.count_documents({})
    stock_immediate = await db.stock.count_documents({"availability": "Entrega inmediata"})
    promos = await db.promotions.find().to_list(300)
    active = sum(1 for p in promos if promo_status(p) in {"activa", "proxima"})

    last_sync: dict[str, str] = {}
    for coll, field in [
        ("vehicles", "last_updated"),
        ("stock", "last_updated"),
        ("prices", "last_updated"),
        ("financing", "last_updated"),
        ("promotions", "last_updated"),
        ("documents", "upload_date"),
        ("faq", "last_updated"),
        ("memory", "updated_at"),
        ("sales", "created_at"),
    ]:
        doc = await db[coll].find_one({}, sort=[(field, -1)])
        value = doc.get(field) if doc else None
        if isinstance(value, datetime):
            last_sync[coll] = value.replace(tzinfo=timezone.utc).isoformat()
        elif value:
            last_sync[coll] = str(value)

    return StatsOut(
        vehicles=await db.vehicles.count_documents({"active": True}),
        stock_units=stock_units,
        stock_immediate=stock_immediate,
        active_promotions=active,
        prices=await db.prices.count_documents({}),
        financing_offers=await db.financing.count_documents({}),
        documents=await db.documents.count_documents({"active": True, "is_deleted": {"$ne": True}}),
        faq_items=await db.faq.count_documents({}),
        memory_items=await db.memory.count_documents({}),
        sales=await db.sales.count_documents({}),
        users=await db.users.count_documents({}),
        last_sync=last_sync,
        demo=False,
    )
