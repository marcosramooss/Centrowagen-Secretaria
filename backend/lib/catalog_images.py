"""Biblioteca de fotos sugeridas para la gama Volkswagen actual (2026).

Son fotografías genéricas de apoyo: el administrador puede sustituirlas por la
imagen oficial de la tarifa pegando su URL en la ficha del vehículo.
"""

FALLBACK = "https://images.unsplash.com/photo-1749417483023-c465991a548e?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"

MODEL_IMAGES: dict[str, str] = {
    "Golf": "https://images.unsplash.com/photo-1572811298797-9eecadf6cb24?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "Golf GTI": "https://images.unsplash.com/photo-1605475300127-0a31e8273bc2?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "T-Roc": "https://images.unsplash.com/photo-1655286182008-2a6578c7f487?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "Tiguan": "https://images.unsplash.com/photo-1655286517582-08a1483aa0fd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "Taigo": "https://images.unsplash.com/photo-1655286536348-c6391c7ec45f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "T-Cross": "https://images.unsplash.com/photo-1623013274387-45cbcbc1725b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "Passat": "https://images.unsplash.com/photo-1721501453423-aafa7921678a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "Touareg": "https://images.unsplash.com/photo-1721501502672-a318bcdca763?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "ID.3": "https://images.unsplash.com/photo-1571872579986-c175acbbcc5a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "ID.4": "https://images.unsplash.com/photo-1571872579779-876c5c06ebb7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "ID.5": "https://images.unsplash.com/photo-1571872579986-c175acbbcc5a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "ID.7": "https://images.unsplash.com/photo-1571872579779-876c5c06ebb7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
}


def image_for(model: str | None) -> str:
    """Mejor foto disponible para un modelo (coincidencia exacta o por prefijo)."""
    name = (model or "").strip()
    if not name:
        return FALLBACK
    if name in MODEL_IMAGES:
        return MODEL_IMAGES[name]
    low = name.lower()
    for key, url in MODEL_IMAGES.items():
        if low.startswith(key.lower()) or key.lower() in low:
            return url
    return FALLBACK
