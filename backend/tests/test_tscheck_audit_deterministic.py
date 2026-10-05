"""Deterministic audit rules (/api/audit) — confirms, flags for verification, or rejects.

Criterion: Auditoria de datos: confirma, avisa o rechaza.
"""

import httpx


def _login(client: httpx.Client) -> None:
    r = client.post("/auth/login", json={"email": "vendedor@centrowagen.es", "password": "vendedor123"})
    assert r.status_code == 200, r.text


def test_audit_confirms_real_price(client: httpx.Client):
    _login(client)
    r = client.post("/audit", json={"kind": "precio", "model": "T-Roc", "value": 35020})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["estado"] == "confirmado", body
    assert any(c.get("tipo") in ("tarifa", "stock") for c in body["coincidencias"]), body
    assert body["fuentes"], "expected at least one source"


def test_audit_rejects_fabricated_price(client: httpx.Client):
    _login(client)
    r = client.post("/audit", json={"kind": "precio", "model": "T-Roc", "value": 99999})
    assert r.status_code == 200, r.text
    body = r.json()
    # Must NOT confirm a clearly false price.
    assert body["estado"] != "confirmado", body


def test_audit_flags_expired_promotion_as_incorrect(client: httpx.Client):
    _login(client)
    r = client.post("/audit", json={"kind": "promocion", "model": "Taigo", "value": 2000})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["estado"] == "incorrecto", body
    assert "finaliz" in body["mensaje"].lower(), body["mensaje"]
