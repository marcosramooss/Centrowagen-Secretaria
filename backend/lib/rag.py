"""Retrieval over the dealer database — RAG step 1: find, date-check, prioritise.

SecretarIA answers ONLY from the context block built here. Anything absent from
it is "dato no confirmado" by construction — that is how the no-invention rule
is enforced mechanically, not just by prompt.
"""

import re
from datetime import datetime, timedelta, timezone

from lib.db import db
from lib.dates import today_iso

STALE_DAYS = 45  # 🟡 threshold for "posiblemente desactualizado"

STOPWORDS = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "en", "y", "o",
    "que", "cual", "cuales", "cuanto", "cuanta", "como", "para", "por", "con", "sin", "sobre",
    "tiene", "tienen", "hay", "es", "son", "esta", "estan", "me", "te", "se", "le", "les", "dame",
    "quiero", "busca", "buscar", "donde", "cuando", "mas", "menos", "muy", "sos", "eres", "tengo",
    "hola", "gracias", "podria", "puedes", "puedo", "ver", "dime", "dice", "decir", "si", "no",
}


def tokens(text: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9áéíóúüñ.]+", (text or "").lower()) if t and t not in STOPWORDS]


def score(tks: list[str], *texts: str | None) -> int:
    blob = " ".join((t or "") for t in texts).lower()
    return sum(1 for t in tks if t in blob)


def freshness(last_updated) -> str:
    """🟢 fresh (≤ STALE_DAYS) | 🟡 posiblemente desactualizado."""
    if not last_updated:
        return "🟡"
    dt = last_updated if isinstance(last_updated, datetime) else None
    if dt is None:
        try:
            dt = datetime.fromisoformat(str(last_updated))
        except Exception:
            return "🟡"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return "🟢" if datetime.now(timezone.utc) - dt <= timedelta(days=STALE_DAYS) else "🟡"


def _fmt_date(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    return str(value or "—")


def promo_status(promo: dict) -> str:
    """Server-side state from dates — never trust a stored status."""
    t = today_iso()
    vu = str(promo.get("valid_until") or "")
    vf = str(promo.get("valid_from") or "")
    if vu and vu < t:
        return "finalizada"
    if vf and vf > t:
        return "programada"
    if vu:
        try:
            end = datetime.fromisoformat(vu)
            if end - datetime.now() <= timedelta(days=7):
                return "proxima"
        except Exception:
            pass
    return "activa"


async def retrieve(query: str) -> dict:
    """Fetch and rank every data plane relevant to the query."""
    tks = tokens(query)
    out: dict = {
        "vehicles": [], "stock": [], "prices": [], "financing": [], "promotions": [],
        "faq": [], "memory": [], "documents": [], "argumentario": [],
    }

    vehicles = await db.vehicles.find({"active": True}).to_list(500)
    stock = await db.stock.find().to_list(2000)
    prices = await db.prices.find().to_list(2000)
    financing = await db.financing.find().to_list(500)
    promotions = await db.promotions.find().to_list(500)
    faq = await db.faq.find().to_list(500)
    memory = await db.memory.find().to_list(500)
    documents = await db.documents.find({"active": True, "is_deleted": {"$ne": True}}).to_list(500)
    argumentario = await db.argumentario.find().to_list(200)

    # Vehicles — top matches by name/trim/fuel/body; fall back to the whole range.
    ranked = sorted(
        vehicles,
        key=lambda d: score(tks, d.get("model"), d.get("trim"), d.get("fuel"), d.get("body_type"), d.get("engine")),
        reverse=True,
    )
    matched = [v for v in ranked if score(tks, v.get("model"), v.get("trim"), v.get("fuel"), v.get("body_type")) > 0]
    out["vehicles"] = matched[:6] if matched else ranked[:6]

    ids = [v["id"] for v in out["vehicles"]]
    vstock = [s for s in stock if s.get("vehicle_id") in ids]
    if not vstock:
        vstock = [s for s in stock if score(tks, s.get("model"), s.get("trim"), s.get("exterior_color"), s.get("availability")) > 0]
    out["stock"] = vstock[:10]

    out["prices"] = [p for p in prices if p.get("vehicle_id") in ids][:8]
    out["financing"] = [f for f in financing if (f.get("vehicle_id") in ids) or not f.get("vehicle_id")][:8]

    actives = [p for p in promotions if promo_status(p) != "finalizada"]
    matched_p = [p for p in actives if score(tks, p.get("name"), p.get("model"), p.get("description")) > 0]
    out["promotions"] = (matched_p or actives)[:8]

    f_ranked = sorted(faq, key=lambda d: score(tks, d.get("question"), d.get("answer")), reverse=True)
    out["faq"] = ([f for f in f_ranked if score(tks, f.get("question"), f.get("answer")) > 0][:5] if tks else f_ranked[:6])

    m_ranked = sorted(memory, key=lambda d: score(tks, d.get("content"), d.get("category")), reverse=True)
    m_matched = [m for m in m_ranked if score(tks, m.get("content"), m.get("category")) > 0][:5]
    out["memory"] = m_matched or [m for m in memory if m.get("importance") == "alta"][:3]

    d_ranked = sorted(documents, key=lambda d: score(tks, d.get("name"), d.get("category"), (d.get("content_text") or "")[:4000]), reverse=True)
    out["documents"] = [d for d in d_ranked if score(tks, d.get("name"), d.get("category"), (d.get("content_text") or "")[:4000]) > 0][:3]

    out["argumentario"] = [a for a in argumentario if a.get("model") in {v.get("model") for v in out["vehicles"]}][:3]

    return out


def build_context_block(ctx: dict) -> str:
    lines: list[str] = []
    lines.append("### VEHÍCULOS (catálogo)")
    if ctx["vehicles"]:
        for v in ctx["vehicles"]:
            specs = [f"{v.get('body_type', '')}", f"{v.get('engine') or ''}"]
            if v.get("power_cv"):
                specs.append(f"{v['power_cv']} CV")
            if v.get("transmission"):
                specs.append(str(v["transmission"]))
            if v.get("fuel"):
                specs.append(str(v["fuel"]))
            if v.get("consumption"):
                unit = "kWh/100 km" if (v.get("fuel") or "").lower().startswith("eléc") else "l/100 km"
                specs.append(f"{v['consumption']} {unit}")
            if v.get("co2_g") is not None:
                specs.append(f"{v['co2_g']} g CO2")
            if v.get("electric_range_km"):
                specs.append(f"{v['electric_range_km']} km autonomía eléctrica")
            if v.get("trunk_l"):
                specs.append(f"{v['trunk_l']} l maletero")
            fresh = freshness(v.get("last_updated"))
            lines.append(
                f"- Volkswagen {v.get('model')} {v.get('trim', '')} | {' | '.join(s for s in specs if s)}\n"
                f"  Fuente: {v.get('source')} · Actualizado: {_fmt_date(v.get('last_updated'))} · {fresh}"
            )
    else:
        lines.append("(sin datos)")

    lines.append("### STOCK (unidades)")
    if ctx["stock"]:
        for s in ctx["stock"]:
            price = s.get("promotional_price") or s.get("pvp")
            lines.append(
                f"- {s.get('model')} {s.get('trim', '')} · Nº {s.get('stock_number')} · {s.get('exterior_color', '')} · "
                f"{s.get('transmission') or ''} · PVP: {price if price is not None else 'no disponible'} € · "
                f"{s.get('availability')} · {s.get('location', '')} · Entrega: {s.get('delivery_estimate') or 'no disponible'}\n"
                f"  Fuente: Listado interno Centrowagen · Actualizado: {_fmt_date(s.get('last_updated'))} · {freshness(s.get('last_updated'))}"
            )
    else:
        lines.append("(sin unidades coincidentes — si preguntan por stock, indica que no hay unidades registradas con esos criterios)")

    lines.append("### PRECIOS (tarifa)")
    if ctx["prices"]:
        for p in ctx["prices"]:
            parts = [f"PVP: {p.get('base_price')} €"]
            if p.get("promotional_price"):
                parts.append(f"Precio promocional: {p['promotional_price']} €")
            if p.get("financing_price"):
                parts.append(f"Precio con financiación: {p['financing_price']} €")
            if p.get("discount"):
                parts.append(f"Dto: {p['discount']}%")
            if p.get("campaign"):
                parts.append(f"Campaña: {p['campaign']}")
            lines.append(
                f"- {', '.join(parts)} · Vigencia: {p.get('valid_from') or '—'} → {p.get('valid_until') or '—'}\n"
                f"  Fuente: {p.get('source')} · Actualizado: {_fmt_date(p.get('last_updated'))} · {freshness(p.get('last_updated'))}"
            )
    else:
        lines.append("(sin tarifas registradas para estos modelos — NO digas ningún precio)")

    lines.append("### FINANCIACIÓN (Volkswagen Financial Services)")
    if ctx["financing"]:
        for f in ctx["financing"]:
            lines.append(
                f"- {f.get('campaign')} · Entrada: {f.get('entry_payment')} € · Cuota: {f.get('monthly_payment')} €/mes · "
                f"{f.get('number_of_payments')} cuotas"
                + (f" · Última cuota: {f['final_payment']} €" if f.get("final_payment") else "")
                + f" · TIN {f.get('tin')}% · TAE {f.get('tae')}%"
                + (f" · Importe financiado: {f['financed_amount']} €" if f.get("financed_amount") else "")
                + (f" · Total adeudado: {f['total_amount']} €" if f.get("total_amount") else "")
                + (f" · Condiciones: {f['conditions']}" if f.get("conditions") else "")
                + f"\n  Fuente: {f.get('source')} · Actualizado: {_fmt_date(f.get('last_updated'))} · {freshness(f.get('last_updated'))}"
            )
    else:
        lines.append("(sin planes registrados)")

    lines.append("### PROMOCIONES (estado calculado con la fecha de hoy)")
    if ctx["promotions"]:
        for p in ctx["promotions"]:
            lines.append(
                f"- {p.get('name')} ({p.get('model')}) · {p.get('description', '')}"
                + (f" · Descuento: {p['discount']}" if p.get("discount") else "")
                + f" · Vigencia: {p.get('valid_from') or '—'} → {p.get('valid_until') or '—'} · Estado: {promo_status(p).upper()}"
                + (" · Requiere financiación" if p.get("financing_required") else "")
                + (f" · Condiciones: {p['conditions']}" if p.get("conditions") else "")
                + f"\n  Fuente: {p.get('source')} · Actualizado: {_fmt_date(p.get('last_updated'))} · {freshness(p.get('last_updated'))}"
            )
    else:
        lines.append("(sin promociones activas)")

    lines.append("### FAQ")
    if ctx["faq"]:
        for f in ctx["faq"]:
            lines.append(f"- [{f.get('category')}] {f.get('question')}\n  {f.get('answer')}\n  Fuente: {f.get('source')} · {freshness(f.get('last_updated'))}")
    else:
        lines.append("(sin coincidencias)")

    lines.append("### MEMORIA (contexto aprendido)")
    if ctx["memory"]:
        for m in ctx["memory"]:
            lines.append(f"- [{m.get('category')}] {m.get('content')}\n  Actualizado: {_fmt_date(m.get('updated_at'))} · Importancia: {m.get('importance')}")
    else:
        lines.append("(sin memoria relevante)")

    lines.append("### DOCUMENTOS (base documental)")
    if ctx["documents"]:
        for d in ctx["documents"]:
            snippet = ((d.get("content_text") or "")[:400] + "…") if d.get("content_text") else "(sin texto extraíble — solo registro y trazabilidad)"
            lines.append(f"- {d.get('name')} [{d.get('category')}] · {d.get('document_type')} · Subido: {d.get('upload_date')} · {freshness(d.get('upload_date'))}\n  {snippet}")
    else:
        lines.append("(sin documentos coincidentes)")

    lines.append("### ARGUMENTARIO COMERCIAL")
    if ctx["argumentario"]:
        for a in ctx["argumentario"]:
            lines.append(f"- {a.get('model')}: Puntos fuertes: {'; '.join(a.get('strong_points') or [])}")
            for ob in a.get("objections") or []:
                lines.append(f"  Objeción: «{ob.get('objection')}» → Respuesta: {ob.get('response')}")
    else:
        lines.append("(sin argumentario para estos modelos)")

    return "\n".join(lines)


COMMAND_HINTS = {
    "/stock": "El usuario quiere unidades de stock: responde con una tabla de unidades (modelo, versión, color, precio, disponibilidad, entrega).",
    "/precio": "El usuario quiere precios: responde solo con precios de la sección PRECIOS, con fuente y fecha.",
    "/financiacion": "El usuario quiere financiación: responde con los planes de la sección FINANCIACIÓN (entrada, cuota, plazos, TIN/TAE).",
    "/promociones": "El usuario quiere promociones: lista las de la sección PROMOCIONES con estado y vigencia.",
    "/comparar": "El usuario quiere comparar modelos: construye una tabla comparativa solo con datos de las secciones VEHÍCULOS/PRECIOS/FINANCIACIÓN.",
    "/vehiculo": "El usuario quiere la ficha de un modelo: responde con ficha técnica y equipamiento de las secciones VEHÍCULOS/ARGUMENTARIO.",
    "/faq": "El usuario quiere respuestas de la base de conocimiento: usa la sección FAQ.",
    "/cliente": "Genera un mensaje listo para enviar a un cliente, solo con datos confirmados.",
    "/auditar": "El usuario quiere verificar un dato: indica fuente, fecha y estado (🟢/🟡) de lo que encuentres en los DATOS RECUPERADOS.",
    "/investigar": "El usuario quiere profundizar: usa DOCUMENTOS y FAQ para una respuesta detallada y trazable.",
    "/memoria": "El usuario quiere ver qué recuerdas: resume la sección MEMORIA.",
}


def build_system_prompt(mode: str, context: dict, command: str | None = None, user_name: str = "") -> str:
    mode_line = (
        "MODO VENDEDOR: puedes referirte a condiciones comerciales, campañas y detalles internos presentes en los datos."
        if mode != "cliente"
        else "MODO CLIENTE: redacta para poder enviarse directamente a un cliente. No menciones información interna, notas privadas, márgenes ni datos confidenciales."
    )
    hint = f"\nCOMANDO ACTIVO: {COMMAND_HINTS.get(command, '')}" if command else ""
    return f"""Eres SecretarIA, la asistente de inteligencia artificial comercial de Centrowagen Don Benito, concesionario oficial Volkswagen en Don Benito (Badajoz, España). Tu subtítulo es "Tu asistente comercial Volkswagen". Atiendes a {user_name or "el equipo comercial"}, vendedor/a profesional de Volkswagen.

REGLA ABSOLUTA — NO INVENTAR DATOS COMERCIALES:
- Nunca inventes precios, stock, descuentos, promociones, cuotas, TIN, TAE, equipamiento, fechas de entrega, disponibilidad, campañas ni características técnicas.
- Responde EXCLUSIVAMENTE con la información de la sección DATOS RECUPERADOS. Si un dato no está ahí, responde exactamente: "⚠️ No tengo este dato confirmado en la información oficial disponible." y sugiere verificarlo con jefatura o actualizar la fuente.
- Si un dato aparece marcado como 🟡, indícalo como posiblemente desactualizado.
- Si hay varias versiones de un dato, usa la más reciente y muestra su fecha.

{mode_line}
{hint}

FECHA DE HOY: {today_iso()} (España).

FORMATO DE RESPUESTA:
- Markdown sencillo: títulos con ##, negritas con **, listas con -, tablas con | para comparativas.
- Respuesta rápida, clara, profesional y comercial. No más de una pantalla salvo que te lo pidan.
- Destaca precios y cuotas en negrita. Muestra estado (🟢/🟡), fecha de actualización y fuente cuando corresponda.
- Ejemplo de bloque de respuesta para un modelo:

## Volkswagen T-Roc
**R-Line 1.5 TSI DSG**
🚗 150 CV · ⚙️ DSG · ⛽ Gasolina · 💰 **35.020 €** · 📦 **Stock disponible**

**Promoción** 🔥 ... · **Financiación** desde **XXX €/mes** · ⚠️ Condiciones sujetas a campaña vigente.
📚 Fuente: ... · 📅 Actualizado: ... · 🟢/🟡

=== DATOS RECUPERADOS DE LA BASE DE DATOS (única fuente permitida) ===
{build_context_block(context)}
=== FIN DE DATOS ==="""


def context_sources(context: dict) -> list[dict]:
    """Unique (source, updated, freshness) triples across the retrieved sections."""
    out: list[dict] = []
    seen: set[tuple] = set()

    def add(source, updated):
        key = (str(source), str(updated))
        if source and key not in seen:
            seen.add(key)
            out.append({"name": str(source), "updated": _fmt_date(updated), "estado": freshness(updated)})

    for v in context["vehicles"]:
        add(v.get("source"), v.get("last_updated"))
    for s in context["stock"]:
        add("Listado interno Centrowagen", s.get("last_updated"))
    for p in context["prices"]:
        add(p.get("source"), p.get("last_updated"))
    for f in context["financing"]:
        add(f.get("source"), f.get("last_updated"))
    for p in context["promotions"]:
        add(p.get("source"), p.get("last_updated"))
    for f in context["faq"]:
        add(f.get("source"), f.get("last_updated"))
    for d in context["documents"]:
        add(d.get("source") or d.get("name"), d.get("upload_date"))
    for a in context["argumentario"]:
        add(a.get("source"), a.get("last_updated"))
    return out[:8]
