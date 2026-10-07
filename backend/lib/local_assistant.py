"""Deterministic local lookup. No LLM, network call, secret or invented commercial fact."""
import asyncio
import re
import unicodedata
from datetime import datetime

from lib.db import db
from lib.official_catalog import stored_catalog
from lib.rag import freshness, promo_status
from models.local_chat import LocalAnswer, LocalSource

STOP = set('a al algo alguna alguno algunos algun ante como con cual cuales cuando cuanto cuantos de del dime el ella en es esta este estos estas hay la las lo los me mi muestra muestrame necesito nos o para por puedes que quiero se sobre su sus te tiene tienen tu un una unos unas y yo volkswagen vw coche coches vehiculo vehiculos saber informacion favor pregunta dar dame consultar'.split())


def norm(value) -> str:
    raw = ''.join(c for c in unicodedata.normalize('NFKD', str(value or '').lower()) if not unicodedata.combining(c))
    raw = re.sub(r'\bid[.\s-]*(\d)', r'id \1', raw)
    return ' '.join(re.sub(r'[^a-z0-9]+', ' ', raw).split())


def terms(value) -> set[str]:
    return {t for t in norm(value).split() if t not in STOP and (len(t) > 1 or t.isdigit())}


def model_name(value) -> str:
    return re.sub(r'^(nuevo|nueva|volkswagen) ', '', norm(value))


def named_matches(query, models):
    q = f' {norm(query)} '
    matches = [m for m in models if f' {model_name(m["name"])} ' in q]
    return [m for m in matches if not any(m is not other and model_name(m['name']) != model_name(other['name']) and
        f' {model_name(m["name"])} ' in f' {model_name(other["name"])} ' for other in matches)]


def money(value) -> str:
    if value is None:
        return 'no registrado'
    return f'{float(value):,.2f}'.replace(',', '_').replace('.', ',').replace('_', '.') + ' €'


def text(value) -> str:
    """Render imported strings as bounded data, never as instructions or Markdown headings."""
    return ' '.join(str(value or '').replace('|', ' / ').replace('*', '').replace('#', '').split())[:700]


def source(name, updated=None, url=None, verified=False) -> LocalSource:
    date = updated.isoformat() if isinstance(updated, datetime) else str(updated or 'Sin fecha')
    return LocalSource(name=text(name), updated=date, estado=freshness(updated) if verified else '🟡 Pendiente de revisión', url=url)


def state(record) -> str:
    return 'revisado por el concesionario' if record.get('verification_status') == 'verified' else 'pendiente de verificación comercial'


def score(query_terms, value) -> int:
    return len(query_terms & terms(value))


async def answer_local(query: str, mode: str = 'vendedor', previous_query: str = '') -> LocalAnswer:
    q = norm(query)
    if q in {'hola', 'buenas', 'buenos dias', 'buenas tardes', 'ayuda', 'que puedes hacer', 'gracias'}:
        return LocalAnswer(content='## Consulta local, sin créditos de IA\nPuedo mostrar la gama Volkswagen, buscar versiones, stock, precios registrados y extractos de tus documentos. No soy un modelo generativo.\n\nPrueba: «¿Qué motorizaciones tiene el Golf?», «¿Qué stock de Tiguan hay?» o «Busca garantía de batería en documentos».\nSi faltan datos, te lo indicaré y podrás abrir un chat externo sin enviarle automáticamente información del concesionario.')

    catalog = await stored_catalog()
    official = [m.model_dump() for m in catalog.models]
    named = named_matches(query, official)
    if not named and previous_query and re.search(r'^(y |su |sus |ese |este |cuanto |cual |que )', q):
        named = named_matches(previous_query, official)
    names = {model_name(m['name']) for m in named}
    qt = terms(query)
    live_filter = {'is_deleted': {'$ne': True}, 'is_demo': {'$ne': True}, 'data_origin': {'$ne': 'demo'}}
    collections = ['vehicles', 'stock', 'prices', 'financing', 'promotions', 'documents', 'faq', 'memory', 'argumentario']
    loaded = await asyncio.gather(*(db[c].find(live_filter).to_list(2000 if c == 'stock' else 500) for c in collections))
    data = dict(zip(collections, loaded))
    vehicles = [v for v in data['vehicles'] if v.get('active') is not False]
    if not names:
        dealer_matches = named_matches(query, [{'name': v.get('model', '')} for v in vehicles if v.get('model')])
        names = {model_name(v['name']) for v in dealer_matches}
    def vehicle_matches(v):
        return model_name(v.get('model')) in names if names else False
    matching_vehicles = [v for v in vehicles if vehicle_matches(v)]
    ids = {v['id'] for v in matching_vehicles}
    safe = lambda r: mode != 'cliente' or r.get('verification_status') == 'verified'

    intent = 'specs'
    if any(t in qt for t in ['documento', 'documentos', 'archivo', 'archivos', 'pdf', 'investigar']): intent = 'documents'
    elif any(t in qt for t in ['stock', 'disponible', 'disponibles', 'entrega', 'unidades']): intent = 'stock'
    elif any(t in qt for t in ['financiacion', 'financiar', 'cuota', 'cuotas', 'tae', 'tin']): intent = 'financing'
    elif any(t in qt for t in ['precio', 'precios', 'pvp', 'vale', 'cuesta', 'presupuesto']): intent = 'prices'
    elif any(t in qt for t in ['promocion', 'promociones', 'campana', 'campanas', 'descuento', 'oferta', 'ofertas']): intent = 'promotions'
    elif 'memoria' in qt: intent = 'memory'
    elif 'faq' in qt or any(t in qt for t in ['garantia', 'garantias', 'mantenimiento']): intent = 'documents'
    lines, sources = [], []
    answered = False
    official_matches = named
    if not official_matches and intent == 'specs':
        filters = []
        for trigger, field, value in [('electric', 'fuels', 'electric'), ('hibrid', 'fuels', 'hibrid'), ('diesel', 'fuels', 'diesel'), ('gasolina', 'fuels', 'gasolina'), ('suv', 'body_types', 'suv'), ('automatic', 'transmissions', 'automatic')]:
            if trigger in q:
                filters.append((field, value))
        if filters:
            official_matches = [m for m in official if all(any(value in norm(v) for v in m[field]) for field, value in filters)]
        elif qt & {'modelos', 'gama', 'catalogo', 'turismos', 'comerciales'}:
            official_matches = official
        if 'comerciales' in qt:
            official_matches = [m for m in official_matches if m['category'] == 'comerciales']
        elif 'turismos' in qt:
            official_matches = [m for m in official_matches if m['category'] == 'turismos']

    if intent == 'specs' and official_matches:
        lines.append('## Catálogo oficial Volkswagen')
        list_mode = not named or len(official_matches) > 4
        requested_missing = qt & {'autonomia', 'maletero', 'medidas', 'dimensiones', 'equipamiento', 'bateria', 'consumo', 'emisiones', 'velocidad', 'aceleracion'}
        model_terms = set().union(*(terms(m['name']) for m in named)) if named else set()
        technical_terms = {'motor', 'motores', 'motorizacion', 'motorizaciones', 'transmision', 'transmisiones', 'cambio', 'potencia', 'potencias', 'cv', 'acabado', 'acabados', 'carroceria', 'caracteristicas', 'ficha', 'tecnica', 'tecnico', 'comparar', 'compara', 'comparame', 'comparativa', 'diferencias', 'gama', 'modelos', 'catalogo', 'electrico', 'electricos', 'suv', 'automatico', 'automaticos', 'hibridos', 'hibrido', 'vehiculo'}
        if named and (qt - model_terms) and not ((qt - model_terms) & technical_terms):
            requested_missing.add('información fuera de las características publicadas')
        for m in official_matches[:40 if list_mode else 4]:
            if list_mode:
                lines.append(f'- **{text(m["name"])}** · {text(" / ".join(m["fuels"])) or "Motorización no publicada en la consulta"}')
            else:
                lines.append(f'### {text(m["name"])}')
                for label, value in [('Carrocería', m['body_types']), ('Motorizaciones de gama', m['fuels']), ('Transmisiones', m['transmissions']), ('Potencias publicadas', [f'{p} CV' for p in m['power_cv']]), ('Acabados', m['trims'])]:
                    if value:
                        lines.append(f'- {label}: {text(" / ".join(value))}')
                if (qt & {'potencia', 'potencias', 'cv'} and not m['power_cv']) or (qt & {'acabado', 'acabados'} and not m['trims']):
                    requested_missing.add('detalle de la versión')
            ref = source('Volkswagen España · ' + m['name'], catalog.checked_at, m['detail_url'], verified=True)
            if ref.url not in {s.url for s in sources}:
                sources.append(ref)
        lines.append('\nDatos agregados de gama, no de una unidad concreta. No implican que todos los motores estén disponibles con todos los acabados.')
        if catalog.stale or catalog.sync_status == 'error':
            lines.append('⚠️ La consulta oficial necesita actualizarse o el último intento falló; confirma su vigencia.')
        answered = not requested_missing
        if requested_missing:
            lines.append('\nNo consta ese dato técnico concreto en la consulta oficial guardada. No voy a completarlo con suposiciones.')

    if intent == 'stock':
        generic = qt <= {'stock', 'disponible', 'disponibles', 'disponibilidad', 'entrega', 'inmediata', 'unidades', 'registradas', 'registrados', 'listado', 'todos', 'todas', 'tenemos', 'tenemos', 'actual', 'automaticos', 'automatico'}
        rows = [s for s in data['stock'] if (vehicle_matches(s) if names else generic) and safe(s)]
        if 'automatic' in q:
            rows = [s for s in rows if any(t in norm(s.get('transmission')) for t in ['automatic', 'dsg'])]
        if 'inmediata' in qt:
            rows = [s for s in rows if s.get('availability') == 'Entrega inmediata']
        lines.append('## Stock registrado en el concesionario')
        for s in rows[:10]:
            lines.append(f'- **{text(s.get("model"))} {text(s.get("trim"))}** · {text(s.get("stock_number"))} · {text(s.get("exterior_color"))} · {text(s.get("availability"))} · PVP registrado: {money(s.get("pvp"))} · {state(s)}')
            sources.append(source(s.get('source') or 'Stock del concesionario', s.get('last_updated'), '/stock', s.get('verification_status') == 'verified'))
        answered = bool(rows) and all(r.get('verification_status') == 'verified' for r in rows[:10])
        if not rows:
            lines.append('No hay unidades registradas que coincidan. Esto no confirma que el concesionario no tenga stock: falta cargar o contrastar el listado real.')
    elif intent == 'prices':
        generic = qt <= {'precio', 'precios', 'pvp', 'tarifa', 'tarifas', 'registrados', 'registradas', 'todos', 'todas', 'listado', 'actuales', 'catalogo'}
        rows = [p for p in data['prices'] if (p.get('vehicle_id') in ids if names else generic) and safe(p)]
        vmap = {v['id']: v for v in vehicles}
        lines.append('## Precios registrados')
        for p in rows[:8]:
            v = vmap.get(p.get('vehicle_id'), {})
            lines.append(f'- **{text(v.get("model"))} {text(v.get("trim"))}** · PVP: {money(p.get("base_price"))} · {state(p)} · Vigencia: {text(p.get("valid_until")) or "no indicada"}')
            sources.append(source(p.get('source') or 'Tarifa cargada', p.get('last_updated'), '/precios', p.get('verification_status') == 'verified'))
        answered = bool(rows) and all(r.get('verification_status') == 'verified' for r in rows[:8])
        if not rows: lines.append('No tengo una tarifa registrada que permita confirmar ese precio. No usaré el precio de otro modelo ni una cifra de ejemplo.')
    elif intent in {'financing', 'promotions'}:
        generic = qt <= {'financiacion', 'financiar', 'cuota', 'cuotas', 'tae', 'tin', 'promocion', 'promociones', 'campana', 'campanas', 'descuento', 'oferta', 'ofertas', 'registradas', 'vigentes', 'todos', 'todas', 'listado', 'actuales'}
        rows = [r for r in data[intent] if safe(r) and ((r.get('vehicle_id') in ids if intent == 'financing' else vehicle_matches(r) or r.get('model') == 'Todos') if names else generic)]
        if intent == 'promotions': rows = [r for r in rows if promo_status(r) in {'activa', 'proxima'}]
        lines.append('## Financiación registrada' if intent == 'financing' else '## Promociones registradas')
        for r in rows[:6]:
            if intent == 'financing':
                lines.append(f'- **{text(r.get("campaign"))}** · Entrada: {money(r.get("entry_payment"))} · Cuota: {money(r.get("monthly_payment"))} · {text(r.get("number_of_payments"))} cuotas · TIN: {text(r.get("tin"))}% · TAE: {text(r.get("tae"))}% · {state(r)}')
            else:
                lines.append(f'- **{text(r.get("name"))}** · {text(r.get("description"))} · {text(r.get("conditions"))} · {state(r)}')
            sources.append(source(r.get('source') or 'Registro comercial', r.get('last_updated'), '/financiacion' if intent == 'financing' else '/promociones', r.get('verification_status') == 'verified'))
        answered = bool(rows) and all(r.get('verification_status') == 'verified' for r in rows[:6])
        if not rows: lines.append('No hay condiciones registradas que permitan confirmar esta consulta.')

    # Pending uploads may be shown as excerpts in seller mode, never as confirmed answers or client copy.
    if intent == 'documents' or not answered:
        query_terms = qt - {'documentos', 'documento', 'archivos', 'archivo', 'pdf', 'busca', 'buscar', 'investigar', 'faq'}
        candidates = []
        for d in data['documents']:
            if d.get('active') is False or mode == 'cliente': continue
            body = d.get('content_text') or ''
            chunks = [s.strip() for s in re.split(r'\n+|(?<=[.!?])\s+', body) if s.strip()]
            best = max(chunks, key=lambda s: score(query_terms, s), default='')
            hits = score(query_terms, best)
            if hits and hits >= max(1, len(query_terms) // 2):
                candidates.append((hits, d, best))
        candidates.sort(key=lambda item: item[0], reverse=True)
        if candidates:
            lines.append('\n## Extractos de archivos cargados')
            for _, d, excerpt in candidates[:3]:
                lines.append(f'### {text(d.get("name"))}\nEstado: {state(d)}. Extracto literal, no respuesta generada:\n{text(excerpt)}')
                sources.append(source(d.get('name'), d.get('upload_date'), f'/api/documents/{d["id"]}/file' if d.get('file_url') else '/archivos?seccion=documentos', d.get('verification_status') == 'verified'))
            # A keyword match is not proof that a question was answered completely.
            lines.append('Comprueba el documento completo y su vigencia antes de usar este extracto como condición comercial.')
        faqs = [f for f in data['faq'] if safe(f) and score(query_terms, f.get('question')) >= max(2, len(query_terms) - 1)]
        if faqs:
            lines.append('\n## Coincidencias en preguntas frecuentes')
            for f in faqs[:2]:
                lines.append(f'**{text(f.get("question"))}**\n{text(f.get("answer"))}\nEstado: {state(f)}')
                sources.append(source(f.get('source') or 'FAQ', f.get('last_updated'), '/faq', f.get('verification_status') == 'verified'))
    if intent == 'memory' and mode != 'cliente':
        rows = [m for m in data['memory'] if not (qt - {'memoria', 'recuerdas'}) or score(qt - {'memoria', 'recuerdas'}, m.get('content')) > 0]
        if rows:
            lines.append('## Notas internas registradas — no son fuentes oficiales')
            for m in rows[:6]:
                lines.append(f'- {text(m.get("content"))}')
                sources.append(source('Memoria interna', m.get('updated_at'), '/memoria'))
            answered = True

    if not lines:
        lines.append('No he encontrado datos o extractos suficientemente relacionados en el catálogo y los archivos disponibles.')
    if not answered:
        lines.append('\n⚠️ No tengo información confirmada suficiente para resolver por completo esta consulta. Puedes consultar las fuentes originales o abrir un chat externo para orientación general. Una IA externa no conoce tu stock, tarifas internas ni archivos: sus respuestas no sustituyen la documentación oficial.')
    if mode == 'cliente' and not answered:
        lines = ['[DATO PENDIENTE DE CONFIRMACIÓN]\nNo hay información confirmada suficiente para preparar esta respuesta al cliente.']
        sources = []
    unique_sources = list({(s.name, s.url): s for s in sources}.values())[:8]
    return LocalAnswer(content='\n'.join(lines), sources=unique_sources, external_help=not answered)