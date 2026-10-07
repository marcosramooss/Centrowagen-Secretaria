"""Two-phase, admin-only imports. Confirm a server-owned, expiring preview, never client rows."""
import math
import re
from datetime import timedelta
from typing import Literal
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pymongo import ReturnDocument

from lib.auth import require_admin
from lib.db import db
from lib.doc import now_utc, new_id
from models.dataimport import ConfirmImport, ImportPreview, ImportResult, ImportRowResult, PreviewRow
from models.dealer import StockUnit, Vehicle
from routers.dataimport import VEHICLE_HEADERS, STOCK_HEADERS, _load_file, _map_columns, _rows_of, _text, _list
from routers.tariff import norm, to_number

router = APIRouter(tags=['safe-import'])
NUMERIC = {'power_cv', 'co2_g', 'electric_range_km', 'trunk_l', 'seats', 'consumption', 'power', 'pvp', 'base_price', 'promotional_price'}
INTEGER = {'power_cv', 'co2_g', 'electric_range_km', 'trunk_l', 'seats', 'power'}


def number(value: str, field: str):
    if not re.fullmatch(r'[\d.,\s€+\-]+', value):
        raise ValueError(f'{field}: número no válido')
    result = to_number(value)
    if result is None or not math.isfinite(result) or result < 0:
        raise ValueError(f'{field}: debe ser un número positivo')
    if field in INTEGER and (not result.is_integer() or result > 10000):
        raise ValueError(f'{field}: entero fuera de rango')
    if field in {'pvp', 'base_price'} and result == 0:
        raise ValueError(f'{field}: el precio debe ser mayor que cero')
    return int(result) if field in INTEGER else result


@router.post('/import/{kind}/preview', response_model=ImportPreview)
async def preview(kind: Literal['vehicles', 'stock'], file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    table = await _load_file(file)
    if len(table) > 5001:
        raise HTTPException(400, 'Máximo 5.000 filas por importación')
    headers = VEHICLE_HEADERS if kind == 'vehicles' else STOCK_HEADERS
    mapping, found, header_idx = _map_columns(table, headers, ['model'] if kind == 'vehicles' else ['stock_number', 'model'])
    vehicles = await db.vehicles.find({'active': True}).to_list(10000)
    current = vehicles if kind == 'vehicles' else await db.stock.find().to_list(10000)
    by_key = {}
    def key_of(d):
        return (norm(d.get('model')), norm(d.get('trim'))) if kind == 'vehicles' else norm(d.get('stock_number'))
    for d in current:
        by_key.setdefault(key_of(d), []).append(d)
    rows, plan, seen = [], [], set()
    for row_no, raw in _rows_of(table, header_idx):
        text = {key: _text(raw, mapping, key) for key in mapping}
        label = ' · '.join(text[k] for k in ('stock_number', 'model', 'trim') if text.get(k))
        row = PreviewRow(row=row_no, label=label, action='rechazada')
        try:
            if not text.get('model') or (kind == 'stock' and not text.get('stock_number')):
                raise ValueError('Falta el modelo o el número de stock')
            key = key_of(text)
            if key in seen:
                raise ValueError('Fila duplicada en el mismo archivo')
            seen.add(key)
            matches = by_key.get(key, [])
            if len(matches) > 1:
                raise ValueError('Coincidencia ambigua: revisa los registros existentes')
            existing = matches[0] if matches else None
            fields = {}
            for field, value in text.items():
                if not value:
                    continue  # Blank cells never silently erase existing data.
                if field in NUMERIC:
                    fields[field] = number(value, field)
                elif field in {'equipment', 'options'}:
                    fields[field] = _list(value)
                elif field == 'image':
                    url = urlparse(value)
                    if url.scheme != 'https' or not url.hostname:
                        raise ValueError('La fotografía requiere una URL HTTPS')
                    fields[field] = value
                else:
                    fields[field] = value
            fields.setdefault('trim', text.get('trim', ''))
            base = fields.pop('base_price', None)
            if kind == 'stock':
                matched = [v for v in vehicles if norm(v['model']) == norm(text['model']) and norm(v.get('trim')) == norm(text.get('trim'))]
                if len(matched) != 1:
                    raise ValueError('Modelo/acabado no reconocido o ambiguo. Importa primero su versión en el catálogo del concesionario')
                fields['vehicle_id'] = matched[0]['id']
                if 'availability' in fields and fields['availability'] not in {'Entrega inmediata', 'En tránsito', 'Bajo pedido', 'Reservado'}:
                    raise ValueError('Disponibilidad no reconocida')
                if fields.get('vin') and not re.fullmatch(r'[A-HJ-NPR-Z0-9]{17}', fields['vin'].upper()):
                    raise ValueError('El bastidor debe tener 17 caracteres válidos')
            fields.update(source=f'Archivo del concesionario: {file.filename}', verification_status='pending')
            if not existing:
                schema = Vehicle if kind == 'vehicles' else StockUnit
                fields = schema(**fields).model_dump(exclude={'id', 'last_updated'})
            target_id = existing['id'] if existing else new_id()
            previous_price = await db.prices.find_one({'vehicle_id': target_id}) if base is not None else None
            changes = {k: {'antes': (existing or {}).get(k), 'después': v} for k, v in fields.items() if (existing or {}).get(k) != v}
            if base is not None:
                changes['base_price'] = {'antes': (previous_price or {}).get('base_price'), 'después': base}
            row.action = 'actualizar' if existing else 'crear'
            row.values, row.changes = fields, changes
            row.message = 'Pendiente de verificación comercial; las celdas vacías no borran datos'
            plan.append({'row': row_no, 'label': label, 'id': target_id, 'fields': fields, 'before': existing, 'base_price': base, 'price_before': previous_price})
        except (ValueError, TypeError) as exc:
            row.message = str(exc)
        rows.append(row)
    if not rows:
        raise HTTPException(400, 'El archivo solo contiene cabeceras. Añade tus datos reales')
    result = ImportPreview(id=new_id(), kind=kind, filename=file.filename or 'archivo', detected_columns=found,
                           rows=rows, valid_rows=len(plan), rejected_rows=len(rows)-len(plan))
    now = now_utc()
    await db.import_batches.insert_one({'id': result.id, 'owner_id': admin['id'], 'kind': kind, 'filename': result.filename,
        'plan': plan, 'status': 'preview', 'created_at': now, 'expires_at': now + timedelta(minutes=30)})
    return result


@router.post('/import/apply', response_model=ImportResult)
async def apply_import(payload: ConfirmImport, admin: dict = Depends(require_admin)):
    batch = await db.import_batches.find_one_and_update(
        {'id': payload.preview_id, 'owner_id': admin['id'], 'status': 'preview', 'expires_at': {'$gt': now_utc()}},
        {'$set': {'status': 'applying'}}, return_document=ReturnDocument.BEFORE)
    if not batch:
        raise HTTPException(409, 'La vista previa ha caducado o ya fue aplicada. Vuelve a cargar el archivo')
    collection = db[batch['kind']]
    # All conflict checks precede any business write.
    for item in batch['plan']:
        current = await collection.find_one({'id': item['id']})
        unique_key = {'stock_number': item['fields']['stock_number']} if batch['kind'] == 'stock' else {'model': item['fields']['model'], 'trim': item['fields'].get('trim', ''), 'active': True}
        conflict = current != item['before'] or (item['before'] is None and await collection.find_one(unique_key) is not None)
        if item['base_price'] is not None:
            conflict = conflict or await db.prices.find_one({'vehicle_id': item['id']}) != item['price_before']
        if conflict:
            await db.import_batches.update_one({'id': batch['id']}, {'$set': {'status': 'conflict'}})
            raise HTTPException(409, 'Los datos cambiaron desde la vista previa. Genera una nueva antes de confirmar')
    result = ImportResult(filename=batch['filename'])
    now = now_utc()
    for item in batch['plan']:
        fields = {**item['fields'], 'last_updated': now, 'import_id': batch['id']}
        if item['before']:
            await collection.update_one({'id': item['id']}, {'$set': fields})
            result.updated += 1
        else:
            await collection.insert_one({'id': item['id'], **fields})
            result.created += 1
        if item['base_price'] is not None:
            await db.prices.update_one({'vehicle_id': item['id']}, {'$set': {'base_price': item['base_price'],
                'source': fields['source'], 'verification_status': 'pending', 'last_updated': now, 'import_id': batch['id']},
                '$setOnInsert': {'id': new_id()}}, upsert=True)
        result.rows.append(ImportRowResult(row=item['row'], label=item['label'], action='actualizada' if item['before'] else 'creada'))
    await db.import_audit.insert_one({'id': new_id(), 'import_id': batch['id'], 'owner_id': admin['id'], 'kind': batch['kind'],
        'filename': batch['filename'], 'created_at': now, 'created': result.created, 'updated': result.updated, 'verification_status': 'pending'})
    await db.import_batches.update_one({'id': batch['id']}, {'$set': {'status': 'applied'}})
    return result