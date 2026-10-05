"""Dealer data plane: vehicles, stock, prices, financing, promotions.

Reads are open to any authenticated user; every mutation requires ADMIN —
a VENDEDOR must not alter critical commercial information.
"""

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, require_admin
from lib.db import db
from lib.doc import new_id, now_utc, prepare
from lib.rag import promo_status, score, tokens
from models.dealer import (
    FinancingIn,
    FinancingOffer,
    PriceEntry,
    PriceIn,
    Promotion,
    PromotionIn,
    StockIn,
    StockUnit,
    Vehicle,
    VehicleDetail,
    VehicleIn,
)
from models.knowledge import Argumentario, FaqItem

router = APIRouter(tags=["dealer"])


# ---------------------------------------------------------------- Vehicles


@router.get("/vehicles", response_model=list[Vehicle])
async def list_vehicles(q: str | None = None, body_type: str | None = None, fuel: str | None = None):
    flt: dict = {"active": True}
    if body_type:
        flt["body_type"] = body_type
    if fuel:
        flt["fuel"] = fuel
    docs = await db.vehicles.find(flt).sort([("model", 1), ("trim", 1)]).to_list(500)
    items = [Vehicle(**prepare(d, "last_updated")) for d in docs]
    if q:
        tks = tokens(q)
        scored = [v for v in items if score(tks, v.model, v.trim, v.fuel, v.body_type, v.engine or "") > 0]
        if scored:
            items = scored
    return items


@router.get("/vehicles/{vid}", response_model=VehicleDetail)
async def get_vehicle(vid: str):
    doc = await db.vehicles.find_one({"id": vid})
    if not doc:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    vehicle = Vehicle(**prepare(doc, "last_updated"))

    price = None
    price_doc = await db.prices.find_one({"vehicle_id": vid})
    if price_doc:
        price = PriceEntry(**prepare(price_doc, "last_updated"))

    fin_docs = await db.financing.find({"$or": [{"vehicle_id": vid}, {"vehicle_id": None}]}).to_list(50)
    financing = [FinancingOffer(**prepare(f, "last_updated")) for f in fin_docs]

    promo_docs = await db.promotions.find({"model": {"$in": [vehicle.model, "Todos"]}}).to_list(50)
    promotions: list[Promotion] = []
    for p in promo_docs:
        item = Promotion(**prepare(p, "last_updated"))
        item.status = promo_status(p)
        promotions.append(item)

    stock_docs = await db.stock.find({"vehicle_id": vid}).sort("stock_number", 1).to_list(100)
    stock = [StockUnit(**prepare(s, "last_updated")) for s in stock_docs]

    arg_doc = await db.argumentario.find_one({"model": vehicle.model})
    argumentario = Argumentario(**prepare(arg_doc, "last_updated")) if arg_doc else None

    tks = tokens(vehicle.model)
    faq_docs = await db.faq.find().to_list(200)
    related = [f for f in faq_docs if score(tks, f.get("question"), f.get("answer")) > 0][:4]
    related_faq = [FaqItem(**prepare(f, "last_updated")) for f in related]

    return VehicleDetail(
        vehicle=vehicle, price=price, financing=financing,
        promotions=promotions, stock=stock, argumentario=argumentario, related_faq=related_faq,
    )


@router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(payload: VehicleIn, _: dict = Depends(require_admin)):
    obj = Vehicle(**payload.model_dump())
    await db.vehicles.insert_one(obj.model_dump())
    return obj


@router.patch("/vehicles/{vid}", response_model=Vehicle)
async def update_vehicle(vid: str, payload: VehicleIn, _: dict = Depends(require_admin)):
    if not await db.vehicles.find_one({"id": vid}):
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    updates = payload.model_dump(exclude_unset=True)
    updates["last_updated"] = now_utc()
    await db.vehicles.update_one({"id": vid}, {"$set": updates})
    fresh = await db.vehicles.find_one({"id": vid})
    return Vehicle(**prepare(fresh, "last_updated"))


@router.delete("/vehicles/{vid}")
async def delete_vehicle(vid: str, _: dict = Depends(require_admin)):
    await db.vehicles.update_one({"id": vid}, {"$set": {"active": False, "last_updated": now_utc()}})
    return {"ok": True}


# ---------------------------------------------------------------- Stock


@router.get("/stock", response_model=list[StockUnit])
async def list_stock(
    q: str | None = None,
    model: str | None = None,
    trim: str | None = None,
    body_type: str | None = None,
    fuel: str | None = None,
    transmission: str | None = None,
    exterior_color: str | None = None,
    availability: str | None = None,
    max_price: float | None = None,
    min_power: int | None = None,
):
    # Demo scale: filter in Python so cross-collection filters (fuel/body via vehicle) stay exact.
    docs = await db.stock.find().sort([("model", 1), ("stock_number", 1)]).to_list(2000)
    vdocs = await db.vehicles.find({"active": True}).to_list(500)
    vmap = {v["id"]: v for v in vdocs}
    items: list[StockUnit] = []
    for d in docs:
        item = StockUnit(**prepare(d, "last_updated"))
        v = vmap.get(item.vehicle_id) or {}
        if model and item.model.lower() != model.lower():
            continue
        if trim and item.trim.lower() != trim.lower():
            continue
        if body_type and v.get("body_type") != body_type:
            continue
        if fuel and v.get("fuel") != fuel:
            continue
        if transmission and item.transmission != transmission:
            continue
        if exterior_color and item.exterior_color != exterior_color:
            continue
        if availability and item.availability != availability:
            continue
        price = item.promotional_price or item.pvp
        if max_price is not None and (price is None or price > max_price):
            continue
        if min_power is not None and (item.power is None or item.power < min_power):
            continue
        if q:
            tks = tokens(q)
            if score(tks, item.model, item.trim, item.engine or "", item.exterior_color, item.availability, item.location or "") == 0:
                continue
        items.append(item)
    return items


@router.post("/stock", response_model=StockUnit)
async def create_stock(payload: StockIn, _: dict = Depends(require_admin)):
    if not await db.vehicles.find_one({"id": payload.vehicle_id}):
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    obj = StockUnit(**payload.model_dump())
    await db.stock.insert_one(obj.model_dump())
    return obj


@router.patch("/stock/{sid}", response_model=StockUnit)
async def update_stock(sid: str, payload: StockIn, _: dict = Depends(require_admin)):
    if not await db.stock.find_one({"id": sid}):
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    updates = payload.model_dump(exclude_unset=True)
    updates["last_updated"] = now_utc()
    await db.stock.update_one({"id": sid}, {"$set": updates})
    fresh = await db.stock.find_one({"id": sid})
    return StockUnit(**prepare(fresh, "last_updated"))


@router.delete("/stock/{sid}")
async def delete_stock(sid: str, _: dict = Depends(require_admin)):
    await db.stock.delete_one({"id": sid})
    return {"ok": True}


# ---------------------------------------------------------------- Prices


@router.get("/prices", response_model=list[PriceEntry])
async def list_prices(vehicle_id: str | None = None, _: dict = Depends(get_current_user)):
    flt = {"vehicle_id": vehicle_id} if vehicle_id else {}
    docs = await db.prices.find(flt).sort("base_price", 1).to_list(1000)
    return [PriceEntry(**prepare(d, "last_updated")) for d in docs]


@router.post("/prices", response_model=PriceEntry)
async def create_price(payload: PriceIn, _: dict = Depends(require_admin)):
    if not await db.vehicles.find_one({"id": payload.vehicle_id}):
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    obj = PriceEntry(**payload.model_dump())
    await db.prices.insert_one(obj.model_dump())
    return obj


@router.patch("/prices/{pid}", response_model=PriceEntry)
async def update_price(pid: str, payload: PriceIn, _: dict = Depends(require_admin)):
    if not await db.prices.find_one({"id": pid}):
        raise HTTPException(status_code=404, detail="Tarifa no encontrada")
    updates = payload.model_dump(exclude_unset=True)
    updates["last_updated"] = now_utc()
    await db.prices.update_one({"id": pid}, {"$set": updates})
    fresh = await db.prices.find_one({"id": pid})
    return PriceEntry(**prepare(fresh, "last_updated"))


@router.delete("/prices/{pid}")
async def delete_price(pid: str, _: dict = Depends(require_admin)):
    await db.prices.delete_one({"id": pid})
    return {"ok": True}


# ---------------------------------------------------------------- Financing


@router.get("/financing", response_model=list[FinancingOffer])
async def list_financing(vehicle_id: str | None = None):
    flt = {"vehicle_id": vehicle_id} if vehicle_id else {}
    docs = await db.financing.find(flt).sort("monthly_payment", 1).to_list(500)
    return [FinancingOffer(**prepare(d, "last_updated")) for d in docs]


@router.post("/financing", response_model=FinancingOffer)
async def create_financing(payload: FinancingIn, _: dict = Depends(require_admin)):
    obj = FinancingOffer(**payload.model_dump())
    await db.financing.insert_one(obj.model_dump())
    return obj


@router.patch("/financing/{fid}", response_model=FinancingOffer)
async def update_financing(fid: str, payload: FinancingIn, _: dict = Depends(require_admin)):
    if not await db.financing.find_one({"id": fid}):
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    updates = payload.model_dump(exclude_unset=True)
    updates["last_updated"] = now_utc()
    await db.financing.update_one({"id": fid}, {"$set": updates})
    fresh = await db.financing.find_one({"id": fid})
    return FinancingOffer(**prepare(fresh, "last_updated"))


@router.delete("/financing/{fid}")
async def delete_financing(fid: str, _: dict = Depends(require_admin)):
    await db.financing.delete_one({"id": fid})
    return {"ok": True}


# ---------------------------------------------------------------- Promotions


@router.get("/promotions", response_model=list[Promotion])
async def list_promotions(status: str | None = None, model: str | None = None):
    docs = await db.promotions.find().to_list(300)
    items: list[Promotion] = []
    for d in docs:
        item = Promotion(**prepare(d, "last_updated"))
        item.status = promo_status(d)  # server-side state from dates — never trusted from storage
        if status and item.status != status:
            continue
        if model and item.model.lower() != model.lower() and item.model.lower() != "todos":
            continue
        items.append(item)
    order = {"activa": 0, "proxima": 1, "programada": 2, "finalizada": 3}
    items.sort(key=lambda i: order.get(i.status, 9))
    return items


@router.post("/promotions", response_model=Promotion)
async def create_promotion(payload: PromotionIn, _: dict = Depends(require_admin)):
    obj = Promotion(**payload.model_dump())
    await db.promotions.insert_one(obj.model_dump())
    obj.status = promo_status(obj.model_dump())
    return obj


@router.patch("/promotions/{pid}", response_model=Promotion)
async def update_promotion(pid: str, payload: PromotionIn, _: dict = Depends(require_admin)):
    if not await db.promotions.find_one({"id": pid}):
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    updates = payload.model_dump(exclude_unset=True)
    updates["last_updated"] = now_utc()
    await db.promotions.update_one({"id": pid}, {"$set": updates})
    fresh = await db.promotions.find_one({"id": pid})
    item = Promotion(**prepare(fresh, "last_updated"))
    item.status = promo_status(fresh)
    return item


@router.delete("/promotions/{pid}")
async def delete_promotion(pid: str, _: dict = Depends(require_admin)):
    await db.promotions.delete_one({"id": pid})
    return {"ok": True}
