"""Borrado selectivo: SOLO registros marcados explícitamente como demo.

Uso: cd /app/backend && python wipe_demo.py [--yes]

Sin marca inequívoca no se borra. Nunca vacía una colección ni toca usuarios/configuración.
"""

import asyncio
import sys

from lib.db import db

WIPE = [
    "vehicles", "stock", "prices", "financing", "promotions",
    "faq", "memory", "argumentario", "documents", "sales",
    "chats", "messages", "client_messages", "tasks",
]


async def main(confirmed: bool) -> None:
    if not confirmed:
        print("Añade --yes para confirmar el borrado de los datos de demostración.")
        return
    for name in WIPE:
        marked = {'$or': [{'is_demo': True}, {'data_origin': 'demo'}]}
        res = await db[name].delete_many(marked)
        print(f"{name}: {res.deleted_count} documentos borrados")
    print("\nSolo se han borrado marcas demo explícitas. Los registros sin marca se conservan para revisión.")


if __name__ == "__main__":
    asyncio.run(main("--yes" in sys.argv))
