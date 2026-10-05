"""Follow-up tasks: CRUD, summary for the in-app bell, and the daily email digest cron."""

import hmac
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request

from lib.auth import get_current_user
from lib.db import db
from lib.dates import today_iso
from lib.doc import now_utc, prepare
from lib.email import send_email
from models.tasks import Task, TaskIn, TaskSummary, TaskUpdate

router = APIRouter(tags=["tasks"])
logger = logging.getLogger(__name__)


def _scope(user: dict) -> dict:
    """Admin sees every reminder; a vendedor only their own."""
    return {} if user.get("role") == "admin" else {"owner_id": user["id"]}


@router.get("/tasks", response_model=list[Task])
async def list_tasks(status: str | None = None, user: dict = Depends(get_current_user)):
    flt = _scope(user)
    if status:
        flt = {**flt, "status": status}
    docs = await db.tasks.find(flt).sort([("due_date", 1), ("due_time", 1)]).to_list(500)
    return [Task(**prepare(d, "created_at", "completed_at")) for d in docs]


@router.get("/tasks/summary", response_model=TaskSummary)
async def tasks_summary(user: dict = Depends(get_current_user)):
    docs = await db.tasks.find(_scope(user)).to_list(1000)
    t = today_iso()
    horizon = (datetime.fromisoformat(t) + timedelta(days=7)).strftime("%Y-%m-%d")
    pending = [d for d in docs if d.get("status") != "hecha"]
    overdue = [d for d in pending if str(d.get("due_date", "")) < t]
    today = [d for d in pending if str(d.get("due_date", "")) == t]
    upcoming = [d for d in pending if t < str(d.get("due_date", "")) <= horizon]
    nxt = sorted(overdue + today + upcoming, key=lambda d: (str(d.get("due_date")), str(d.get("due_time") or "99:99")))
    return TaskSummary(
        overdue=len(overdue),
        today=len(today),
        upcoming=len(upcoming),
        pending=len(pending),
        done=len(docs) - len(pending),
        next_tasks=[Task(**prepare(d, "created_at", "completed_at")) for d in nxt[:5]],
    )


@router.post("/tasks", response_model=Task)
async def create_task(payload: TaskIn, user: dict = Depends(get_current_user)):
    obj = Task(owner_id=user["id"], owner_name=user["name"], **payload.model_dump())
    await db.tasks.insert_one(obj.model_dump())
    return obj


@router.patch("/tasks/{tid}", response_model=Task)
async def update_task(tid: str, payload: TaskUpdate, user: dict = Depends(get_current_user)):
    doc = await db.tasks.find_one({"id": tid})
    if not doc:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    if user.get("role") != "admin" and doc.get("owner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Solo puedes modificar tus propios recordatorios")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates.get("status") == "hecha":
        updates["completed_at"] = now_utc()
    elif updates.get("status") == "pendiente":
        updates["completed_at"] = None
    await db.tasks.update_one({"id": tid}, {"$set": updates})
    fresh = await db.tasks.find_one({"id": tid})
    return Task(**prepare(fresh, "created_at", "completed_at"))


@router.delete("/tasks/{tid}")
async def delete_task(tid: str, user: dict = Depends(get_current_user)):
    doc = await db.tasks.find_one({"id": tid})
    if not doc:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    if user.get("role") != "admin" and doc.get("owner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Solo puedes eliminar tus propios recordatorios")
    await db.tasks.delete_one({"id": tid})
    return {"ok": True}


# --------------------------------------------------------------- daily digest

def _digest_html(name: str, overdue: list[dict], today: list[dict]) -> str:
    from html import escape

    def block(title: str, items: list[dict], color: str) -> str:
        if not items:
            return ""
        rows = "".join(
            f'<tr><td style="padding:6px 0;border-bottom:1px solid #1e293b">'
            f'<strong style="color:#f8fafc">{escape(str(i.get("title") or ""))}</strong><br>'
            f'<span style="color:#94a3b8;font-size:12px">{escape(str(i.get("kind") or ""))}'
            f'{" · " + escape(str(i.get("client_name"))) if i.get("client_name") else ""}'
            f'{" · " + escape(str(i.get("vehicle_model"))) if i.get("vehicle_model") else ""}'
            f'{" · " + escape(str(i.get("due_time"))) if i.get("due_time") else ""}'
            f'</span></td></tr>'
            for i in items[:25]
        )
        return (
            f'<p style="margin:18px 0 6px;color:{color};font-weight:bold;font-size:13px">{title} ({len(items)})</p>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>'
        )

    empty_note = (
        '<p style="color:#34d399;font-size:13px">No tienes tareas pendientes para hoy. 🎉</p>'
        if not overdue and not today
        else ""
    )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px">'
        '<tr><td align="center"><table role="presentation" width="600" '
        'style="max-width:600px;background:#111c33;border-radius:16px;padding:32px;font-family:Arial,sans-serif;color:#f8fafc">'
        '<tr><td style="color:#38bdf8;font-weight:bold;font-size:18px;padding-bottom:4px">SecretarIA — Tus tareas de hoy</td></tr>'
        f'<tr><td style="color:#94a3b8;font-size:12px;padding-bottom:8px">Centrowagen Don Benito · {escape(name)}</td></tr>'
        f'<tr><td>{block("Vencidas", overdue, "#fb7185")}{block("Para hoy", today, "#fbbf24")}{empty_note}</td></tr>'
        '<tr><td style="font-size:11px;color:#94a3b8;padding-top:18px">Resumen automático de SecretarIA. '
        'Nunca te pediremos contraseñas ni datos de tarjeta por email.</td></tr>'
        '</table></td></tr></table>'
    )


async def _run_digest(run_id: str) -> None:
    """The real work — runs in the background after the cron endpoint has acked."""
    t = today_iso()
    sent = 0
    try:
        users = await db.users.find({}).to_list(200)
        for u in users:
            email = u.get("email")
            if not email:
                continue
            pending = await db.tasks.find({"owner_id": u["id"], "status": {"$ne": "hecha"}}).to_list(500)
            overdue = [d for d in pending if str(d.get("due_date", "")) < t]
            today = [d for d in pending if str(d.get("due_date", "")) == t]
            if not overdue and not today:
                continue  # nothing to say — don't send noise
            try:
                await send_email(
                    to=email,
                    subject=f"Tus tareas de hoy ({len(overdue) + len(today)}) — SecretarIA",
                    html=_digest_html(u.get("name") or "", overdue, today),
                )
                sent += 1
            except Exception as exc:
                logger.error("digest email failed for %s: %s", email, exc)
        await db.cron_runs.update_one(
            {"run_id": run_id},
            {"$set": {"finished_at": now_utc(), "emails_sent": sent, "status": "done"}},
        )
    except Exception as exc:
        logger.error("digest run failed: %s", exc)
        await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"status": "error", "error": str(exc)}})


@router.post("/cron/daily-digest")
async def cron_daily_digest(
    request: Request,
    background: BackgroundTasks,
    authorization: str | None = Header(None),
    x_webhook_id: str | None = Header(None),
):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    import os

    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not secret or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="No autorizado")

    try:
        envelope = await request.json()
    except Exception:
        envelope = {}
    if not isinstance(envelope, dict):
        raise HTTPException(status_code=400, detail="Cuerpo inválido")

    run_id = x_webhook_id or envelope.get("run_id") or f"manual-{now_utc().isoformat()}"
    existing = await db.cron_runs.find_one({"run_id": run_id})
    if existing:
        return {"ok": True, "duplicate": True, "run_id": run_id}  # idempotent

    await db.cron_runs.insert_one({"run_id": run_id, "job": "daily-digest", "started_at": now_utc(), "status": "running"})
    background.add_task(_run_digest, run_id)
    return {"ok": True, "run_id": run_id}
