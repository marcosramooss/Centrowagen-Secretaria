"""Printable PDF offer — precio, promoción y cuota listos para entregar al cliente."""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

VW_BLUE = colors.HexColor("#0066D6")
INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#CBD5E1")


def eur(value: float | None) -> str:
    if value is None:
        return "No disponible"
    return f"{value:,.0f} €".replace(",", ".")


def eur2(value: float | None) -> str:
    if value is None:
        return "No disponible"
    return f"{value:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def build_offer_pdf(
    *,
    vehicle: dict,
    price: dict | None,
    financing: dict | None,
    promotions: list[dict],
    stock_unit: dict | None,
    client_name: str,
    seller_name: str,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Oferta {vehicle.get('model')} {vehicle.get('trim')}",
        author="Centrowagen Don Benito",
    )
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=20, leading=24, textColor=INK, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=11, leading=14, textColor=VW_BLUE, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=ss["BodyText"], fontSize=9.5, leading=13, textColor=INK)
    small = ParagraphStyle("small", parent=ss["BodyText"], fontSize=7.5, leading=10, textColor=MUTED)
    right = ParagraphStyle("right", parent=small, alignment=TA_RIGHT)

    flow: list = []

    # Header
    flow.append(
        Table(
            [[
                Paragraph("<b>SecretarIA</b><br/><font size=8 color='#64748B'>Centrowagen Don Benito · Concesionario oficial Volkswagen</font>", body),
                Paragraph(f"Oferta comercial<br/>{datetime.now().strftime('%d/%m/%Y')}", right),
            ]],
            colWidths=[112 * mm, 62 * mm],
            style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]),
        )
    )
    flow.append(HRFlowable(width="100%", thickness=2, color=VW_BLUE, spaceAfter=10))

    # Vehicle
    flow.append(Paragraph(f"Volkswagen {vehicle.get('model', '')}", h1))
    flow.append(Paragraph(f"<font size=11 color='#475569'>{vehicle.get('trim', '')} · {vehicle.get('engine') or ''}</font>", body))
    flow.append(Spacer(1, 8))

    specs = [
        ("Potencia", f"{vehicle.get('power_cv')} CV" if vehicle.get("power_cv") else "—"),
        ("Cambio", vehicle.get("transmission") or "—"),
        ("Combustible", vehicle.get("fuel") or "—"),
        ("Carrocería", vehicle.get("body_type") or "—"),
    ]
    unit = "kWh/100 km" if str(vehicle.get("fuel", "")).lower().startswith("eléc") else "l/100 km"
    specs2 = [
        ("Consumo", f"{vehicle.get('consumption')} {unit}" if vehicle.get("consumption") else "—"),
        ("Emisiones CO₂", f"{vehicle.get('co2_g')} g/km" if vehicle.get("co2_g") is not None else "—"),
        ("Maletero", f"{vehicle.get('trunk_l')} l" if vehicle.get("trunk_l") else "—"),
        ("Autonomía eléctrica", f"{vehicle.get('electric_range_km')} km" if vehicle.get("electric_range_km") else "—"),
    ]
    flow.append(
        Table(
            [[Paragraph(f"<font color='#64748B'>{k}</font><br/><b>{v}</b>", body) for k, v in specs],
             [Paragraph(f"<font color='#64748B'>{k}</font><br/><b>{v}</b>", body) for k, v in specs2]],
            colWidths=[43.5 * mm] * 4,
            style=TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LINEBELOW", (0, 0), (-1, 0), 0.4, LINE),
            ]),
        )
    )

    # Client / seller
    flow.append(Paragraph("Datos de la oferta", h2))
    flow.append(
        Table(
            [
                ["Cliente", client_name or "—", "Asesor comercial", seller_name or "—"],
                ["Fecha", datetime.now().strftime("%d/%m/%Y"), "Unidad", (stock_unit or {}).get("stock_number") or "Bajo pedido"],
            ],
            colWidths=[26 * mm, 61 * mm, 32 * mm, 55 * mm],
            style=TableStyle([
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
                ("TEXTCOLOR", (2, 0), (2, -1), MUTED),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
                ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.3, LINE),
            ]),
        )
    )

    # Price
    flow.append(Paragraph("Precio", h2))
    shown = (price or {}).get("promotional_price") or (price or {}).get("base_price")
    price_rows = [["PVP según tarifa", eur((price or {}).get("base_price"))]]
    if (price or {}).get("promotional_price"):
        price_rows.append(["Precio promocional", eur(price["promotional_price"])])
    if (price or {}).get("financing_price"):
        price_rows.append(["Precio con financiación", eur(price["financing_price"])])
    if (price or {}).get("campaign"):
        price_rows.append(["Campaña aplicada", str(price["campaign"])])
    price_rows.append(["PRECIO OFERTADO", eur(shown)])
    flow.append(
        Table(
            price_rows,
            colWidths=[119 * mm, 55 * mm],
            style=TableStyle([
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("TEXTCOLOR", (0, 0), (0, -2), MUTED),
                ("GRID", (0, 0), (-1, -1), 0.3, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("BACKGROUND", (0, -1), (-1, -1), VW_BLUE),
                ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, -1), (-1, -1), 12),
            ]),
        )
    )

    # Promotions
    if promotions:
        flow.append(Paragraph("Promociones aplicables", h2))
        for p in promotions:
            flow.append(
                Paragraph(
                    f"<b>{p.get('name', '')}</b> — {p.get('discount') or ''}<br/>"
                    f"<font size=8 color='#64748B'>{p.get('description') or ''} "
                    f"Vigencia hasta {p.get('valid_until') or '—'}."
                    f"{' Requiere financiación con VWFS.' if p.get('financing_required') else ''}</font>",
                    body,
                )
            )
            flow.append(Spacer(1, 4))

    # Financing
    flow.append(Paragraph("Financiación", h2))
    if financing:
        flow.append(
            Table(
                [
                    ["Campaña", str(financing.get("campaign") or "—"), "Cuota mensual", eur2(financing.get("monthly_payment"))],
                    ["Entrada", eur(financing.get("entry_payment")), "Nº de cuotas", str(financing.get("number_of_payments") or "—")],
                    ["Importe financiado", eur(financing.get("financed_amount")), "Última cuota", eur(financing.get("final_payment"))],
                    ["TIN", f"{financing.get('tin')} %", "TAE", f"{financing.get('tae')} %"],
                    ["Comisión de apertura", eur(financing.get("opening_fee")), "Total adeudado", eur(financing.get("total_amount"))],
                ],
                colWidths=[42 * mm, 45 * mm, 38 * mm, 49 * mm],
                style=TableStyle([
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
                    ("TEXTCOLOR", (2, 0), (2, -1), MUTED),
                    ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
                    ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.3, LINE),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]),
            )
        )
        if financing.get("conditions"):
            flow.append(Spacer(1, 4))
            flow.append(Paragraph(str(financing["conditions"]), small))
    else:
        flow.append(Paragraph("No hay un plan de financiación confirmado para esta unidad.", body))

    # Equipment
    if vehicle.get("equipment"):
        flow.append(Paragraph("Equipamiento destacado", h2))
        eq = list(vehicle["equipment"])[:12]
        half = (len(eq) + 1) // 2
        rows = []
        for i in range(half):
            left = f"• {eq[i]}"
            rightc = f"• {eq[i + half]}" if i + half < len(eq) else ""
            rows.append([Paragraph(left, body), Paragraph(rightc, body)])
        flow.append(Table(rows, colWidths=[87 * mm, 87 * mm], style=TableStyle([
            ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ])))

    # Legal
    flow.append(Spacer(1, 12))
    flow.append(HRFlowable(width="100%", thickness=0.5, color=LINE, spaceAfter=6))
    src = (price or {}).get("source") or vehicle.get("source") or "Tarifa Volkswagen"
    flow.append(
        Paragraph(
            "<b>Condiciones:</b> esta oferta es informativa y no constituye un contrato. Los importes, promociones y "
            "condiciones de financiación están sujetos a la campaña vigente, a la aprobación de Volkswagen Financial "
            "Services y deben verificarse antes de su aceptación definitiva. Precios con impuestos y transporte según "
            "tarifa oficial, sin incluir gastos de matriculación salvo indicación expresa. Oferta válida salvo error "
            "tipográfico o fin de existencias de la unidad indicada.<br/><br/>"
            f"<b>Fuente de los datos:</b> {src}. <b>DATOS DE DEMOSTRACIÓN</b> — sustituir por tarifa oficial antes de "
            "entregar al cliente. Documento generado por SecretarIA para Centrowagen Don Benito.",
            small,
        )
    )

    doc.build(flow)
    return buf.getvalue()
