"""Dashboard stats model."""

from pydantic import BaseModel


class StatsOut(BaseModel):
    vehicles: int
    stock_units: int
    stock_immediate: int
    active_promotions: int
    prices: int
    financing_offers: int
    documents: int
    faq_items: int
    memory_items: int
    sales: int
    users: int
    last_sync: dict[str, str] = {}  # colección → ISO datetime
    demo: bool = True  # DATOS DE DEMOSTRACIÓN
