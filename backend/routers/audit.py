"""Auditoría — verify a commercial datum against the stored information.

Deterministic rules (reliable + fast): the verdict comes from matching the
claimed value against prices/stock/promotions/documents, never from an LLM.
"""

import re
from datetime import datetime

from fastapi import APIRouter, Depends

from lib.auth import get_current_user
from lib.db import db
from lib.rag import freshness, promo_status, score, tokens
from models.audit import AuditIn, AuditResult

router = APIRouter(tags=["audit"])


def _fmt(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    return str(value or "—")


def _near(ref, value: float, tol: float = 0.01) -> bool:
    try:
        return abs(float(ref) - value) <= tol * value
    except (TypeError, ValueError):
        return False


@router.post("/audit", response_model=AuditResult)
async def audit_data(payload: AuditIn, user: dict = Depends(get_current_user)):
    estado, mensaje = "verificar", ""
    if payload.value is None:
        return AuditResult(
            estado="verificar",
            mensaje="Indica también el valor numérico (precio, importe o descuento) para poder verificarlo contra la información oficial.",
        )

    value = float(payload.value)
    tks = tokens(f"{payload.model or ''} {payload.claim}")
    coincidencias: list[dict] = []
    fuentes: list[dict] = []

    if payload.kind == "precio":
        vdocs = await db.vehicles.find({"active": True}).to_list(500)
        vmap = {v["id"]: v for v in vdocs}
        for p in await db.prices.find().to_list(2000):
            v = vmap.get(p.get("vehicle_id"))
            if not v:
                continue
            label = f"{v.get('model')} {v.get('trim', '')}".strip()
            if payload.model and payload.model.lower() not in label.lower():
                continue
            est = freshness(p.get("last_updated"))
            for field in ("base_price", "promotional_price", "financing_price"):
                ref = p.get(field)
                if ref and _near(ref, value):
                    coincidencias.append({
                        "tipo": "tarifa", "modelo": label, "campo": field, "valor": ref,
                        "fuente": p.get("source"), "actualizado": _fmt(p.get("last_updated")), "estado": est,
                    })
                    fuentes.append({"name": p.get("source"), "updated": _fmt(p.get("last_updated")), "estado": est})
                    break
        for s in await db.stock.find().to_list(2000):
            label = f"{s.get('model')} {s.get('trim', '')}".strip()
            if payload.model and payload.model.lower() not in label.lower():
                continue
            est = freshness(s.get("last_updated"))
            for field in ("pvp", "promotional_price", "financing_price"):
                ref = s.get(field)
                if ref and _near(ref, value):
                    coincidencias.append({
                        "tipo": "stock", "unidad": s.get("stock_number"), "modelo": label, "campo": field, "valor": ref,
                        "fuente": "Listado interno Centrowagen", "actualizado": _fmt(s.get("last_updated")), "estado": est,
                    })
                    fuentes.append({"name": "Listado interno Centrowagen", "updated": _fmt(s.get("last_updated")), "estado": est})
                    break
        if coincidencias:
            fresh_hits = [c for c in coincidencias if c["estado"] == "🟢"]
            if fresh_hits:
                estado = "confirmado"
                mensaje = f"🟢 CONFIRMADO — el precio coincide con la información registrada ({fresh_hits[0]['fuente']}, actualizada el {fresh_hits[0]['actualizado']})."
            else:
                estado = "verificar"
                mensaje = f"🟡 NECESITA VERIFICACIÓN — hay coincidencias, pero su fecha de actualización es antigua ({coincidencias[0]['actualizado']})."
        elif coincidencias or fuentes:
            estado, mensaje = "incorrecto", "🔴 INCORRECTO — hay tarifas registradas para este modelo, pero ninguna coincide con el valor indicado."
        else:
            estado, mensaje = "verificar", "⚠️ No tengo este dato confirmado en la información oficial disponible. Registra la tarifa antes de presentarla."
        return AuditResult(estado=estado, mensaje=mensaje, coincidencias=coincidencias[:8], fuentes=fuentes[:5])

    if payload.kind == "promocion":
        promos = await db.promotions.find().to_list(300)
        for p in promos:
            if payload.model and payload.model.lower() not in f"{p.get('model', '')} {p.get('name', '')}".lower():
                continue
            m = re.search(r"([\d.,]+)", str(p.get("discount") or ""))
            discount_value = float(m.group(1).replace(".", "").replace(",", ".")) if m else None
            match = bool(tks) and score(tks, p.get("name"), p.get("model"), p.get("description")) >= 1
            value_match = discount_value is not None and _near(discount_value, value)
            if match or value_match:
                status = promo_status(p)
                est = freshness(p.get("last_updated"))
                coincidencias.append({
                    "tipo": "promoción", "nombre": p.get("name"), "modelo": p.get("model"),
                    "descuento": p.get("discount"), "vigencia": f"{p.get('valid_from')} → {p.get('valid_until')}",
                    "estado_campaña": status, "fuente": p.get("source"), "actualizado": _fmt(p.get("last_updated")), "estado": est,
                })
                fuentes.append({"name": p.get("source"), "updated": _fmt(p.get("last_updated")), "estado": est})
                if status == "finalizada":
                    estado, mensaje = "incorrecto", f"🔴 INCORRECTO / DESACTUALIZADO — la campaña «{p.get('name')}» finalizó el {p.get('valid_until')}. No presentarla como vigente."
                elif est == "🟢":
                    estado, mensaje = "confirmado", f"🟢 CONFIRMADO — «{p.get('name')}» figura como {status.upper()} en la información registrada (actualizada el {_fmt(p.get('last_updated'))})."
                else:
                    estado, mensaje = "verificar", f"🟡 NECESITA VERIFICACIÓN — «{p.get('name')}» coincide, pero el registro es antiguo ({_fmt(p.get('last_updated'))})."
        if not coincidencias:
            estado, mensaje = "verificar", "⚠️ No tengo esta promoción confirmada en la información oficial disponible."
        return AuditResult(estado=estado, mensaje=mensaje, coincidencias=coincidencias[:8], fuentes=fuentes[:5])

    # kind == "dato" — FAQ / memoria / documentación
    claim_tks = tokens(payload.claim)
    best: tuple[int, dict, str] | None = None
    for f in await db.faq.find().to_list(500):
        overlap = score(claim_tks, f.get("question"), f.get("answer"))
        if best is None or overlap > best[0]:
            best = (overlap, f, "FAQ")
    for m in await db.memory.find().to_list(500):
        overlap = score(claim_tks, m.get("content"))
        if best is None or overlap > best[0]:
            best = (overlap, m, "Memoria")
    for d in await db.documents.find({"active": True}).to_list(500):
        overlap = score(claim_tks, d.get("name"), (d.get("content_text") or "")[:20000])
        if best is None or overlap > best[0]:
            best = (overlap, d, "Documento")
    threshold = max(2, int(0.4 * max(1, len(claim_tks))))
    if best and best[0] >= threshold:
        _, doc, kind_name = best
        src = doc.get("source") or kind_name
        upd = doc.get("last_updated") or doc.get("updated_at") or doc.get("upload_date")
        est = freshness(upd)
        fuentes.append({"name": src, "updated": _fmt(upd), "estado": est})
        coincidencias.append({"tipo": kind_name, "contenido": str(doc.get("answer") or doc.get("content") or doc.get("name") or "")[:300], "fuente": src, "actualizado": _fmt(upd), "estado": est})
        if est == "🟢":
            estado, mensaje = "confirmado", f"🟢 CONFIRMADO — el dato figura en {kind_name}: {src} (actualizado el {_fmt(upd)})."
        else:
            estado, mensaje = "verificar", f"🟡 NECESITA VERIFICACIÓN — el dato aparece en {kind_name}: {src}, pero el registro es antiguo ({_fmt(upd)})."
    else:
        estado, mensaje = "verificar", "⚠️ No tengo este dato confirmado en la información oficial disponible."
    return AuditResult(estado=estado, mensaje=mensaje, coincidencias=coincidencias[:8], fuentes=fuentes[:5])
