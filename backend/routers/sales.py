"""Sales register + commission — sellers register their own sales, admin sees all."""

from fastapi import APIRouter, Depends, HTTPException

from lib.dates import today_iso
from lib.auth import get_current_user, require_admin
from lib.db import db
from lib.doc import now_utc, prepare
from models.sales import SaleIn, SaleOut, SalesSummary, SettingsIn, SettingsOut

router = APIRouter(tags=["sales"])


@router.get("/sales", response_model=list[SaleOut])
async def list_sales(user: dict = Depends(get_current_user)):
    flt = {} if user.get("role") == "admin" else {"seller_id": user["id"]}
    docs = await db.sales.find(flt).sort("sale_date", -1).to_list(500)
    return [SaleOut(**prepare(d, "created_at")) for d in docs]


@router.get("/sales/summary", response_model=SalesSummary)
async def sales_summary(user: dict = Depends(get_current_user)):
    flt = {} if user.get("role") == "admin" else {"seller_id": user["id"]}
    docs = await db.sales.find(flt).to_list(2000)
    settings = await db.settings.find_one({"key": "ventas"}) or {}
    rate = float(settings.get("commission_rate", 2.0))
    target = float(settings.get("monthly_target", 0))
    t = today_iso()
    mdocs = [d for d in docs if str(d.get("sale_date", "")).startswith(t[:7]) and d.get("status") != "Cancelada"]
    ydocs = [d for d in docs if str(d.get("sale_date", "")).startswith(t[:4]) and d.get("status") != "Cancelada"]
    return SalesSummary(
        month_sales=len(mdocs),
        month_pvp=round(sum(float(d.get("pvp", 0)) - float(d.get("discount", 0)) for d in mdocs), 2),
        month_commission=round(sum(float(d.get("commission_estimated", 0)) for d in mdocs), 2),
        year_sales=len(ydocs),
        year_commission=round(sum(float(d.get("commission_estimated", 0)) for d in ydocs), 2),
        commission_rate=rate,
        monthly_target=target,
    )


@router.post("/sales", response_model=SaleOut)
async def create_sale(payload: SaleIn, user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"key": "ventas"}) or {}
    data = payload.model_dump()
    # commission_rate lives on SaleIn too — pop it so it is not passed twice to SaleOut.
    requested_rate = data.pop("commission_rate", None)
    rate = requested_rate if requested_rate is not None else float(settings.get("commission_rate", 2.0))
    base = float(payload.pvp) - float(payload.discount)
    obj = SaleOut(
        seller_id=user["id"],
        seller_name=user["name"],
        **data,
        commission_rate=rate,
        commission_estimated=round(base * rate / 100, 2),
    )
    await db.sales.insert_one(obj.model_dump())
    return obj


@router.delete("/sales/{sid}")
async def delete_sale(sid: str, user: dict = Depends(get_current_user)):
    doc = await db.sales.find_one({"id": sid})
    if not doc:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if user.get("role") != "admin" and doc.get("seller_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Solo el ADMIN o el autor puede eliminar esta venta")
    await db.sales.delete_one({"id": sid})
    return {"ok": True}


@router.get("/settings", response_model=SettingsOut)
async def get_settings(_: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "ventas"}) or {}
    return SettingsOut(commission_rate=float(doc.get("commission_rate", 2.0)), monthly_target=float(doc.get("monthly_target", 0)))


@router.put("/settings", response_model=SettingsOut)
async def put_settings(payload: SettingsIn, _: dict = Depends(require_admin)):
    updates = payload.model_dump(exclude_unset=True)
    if await db.settings.find_one({"key": "ventas"}):
        await db.settings.update_one({"key": "ventas"}, {"$set": updates})
    else:
        await db.settings.insert_one({"key": "ventas", **updates})
    doc = await db.settings.find_one({"key": "ventas"}) or {}
    return SettingsOut(commission_rate=float(doc.get("commission_rate", 2.0)), monthly_target=float(doc.get("monthly_target", 0)))
