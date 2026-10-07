"""Idempotent demo seed for SecretarIA — run: cd /app/backend && python seed.py [--force]

Every figure here is DATOS DE DEMOSTRACIÓN: plausible but fictional, clearly
labelled in the UI. Real prices/stock will come from official documentation
once the external sources are connected.
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone

from lib.auth import hash_password
from lib.dates import today_iso
from lib.db import db, ensure_indexes
from lib.doc import new_id, now_utc

TODAY = today_iso()


def days_from_now(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


def updated(days_ago: int) -> datetime:
    return now_utc() - timedelta(days=days_ago)


def cuota(financed: float, tin: float, months: int, final: float = 0.0) -> float:
    i = tin / 100 / 12
    if i <= 0:
        return round((financed - final) / months, 2)
    pv_final = final / ((1 + i) ** months)
    return round((financed - pv_final) * i / (1 - (1 + i) ** (-months)), 2)


def dims(l: int, w: int, h: int, wb: int) -> dict:
    return {"length_mm": l, "width_mm": w, "height_mm": h, "wheelbase_mm": wb}


EQ_BASE = [
    "Climatizador bizona", "Apple CarPlay / Android Auto", "Elevalunas eléctricos",
    "Cierre centralizado con mando", "Sensores de aparcamiento traseros",
    "Volante multifunción", "Cockpit digital", "Front Assist con frenada de emergencia",
    "Lane Assist", "Faros LED",
]
EQ_RLINE = [
    "Acabado R-Line", "Faros LED matriciales IQ.Light", "Llantas de aleación 18\"",
    "Suspensión deportiva", "Asientos deportivos", "Pedales de acero inoxidable",
    "Cámara de visión trasera", "Control de crucero adaptativo ACC",
    "Portón trasero eléctrico", "Park Assist",
]
EQ_GTI = [
    "Motor 2.0 TSI GTI", "Diferencial XDS", "Frenos deportivos",
    "Asientos deportivos con tejido Clark", "Volante deportivo con levas",
    "Modos de conducción", "IQ.Light", "App-Connect inalámbrico",
]
EQ_EV = [
    "Bomba de calor", "Carga rápida CC hasta 135 kW", "Navegación eléctrica con preacondicionamiento",
    "App Volkswagen Connect", "Faros matriciales IQ.Light LED", "Asientos calefactados",
    "Asistente de conducción Travel Assist", "Carga por inducción para smartphone",
]
EQ_EXTRA = ["Head-Up Display", "Sistema de sonido premium", "Techo panorámico", "Acceso sin llave Kessy"]

VEHICLES = [
    dict(key="golf-life", model="Golf", trim="Life", body="Compacto", generation="Golf 8.5",
         engine="1.5 TSI 115CV", fuel="Gasolina", cv=115, trans="Manual 6 velocidades", drive="Delantera",
         consumption=5.9, co2=134, trunk=373, seats=5, dimensiones=dims(4283, 1789, 1471, 2619),
         base=29460, image="/vehicles/golf-white.jpg", source="Tarifa Volkswagen 2026-2", age_days=3,
         promo_price=28100, discount=4.6, campaign="Campaña Golf",
         equipment=EQ_BASE + ["Llantas 16\"", "Cristales tintados"]),
    dict(key="golf-rline", model="Golf", trim="R-Line", body="Compacto", generation="Golf 8.5",
         engine="1.5 TSI 150CV", fuel="Gasolina", cv=150, trans="DSG 7 velocidades", drive="Delantera",
         consumption=6.0, co2=138, trunk=373, seats=5, dimensiones=dims(4283, 1789, 1471, 2619),
         base=33870, image="/vehicles/golf-gray.jpg", source="Tarifa Volkswagen 2026-2", age_days=3,
         promo_price=32570, fin_price=33100, discount=3.8, campaign="Campaña Golf",
         equipment=EQ_BASE + EQ_RLINE[:6]),
    dict(key="golf-gti", model="Golf", trim="GTI", body="Compacto", generation="Golf 8.5",
         engine="2.0 TSI 265CV", fuel="Gasolina", cv=265, trans="DSG 7 velocidades", drive="Delantera",
         consumption=7.1, co2=161, trunk=373, seats=5, dimensiones=dims(4287, 1789, 1442, 2630),
         base=47505, image="/vehicles/golf-gray.jpg", source="Tarifa Volkswagen 2026-2", age_days=5,
         equipment=EQ_BASE + EQ_GTI),
    dict(key="troc-life", model="T-Roc", trim="Life", body="SUV Compacto", generation="T-Roc 2022",
         engine="1.0 TSI 110CV", fuel="Gasolina", cv=110, trans="Manual 6 velocidades", drive="Delantera",
         consumption=6.2, co2=140, trunk=445, seats=5, dimensiones=dims(4234, 1819, 1573, 2603),
         base=28655, image="/vehicles/suv-city.jpg", source="Tarifa Volkswagen 2026-2", age_days=4,
         equipment=EQ_BASE),
    dict(key="troc-rline", model="T-Roc", trim="R-Line", body="SUV Compacto", generation="T-Roc 2022",
         engine="1.5 TSI 150CV", fuel="Gasolina", cv=150, trans="DSG 7 velocidades", drive="Delantera",
         consumption=6.3, co2=143, trunk=445, seats=5, dimensiones=dims(4234, 1819, 1573, 2603),
         base=35020, image="/vehicles/suv-brown.jpg", source="Tarifa Volkswagen 2026-2", age_days=2,
         promo_price=31520, discount=10.0, campaign="T-Roc Edición Limitada",
         equipment=EQ_BASE + EQ_RLINE),
    dict(key="tiguan-life", model="Tiguan", trim="Life", body="SUV", generation="Tiguan 3",
         engine="1.5 TSI 150CV", fuel="Gasolina", cv=150, trans="DSG 7 velocidades", drive="Delantera",
         consumption=7.0, co2=158, trunk=652, seats=5, dimensiones=dims(4539, 1842, 1655, 2680),
         base=42305, image="/vehicles/suv-white.jpg", source="Tarifa Volkswagen 2026-2", age_days=4,
         fin_price=41800, equipment=EQ_BASE + ["Llantas 17\""]),
    dict(key="tiguan-rline", model="Tiguan", trim="R-Line", body="SUV", generation="Tiguan 3",
         engine="2.0 TDI 193CV", fuel="Diésel", cv=193, trans="DSG 7 velocidades", drive="4MOTION",
         consumption=6.1, co2=160, trunk=652, seats=5, dimensiones=dims(4539, 1842, 1655, 2680),
         base=52470, image="/vehicles/suv-black.jpg", source="Tarifa Volkswagen 2026-2", age_days=4,
         equipment=EQ_BASE + EQ_RLINE + ["Asientos calefactados", "Techo panorámico"]),
    dict(key="passat-business", model="Passat", trim="Business", body="Berlina", generation="Passat B9",
         engine="1.5 TSI 150CV", fuel="Gasolina", cv=150, trans="DSG 7 velocidades", drive="Delantera",
         consumption=6.4, co2=146, trunk=565, seats=5, dimensiones=dims(4917, 1852, 1500, 2841),
         base=43640, image="/vehicles/sedan-black.jpg", source="Tarifa Volkswagen 2026-2", age_days=6,
         equipment=EQ_BASE + ["Navegador Discover", "Llantas 17\""]),
    dict(key="passat-elegance", model="Passat", trim="Elegance eHybrid", body="Berlina", generation="Passat B9",
         engine="1.5 eHybrid 218CV", fuel="Híbrido enchufable", hybrid="PHEV", cv=218, trans="DSG 6 velocidades",
         drive="Delantera", consumption=1.2, co2=27, erange=120, trunk=565, seats=5,
         dimensiones=dims(4917, 1852, 1500, 2841), base=52830, image="/vehicles/sedan-black.jpg",
         source="Tarifa Volkswagen 2026-2", age_days=6, equipment=EQ_BASE + EQ_RLINE[:4] + ["Bomba de calor", "Modo eléctrico E-Mode"]),
    dict(key="taigo-life", model="Taigo", trim="Life", body="SUV Coupé Compacto", generation="Taigo",
         engine="1.0 TSI 95CV", fuel="Gasolina", cv=95, trans="Manual 5 velocidades", drive="Delantera",
         consumption=5.8, co2=132, trunk=438, seats=5, dimensiones=dims(4266, 1757, 1515, 2563),
         base=25130, image="/vehicles/suv-city.jpg", source="Tarifa Volkswagen 2026-2", age_days=7,
         equipment=EQ_BASE),
    dict(key="taigo-rline", model="Taigo", trim="R-Line", body="SUV Coupé Compacto", generation="Taigo",
         engine="1.5 TSI 150CV", fuel="Gasolina", cv=150, trans="DSG 7 velocidades", drive="Delantera",
         consumption=6.0, co2=136, trunk=438, seats=5, dimensiones=dims(4266, 1757, 1515, 2563),
         base=30950, image="/vehicles/suv-brown.jpg", source="Tarifa Volkswagen 2026-2", age_days=7,
         promo_price=28950, discount=6.5, campaign="Campaña Taigo", equipment=EQ_BASE + EQ_RLINE[:5]),
    dict(key="tcross-life", model="T-Cross", trim="Life", body="SUV Urbano", generation="T-Cross",
         engine="1.0 TSI 95CV", fuel="Gasolina", cv=95, trans="Manual 5 velocidades", drive="Delantera",
         consumption=5.4, co2=123, trunk=385, seats=5, dimensiones=dims(4155, 1760, 1576, 2563),
         base=23830, image="/vehicles/suv-white.jpg", source="Tarifa Volkswagen 2026-2", age_days=8,
         equipment=EQ_BASE),
    dict(key="tcross-sport", model="T-Cross", trim="Sport", body="SUV Urbano", generation="T-Cross",
         engine="1.0 TSI 110CV", fuel="Gasolina", cv=110, trans="DSG 7 velocidades", drive="Delantera",
         consumption=5.6, co2=126, trunk=385, seats=5, dimensiones=dims(4155, 1760, 1576, 2563),
         base=28690, image="/vehicles/suv-brown.jpg", source="Tarifa Volkswagen 2026-2", age_days=8,
         promo_price=27190, discount=5.2, campaign="T-Cross Joven", equipment=EQ_BASE + ["Llantas 17\"", "Cámara de visión trasera", "App-Connect"]),
    dict(key="id3-pro", model="ID.3", trim="Pro", body="Compacto", generation="ID.3 FL",
         engine="APP 550 Eléctrico", fuel="Eléctrico", hybrid="BEV", cv=204, trans="Automático", drive="Trasera",
         consumption=15.9, co2=0, erange=420, trunk=385, seats=5, dimensiones=dims(4261, 1809, 1552, 2771),
         base=37930, image="/vehicles/ev-red.jpg", source="Tarifa Volkswagen 2026-2", age_days=10,
         equipment=EQ_BASE + EQ_EV),
    dict(key="id4-pro", model="ID.4", trim="Pro", body="SUV", generation="ID.4",
         engine="APP 550 Eléctrico", fuel="Eléctrico", hybrid="BEV", cv=204, trans="Automático", drive="Trasera",
         consumption=16.4, co2=0, erange=545, trunk=543, seats=5, dimensiones=dims(4584, 1852, 1637, 2765),
         base=45130, image="/vehicles/ev-dark.jpg", source="Tarifa Volkswagen 2026-2", age_days=12,
         equipment=EQ_BASE + EQ_EV),
    dict(key="id5-pro", model="ID.5", trim="Pro", body="SUV Coupé", generation="ID.5",
         engine="APP 550 Eléctrico", fuel="Eléctrico", hybrid="BEV", cv=204, trans="Automático", drive="Trasera",
         consumption=16.0, co2=0, erange=520, trunk=549, seats=5, dimensiones=dims(4582, 1852, 1615, 2765),
         base=48070, image="/vehicles/ev-charge.jpg", source="Tarifa Volkswagen 2026-2", age_days=12,
         equipment=EQ_BASE + EQ_EV),
    dict(key="id7-pro", model="ID.7", trim="Pro", body="Berlina", generation="ID.7",
         engine="APP 550 Eléctrico", fuel="Eléctrico", hybrid="BEV", cv=286, trans="Automático", drive="Trasera",
         consumption=14.9, co2=0, erange=615, trunk=586, seats=5, dimensiones=dims(4961, 1862, 1539, 2971),
         base=54130, image="/vehicles/ev-dark.jpg", source="Tarifa Volkswagen 2026-2", age_days=9,
         equipment=EQ_BASE + EQ_EV + ["Parabrisas calefactado inteligente", "Head-Up Display aumentado"]),
]


def tech_for(v: dict) -> dict:
    if v["fuel"] == "Eléctrico":
        return {
            "Batería": "77 kWh (útil)",
            "Potencia": f"{v['cv']} CV",
            "Carga CC": "hasta 135 kW",
            "Carga AC": "11 kW",
            "Tracción": "Trasera",
            "0-100 km/h": "6,5 s (aprox.)",
        }
    return {
        "Cilindrada": "1.498 cc",
        "Par máximo": "250 Nm",
        "Depósito": "50 l",
        "0-100 km/h": "9,1 s (aprox.)",
        "Velocidad máx.": "205 km/h",
    }


# key, stock_number, exterior, interior, transmission, availability, location, delivery, options, delta
STOCK = [
    ("golf-life", "CB-1010", "Blanco Puro", "Tejido Gris Titanio", "Manual 6 velocidades", "Entrega inmediata", "Don Benito", "Inmediata", [], 0),
    ("golf-rline", "CB-1042", "Blanco Puro", "Tejido Gris Titanio", "DSG 7 velocidades", "Entrega inmediata", "Don Benito", "Inmediata", ["Techo panorámico", "Head-Up Display"], 1800),
    ("golf-rline", "CB-1057", "Gris Urano", "Tejido Gris Titanio", "DSG 7 velocidades", "En tránsito", "Don Benito", "10 días", ["Pack Invierno"], 1200),
    ("golf-gti", "CB-1063", "Rojo Tornado", "Tejido Clark Rojo", "DSG 7 velocidades", "Reservado", "Don Benito", "15 días", ["Pack Performance"], 3200),
    ("troc-life", "CB-1021", "Negro Profundo", "Tejido Gris Cerámica", "Manual 6 velocidades", "Entrega inmediata", "Don Benito", "Inmediata", [], 0),
    ("troc-rline", "CB-1033", "Gris Urano", "Tejido R-Line", "DSG 7 velocidades", "Entrega inmediata", "Don Benito", "Inmediata", ["IQ.Light", "Cámara 360°"], 0),
    ("troc-rline", "CB-1034", "Azul Noche", "Tejido R-Line", "DSG 7 velocidades", "Bajo pedido", "Villanueva de la Serena", "25 días", [], 0),
    ("tiguan-life", "CB-2011", "Plata Pireo", "Tejido Gris Cerámica", "DSG 7 velocidades", "Entrega inmediata", "Don Benito", "Inmediata", ["Pack Remolque"], 900),
    ("tiguan-rline", "CB-2032", "Negro Profundo", "Cuero negro", "DSG 7 velocidades", "Entrega inmediata", "Don Benito", "Inmediata", ["Techo panorámico", "Sound premium", "Head-Up Display"], 4500),
    ("tiguan-rline", "CB-2044", "Blanco Puro", "Cuero negro", "DSG 7 velocidades", "En tránsito", "Don Benito", "12 días", [], 0),
    ("passat-business", "CB-3010", "Gris Manganita", "Tejido gris", "DSG 7 velocidades", "Entrega inmediata", "Don Benito", "Inmediata", ["Navegador Discover"], 1400),
    ("passat-elegance", "CB-3021", "Azul Saltillo", "Cuero marrón", "DSG 6 velocidades", "Bajo pedido", "Don Benito", "30 días", ["Pack Remolque"], 2600),
    ("taigo-life", "CB-4005", "Rojo Rage", "Tejido gris", "Manual 5 velocidades", "Entrega inmediata", "Don Benito", "Inmediata", [], 0),
    ("taigo-rline", "CB-4017", "Negro Profundo", "Tejido R-Line", "DSG 7 velocidades", "Entrega inmediata", "Villanueva de la Serena", "Inmediata", ["Cámara de visión trasera"], 1100),
    ("tcross-life", "CB-5008", "Blanco Puro", "Tejido negro", "Manual 5 velocidades", "Entrega inmediata", "Don Benito", "Inmediata", [], 0),
    ("tcross-sport", "CB-5022", "Azul Reef", "Tejido azul", "DSG 7 velocidades", "Entrega inmediata", "Don Benito", "Inmediata", ["Beats Audio"], 1300),
    ("id3-pro", "CB-6001", "Gris Luna", "Tejido gris", "Automático", "Entrega inmediata", "Don Benito", "Inmediata", ["Bomba de calor"], 1000),
    ("id3-pro", "CB-6002", "Blanco Cristal", "Tejido gris", "Automático", "En tránsito", "Don Benito", "15 días", [], 0),
    ("id4-pro", "CB-6015", "Azul Onix", "Cuero gris", "Automático", "Entrega inmediata", "Don Benito", "Inmediata", ["Pack Remolque", "Techo panorámico"], 2800),
    ("id4-pro", "CB-6016", "Negro Profundo", "Cuero gris", "Automático", "Bajo pedido", "Don Benito", "35 días", [], 0),
    ("id5-pro", "CB-6030", "Gris Kymat", "Tejido gris", "Automático", "En tránsito", "Don Benito", "18 días", [], 0),
    ("id7-pro", "CB-6041", "Blanco Cristal", "Cuero negro", "Automático", "Entrega inmediata", "Don Benito", "Inmediata", ["IQ.Light", "Head-Up Display"], 3600),
    ("id7-pro", "CB-6042", "Gris Grafito", "Cuero negro", "Automático", "Reservado", "Don Benito", "20 días", [], 0),
]

# key (None = genérica), campaign, entry, months, tin, tae, final, opening_fee, conditions
FIN_PLANS = [
    ("golf-life", "Volkswagen My Way", 5000, 48, 6.95, 8.15, None, 0, "Entrada 5.000 € y 48 cuotas. Oferta sujeta a aprobación de Volkswagen Financial Services."),
    ("golf-rline", "Volkswagen My Way", 6000, 48, 6.95, 8.12, 9500, 0, "Entrada 6.000 €, 47 cuotas y última cuota de 9.500 € (opción de recompra)."),
    ("golf-gti", "Volkswagen My Way GTI", 9000, 60, 7.25, 8.6, 15000, 0, "Entrada 9.000 €, 59 cuotas y última cuota de 15.000 €."),
    ("troc-life", "Volkswagen My Way", 4500, 48, 6.95, 8.2, None, 0, "Entrada 4.500 € y 48 cuotas."),
    ("troc-rline", "Volkswagen My Way", 6000, 48, 6.95, 8.12, 11000, 0, "Entrada 6.000 €, 47 cuotas y última cuota de 11.000 € (opción de recompra)."),
    ("tiguan-rline", "Volkswagen My Way", 10000, 60, 6.75, 7.95, 16000, 0, "Entrada 10.000 €, 59 cuotas y última cuota de 16.000 €."),
    ("id4-pro", "ID. Electromovilidad", 7000, 48, 5.95, 7.1, None, 0, "Plan eléctrico con entrada de 7.000 € y 48 cuotas. Incluye campaña ID."),
    ("id7-pro", "ID. Electromovilidad", 9000, 60, 5.95, 7.05, 18000, 0, "Entrada 9.000 €, 59 cuotas y última cuota de 18.000 €."),
    (None, "Volkswagen My Way — campaña general", 5000, 48, 6.95, 8.15, None, 0, "Cuota orientativa desde, sujeta a modelo, entrada y perfil del cliente."),
    (None, "Renting Volkswagen Todo Incluido", 0, 60, 7.5, 8.9, None, 0, "Cuota desde 299 €/mes con mantenimiento y seguro incluidos (según modelo)."),
]

PROMOS = [
    dict(name="Campaña Golf — Financiación especial", model="Golf",
         description="Descuento financiado para la gama Golf con Volkswagen My Way.", discount="1.900 €",
         conditions="Financiación con Volkswagen Financial Services a 48 meses. Acumulable con entrega de vehículo usado.",
         financing_required=True, vf=-20, vu=45, source="Volkswagen España", age_days=2),
    dict(name="T-Roc Edición Limitada", model="T-Roc",
         description="Descuento directo en unidades T-Roc R-Line de stock.", discount="3.500 €",
         conditions="Solo unidades matriculables antes de fin de mes. No acumulable con otras campañas.",
         financing_required=False, vf=-25, vu=5, source="Centrowagen Don Benito", age_days=1),
    dict(name="Tiguan eHybrid — Plan MOVES III", model="Tiguan",
         description="Ayuda por electrificación en el Tiguan híbrido enchufable.", discount="Hasta 4.500 €",
         conditions="Sujeto al plan MOVES III vigente y a financiación con VWFS.",
         financing_required=True, vf=-15, vu=70, source="Volkswagen España", age_days=3),
    dict(name="ID. Family — Promoción eléctrica", model="Todos",
         description="Descuento en ID.3, ID.4, ID.5 e ID.7 + wallbox de regalo.", discount="Hasta 6.900 €",
         conditions="Entrega antes de 90 días. Requiere financiación con VWFS.",
         financing_required=True, vf=-30, vu=60, source="Volkswagen España", age_days=4),
    dict(name="T-Cross Joven", model="T-Cross",
         description="Descuento para conductores jóvenes con financiación.", discount="1.500 €",
         conditions="Edad 26-35 años, financiación a 36-60 meses.",
         financing_required=True, vf=-10, vu=80, source="Volkswagen España", age_days=6),
    dict(name="Passat Empresas", model="Passat",
         description="Condiciones especiales para empresas y autónomos.", discount="2.750 €",
         conditions="Válido para empresas y autónomos; mín. 3 unidades o financiación.",
         financing_required=True, vf=-18, vu=50, source="Volkswagen España", age_days=5),
    dict(name="Taigo Verano", model="Taigo",
         description="Campaña de verano finalizada.", discount="2.000 €",
         conditions="Expirada — no presentar como vigente.",
         financing_required=False, vf=-80, vu=-10, source="Volkswagen España", age_days=40),
    dict(name="Golf GTI Lanzamiento", model="Golf",
         description="Campaña de lanzamiento finalizada.", discount="950 €",
         conditions="Expirada — no presentar como vigente.",
         financing_required=False, vf=-120, vu=-45, source="Volkswagen España", age_days=50),
]

FAQ = [
    ("Vehículos", "¿Qué diferencia hay entre los acabados Life y R-Line?",
     "Life es el acabado de acceso con el equipamiento completo de confort y seguridad; R-Line añade estética deportiva, llantas mayores, suspensión deportiva y más tecnología de serie. La comparativa exacta depende del modelo: consúltala en la ficha de cada vehículo.",
     "Volkswagen España", 5),
    ("Vehículos", "¿Cuántos años de garantía tiene un Volkswagen nuevo?",
     "Garantía oficial de 2 años sin límite de kilómetros, ampliable mediante Volkswagen Garantía Extra hasta 5 años. Consulta las condiciones vigentes en la documentación oficial.",
     "Volkswagen España", 5),
    ("Financiación", "¿Qué es Volkswagen My Way?",
     "Es la fórmula de financiación con opción de recompra: cuota reducida, una última cuota final y la posibilidad de entregar el vehículo, financiarlo o quedártelo.",
     "Volkswagen Financial Services", 8),
    ("Financiación", "¿Puedo financiar sin entrada?",
     "Las campañas habituales requieren una entrada mínima; existen promociones puntuales con entrada 0 € para determinados modelos y perfiles. Verifica siempre la campaña vigente.",
     "Volkswagen Financial Services", 8),
    ("Financiación", "¿Se puede amortizar anticipadamente la financiación?",
     "Sí, con comisión según contrato; en My Way además puedes aplicar la última cuota como recompra. Revisa las condiciones del contrato antes de firmar.",
     "Volkswagen Financial Services", 8),
    ("Garantía", "¿Qué cubre la garantía de la batería de los ID.?",
     "8 años o 160.000 km (lo que antes ocurra) con garantía de capacidad mínima del 70%. Sujeto a condiciones oficiales.",
     "Volkswagen España", 12),
    ("Mantenimiento", "¿Qué incluye el plan de mantenimiento Volkswagen?",
     "Revisiones oficiales según tiempo/kilómetros del plan vigente, con piezas y mano de obra según tarifario oficial. Puede financiarse junto con el vehículo.",
     "Centrowagen Don Benito", 15),
    ("Entrega", "¿Cuánto tarda la entrega de un vehículo bajo pedido?",
     "Depende del modelo y la fabricación: entre 4 y 16 semanas en condiciones normales. Las unidades con 'Entrega inmediata' se entregan en 24-72 horas tras la matriculación.",
     "Centrowagen Don Benito", 3),
    ("Entrega", "¿Qué documentos necesito para la entrega?",
     "DNI, permiso de conducir, justificante de domicilio y datos fiscales para la factura; si hay financiación, además la documentación de solvencia que solicite VWFS.",
     "Centrowagen Don Benito", 15),
    ("Tecnología", "¿Qué es IQ.Light?",
     "Es el sistema de faros LED matriciales de Volkswagen con luz larga sin deslumbrar y señalización gráfica en carretera según el modelo.",
     "Volkswagen España", 20),
    ("Conectividad", "¿Qué App uso con mi Volkswagen?",
     "La App Volkswagen Connect (combustión) y la App ID. (eléctricos) permiten estado del vehículo, climatización remota, localización y datos de trayecto según el modelo.",
     "Volkswagen España", 20),
    ("Vehículos eléctricos", "¿Cuánto tarda una carga rápida en un ID.?",
     "Con un cargador CC de alta potencia (100-135 kW según modelo) se recupera del 10% al 80% en unos 25-35 minutos en condiciones óptimas.",
     "Volkswagen España", 12),
    ("Vehículos eléctricos", "¿Tiene sentido el eléctrico si hago muchos kilómetros?",
     "Para grandes cabileros anuales conviene evaluar híbrido enchufable o diésel; para perfiles urbanos o regionales con carga en casa, el ID. es imbatible en coste de uso. Analiza cada caso con el simulador.",
     "Centrowagen Don Benito", 6),
    ("Híbridos", "¿Qué autonomía eléctrica tienen los eHybrid?",
     "Los híbridos enchufables de la gama actual ofrecen entre 100 y 120 km de autonomía eléctrica homologada según el modelo (ciclo WLTP).",
     "Volkswagen España", 9),
]

MEMORY = [
    ("Preferencias del vendedor", "El vendedor prefiere presentar primero el precio con financiación incluida y después el PVP de contado.", "alta"),
    ("Preferencias del vendedor", "Trata de usted a los clientes mayores de 60 años y de tú al resto, salvo indicación contraria.", "media"),
    ("Procedimientos", "Antes de cualquier oferta: comprobar el stock real en la pantalla Stock y confirmar la vigencia de la campaña en Promociones.", "alta"),
    ("Procedimientos", "Toda oferta por WhatsApp debe llevar la fecha del dato y la leyenda 'sujeto a confirmación por jefatura'.", "alta"),
    ("Argumentarios", "Frente a competidores coreanos, insistir en la red oficial Volkswagen, el valor de reventa y la garantía ampliable.", "media"),
    ("Información comercial", "Objetivo mensual del punto de venta: 12 unidades y 600.000 € de facturación (demo).", "media"),
    ("Datos recurrentes", "Feria de mayo de Don Benito: montar expositor con ID.4 y T-Roc los días 8-11.", "baja"),
    ("FAQ", "Pregunta frecuente en showroom: '¿la revisión del primer año va incluida?' — responder con el plan de mantenimiento vigente.", "media"),
]

ARGS = [
    dict(model="Golf",
         strong_points=["Icono del segmento con mejor valor de reventa", "Calidad de conducción y chasis de referencia", "Tecnología de cockpit digital de serie"],
         ideal_customer="Perfil urbano-profesional que valora imagen, tecnología y placer de conducción.",
         sales_arguments=["Coste de uso contenido y financiación My Way a medida", "Equipamiento de seguridad Front Assist de serie", "Amplia red oficial de servicio Volkswagen"],
         objections=[("Es demasiado caro", "Explica el valor: equipamiento de serie, seguridad, garantía ampliable y financiación a medida con la campaña vigente; compara la cuota mensual, no solo el precio de contado."),
                     ("Prefiero esperar a una oferta mayor", "La campaña actual ya aplica descuento financiado; las promociones pueden caducar y el stock actual tiene entrega inmediata."),
                     ("Mi coche actual vale poco", "Tasa el vehículo de entrega con la herramienta oficial y demuestra el valor final a financiar.")],
         differences=["Frente a T-Roc: más deportivo y eficiente, menos altura al suelo", "Frente a competidores premium: mismo nivel tecnológico con coste de mantenimiento menor"],
         discovery_questions=["¿Cuántos kilómetros haces al año?", "¿Te interesaría una unidad con entrega inmediata?", "¿Valoras más la deportividad o la eficiencia?"]),
    dict(model="T-Roc",
         strong_points=["Diseño SUV compacto muy demandado", "Posición de conducción elevada", "Amplia paleta de colores y acabados"],
         ideal_customer="Parejas jóvenes o familias pequeñas que quieren un SUV manejable con presencia.",
         sales_arguments=["Stock local con entrega inmediata", "Campaña Edición Limitada vigente (verificar vigencia)", "Maletero de 445 l con respaldo abatible"],
         objections=["Es demasiado caro", "Prefiero esperar a una oferta mayor", "Mi coche actual vale poco"],
         differences=["Frente a Tiguan: más compacto y asequible", "Frente a T-Cross: más espacio y potencia"],
         discovery_questions=["¿Aparcas habitualmente en ciudad?", "¿Necesitas los cinco asientos a diario?"]),
    dict(model="Tiguan",
         strong_points=["SUV familiar de referencia del segmento", "Maletero de 652 l", "Disponible 4MOTION y eHybrid"],
         ideal_customer="Familias con niños que viajan mucho por carretera.",
         sales_arguments=["Espacio y seguridad para toda la familia", "Plan MOVES III para la versión eHybrid", "Confort de suspensión adaptativa según acabado"],
         objections=["Necesito 7 plazas", "El consumo en SUV me preocupa", "Prefiero diésel para viaje"],
         differences=["Frente a ID.4: motorización convencional frente a eléctrico", "Líder de segmento en espacio maletero"],
         discovery_questions=["¿Qué abandonas normalmente en el maletero?", "¿Haces viajes largos con carga?"]),
    dict(model="Passat",
         strong_points=["Berlina ejecutiva con gran habitáculo", "Versión eHybrid con 120 km de autonomía eléctrica", "Cofre maletero de 565 l"],
         ideal_customer="Profesionales con muchos kilómetros y familias que prefieren berlina a SUV.",
         sales_arguments=["Consumo irrisorio en la versión eHybrid con carga en casa", "Confort de marcha de berlina larga", "Campaña Passat Empresas vigente"],
         objections=["El SUV está de moda", "No tengo cargador en casa", "Es demasiado coche para mí"],
         differences=["Frente a Tiguan: aerodinámica mejor y consumo menor", "Frente a ejecutivos premium: coste/valor insuperable"],
         discovery_questions=["¿Cuántos kilómetros haces al año y por dónde?", "¿Puedes cargar en el trabajo?"]),
    dict(model="T-Cross",
         strong_points=["SUV urbano perfecto para ciudad", "Precio de acceso muy competitivo", "Maletero modular con doble fondo"],
         ideal_customer="Conductores de ciudad, segunda unidad familiar o primer coche de joven.",
         sales_arguments=["Campaña T-Cross Joven vigente", "Consumo real bajo en ciudad", "Maniobrabilidad y aparcamiento sencillos"],
         objections=["Me parece pequeño", "Necesito más potencia", "Prefiero diésel por viaje"],
         differences=["Frente a T-Roc: más urbano y económico", "El más vendido para conductores jóvenes"],
         discovery_questions=["¿Qué tamaño tiene tu plaza de garaje?", "¿Cuántos viajáis normalmente?"]),
    dict(model="ID.4",
         strong_points=["SUV eléctrico con hasta 545 km de autonomía", "Carga rápida de 135 kW", "Muy bajo coste de uso y mantenimiento"],
         ideal_customer="Perfil con carga en casa o en el trabajo, 15.000-25.000 km/año, conciencia medioambiental.",
         sales_arguments=["Coste por km imbatible frente a combustión", "Promoción ID. Family + wallbox", "Ayudas MOVES III aplicables"],
         objections=["Me preocupa la autonomía en viaje", "No tengo dónde cargar", "La batería se degradará"],
         differences=["Frente a Tiguan: electricidad pura, cero emisiones", "Garantía de batería 8 años/160.000 km"],
         discovery_questions=["¿Podrías cargar en casa por la noche?", "¿Qué porcentaje de tus viajes supera 300 km?"]),
]

DOCS = [
    ("Tarifa Volkswagen PVP 2026-2 (DEMO)", "Tarifas", "PDF", "Volkswagen España",
     "Tarifa oficial de PVP recomendado vigente 2026-2. Golf 29.460 €; T-Roc 28.655 €; Tiguan 42.305 €; Passat 43.640 €; Taigo 25.130 €; T-Cross 23.830 €; ID.3 37.930 €; ID.4 45.130 €; ID.5 48.070 €; ID.7 54.130 €. Descuentos por campaña no incluidos.", 2),
    ("Circular Campaña Q4 — Centrowagen (DEMO)", "Campañas", "PDF", "Centrowagen",
     "Campaña comercial interna Q4: descuento adicional financiado en Golf y T-Roc; prioridad de venta de las unidades CB-1010 a CB-1063 con entrega inmediata.", 4),
    ("Condiciones Volkswagen My Way (DEMO)", "Financiación", "PDF", "Volkswagen Financial Services",
     "My Way: opción de recompra con última cuota; comisión de apertura 0%; amortización anticipada según contrato; TAE orientativa 8,12%.", 10),
    ("Listado de stock Don Benito (DEMO)", "Stock", "XLSX", "Centrowagen", "", 1),
    ("Ficha técnica ID.4 Pro (DEMO)", "Fichas técnicas", "PDF", "Volkswagen España",
     "ID.4 Pro: 204 CV, tracción trasera, batería 77 kWh, autonomía hasta 545 km WLTP, carga CC 135 kW, maletero 543 l.", 20),
    ("Manual argumentario comercial SUV (DEMO)", "Formación", "PDF", "Centrowagen",
     "Argumentos principales de la gama SUV: seguridad, espacio modular, digitalización y red de servicio.", 30),
    ("Garantía Volkswagen y ampliaciones (DEMO)", "Garantía", "PDF", "Volkswagen España",
     "Garantía 2 años sin límite de km; ampliación hasta 5 años; batería ID. 8 años/160.000 km al 70% de capacidad.", 60),
    ("Checklist de entrega (DEMO)", "Procedimientos", "DOCX", "Centrowagen",
     "Entrega: documentos, kit de emergencia, emparejamiento App, revisión de niveles, depósito lleno.", 25),
]

USERS = [
    {"id": new_id(), "name": "Dirección Centrowagen", "email": "doncipotecheats@gmail.com", "role": "admin", "password": "admin123"},
    {"id": new_id(), "name": "Vendedor Comercial", "email": "vendedor@centrowagen.es", "role": "vendedor", "password": "vendedor123"},
]

# days_ago, client, model, stock_number, pvp, discount, status, notes, seller_index
SALES = [
    (2, "María López", "Golf R-Line 1.5 TSI DSG", "CB-1042", 35670, 1900, "Reserva", "Financiación My Way 48 meses.", 1),
    (5, "Carlos Ruiz", "T-Roc R-Line DSG", "CB-1033", 35020, 3500, "Cerrada", "Entrega inmediata con campaña Edición Limitada.", 1),
    (9, "Ana Martín", "Tiguan R-Line 2.0 TDI", "CB-2032", 56970, 2750, "Cerrada", "Evaluó eHybrid; eligió 2.0 TDI 4MOTION.", 1),
    (12, "Javier Serrano", "ID.4 Pro", "CB-6015", 47930, 3000, "Entregada", "Con wallbox y campaña ID. Family.", 1),
    (6, "Lucía Fernández", "T-Cross Sport DSG", "CB-5022", 29990, 1500, "Entregada", "Perfil joven — campaña T-Cross.", 0),
]

COMMISSION_RATE = 3.0
MONTHLY_TARGET = 600000.0

# title, kind, client, phone, vehicle, days_from_today, time, priority
TASKS = [
    ("Llamar a María para confirmar la financiación", "Llamada", "María López", "600 111 222", "Golf R-Line 1.5 TSI DSG", 0, "10:30", "alta"),
    ("Enviar oferta del T-Roc por WhatsApp", "WhatsApp", "Carlos Ruiz", "600 333 444", "T-Roc R-Line DSG", 0, "17:00", "media"),
    ("Seguimiento: no contestó la semana pasada", "Seguimiento", "Ana Martín", "600 555 666", "Tiguan R-Line", -4, None, "alta"),
    ("Preparar la entrega del ID.4 y emparejar la App", "Entrega", "Javier Serrano", "600 777 888", "ID.4 Pro", 2, "09:30", "media"),
    ("Prueba dinámica del ID.3 con el cliente", "Prueba dinámica", "Lucía Fernández", "600 999 000", "ID.3 Pro", 4, "16:15", "baja"),
]


async def main(force: bool = False) -> None:
    raise RuntimeError('Seed demo deshabilitado. Configura el primer administrador en /login e importa documentación real.')
    existing = await db.vehicles.count_documents({})
    if existing and not force:
        print(f"La base ya contiene {existing} vehículos — seed omitido (usa --force para reiniciar).")
        return
    if force:
        for coll in ["vehicles", "stock", "prices", "financing", "promotions", "documents", "faq",
                     "memory", "argumentario", "users", "sessions", "sales", "settings", "chats", "messages",
                     "tasks", "client_messages", "cron_runs"]:
            await db[coll].delete_many({})
    await ensure_indexes()

    # Users --------------------------------------------------------------
    for u in USERS:
        await db.users.insert_one({
            "id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"],
            "password_hash": hash_password(u["password"]),
            "created_at": now_utc(),
        })

    # Vehicles + prices --------------------------------------------------
    ids: dict[str, str] = {}
    for v in VEHICLES:
        vid = new_id()
        ids[v["key"]] = vid
        await db.vehicles.insert_one({
            "id": vid, "brand": "Volkswagen", "model": v["model"], "generation": v["generation"],
            "body_type": v["body"], "trim": v["trim"], "engine": v["engine"], "fuel": v["fuel"],
            "hybrid_type": v.get("hybrid"), "power_cv": v["cv"], "transmission": v["trans"],
            "drivetrain": v.get("drive"), "consumption": v["consumption"], "co2_g": v.get("co2"),
            "electric_range_km": v.get("erange"), "trunk_l": v["trunk"], "seats": v["seats"],
            "dimensions": v["dimensiones"], "technical_data": tech_for(v), "equipment": v["equipment"],
            "image": v["image"], "active": True, "source": v["source"], "source_url": None,
            "last_updated": updated(v["age_days"]),
        })
        await db.prices.insert_one({
            "id": new_id(), "vehicle_id": vid, "base_price": v["base"],
            "promotional_price": v.get("promo_price"), "financing_price": v.get("fin_price"),
            "discount": v.get("discount"), "campaign": v.get("campaign"),
            "valid_from": days_from_now(-30), "valid_until": days_from_now(90),
            "source": "Tarifa Volkswagen / Centrowagen", "last_updated": updated(2),
        })
    vmap = {v["key"]: v for v in VEHICLES}

    # Stock ----------------------------------------------------------------
    for key, number, exterior, interior, trans, availability, location, delivery, options, delta in STOCK:
        v = vmap[key]
        pvp = float(v["base"] + delta)
        promo = pvp - 3500 if key == "troc-rline" and number == "CB-1033" else None
        await db.stock.insert_one({
            "id": new_id(), "vehicle_id": ids[key], "stock_number": number, "vin": None,
            "model": v["model"], "trim": v["trim"], "engine": v["engine"], "power": v["cv"],
            "transmission": trans, "exterior_color": exterior, "interior_color": interior,
            "options": options, "pvp": pvp, "promotional_price": promo, "financing_price": None,
            "availability": availability, "location": location, "delivery_estimate": delivery,
            "last_updated": updated(1),
        })

    # Financing ------------------------------------------------------------
    for key, campaign, entry, months, tin, tae, final, opening, conditions in FIN_PLANS:
        if key is None:
            financed = 0.0
            monthly = 299.0 if "Renting" in campaign else 259.0
        else:
            financed = float(vmap[key]["base"] - entry)
            monthly = cuota(financed, tin, months, final or 0.0)
        total = round(entry + monthly * (months - 1) + (final or 0)) if final else round(entry + monthly * months)
        await db.financing.insert_one({
            "id": new_id(), "vehicle_id": ids[key] if key else None, "campaign": campaign,
            "entry_payment": float(entry), "financed_amount": financed, "monthly_payment": monthly,
            "number_of_payments": months, "final_payment": final, "tin": tin, "tae": tae,
            "opening_fee": opening, "total_amount": float(total), "conditions": conditions,
            "valid_from": days_from_now(-20), "valid_until": days_from_now(60),
            "source": "Volkswagen Financial Services", "last_updated": updated(3),
        })

    # Promotions -------------------------------------------------------------
    for p in PROMOS:
        await db.promotions.insert_one({
            "id": new_id(), "name": p["name"], "model": p["model"], "description": p["description"],
            "discount": p.get("discount"), "conditions": p.get("conditions", ""),
            "financing_required": p.get("financing_required", False),
            "valid_from": days_from_now(p["vf"]), "valid_until": days_from_now(p["vu"]),
            "source": p["source"], "last_updated": updated(p["age_days"]),
        })

    # FAQ / Memory / Argumentario / Documents --------------------------------
    for category, question, answer, source, age in FAQ:
        await db.faq.insert_one({
            "id": new_id(), "category": category, "question": question, "answer": answer,
            "source": source, "last_updated": updated(age),
        })

    for category, content, importance in MEMORY:
        await db.memory.insert_one({
            "id": new_id(), "category": category, "content": content, "importance": importance,
            "created_at": updated(30), "updated_at": updated(10),
        })

    for a in ARGS:
        await db.argumentario.insert_one({
            "id": new_id(), "model": a["model"], "strong_points": a["strong_points"],
            "ideal_customer": a["ideal_customer"], "sales_arguments": a["sales_arguments"],
            "objections": [{"objection": o[0], "response": o[1]} for o in a["objections"]],
            "differences": a["differences"], "discovery_questions": a["discovery_questions"],
            "source": "Centrowagen Don Benito", "last_updated": updated(14),
        })

    for name, category, dtype, source, text, age in DOCS:
        await db.documents.insert_one({
            "id": new_id(), "name": name, "category": category, "file_url": None,
            "document_type": dtype, "upload_date": days_from_now(-age), "version": "1.0",
            "source": source, "active": True, "content_text": text, "size_bytes": None,
            "storage_path": None, "content_type": None, "original_filename": None, "is_deleted": False,
        })

    # Sales + settings ---------------------------------------------------------
    for days_ago, client_name, vmodel, stock_number, pvp, discount, status, notes, seller_idx in SALES:
        seller = USERS[seller_idx]
        await db.sales.insert_one({
            "id": new_id(), "seller_id": seller["id"], "seller_name": seller["name"],
            "sale_date": days_from_now(-days_ago), "client_name": client_name, "vehicle_model": vmodel,
            "stock_number": stock_number, "pvp": float(pvp), "discount": float(discount),
            "commission_rate": COMMISSION_RATE,
            "commission_estimated": round((pvp - discount) * COMMISSION_RATE / 100, 2),
            "status": status, "notes": notes, "created_at": updated(days_ago),
        })

    await db.settings.insert_one({"key": "ventas", "commission_rate": COMMISSION_RATE, "monthly_target": MONTHLY_TARGET})

    # Recordatorios de seguimiento (del vendedor) ------------------------------
    seller = USERS[1]
    for title, kind, client, phone, vehicle, delta, time_str, priority in TASKS:
        await db.tasks.insert_one({
            "id": new_id(), "owner_id": seller["id"], "owner_name": seller["name"],
            "title": title, "kind": kind, "client_name": client, "client_phone": phone,
            "client_email": None, "vehicle_model": vehicle,
            "due_date": days_from_now(delta), "due_time": time_str, "priority": priority,
            "notes": "", "status": "pendiente", "created_at": updated(5), "completed_at": None,
        })

    print("Seed completado — DATOS DE DEMOSTRACIÓN cargados (17 vehículos, 23 unidades de stock, 10 planes de financiación, 8 promociones).")
    print("Cuentas: doncipotecheats@gmail.com / admin123 (ADMIN) · vendedor@centrowagen.es / vendedor123 (VENDEDOR)")


if __name__ == "__main__":
    asyncio.run(main(force="--force" in sys.argv))
