"""Importador genérico de datos reales: catálogo de vehículos y unidades de stock.

Acepta Excel (.xlsx) o CSV con cabecera en español. Reutiliza los helpers del
importador de tarifas (lectura de tabla, normalización y números en formato español).
Escribe directamente, emparejando por modelo+acabado (vehículos) y por nº de stock (stock).
"""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse

from lib.auth import require_admin
from lib.catalog_images import MODEL_IMAGES, image_for
from lib.db import db
from lib.doc import new_id, now_utc
from models.dataimport import ImportResult, ImportRowResult, ModelImage
from routers.tariff import MAX_BYTES, _read_table, norm, to_number

router = APIRouter(tags=["import"])
logger = logging.getLogger(__name__)

VEHICLE_HEADERS: dict[str, list[str]] = {
    "model": ["modelo", "model", "gama"],
    "trim": ["acabado", "version", "versión", "trim"],
    "body_type": ["carroceria", "carrocería", "tipo", "body"],
    "engine": ["motor", "engine", "motorizacion", "motorización"],
    "fuel": ["combustible", "fuel"],
    "power_cv": ["potencia", "cv", "power"],
    "transmission": ["cambio", "transmision", "transmisión"],
    "drivetrain": ["traccion", "tracción"],
    "consumption": ["consumo"],
    "co2_g": ["co2", "emisiones"],
    "electric_range_km": ["autonomia", "autonomía"],
    "trunk_l": ["maletero"],
    "seats": ["plazas", "asientos"],
    "equipment": ["equipamiento", "equipo"],
    "image": ["imagen", "foto", "image"],
    "base_price": ["pvp", "precio", "tarifa", "precio base"],
}

STOCK_HEADERS: dict[str, list[str]] = {
    "stock_number": ["stock", "n stock", "nº stock", "numero de stock", "número de stock", "referencia", "ref"],
    "model": ["modelo", "model", "gama"],
    "trim": ["acabado", "version", "versión", "trim"],
    "engine": ["motor", "engine"],
    "power": ["potencia", "cv"],
    "transmission": ["cambio", "transmision", "transmisión"],
    "exterior_color": ["color", "color exterior", "exterior"],
    "interior_color": ["color interior", "interior", "tapiceria", "tapicería"],
    "vin": ["vin", "bastidor"],
    "pvp": ["pvp", "precio"],
    "promotional_price": ["promocional", "precio promocional", "oferta"],
    "availability": ["disponibilidad", "estado"],
    "location": ["ubicacion", "ubicación", "localizacion", "localización"],
    "delivery_estimate": ["entrega", "plazo", "fecha de entrega"],
    "options": ["opciones", "extras"],
}

TEMPLATES = {
    "vehicles": (
        "Modelo;Acabado;Carroceria;Motor;Combustible;Potencia;Cambio;Traccion;Consumo;CO2;Autonomia;Maletero;Plazas;Equipamiento;Imagen;PVP\n"
        "T-Roc;R-Line;SUV;1.5 TSI 150 CV;Gasolina;150;DSG;Delantera;6,1;139;;445;5;Faros LED|Cockpit digital;;34.990\n"
    ),
    "stock": (
        "N Stock;Modelo;Acabado;Motor;Potencia;Cambio;Color;Color interior;VIN;PVP;Promocional;Disponibilidad;Ubicacion;Entrega;Opciones\n"
        "CB-1001;T-Roc;R-Line;1.5 TSI 150 CV;150;DSG;Blanco Puro;Negro;;34.990;33.500;Entrega inmediata;Don Benito;15 días;Techo panorámico|Park Assist\n"
    ),
}


def _map_columns(rows: list[list[object]], headers: dict[str, list[str]], required: list[str]):
    """Localiza la fila de cabecera en las 10 primeras líneas."""
    for idx, row in enumerate(rows[:10]):
        cells = [norm(c) for c in row]
        mapping: dict[str, int] = {}
        found: dict[str, str] = {}
        for field, names in headers.items():
            for ci, cell in enumerate(cells):
                if not cell or ci in mapping.values():
                    continue
                if cell in names or any(cell.startswith(n) for n in names):
                    mapping[field] = ci
                    found[field] = str(row[ci])
                    break
        if all(r in mapping for r in required):
            return mapping, found, idx
    raise HTTPException(
        status_code=400,
        detail=f"No encuentro las columnas mínimas ({', '.join(required)}). Descarga la plantilla y respeta la cabecera.",
    )


def _rows_of(table: list[list[object]], header_idx: int):
    for offset, raw in enumerate(table[header_idx + 1 :], start=header_idx + 2):
        if not raw or all(c is None or str(c).strip() == "" for c in raw):
            continue
        yield offset, raw


def _text(row: list[object], mapping: dict[str, int], field: str) -> str:
    ci = mapping.get(field)
    if ci is None or ci >= len(row) or row[ci] is None:
        return ""
    return str(row[ci]).strip()


def _list(value: str) -> list[str]:
    parts = [p.strip() for p in value.replace("|", ";").split(";")]
    return [p for p in parts if p]


async def _load_file(file: UploadFile) -> list[list[object]]:
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="El archivo supera el límite de 10 MB")
    if not data:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    return _read_table(file.filename or "", data)


@router.get("/import/template/{kind}", response_class=PlainTextResponse)
async def download_template(kind: str, _: dict = Depends(require_admin)):
    if kind not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Plantilla no disponible")
    return PlainTextResponse(
        TEMPLATES[kind],
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="plantilla_{kind}.csv"'},
    )


@router.get("/catalog/model-images", response_model=list[ModelImage])
async def list_model_images(_: dict = Depends(require_admin)):
    return [ModelImage(model_name=m, image=url) for m, url in MODEL_IMAGES.items()]


@router.post("/import/vehicles", response_model=ImportResult)
async def import_vehicles(file: UploadFile = File(...), _: dict = Depends(require_admin)):
    table = await _load_file(file)
    mapping, found, header_idx = _map_columns(table, VEHICLE_HEADERS, ["model"])
    result = ImportResult(filename=file.filename or "vehiculos", detected_columns=found)
    now = now_utc()

    for row_no, raw in _rows_of(table, header_idx):
        model = _text(raw, mapping, "model")
        trim = _text(raw, mapping, "trim")
        label = f"{model} {trim}".strip()
        if not model:
            result.skipped += 1
            result.rows.append(ImportRowResult(row=row_no, label=label, message="Sin modelo"))
            continue

        fields: dict = {
            "model": model,
            "trim": trim,
            "active": True,
            "last_updated": now,
            "source": "Documentación Centrowagen",
        }
        for key in ("body_type", "engine", "fuel", "transmission", "drivetrain"):
            value = _text(raw, mapping, key)
            if value:
                fields[key] = value
        for key in ("power_cv", "co2_g", "electric_range_km", "trunk_l", "seats"):
            value = to_number(_text(raw, mapping, key))
            if value is not None:
                fields[key] = int(value)
        consumption = to_number(_text(raw, mapping, "consumption"))
        if consumption is not None:
            fields["consumption"] = consumption
        equipment = _list(_text(raw, mapping, "equipment"))
        if equipment:
            fields["equipment"] = equipment
        fields["image"] = _text(raw, mapping, "image") or image_for(model)

        existing = await db.vehicles.find_one({"model": model, "trim": trim})
        if existing:
            await db.vehicles.update_one({"id": existing["id"]}, {"$set": fields})
            vehicle_id = existing["id"]
            result.updated += 1
            action = "actualizada"
        else:
            vehicle_id = new_id()
            await db.vehicles.insert_one({"id": vehicle_id, "brand": "Volkswagen", **fields})
            result.created += 1
            action = "creada"

        message = ""
        base = to_number(_text(raw, mapping, "base_price"))
        if base and base > 0:
            price_fields = {"base_price": base, "source": "Tarifa Volkswagen", "last_updated": now}
            current = await db.prices.find_one({"vehicle_id": vehicle_id})
            if current:
                await db.prices.update_one({"vehicle_id": vehicle_id}, {"$set": price_fields})
            else:
                await db.prices.insert_one({"id": new_id(), "vehicle_id": vehicle_id, **price_fields})
            message = f"Tarifa registrada: {base:,.0f} €".replace(",", ".")

        result.rows.append(ImportRowResult(row=row_no, label=label, action=action, message=message))

    return result


@router.post("/import/stock", response_model=ImportResult)
async def import_stock(file: UploadFile = File(...), _: dict = Depends(require_admin)):
    table = await _load_file(file)
    mapping, found, header_idx = _map_columns(table, STOCK_HEADERS, ["stock_number", "model"])
    result = ImportResult(filename=file.filename or "stock", detected_columns=found)
    vehicles = await db.vehicles.find({"active": True}).to_list(1000)
    now = now_utc()

    for row_no, raw in _rows_of(table, header_idx):
        number = _text(raw, mapping, "stock_number")
        model = _text(raw, mapping, "model")
        trim = _text(raw, mapping, "trim")
        label = f"{number} · {model} {trim}".strip()
        if not number or not model:
            result.skipped += 1
            result.rows.append(ImportRowResult(row=row_no, label=label, message="Falta el nº de stock o el modelo"))
            continue

        match = next(
            (v for v in vehicles if norm(v.get("model")) == norm(model) and norm(v.get("trim")) == norm(trim)),
            None,
        )
        if match is None:
            candidates = [v for v in vehicles if norm(v.get("model")) == norm(model)]
            match = candidates[0] if len(candidates) == 1 else None
        if match is None:
            result.skipped += 1
            result.rows.append(
                ImportRowResult(row=row_no, label=label, message="Ese modelo/acabado no está en el catálogo: dalo de alta primero")
            )
            continue

        fields: dict = {
            "vehicle_id": match["id"],
            "stock_number": number,
            "model": match.get("model", model),
            "trim": trim or str(match.get("trim") or ""),
            "last_updated": now,
        }
        for key in ("engine", "transmission", "exterior_color", "interior_color", "vin", "availability", "location", "delivery_estimate"):
            value = _text(raw, mapping, key)
            if value:
                fields[key] = value
        power = to_number(_text(raw, mapping, "power"))
        if power is not None:
            fields["power"] = int(power)
        for key in ("pvp", "promotional_price"):
            value = to_number(_text(raw, mapping, key))
            if value is not None:
                fields[key] = value
        options = _list(_text(raw, mapping, "options"))
        if options:
            fields["options"] = options
        fields.setdefault("availability", "Bajo pedido")
        fields.setdefault("location", "Don Benito")
        fields.setdefault("exterior_color", "")

        existing = await db.stock.find_one({"stock_number": number})
        if existing:
            await db.stock.update_one({"id": existing["id"]}, {"$set": fields})
            result.updated += 1
            action = "actualizada"
        else:
            await db.stock.insert_one({"id": new_id(), **fields})
            result.created += 1
            action = "creada"

        result.rows.append(ImportRowResult(row=row_no, label=label, action=action))

    return result
