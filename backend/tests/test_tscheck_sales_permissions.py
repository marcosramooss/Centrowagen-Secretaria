"""Sales register + commissions — creating a sale updates the ledger/summary, and the
seller-vs-admin delete permission is enforced.

Criterion: Ventas y comisiones: registrar una venta actualiza tabla y KPIs, y el permiso de
borrado se respeta.
"""

import uuid

import httpx


def _login(client: httpx.Client, email: str, password: str) -> dict:
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def test_create_sale_computes_commission_and_appears_in_list(client: httpx.Client):
    _login(client, "vendedor@centrowagen.es", "vendedor123")
    tag = f"tscheck-sale-{uuid.uuid4().hex[:8]}"

    r = client.post(
        "/sales",
        json={
            "client_name": tag,
            "vehicle_model": "Tiguan R-Line",
            "pvp": 52470,
            "discount": 2470,
            "status": "Reserva",
        },
    )
    assert r.status_code == 200, r.text
    sale = r.json()
    sale_id = sale["id"]
    try:
        # base = 52470 - 2470 = 50000; 3% commission -> 1500.00
        assert sale["commission_estimated"] == 1500.0, sale

        listed = client.get("/sales")
        assert listed.status_code == 200
        ids = [s["id"] for s in listed.json()]
        assert sale_id in ids, "newly created sale missing from /sales list"
    finally:
        d = client.delete(f"/sales/{sale_id}")
        assert d.status_code == 200, d.text

    # Deletion actually removed it.
    listed_after = client.get("/sales").json()
    assert sale_id not in [s["id"] for s in listed_after]


def test_seller_cannot_delete_another_users_sale(client: httpx.Client):
    admin = _login(client, "doncipotecheats@gmail.com", "admin123")
    all_sales = client.get("/sales").json()
    admin_owned = [s for s in all_sales if s["seller_id"] == admin["id"]]
    assert admin_owned, "expected at least one seeded sale belonging to the admin account"
    target = admin_owned[0]

    _login(client, "vendedor@centrowagen.es", "vendedor123")
    # Pick a sale NOT owned by the currently-logged-in vendedor to prove rejection; if the
    # vendedor happens to own it (role mismatch in fixtures) this assertion would be invalid,
    # so re-check ownership from this session's perspective too.
    me = client.get("/auth/me").json()
    assert target["seller_id"] != me["id"]

    r = client.delete(f"/sales/{target['id']}")
    assert r.status_code == 403, r.text

    # Confirm it was NOT deleted.
    _login(client, "doncipotecheats@gmail.com", "admin123")
    still_there = client.get("/sales").json()
    assert target["id"] in [s["id"] for s in still_there]
