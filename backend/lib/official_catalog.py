"""Read only VW's public, embedded model-overview data. Never infer specs or prices."""
import asyncio
import json
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote, urljoin
from zoneinfo import ZoneInfo

import httpx

from lib.db import db
from models.catalog import OfficialCatalog, OfficialModel

SOURCES = ['https://www.volkswagen.es/es/modelos.html', 'https://www.volkswagen-comerciales.es/es/modelos.html']
EXCLUDED = {'approved', 'modelos-anteriores', 'vehiculos-comerciales', 'gama-4motion', 'gama-suv', 'volkswagen-r', 'gama-camper', 'volkswagen-turismos', 'soluciones-estandarizadas'}


def walk(node):
    yield node
    for child in node.get('children', []):
        yield from walk(child)


def extract_models(html: str, source: str, category: str) -> list[OfficialModel]:
    match = re.search(r'<script type="x-feature-hub/serialized-states"[^>]*>(.*?)</script>', html, re.S)
    if not match:
        raise ValueError('La web oficial ha cambiado su estructura')
    states = json.loads(unquote(match[1]))
    overview = None
    for value in states.values():
        value = json.loads(value) if isinstance(value, str) else value
        if isinstance(value, dict) and 'modelOverviewResult' in value:
            overview = value['modelOverviewResult'].get('modelOverview')
            break
    if not overview:
        raise ValueError('No se ha encontrado el catálogo oficial')
    models = []
    for node in overview['models']:
        slug = node['nodeId'].strip('/').lower()
        if slug in EXCLUDED or node.get('type') != 'carline':
            continue
        data = node['data']
        engines = [engine for child in walk(node) for engine in child.get('data', {}).get('engines', [])]
        def values(key):
            return sorted({str(v) for e in engines for v in e.get(key, []) if v})
        media = data.get('media', {})
        photo = media.get('firstLevelThreeQuarterView') or media.get('defaultSideView') or {}
        asset = photo.get('imageServiceData', {}).get('scene7File')
        # The public CDN uses encoded transformation parameters (plain wid/fmt returns 403).
        image = f'https://assets.volkswagen.com/is/image/{asset}?Zm10PXdlYnAtYWxwaGEmcWx0PTc5JndpZD04NjQmYmZjPW9mZiY0MDVm' if asset else None
        page_slug = 'golf-8' if slug == 'golf' else slug
        relative = f'/es/modelos/{page_slug}.html'
        detail = urljoin(source, relative) if f'href="{relative}"' in html else source
        # isElectric is also true on the public Golf/Tiguan nodes; it is NOT a propulsion spec.
        powers = sorted({int(m) for e in engines for m in re.findall(r'\((\d+) CV\)', e.get('modelName', ''))})
        models.append(OfficialModel(
            id=f'{category}-{slug}', name=data['name'], category=category, image=image,
            source_url=source, detail_url=detail,
            body_types=values('bodyTypes'), fuels=values('engineTypes'), transmissions=values('gearTypes'),
            trims=sorted({c['data']['name'] for c in walk(node) if c.get('type') == 'trim'}), power_cv=powers,
        ))
    if not models:
        raise ValueError('La fuente no devolvió modelos: se conserva la consulta anterior')
    return models


async def fetch_catalog() -> OfficialCatalog:
    async with httpx.AsyncClient(timeout=40, follow_redirects=True) as client:
        responses = await asyncio.gather(*(client.get(url) for url in SOURCES))
    groups = []
    for response, source, category in zip(responses, SOURCES, ['turismos', 'comerciales']):
        response.raise_for_status()
        groups.append(extract_models(response.text, source, category))
    # Commercial families are listed on both websites: keep their specialist source only.
    commercial_names = {m.id.removeprefix('comerciales-') for m in groups[1]}
    passenger = [m for m in groups[0] if m.id.removeprefix('turismos-') not in commercial_names]
    return OfficialCatalog(checked_at=datetime.now(timezone.utc), models=passenger + groups[1], sources=SOURCES)


async def stored_catalog() -> OfficialCatalog:
    doc = await db.catalog_snapshots.find_one({'key': 'vw-es'})
    result = OfficialCatalog(**doc) if doc else OfficialCatalog(sources=SOURCES, warnings=['Pendiente de la primera consulta automática. Un administrador puede actualizar ahora.'])
    local_now = datetime.now(ZoneInfo('Europe/Madrid'))
    next_run = local_now.replace(hour=8, minute=0, second=0, microsecond=0)
    if next_run <= local_now:
        next_run += timedelta(days=1)
    result.next_sync_at = next_run.astimezone(timezone.utc)
    if result.last_attempt_at and result.last_attempt_at.tzinfo is None:
        result.last_attempt_at = result.last_attempt_at.replace(tzinfo=timezone.utc)
    checked = result.checked_at
    if checked:
        checked = checked.replace(tzinfo=timezone.utc) if checked.tzinfo is None else checked
        result.checked_at = checked
        result.stale = datetime.now(timezone.utc) - checked > timedelta(days=7)
    return result


async def sync_catalog() -> OfficialCatalog:
    """Shared by manual refresh and the platform cron. Never touches dealer collections."""
    started = datetime.now(timezone.utc)
    previous = await db.catalog_snapshots.find_one({'key': 'vw-es'}) or {}
    await db.catalog_snapshots.update_one({'key': 'vw-es'}, {'$set': {
        'last_attempt_at': started, 'sync_status': 'running', 'sync_error': None,
    }}, upsert=True)
    try:
        catalog = await fetch_catalog()
        old_ids = {m['id'] for m in previous.get('models', [])}
        catalog.added_model_ids = [m.id for m in catalog.models if m.id not in old_ids]
        catalog.sync_status = 'success'
        catalog.last_attempt_at = started
        await db.catalog_snapshots.update_one({'key': 'vw-es'}, {'$set': catalog.model_dump()})
    except Exception:
        await db.catalog_snapshots.update_one({'key': 'vw-es'}, {'$set': {
            'sync_status': 'error',
            'sync_error': 'No se pudieron consultar ambas fuentes oficiales. Se conserva la última consulta correcta.',
        }})
        raise
    return await stored_catalog()