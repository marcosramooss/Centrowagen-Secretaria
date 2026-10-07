"""Admin accounts & setup gating (criterion: Marcos stays ADMIN; 5-char min password;
vendedor cannot promote/import; setup stays closed while users exist).

Uses the temporary regression account cinco@centrowagen.es / Abc5! (role admin) to
read the user list, and creates/tears down its OWN throwaway vendedor fixture (direct
Mongo insert, since no HTTP endpoint creates a plain vendedor outside Google sign-in)
to prove the permission boundary via real HTTP calls. Never touches Marcos.
"""
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.auth import hash_password  # noqa: E402
from lib.db import db  # noqa: E402

REAL_ADMIN_ID = "4b2ac06e-d3a2-4d66-bd3d-b8ff961a1f5f"
REAL_ADMIN_EMAIL = "mxrcosramos@gmail.com"
TEMP_ADMIN_EMAIL = "cinco@centrowagen.es"
TEMP_ADMIN_PASSWORD = "Abc5!"


def test_setup_password_length_validated_without_touching_real_users(client):
    """Pydantic validates password length BEFORE the 'already configured' check,
    so this proves the 5-char minimum/4-char rejection without creating or
    deleting any real user (setup is already closed because users exist)."""
    base_payload = {
        "name": "tscheck setup probe",
        "email": f"tscheck-setup-{uuid.uuid4().hex[:8]}@example.com",
        "setup_token": "irrelevant-but-long-enough-for-min-length",
    }
    r4 = client.post("/auth/setup", json={**base_payload, "password": "abcd"})
    assert r4.status_code == 422, r4.text
    assert "5" in str(r4.json())

    r5 = client.post("/auth/setup", json={**base_payload, "password": "abcde"})
    assert r5.status_code in (403, 409), r5.text

    status = client.get("/auth/setup")
    assert status.status_code == 200
    assert status.json()["required"] is False, "initial setup must stay closed while Marcos exists"


def test_real_admin_preserved_in_user_list(client):
    login = client.post("/auth/login", json={"email": TEMP_ADMIN_EMAIL, "password": TEMP_ADMIN_PASSWORD})
    assert login.status_code == 200, login.text
    users = client.get("/auth/users", cookies=login.cookies)
    assert users.status_code == 200
    by_id = {u["id"]: u for u in users.json()}
    assert REAL_ADMIN_ID in by_id, "real Marcos account must still exist"
    assert by_id[REAL_ADMIN_ID]["email"] == REAL_ADMIN_EMAIL
    assert by_id[REAL_ADMIN_ID]["role"] == "admin", "real Marcos account must remain ADMIN"


@pytest_asyncio.fixture
async def tscheck_vendedor(client):
    """Fixture vendedor created directly in Mongo (no HTTP route creates a plain
    vendedor outside Google sign-in); logged-in cookie handed to the test, then the
    user and its session are deleted during teardown."""
    uid = str(uuid.uuid4())
    email = f"tscheck-vendedor-{uid[:8]}@example.com"
    await db.users.insert_one({
        "id": uid, "name": "tscheck vendedor fixture", "email": email,
        "password_hash": hash_password("Tscheck5!"), "role": "vendedor",
        "created_at": datetime.now(timezone.utc),
    })
    login = client.post("/auth/login", json={"email": email, "password": "Tscheck5!"})
    assert login.status_code == 200, login.text
    yield uid, login.cookies
    await db.sessions.delete_many({"user_id": uid})
    await db.users.delete_one({"id": uid})


@pytest.mark.asyncio
async def test_vendedor_cannot_promote_or_import(client, tscheck_vendedor):
    _uid, cookies = tscheck_vendedor

    promote = client.post(f"/auth/users/{REAL_ADMIN_ID}/promote", cookies=cookies)
    assert promote.status_code == 403, promote.text

    sanity = client.get("/auth/users", cookies=cookies)
    assert sanity.status_code == 200
    real = next(u for u in sanity.json() if u["id"] == REAL_ADMIN_ID)
    assert real["role"] == "admin", "vendedor's rejected promote call must not have changed anything"

    unauthorized_import = client.post("/import/apply", json={"preview_id": "x", "confirm": True}, cookies=cookies)
    assert unauthorized_import.status_code == 403, unauthorized_import.text
