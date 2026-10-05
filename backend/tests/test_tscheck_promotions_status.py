"""Promotions status is computed server-side from today's date — expired campaigns never
show as current.

Criterion: Promociones: el estado se calcula con la fecha de hoy y las finalizadas no se
presentan como vigentes.
"""

import httpx


def _login(client: httpx.Client) -> None:
    r = client.post("/auth/login", json={"email": "vendedor@centrowagen.es", "password": "vendedor123"})
    assert r.status_code == 200, r.text


def test_expired_seed_promotions_marked_finalizada(client: httpx.Client):
    _login(client)
    r = client.get("/promotions")
    assert r.status_code == 200, r.text
    promos = r.json()
    by_name = {p["name"]: p for p in promos}

    assert "Taigo Verano" in by_name, "seed promotion missing"
    assert by_name["Taigo Verano"]["status"] == "finalizada", by_name["Taigo Verano"]

    assert "Golf GTI Lanzamiento" in by_name, "seed promotion missing"
    assert by_name["Golf GTI Lanzamiento"]["status"] == "finalizada", by_name["Golf GTI Lanzamiento"]


def test_active_promotion_not_finalizada_and_near_expiry_flagged(client: httpx.Client):
    _login(client)
    r = client.get("/promotions")
    assert r.status_code == 200, r.text
    promos = r.json()
    statuses = {p["status"] for p in promos}
    # At least one currently-valid promotion exists, and the seeded near-expiry one is flagged.
    assert statuses & {"activa", "proxima", "programada"}, statuses
    by_name = {p["name"]: p for p in promos}
    assert "T-Roc Edición Limitada" in by_name
    assert by_name["T-Roc Edición Limitada"]["status"] == "proxima", by_name["T-Roc Edición Limitada"]
