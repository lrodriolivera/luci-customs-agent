# -*- coding: utf-8 -*-
"""43 casos de prueba H1 (Importacion) — datos crudos compactos.
Cada tupla se expande con casos_common.expand_case().
"""

H1_TITLES = {
    1: "Declarante = importador → representación directa",
    2: "Representación indirecta sin representante registrado",
    3: "Código adicional vacío no se envía como '000'",
    4: "Unidades suplementarias obligatorias según TARIC",
    5: "Múltiples partidas con régimen y origen distintos",
    6: "Modificar una declaración con MRN ya asignado",
    7: "Régimen 44 (destino final) con documento de control",
    8: "Régimen 95 exige que no se haya pagado IVA ni IIEE",
    9: "Desaparición del régimen 49: unión aduanera vs territorios fiscales especiales",
    10: "Ubicación de la mercancía condiciona si se puede importar",
    11: "No se puede modificar el declarante/representante tras la fase PREDUA con control",
    12: "Preferencia 14 11: primera cifra vs contingente arancelario",
    13: "Garantía obligatoria antes del levante si no se paga la deuda",
    14: "Valor en aduana: cánones y comisiones de venta se suman, comisiones de compra no",
    15: "Declaración simplificada por falta de datos — casilla 1.2 tipo C",
    16: "Declaración simplificada por falta de documentos — códigos 9AR a 9VI",
    17: "Régimen de zona franca no exento de IVA desde 2023",
    18: "Casilla 14 — código de representación entre corchetes antes del nombre",
    19: "Representante de un no establecido en el TAU no puede ser representación directa",
    20: "Canal Verde + Levante concedido no impide un requerimiento posterior",
    21: "Multi-factura dentro de un mismo DUA con un solo conocimiento de embarque",
    22: "Valor en aduana declarado en divisa distinta a EUR (USD) con transporte aéreo",
    23: "Servicio Web AEAT específico para presentar documentos justificativos pendientes TRAS el levante",
    24: "Régimen 82 (salida de depósito distinto del aduanero) con 6 exclusiones simultáneas",
    25: "Mercancía sin valor comercial (valor factura = 0)",
    26: "Importador particular vs empresa",
    27: "Indicador de contenedor según el transporte",
    28: "Modo de transporte: los 4 códigos",
    29: "Tipo de cambio: no se admiten los códigos antiguos 7008/7010",
    30: "Estatus OEA no puede aparecer ni desaparecer en una modificación",
    31: "Dispensa de garantía para operador OEA/AEOC",
    32: "Vinculación automática a zona franca al introducir mercancía",
    33: "Despacho centralizado excluye Canarias, Ceuta, Melilla y tránsito",
    34: "Inscripción en registros del declarante (IRD) no aplicable a régimen 42/63 ni tránsito",
    35: "Reducción de garantía global 30%/50% depende de la modalidad de representación",
    36: "Notificación de la deuda: plazo general 3 años, especial 5-10 años",
    37: "Incoterm DAP con lugar de destino específico debe coincidir con la aduana/ubicación declarada",
    38: "Documento 9018 (GRN) no puede declararse en el mismo lugar según el tipo de declaración",
    39: "Unidades suplementarias opcionales (no obligatorias) específicamente bajo régimen 82",
    40: "Referencia de conocimiento de transporte (BL/AWB) debe validarse contra el documento adjunto",
    41: "Descripción de mercancía muy larga",
    42: "Deudas inferiores a 10€ dispensadas de notificación",
    43: "Exportador extracomunitario sin NIF español vs. importador con NIF/EORI español",
}


def _c(n, foreign_iso, mode, foreign_idx, es_idx, incoterm, currency, products, **kw):
    base = dict(n=n, id=f"H1-{n:02d}", title=H1_TITLES[n], op='import', mode=mode,
                foreign_iso=foreign_iso, foreign_idx=foreign_idx, es_idx=es_idx,
                incoterm=incoterm, currency=currency, products=products)
    base.update(kw)
    return base


RAW_H1 = [
    _c(1, 'CN', 'maritime', 0, 0, 'FOB', 'USD', [('laptop', 480, 385.00)],
       extra_docs=['ce_certificate'],
       invoice_note="Declarant acts as Importer of Record (direct representation)."),

    _c(2, 'VN', 'maritime', 0, 1, 'CIF', 'USD', [('tshirt', 12000, 3.20)],
       extra_docs=['insurance_certificate'],
       invoice_note="NOTE: No customs representative registered with AEAT at time of invoicing — indirect representation pending appointment."),

    _c(3, 'IN', 'maritime', 0, 0, 'FOB', 'USD', [('cotton_fabric', 8500, 2.15)],
       invoice_note="Additional TARIC code: N/A for this heading (no additional code applicable — must be declared as '000', not left blank)."),

    _c(4, 'TR', 'road', 0, 1, 'EXW', 'EUR', [('whisky', 0, 0), ], ),  # placeholder overwritten below

    _c(5, 'US', 'maritime', 0, 2, 'FCA', 'USD', [
        ('machinery_parts', 60, 145.00), ('auto_parts', 320, 22.50), ('hand_tools', 150, 18.90)],
       invoice_note="Shipment contains 3 tariff lines under different customs regimes (40, 42, 51) and different countries of origin (see per-line origin)."),

    _c(6, 'JP', 'air', 0, 0, 'CPT', 'JPY', [('watches', 220, 18500)],
       invoice_note="Reference: this invoice supports a declaration subsequently amended after MRN assignment (see case notes)."),

    _c(7, 'KR', 'maritime', 0, 1, 'DAP', 'EUR', [('solar_panels', 900, 68.00)],
       extra_docs=['import_license'],
       invoice_note="Regime 44 — End-use relief requested; goods subject to end-use control per Reg. (EU) 952/2013 Art. 254."),

    _c(8, 'ZA', 'maritime', 0, 0, 'EXW', 'ZAR', [('copper_wire', 22000, 9.40)],
       invoice_note="Regime 95 declared — VAT and excise NOT yet paid at time of this invoice (condition precedent for regime eligibility)."),

    _c(9, 'MA', 'maritime', 1, 0, 'FOB', 'EUR', [('leather_bags', 2100, 14.50)],
       es_iso='ES-CN',
       invoice_note="Consignee established in the Canary Islands (special fiscal territory — outside EU VAT area, inside customs union)."),

    _c(10, 'BR', 'maritime', 0, 1, 'CIF', 'USD', [('coffee', 19000, 2.85)],
       extra_docs=['sanitary_certificate'],
       invoice_note="Goods placed in temporary storage at bonded warehouse pending location authorization for release."),

    _c(11, 'MX', 'maritime', 0, 0, 'FOB', 'USD', [('ceramic', 9600, 1.35)],
       invoice_note="PREDUA phase reached with control flag active — declarant/representative locked pending customs decision."),

    _c(12, 'EG', 'maritime', 0, 1, 'FOB', 'USD', [('cotton_fabric', 14000, 1.95)],
       extra_docs=['eur1'],
       invoice_note="Preferential order number 14 11 claimed — subject to available tariff quota balance, not first-come-first-served waiver."),

    _c(13, 'TH', 'maritime', 0, 0, 'CIF', 'USD', [('ceramic_tiles', 5200, 6.80)],
       invoice_note="Customs debt not settled at time of clearance — guarantee (CGU) required before release (levante)."),

    _c(14, 'ID', 'maritime', 0, 1, 'FOB', 'USD', [('furniture', 340, 210.00)],
       invoice_note="Sales commission (buying agent fee, 4%) included per Incoterm; buying commission paid separately by Buyer to its own agent is NOT included in this invoice value."),

    _c(15, 'CO', 'maritime', 0, 0, 'FOB', 'USD', [('cocoa', 21000, 3.10)],
       invoice_note="Simplified declaration — box 1.2 type C: certain particulars pending, to be completed in supplementary declaration."),

    _c(16, 'PE', 'maritime', 0, 1, 'FOB', 'USD', [('wool_yarn', 8800, 5.60)],
       invoice_note="Simplified declaration lodged with supporting documents pending (codes 9AR-9VI apply to missing certificates)."),

    _c(17, 'TN', 'maritime', 1, 0, 'FOB', 'EUR', [('olive_oil', 9000, 4.20)],
       es_iso='ES-ZF',
       invoice_note="Goods placed under Free Zone procedure on entry (Barcelona Free Zone) — VAT suspension does NOT apply since 2023 reform."),

    _c(18, 'PK', 'maritime', 0, 0, 'FOB', 'USD', [('cotton_fabric', 11000, 1.80)],
       invoice_note="Box 14 representation code to be declared in brackets before the representative's name, per AEAT format."),

    _c(19, 'BD', 'maritime', 0, 1, 'FOB', 'USD', [('tshirt', 26000, 2.75)],
       consignee_iso='CH', consignee_idx=0,
       invoice_note="Consignee (ultimate importer) is established in Switzerland, OUTSIDE the EU customs territory (TAU) — "
                     "the Spanish customs agent CANNOT act as direct representative for a non-established principal; "
                     "indirect representation is mandatory per CAU Art. 18-19."),

    _c(20, 'CN', 'air', 1, 0, 'FCA', 'USD', [('phone', 3400, 165.00)],
       extra_docs=['ce_certificate'],
       invoice_note="Green channel assigned and release (levante) granted — subsequent AEAT post-clearance requirement remains possible."),

    _c(21, 'VN', 'maritime', 1, 1, 'FOB', 'USD', [('bicycles', 1200, 78.00), ('jeans', 4000, 9.40)],
       invoice_note="Multi-invoice shipment: this is INVOICE 1 of 2 covering a single consolidated Bill of Lading (see companion invoice for line 2)."),

    _c(22, 'JP', 'air', 1, 1, 'DAP', 'USD', [('medical_devices', 640, 96.00)],
       invoice_note="Customs value declared in USD (non-EUR currency) for an air freight shipment — exchange rate per AEAT daily rate table applies."),

    _c(23, 'KR', 'maritime', 1, 0, 'CIF', 'USD', [('led_lighting', 5200, 11.40)],
       extra_docs=['ce_certificate'],
       invoice_note="Supporting documents (test certificates) to be submitted via the dedicated AEAT web service AFTER release (levante) has been granted."),

    _c(24, 'AU', 'maritime', 0, 0, 'FOB', 'AUD', [('wool_yarn', 16000, 7.90)],
       invoice_note="Regime 82 declared (removal from a place other than a customs warehouse) — 6 simultaneous regime exclusions apply per CDU Annex 71-05."),

    _c(25, 'CN', 'air', 2, 0, 'FCA', 'USD', [('toys', 3200, 0.00)],
       invoice_note="COMMERCIAL VALUE: NIL — goods supplied free of charge as warranty replacement units. No commercial value. Statistical value for customs purposes only."),

    _c(26, 'MX', 'maritime', 1, 0, 'DAP', 'USD', [('ceramic_sanitary', 480, 42.00)],
       buyer_name='Sr. Ricardo Fernandez Ortega', buyer_nif='12345678Z',
       invoice_note="Importer is a private individual (NIF, no company/EORI) — not a registered business entity."),

    _c(27, 'TR', 'road', 1, 0, 'EXW', 'EUR', [('ceramic_tiles', 3600, 5.10)],
       invoice_note="Road transport, non-containerized (LTL) — container indicator per box 19 must reflect 'not containerized'."),

    _c(28, 'CH', 'road', 0, 0, 'EXW', 'CHF', [('watches', 340, 210.00)],
       invoice_note="Reference shipment for transport mode coding exercise (box 21/26 — inland transport by road)."),

    _c(29, 'US', 'air', 1, 0, 'CPT', 'USD', [('medical_devices', 210, 340.00)],
       invoice_note="Exchange rate applicable: current AEAT daily rate — legacy codes 7008/7010 are not accepted for this declaration."),

    _c(30, 'CA', 'maritime', 0, 0, 'FOB', 'CAD', [('machinery_parts', 90, 410.00)],
       buyer_idx=2,
       invoice_note="Importer holds AEOC (Authorised Economic Operator — Customs Simplifications) status, referenced for this declaration."),

    _c(31, 'CA', 'maritime', 1, 3, 'FOB', 'CAD', [('aluminium_profiles', 24000, 3.85)],
       invoice_note="Importer holds AEOC status — guarantee waiver requested per CAU Art. 95(2)."),

    _c(32, 'AE', 'maritime', 0, 0, 'FOB', 'USD', [('perfume', 5400, 6.20)],
       es_iso='ES-ZF',
       invoice_note="Goods to be placed under Free Zone arrangement immediately upon entry (automatic linkage on introduction)."),

    _c(33, 'MA', 'maritime', 0, 1, 'FOB', 'EUR', [('ceramic', 7200, 1.60)],
       es_iso='ES-CE',
       invoice_note="Consignee established in Ceuta — centralised clearance procedure is excluded for this destination."),

    _c(34, 'IN', 'maritime', 1, 0, 'FCA', 'USD', [('cotton_fabric', 9800, 2.05)],
       invoice_note="Regime 42 declared (release for free circulation with subsequent intra-EU supply) — declarant registration (IRD) not applicable."),

    _c(35, 'BR', 'maritime', 1, 1, 'FOB', 'USD', [('frozen_shrimp', 14000, 6.90)],
       extra_docs=['veterinary_certificate'],
       invoice_note="Indirect representation by customs agent — comprehensive guarantee reduction (30%) applies per representation modality."),

    _c(36, 'ZA', 'maritime', 1, 1, 'FOB', 'ZAR', [('fresh_avocado', 18000, 1.10)],
       extra_docs=['phytosanitary_certificate'],
       invoice_note="Reference invoice for post-clearance debt notification timing (general 3-year limitation period)."),

    _c(37, 'TH', 'maritime', 1, 1, 'DAP', 'USD', [('furniture', 260, 195.00)],
       invoice_over={},
       invoice_note="Incoterm DAP — named place of destination: Poligono Industrial Fuente del Jarro, Paterna (Valencia) — must match declared customs location."),

    _c(38, 'ID', 'maritime', 1, 0, 'FOB', 'USD', [('rice', 42000, 0.95)],
       invoice_note="Document code 9018 (Guarantee Reference Number) referenced — location of declaration restricted by declaration type."),

    _c(39, 'PK', 'maritime', 1, 1, 'FOB', 'USD', [('cotton_fabric', 15500, 1.75)],
       invoice_note="Regime 82 declared — supplementary units are OPTIONAL (not mandatory) specifically under this regime."),

    _c(40, 'JP', 'maritime', 2, 0, 'FOB', 'JPY', [('auto_parts', 480, 3800)],
       invoice_note="Transport document reference (Bill of Lading number) must match exactly the attached transport document — see B/L."),

    _c(41, 'CN', 'maritime', 3, 1, 'FOB', 'USD', [
        ('machinery_parts', 40, 890.00,
         "Precision CNC vertical machining center spare parts kit comprising ball-screw assemblies, linear "
         "motion guideways, spindle taper bearings (ISO 7:1 taper), servo-motor couplings, coolant nozzles and "
         "electrical cabinet connectors, supplied as a complete maintenance overhaul set for model VMC-850 "
         "machining centers, packed in individually labelled anti-corrosion wrapping within a single reinforced "
         "wooden crate conforming to ISPM-15 phytosanitary treatment for wood packaging material")],
       invoice_note="LONG DESCRIPTION TEST: single tariff line with an unusually long, fully-detailed goods description (see line 1)."),

    _c(42, 'EG', 'maritime', 1, 0, 'FOB', 'USD', [('cotton_fabric', 600, 1.20)],
       invoice_note="Low customs debt shipment — reference for debt-notification dispensation threshold (< EUR 10)."),

    _c(43, 'AR', 'maritime', 0, 2, 'FOB', 'USD', [('leather_bags', 1800, 22.00)],
       seller_nif=None,
       invoice_note="Seller (extra-Community exporter) has no Spanish tax ID; Buyer (importer) holds Spanish NIF and EORI number ES."),
]

# --- correccion caso 4 (unidades suplementarias): producto real con unidad suplementaria ---
RAW_H1[3] = _c(4, 'TR', 'road', 0, 1, 'EXW', 'EUR', [('whisky', 3600, 8.40)],
               invoice_note="Product subheading requires mandatory supplementary unit (litres of pure alcohol) per TARIC — see quantity in 'l alc. 100%'.")
