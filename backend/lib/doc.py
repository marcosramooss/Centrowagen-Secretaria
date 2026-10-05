"""Shared doc → model helpers.

Mongo hands back naive UTC datetimes and _id fields; Pydantic models want clean
aware-UTC datetimes and string ids. Normalise here, in one place.
"""

from datetime import datetime, timezone


def aware(dt: datetime | None = None) -> datetime:
    """Naive-Mongo datetime → aware UTC (so JS `new Date(...)` parses it right)."""
    if dt is None:
        return datetime.now(timezone.utc)
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def prepare(doc: dict | None, *dt_fields: str) -> dict:
    """Pop Mongo's `_id` and normalise the given datetime fields before model construction."""
    doc = dict(doc or {})
    doc.pop("_id", None)
    for f in dt_fields:
        if f in doc:
            doc[f] = aware(doc[f])
    return doc


def new_id() -> str:
    import uuid

    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
