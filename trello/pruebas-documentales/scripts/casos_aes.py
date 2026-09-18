# -*- coding: utf-8 -*-
"""21 casos de prueba AES (Exportacion) — datos crudos compactos."""

AES_TITLES = {
    1: "EORI presente → nunca enviar nombre/dirección",
    2: "Exportación directa vs indirecta según oficinas",
    3: "Persona de contacto siempre obligatoria",
    4: "Doble país de ruta cuando el destino es extra-UE",
    5: "Unidades suplementarias exigidas por TARIC",
    6: "Rectificación de una AES ya aceptada",
    7: "Declaración EX tipo A (sin seguridad) vs tipo B (con seguridad)",
    8: "Representación indirecta se deduce, no se declara",
    9: "Definición legal de exportador: quien decide sacar la mercancía, no quien factura",
    10: "Exportador sin EORI: las 5 excepciones documentadas",
    11: "Pre-DUA de exportación caduca a los 30 días sin presentación de mercancía",
    12: "Procedimiento de investigación: 90 días sin salida, 150 días invalida la declaración",
    13: "Exportación indirecta requiere notificación de llegada a la aduana de salida",
    14: "Condiciones de entrega: código de lugar o dirección, nunca ambos",
    15: "Transportista solo si es distinto del declarante, siempre con EORI",
    16: "Expedidor de seguridad distinto del exportador",
    17: "EUR.1 no se puede firmar antes de que la exportación sea efectiva o esté asegurada",
    18: "Documento de levante no se actualiza tras modificar la declaración",
    19: "Deuda aduanera nacida por una exportación — cláusula de no reembolso",
    20: "Máximo 30 precintos y 99 contenedores por declaración",
    21: "Masa bruta sin decimales si es ≥1kg, con hasta 3 decimales si es <1kg",
}


def _c(n, foreign_iso, mode, es_idx, foreign_idx, incoterm, currency, products, **kw):
    base = dict(n=n, id=f"AES-{n:02d}", title=AES_TITLES[n], op='export', mode=mode,
                foreign_iso=foreign_iso, foreign_idx=foreign_idx, es_idx=es_idx,
                incoterm=incoterm, currency=currency, products=products)
    base.update(kw)
    return base


RAW_AES = [
    _c(1, 'US', 'maritime', 0, 0, 'FOB', 'USD', [('olive_oil', 8400, 5.20)],
       buyer_eori='US1234567890123',
       invoice_note="Buyer holds a valid EORI/identification number — company name and address are NOT to be additionally declared per AES rule."),

    _c(2, 'MX', 'maritime', 1, 0, 'CIF', 'USD', [('wine', 6000, 4.80)],
       extra_docs=['insurance_certificate'],
       invoice_note="Direct export declared at the customs office of exit — compare with indirect-export scenario via a different office."),

    _c(3, 'BR', 'maritime', 0, 1, 'FOB', 'USD', [('ceramic_tiles', 9600, 5.60)],
       invoice_note="Contact person for this consignment: Sra. Marta Alonso Ruiz — mandatory field, always required regardless of representation type."),

    _c(4, 'AU', 'maritime', 1, 0, 'CFR', 'USD', [('wool_yarn', 5200, 6.40)],
       transport_over={'final_place': 'Melbourne, Australia (via Singapore transhipment)'},
       invoice_note="Routing countries: goods transit via a third country (Singapore) before reaching the extra-EU destination — dual routing country applies."),

    _c(5, 'ZA', 'maritime', 0, 1, 'FOB', 'ZAR', [('whisky', 4200, 11.50)],
       invoice_note="TARIC heading requires mandatory supplementary unit (litres of pure alcohol)."),

    _c(6, 'TR', 'road', 0, 0, 'EXW', 'EUR', [('ceramic', 6800, 1.75)],
       invoice_note="This invoice supports an AES declaration subsequently RECTIFIED after acceptance by customs (see case notes for amendment detail)."),

    _c(7, 'CA', 'maritime', 1, 0, 'FOB', 'CAD', [('machinery_parts', 70, 520.00)],
       invoice_note="Declaration type EX-A (no security data) — compare against EX-B (with entry summary/security data) for the same commodity."),

    _c(8, 'JP', 'air', 0, 0, 'DAP', 'JPY', [('surgical_instruments', 480, 145.00)],
       invoice_note="Indirect representation applies by deduction from the parties involved — it is NOT separately declared as a data element."),

    _c(9, 'KR', 'maritime', 0, 1, 'FOB', 'USD', [('auto_parts', 2100, 34.00)],
       consignee_iso='DE', consignee_idx=0,
       invoice_note="Legal exporter is the party who decides that the goods leave the EU (contracting principal) — NOT necessarily the party issuing this invoice."),

    _c(10, 'AE', 'air', 1, 0, 'CPT', 'USD', [('perfume', 3600, 9.80)],
       seller_nif=None,
       invoice_note="Exporter without EORI — one of the 5 documented exceptions applies (occasional exporter, private individual shipment)."),

    _c(11, 'SA', 'maritime', 0, 0, 'FOB', 'USD', [('led_lighting', 4800, 8.90)],
       invoice_note="Pre-DUA lodged in advance of goods arrival at the customs office of exit — lapses automatically after 30 days without presentation."),

    _c(12, 'GB', 'road', 1, 0, 'DAP', 'GBP', [('furniture', 180, 165.00)],
       invoice_note="Reference for the AES investigation procedure: no exit confirmation within 90 days triggers inquiry; 150 days invalidates the declaration."),

    _c(13, 'CH', 'road', 0, 0, 'FCA', 'CHF', [('watches', 260, 195.00)],
       consignee_iso='CH', consignee_idx=1,
       invoice_note="Indirect export via another Member State's office of exit — requires arrival notification (IE507/IE521) at the actual office of exit."),

    _c(14, 'NO', 'road', 1, 0, 'DAP', 'EUR', [('frozen_shrimp', 0, 0)],  # overwritten below
       invoice_note="Delivery conditions: EITHER a UN/LOCODE place code OR a free-text address may be declared — never both simultaneously."),

    _c(15, 'CO', 'maritime', 0, 0, 'FOB', 'USD', [('cotton_fabric', 7200, 2.30)],
       transport_over={'carrier_note': 'Carrier distinct from declarant, own EORI required'},
       invoice_note="Carrier is declared only when different from the declarant, and in that case an EORI number is mandatory for the carrier."),

    _c(16, 'PE', 'maritime', 1, 0, 'FOB', 'USD', [('leather_bags', 1400, 26.00)],
       notify_iso='PE', notify_idx=0,
       invoice_note="Security consignor (dispatcher for safety/security data) is a party distinct from the exporter of record."),

    _c(17, 'TN', 'road', 0, 0, 'FOB', 'EUR', [('olive_oil', 5400, 4.60)],
       extra_docs=['eur1'],
       invoice_note="EUR.1 certificate of origin must NOT be endorsed until the export is effective or otherwise assured — see accompanying EUR.1 draft status."),

    _c(18, 'EG', 'maritime', 1, 1, 'FOB', 'USD', [('ceramic_sanitary', 620, 38.00)],
       invoice_note="Reference invoice: release document (levante) is NOT automatically refreshed after this declaration is later amended."),

    _c(19, 'AR', 'maritime', 0, 0, 'FOB', 'USD', [('bicycles', 640, 145.00)],
       invoice_note="Customs debt arising from an export declaration — no-refund clause applies even if goods are not ultimately shipped."),

    _c(20, 'TH', 'maritime', 1, 0, 'FOB', 'USD', [('toys', 28000, 1.15)],
       container_type='40HC',
       containers=[{'no': f"MSCU{4500000+i:07d}", 'type': '40HC', 'seal': f"SL{95000+i}"} for i in range(6)],
       invoice_note="Multi-container shipment — reference for the declaration limit of maximum 30 seals and 99 containers."),

    _c(21, 'PK', 'maritime', 0, 1, 'FOB', 'USD', [('surgical_instruments', 3200, 4.90)],
       invoice_note="Gross mass declared without decimals (≥1kg lines) and with up to 3 decimals for sub-1kg lines — see packing list for exact figures."),
]

# --- correccion caso 14 (Noruega, condiciones de entrega) ---
RAW_AES[13] = _c(14, 'NO', 'road', 1, 0, 'DAP', 'EUR', [('frozen_shrimp', 3800, 7.40)],
                 invoice_note="Delivery conditions: EITHER a UN/LOCODE place code OR a free-text address may be declared — never both simultaneously.")
