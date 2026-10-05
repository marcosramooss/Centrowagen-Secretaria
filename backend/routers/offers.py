"""Offer PDF endpoint."""

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import get_current_user
from lib.db import db
from lib.pdf import build_offer_pdf
from lib.rag import promo_status

router = APIRouter(tags=["offers"])


@router.get("/offers/{vehicle_id}/pdf")
async def offer_pdf(
    vehicle_id: str,
    client_name: str = "",
    stock_number: str | None = None,
    financing_id: str | None = None,
    user: dict = Depends(get_current_user),
):
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    price = await db.prices.find_one({"vehicle_id": vehicle_id})

    financing = None
    if financing_id:
        financing = await db.financing.find_one({"id": financing_id})
    if financing is None:
        offers = await db.financing.find({"vehicle_id": vehicle_id}).to_list(50)
        if not offers:
            offers = await db.financing.find({"vehicle_id": None}).to_list(50)
        financing = min(offers, key=lambda f: f.get("monthly_payment", 1e9)) if offers else None

    promo_docs = await db.promotions.find({"model": {"$in": [vehicle.get("model"), "Todos"]}}).to_list(50)
    promotions = [p for p in promo_docs if promo_status(p) in {"activa", "proxima"}]

    stock_unit = None
    if stock_number:
        stock_unit = await db.stock.find_one({"stock_number": stock_number})

    pdf = build_offer_pdf(
        vehicle=vehicle,
        price=price,
        financing=financing,
        promotions=promotions,
        stock_unit=stock_unit,
        client_name=client_name,
        seller_name=user.get("name", ""),
    )
    safe = f"{vehicle.get('model', 'oferta')}-{vehicle.get('trim', '')}".strip().replace(" ", "-").replace("/", "-")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="Oferta-{safe}.pdf"'},
    )
