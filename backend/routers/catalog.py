import logging
import os
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError

from lib.auth import require_admin
from lib.db import db
from lib.official_catalog import sync_catalog, stored_catalog
from lib.doc import now_utc
from models.catalog import OfficialCatalog, CatalogCronEnvelope, CatalogCronAck

router = APIRouter(tags=['official-catalog'])


@router.get('/catalog/official', response_model=OfficialCatalog)
async def official_catalog():
    return await stored_catalog()


@router.post('/catalog/refresh', response_model=OfficialCatalog)
async def refresh_catalog(_: dict = Depends(require_admin)):
    try:
        return await sync_catalog()
    except Exception:
        logging.getLogger(__name__).exception('Official catalog retrieval failed')
        raise HTTPException(502, 'No se pudieron consultar ambas fuentes oficiales. Se conserva la última consulta; utiliza los enlaces a Volkswagen.')


async def run_catalog_job(run_id: str):
    try:
        catalog = await sync_catalog()
        await db.cron_runs.update_one({'run_id': run_id}, {'$set': {
            'status': 'done', 'finished_at': now_utc(), 'model_count': len(catalog.models),
            'added_model_ids': catalog.added_model_ids,
        }})
    except Exception:
        logging.getLogger(__name__).exception('Scheduled catalog sync failed')
        await db.cron_runs.update_one({'run_id': run_id}, {'$set': {
            'status': 'error', 'finished_at': now_utc(), 'error': 'Error al consultar las fuentes oficiales',
        }})


@router.post('/cron/catalog-sync', response_model=CatalogCronAck, status_code=202)
async def catalog_cron(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    expected = os.environ.get('WEBHOOK_CRON_SECRET', '')
    auth = request.headers.get('authorization', '')
    if not expected or not auth.startswith('Bearer ') or not secrets.compare_digest(auth[7:], expected):
        raise HTTPException(401, 'No autorizado')
    try:
        envelope = CatalogCronEnvelope.model_validate(await request.json())
    except (ValueError, ValidationError):
        raise HTTPException(400, 'Evento de programación inválido')
    run_id = request.headers.get('x-webhook-id') or envelope.run_id
    if not run_id.strip() or len(run_id) > 200:
        raise HTTPException(400, 'Identificador de ejecución inválido')
    key = f'catalog:{run_id}'
    try:
        await db.cron_runs.insert_one({'run_id': key, 'job': 'catalog-sync', 'started_at': now_utc(), 'status': 'queued'})
    except DuplicateKeyError:
        return CatalogCronAck(run_id=run_id, duplicate=True)
    background.add_task(run_catalog_job, key)
    return CatalogCronAck(run_id=run_id)