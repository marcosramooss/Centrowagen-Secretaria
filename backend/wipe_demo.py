"""Borra TODO el contenido comercial de demostración — deja usuarios y configuración intactos.

Uso: cd /app/backend && python wipe_demo.py [--yes]

Vacía: vehicles, stock, prices, financing, promotions, faq, memory, argumentario,
documents, sales, chats, messages, client_messages.
NO toca: users, sessions, google_sessions, settings, tasks, cron_runs.
"""

import asyncio
import sys

from lib.db import db

WIPE = [
    "vehicles", "stock", "prices", "financing", "promotions",
    "faq", "memory", "argumentario", "documents", "sales",
    "chats", "messages", "client_messages",
]


async def main(confirmed: bool) -> None:
    if not confirmed:
        print("Añade --yes para confirmar el borrado de los datos de demostración.")
        return
    for name in WIPE:
        res = await db[name].delete_many({})
        print(f"{name}: {res.deleted_count} documentos borrados")
    print("\nListo. La base queda vacía y preparada para los datos reales.")


if __name__ == "__main__":
    asyncio.run(main("--yes" in sys.argv))
