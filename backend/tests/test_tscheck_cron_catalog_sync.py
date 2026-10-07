"""Backend coverage for the daily VW catalog cron (POST /api/cron/catalog-sync).

Validates: valid-bearer envelope -> 202 fast ack; duplicate X-Webhook-Id does not
re-run; invalid bearer -> 401; invalid body -> 400. Secret is read from the
backend's own environment, never hardcoded or printed.
"""
import os
import time
from pathlib import Path

import pytest

# The secret lives only in backend/.env (never hardcoded, never printed).
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
if _ENV_FILE.exists() and "WEBHOOK_CRON_SECRET" not in os.environ:
    for line in _ENV_FILE.read_text().splitlines():
        if line.startswith("WEBHOOK_CRON_SECRET="):
            os.environ["WEBHOOK_CRON_SECRET"] = line.split("=", 1)[1].strip()

SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")


@pytest.mark.skipif(not SECRET, reason="WEBHOOK_CRON_SECRET not set in backend env")
def test_cron_catalog_sync_ack_duplicate_and_auth(client):
    run_id = f"tscheck-cron-{int(time.time() * 1000)}"
    envelope = {"event": "schedule.triggered", "schedule_id": "catalogo-vw-diario", "run_id": run_id}
    headers = {"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": run_id}

    # Valid envelope + valid bearer -> fast 202 ack, not duplicate.
    r1 = client.post("/cron/catalog-sync", json=envelope, headers=headers)
    assert r1.status_code == 202, r1.text
    body1 = r1.json()
    assert body1["accepted"] is True
    assert body1["duplicate"] is False
    assert body1["run_id"] == run_id

    # Same X-Webhook-Id replayed -> idempotent, flagged duplicate, still 202.
    r2 = client.post("/cron/catalog-sync", json=envelope, headers=headers)
    assert r2.status_code == 202, r2.text
    assert r2.json()["duplicate"] is True

    # Invalid bearer -> 401, rejected before any envelope processing.
    r3 = client.post(
        "/cron/catalog-sync",
        json=envelope,
        headers={"Authorization": "Bearer not-the-real-secret", "X-Webhook-Id": f"{run_id}-badauth"},
    )
    assert r3.status_code == 401, r3.text

    # Invalid body (missing required envelope fields) -> 400.
    r4 = client.post(
        "/cron/catalog-sync",
        json={"not": "an-envelope"},
        headers={"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": f"{run_id}-badbody"},
    )
    assert r4.status_code == 400, r4.text


@pytest.mark.skipif(not SECRET, reason="WEBHOOK_CRON_SECRET not set in backend env")
def test_cron_catalog_sync_background_job_completes_and_preserves_catalog(client):
    """The background job runs sync_catalog(); poll cron_runs via the public
    catalog endpoint shape by re-checking /catalog/official still serves a
    real, non-empty catalog with a checked_at timestamp after invocation."""
    run_id = f"tscheck-cron-done-{int(time.time() * 1000)}"
    envelope = {"event": "schedule.triggered", "schedule_id": "catalogo-vw-diario", "run_id": run_id}
    headers = {"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": run_id}

    ack = client.post("/cron/catalog-sync", json=envelope, headers=headers)
    assert ack.status_code == 202, ack.text

    deadline = time.time() + 25
    catalog = None
    while time.time() < deadline:
        resp = client.get("/catalog/official")
        assert resp.status_code == 200
        catalog = resp.json()
        if catalog.get("checked_at"):
            break
        time.sleep(1)

    assert catalog is not None
    assert catalog.get("checked_at"), "catalog never reported a checked_at after cron invocation"
    assert len(catalog.get("models", [])) >= 1, "catalog must keep (or refresh) real models, never go empty"
    assert catalog.get("automatic_schedule")
