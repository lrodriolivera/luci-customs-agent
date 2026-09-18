# -*- coding: utf-8 -*-
"""
Motor de generacion de PDFs realistas para los documentos de un expediente
aduanero: factura comercial, packing list, BL/AWB/CMR, certificado de origen,
EUR.1, seguro, certificados sanitarios/fitosanitarios/CE, licencia de
exportacion.
"""
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle, Paragraph,
                                 Spacer, HRFlowable)
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

styles = getSampleStyleSheet()
H1 = ParagraphStyle('H1c', parent=styles['Heading1'], fontSize=15, spaceAfter=2, textColor=colors.HexColor('#1c2320'))
H2 = ParagraphStyle('H2c', parent=styles['Heading2'], fontSize=10.5, spaceAfter=2, textColor=colors.HexColor('#0b5d4a'))
SMALL = ParagraphStyle('small', parent=styles['Normal'], fontSize=8.3, leading=11)
SMALL_R = ParagraphStyle('smallR', parent=SMALL, alignment=TA_RIGHT)
SMALL_C = ParagraphStyle('smallC', parent=SMALL, alignment=TA_CENTER)
NORMAL = ParagraphStyle('normal9', parent=styles['Normal'], fontSize=9, leading=12)
BOLD9 = ParagraphStyle('bold9', parent=NORMAL, fontName='Helvetica-Bold')
FOOTER = ParagraphStyle('footer', parent=styles['Normal'], fontSize=7, textColor=colors.grey)

ACCENT = colors.HexColor('#0b5d4a')
LINE = colors.HexColor('#c7c2b3')
BGHEAD = colors.HexColor('#eef0ec')


def _truncate(text, limit):
    """Corta un texto por la ultima palabra completa antes del limite (nunca a media palabra)."""
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(' ', 1)[0]
    return cut.rstrip(',;.') + '…'


def _doc(path):
    return SimpleDocTemplate(path, pagesize=A4,
                              leftMargin=16 * mm, rightMargin=16 * mm,
                              topMargin=14 * mm, bottomMargin=14 * mm)


def _party_block(title, party):
    lines = [f"<b>{title}</b>", party.get('name', '')]
    if party.get('address'):
        lines.append(party['address'])
    city_line = ', '.join([p for p in [party.get('postal', ''), party.get('city', '')] if p])
    if city_line:
        lines.append(city_line)
    if party.get('country_name'):
        lines.append(party['country_name'].upper())
    for k, label in (('tax_id', 'Tax ID/NIF'), ('vat', 'VAT'), ('eori', 'EORI'), ('phone', 'Tel.')):
        if party.get(k):
            lines.append(f"{label}: {party[k]}")
    return Paragraph('<br/>'.join(lines), SMALL)


def _header(title_left, doc_no_label, doc_no, date_label, date_val, extra_right=None):
    left = Paragraph(f"<font size=13.5 color='#0b5d4a'><b>{title_left}</b></font>", NORMAL)
    right_lines = [f"<b>{doc_no_label}:</b> {doc_no}", f"<b>{date_label}:</b> {date_val}"]
    if extra_right:
        right_lines.extend(extra_right)
    right = Paragraph('<br/>'.join(right_lines), SMALL_R)
    t = Table([[left, right]], colWidths=[95 * mm, 79 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    return t


def _footer_note(text):
    return Paragraph(text, FOOTER)


# ---------------------------------------------------------------------------
# FACTURA COMERCIAL
# ---------------------------------------------------------------------------
def commercial_invoice(path, case):
    doc = _doc(path)
    el = []
    el.append(_header('COMMERCIAL INVOICE / FACTURA COMERCIAL',
                       'Invoice No.', case['invoice_no'], 'Date', case['invoice_date'],
                       extra_right=[f"<b>Incoterm:</b> {case['incoterm']} {case.get('incoterm_place', '')}",
                                    f"<b>Currency:</b> {case['currency']}"]))
    el.append(Spacer(1, 4 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 3 * mm))

    parties = [[_party_block('SELLER / EXPORTADOR', case['seller']),
                _party_block('BUYER / IMPORTADOR', case['buyer'])]]
    if case.get('consignee') and case['consignee'] is not case['buyer']:
        parties[0].append(_party_block('CONSIGNEE', case['consignee']))
        pt = Table(parties, colWidths=[58 * mm] * 3)
    else:
        pt = Table(parties, colWidths=[87 * mm] * 2)
    pt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                            ('BOX', (0, 0), (-1, -1), 0.4, LINE),
                            ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE),
                            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#faf9f5')),
                            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6)]))
    el.append(pt)
    el.append(Spacer(1, 5 * mm))

    # transporte / condiciones
    tinfo = case.get('transport', {})
    cond_lines = [
        f"<b>Country of origin:</b> {case['origin_country_name']}",
        f"<b>Country of destination:</b> {case.get('dest_country_name', 'Spain')}",
        f"<b>Transport mode:</b> {case['transport_mode_label']}",
        f"<b>Carrier:</b> {tinfo.get('carrier', '-')}",
    ]
    el.append(Paragraph('  |  '.join(cond_lines), SMALL))
    el.append(Spacer(1, 4 * mm))

    # tabla de partidas
    head = ['#', 'Description of goods / HS Code', 'Qty', 'Unit', 'Unit price', 'Amount']
    rows = [head]
    total = 0.0
    for i, g in enumerate(case['goods'], 1):
        amount = g['qty'] * g['unit_price']
        total += amount
        if case.get('hide_hs_confidence'):
            hs_line = f"Supplier's suggested HS code: {g['hs']}.xx.xx (unverified — subject to customs classification review)"
        else:
            hs_line = f"HS/TARIC ref.: {g['hs']}.xx.xx"
        desc = f"{g['desc']}<br/><font size=7 color='#5e6c66'>{hs_line} &nbsp; | &nbsp; Origin: {case['origin_country_name']}</font>"
        rows.append([str(i), Paragraph(desc, SMALL), f"{g['qty']:,.0f}".replace(',', '.'),
                     g['unit'], f"{g['unit_price']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                     f"{amount:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')])
    rows.append(['', '', '', '', 'TOTAL ' + case['currency'], f"{total:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')])

    tbl = Table(rows, colWidths=[8 * mm, 82 * mm, 16 * mm, 16 * mm, 26 * mm, 26 * mm])
    tstyle = [
        ('BACKGROUND', (0, 0), (-1, 0), BGHEAD),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.3),
        ('GRID', (0, 0), (-1, -2), 0.35, LINE),
        ('LINEABOVE', (0, -1), (-1, -1), 0.8, ACCENT),
        ('FONTNAME', (4, -1), (5, -1), 'Helvetica-Bold'),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]
    tbl.setStyle(TableStyle(tstyle))
    el.append(tbl)
    el.append(Spacer(1, 5 * mm))

    if case.get('invoice_extra_note'):
        el.append(Paragraph(case['invoice_extra_note'], SMALL))
        el.append(Spacer(1, 3 * mm))

    el.append(Paragraph(
        f"We hereby certify that the goods described above originate from <b>{case['origin_country_name']}</b> "
        f"and that this invoice is true and correct, showing the actual price of the goods described.",
        SMALL))
    el.append(Spacer(1, 10 * mm))
    el.append(Paragraph(f"For and on behalf of<br/><b>{case['seller']['name']}</b>", SMALL))
    el.append(Spacer(1, 8 * mm))
    el.append(Paragraph('_________________________<br/>Authorized signature', SMALL))
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))

    doc.build(el)


# ---------------------------------------------------------------------------
# PACKING LIST
# ---------------------------------------------------------------------------
def packing_list(path, case):
    doc = _doc(path)
    el = []
    el.append(_header('PACKING LIST / LISTA DE BULTOS',
                       'Invoice No.', case['invoice_no'], 'Date', case['invoice_date']))
    el.append(Spacer(1, 4 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 3 * mm))

    parties = [[_party_block('SHIPPER', case['seller']), _party_block('CONSIGNEE', case.get('consignee') or case['buyer'])]]
    pt = Table(parties, colWidths=[87 * mm] * 2)
    pt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.4, LINE),
                            ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE), ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#faf9f5')),
                            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6)]))
    el.append(pt)
    el.append(Spacer(1, 5 * mm))

    head = ['Pkg No.', 'Package type', 'Description', 'Qty', 'Net wt. (kg)', 'Gross wt. (kg)']
    rows = [head]
    total_net = total_gross = 0.0
    total_pkg = 0
    for i, g in enumerate(case['goods'], 1):
        net = g['qty'] * g['kg_unit']
        gross = net * 1.07
        total_net += net
        total_gross += gross
        pkgs = g.get('packages', max(1, round(g['qty'] / 40)))
        total_pkg += pkgs
        rows.append([f"{i}", g.get('pack_type', 'CTN'), Paragraph(_truncate(g['desc'], 70), SMALL),
                     f"{g['qty']:,.0f}".replace(',', '.'),
                     f"{net:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                     f"{gross:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')])
    rows.append(['TOTAL', f"{total_pkg} pkgs", '', '', f"{total_net:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                 f"{total_gross:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')])

    tbl = Table(rows, colWidths=[16 * mm, 20 * mm, 66 * mm, 18 * mm, 24 * mm, 30 * mm])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BGHEAD), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.3), ('GRID', (0, 0), (-1, -2), 0.35, LINE),
        ('LINEABOVE', (0, -1), (-1, -1), 0.8, ACCENT), ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('ALIGN', (3, 0), (-1, -1), 'RIGHT'), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    el.append(tbl)
    el.append(Spacer(1, 4 * mm))
    marks = case.get('shipping_marks') or f"{case['buyer']['name'][:20].upper()} / {case['invoice_no']} / MADE IN {case['origin_country_name'].upper()}"
    el.append(Paragraph(f"<b>Shipping marks & numbers:</b> {marks}", SMALL))
    el.append(Spacer(1, 2 * mm))
    if case.get('transport', {}).get('containers'):
        cstr = '; '.join([f"{c['no']} ({c['type']}, precinto {c['seal']})" for c in case['transport']['containers']])
        el.append(Paragraph(f"<b>Container(s):</b> {cstr}", SMALL))
    el.append(Spacer(1, 8 * mm))
    el.append(Paragraph('_________________________<br/>Shipper signature', SMALL))
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)


# ---------------------------------------------------------------------------
# BILL OF LADING (maritimo)
# ---------------------------------------------------------------------------
def bill_of_lading(path, case):
    doc = _doc(path)
    t = case['transport']
    el = []
    el.append(Paragraph(f"<font size=14 color='#0b5d4a'><b>{t.get('carrier', 'OCEAN CARRIER')}</b></font>", NORMAL))
    el.append(Paragraph("<b>BILL OF LADING</b> — Negotiable, subject to Hague-Visby Rules", H2))
    el.append(Spacer(1, 3 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 3 * mm))

    top = [[_party_block('SHIPPER', case['seller']), _party_block('CONSIGNEE', case.get('consignee') or case['buyer'])]]
    tt = Table(top, colWidths=[87 * mm] * 2)
    tt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.4, LINE),
                            ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE),
                            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6)]))
    el.append(tt)
    el.append(Spacer(1, 3 * mm))
    notif = case.get('notify_party') or case.get('consignee') or case['buyer']
    el.append(_party_block('NOTIFY PARTY', notif))
    el.append(Spacer(1, 4 * mm))

    info = [
        ['B/L No.', t['doc_no'], 'Vessel / Voyage', t.get('vessel', '-')],
        ['Port of Loading', t.get('pol', '-'), 'Port of Discharge', t.get('pod', '-')],
        ['Place of Receipt', t.get('pol', '-'), 'Place of Delivery', t.get('final_place', 'ALGECIRAS, SPAIN')],
        ['On Board Date', t.get('etd', '-'), 'Freight', case['incoterm']],
    ]
    it = Table(info, colWidths=[32 * mm, 55 * mm, 32 * mm, 55 * mm])
    it.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 8.3), ('GRID', (0, 0), (-1, -1), 0.35, LINE),
                            ('BACKGROUND', (0, 0), (0, -1), BGHEAD), ('BACKGROUND', (2, 0), (2, -1), BGHEAD),
                            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'), ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
                            ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    el.append(it)
    el.append(Spacer(1, 4 * mm))

    head = ['Container No. / Seal', 'Marks & Nos.', 'Description of goods', 'Gross wt. (kg)', 'Meas. (m3)']
    rows = [head]
    containers = t.get('containers', [{'no': '-', 'type': '-', 'seal': '-'}])
    total_gross = sum(g['qty'] * g['kg_unit'] * 1.07 for g in case['goods'])
    goods_desc = '; '.join([_truncate(g['desc'], 50) for g in case['goods'][:3]])
    for c in containers:
        rows.append([Paragraph(f"{c['no']}<br/>{c['type']} / Seal {c['seal']}", SMALL), Paragraph(case.get('shipping_marks') or case['invoice_no'], SMALL),
                     Paragraph(goods_desc, SMALL), f"{total_gross / len(containers):,.1f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                     f"{(total_gross / len(containers)) / 250:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')])
    tbl = Table(rows, colWidths=[32 * mm, 22 * mm, 62 * mm, 26 * mm, 32 * mm])
    tbl.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), BGHEAD), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                             ('FONTSIZE', (0, 0), (-1, -1), 8), ('GRID', (0, 0), (-1, -1), 0.35, LINE),
                             ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    el.append(tbl)
    el.append(Spacer(1, 4 * mm))
    el.append(Paragraph(f"<b>Freight & charges:</b> {case['incoterm']} — {'PREPAID' if case['incoterm'] in ('CIF', 'CIP', 'DAP', 'DDP', 'CFR') else 'COLLECT'}", SMALL))
    el.append(Spacer(1, 8 * mm))
    el.append(Paragraph(f"SHIPPED on board in apparent good order and condition.<br/>Number of original B/L: THREE (3)<br/><br/>"
                         f"For {t.get('carrier', 'the Carrier')}<br/><br/>_________________________<br/>As Agents for the Carrier", SMALL))
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)


# ---------------------------------------------------------------------------
# AIR WAYBILL
# ---------------------------------------------------------------------------
def air_waybill(path, case):
    doc = _doc(path)
    t = case['transport']
    el = []
    el.append(Paragraph(f"<font size=14 color='#0b5d4a'><b>{t.get('carrier', 'AIR CARGO CARRIER')}</b></font>", NORMAL))
    el.append(Paragraph("<b>AIR WAYBILL</b> — Not Negotiable — issued subject to conditions of contract", H2))
    el.append(Spacer(1, 3 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 3 * mm))

    top = [[_party_block('SHIPPER', case['seller']), _party_block('CONSIGNEE', case.get('consignee') or case['buyer'])]]
    tt = Table(top, colWidths=[87 * mm] * 2)
    tt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.4, LINE),
                            ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE),
                            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6)]))
    el.append(tt)
    el.append(Spacer(1, 4 * mm))

    total_customs_value = f"{sum(g['qty'] * g['unit_price'] for g in case['goods']):,.2f} {case['currency']}".replace(',', 'X').replace('.', ',').replace('X', '.')
    lbl_bold = ParagraphStyle('lblB', parent=SMALL, fontName='Helvetica-Bold')
    info = [
        ['AWB No.', t['doc_no'], 'Flight No. / Date', t.get('vessel', '-')],
        ['Airport of Departure', t.get('pol', '-'), 'Airport of Destination', t.get('pod', 'MADRID-BARAJAS (MAD)')],
        [Paragraph('Declared value<br/>for carriage', lbl_bold), 'NVD', Paragraph('Declared value<br/>for customs', lbl_bold), total_customs_value],
    ]
    it = Table(info, colWidths=[34 * mm, 53 * mm, 34 * mm, 53 * mm])
    it.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 8.3), ('GRID', (0, 0), (-1, -1), 0.35, LINE),
                            ('BACKGROUND', (0, 0), (0, -1), BGHEAD), ('BACKGROUND', (2, 0), (2, -1), BGHEAD),
                            ('FONTNAME', (0, 0), (0, 1), 'Helvetica-Bold'), ('FONTNAME', (2, 0), (2, 1), 'Helvetica-Bold'),
                            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                            ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    el.append(it)
    el.append(Spacer(1, 4 * mm))

    head = ['No. of pieces', 'Gross weight (kg)', 'Chargeable weight', 'Nature and quantity of goods']
    total_gross = sum(g['qty'] * g['kg_unit'] * 1.07 for g in case['goods'])
    total_pkgs = sum(g.get('packages', max(1, round(g['qty'] / 40))) for g in case['goods'])
    goods_desc = '; '.join([_truncate(g['desc'], 60) for g in case['goods'][:3]])
    rows = [head, [str(total_pkgs), f"{total_gross:,.1f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                   f"{total_gross:,.1f} kg".replace(',', 'X').replace('.', ',').replace('X', '.'), Paragraph(goods_desc, SMALL)]]
    tbl = Table(rows, colWidths=[24 * mm, 30 * mm, 32 * mm, 88 * mm])
    tbl.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), BGHEAD), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                             ('FONTSIZE', (0, 0), (-1, -1), 8.3), ('GRID', (0, 0), (-1, -1), 0.35, LINE),
                             ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    el.append(tbl)
    el.append(Spacer(1, 10 * mm))
    el.append(Paragraph(f"Issued by: {t.get('carrier', '-')}<br/><br/>_________________________<br/>Signature of shipper or his agent", SMALL))
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)


# ---------------------------------------------------------------------------
# CMR (transporte por carretera)
# ---------------------------------------------------------------------------
def cmr(path, case):
    doc = _doc(path)
    t = case['transport']
    el = []
    el.append(Paragraph("<b>CARTA DE PORTE INTERNACIONAL POR CARRETERA (CMR)</b>", H1))
    el.append(Paragraph("Convenio relativo al Contrato de Transporte Internacional de Mercancias por Carretera (CMR, Ginebra 1956)", SMALL))
    el.append(Spacer(1, 3 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 3 * mm))

    top = [[_party_block('1. EXPEDIDOR / SENDER', case['seller']), _party_block('2. DESTINATARIO / CONSIGNEE', case.get('consignee') or case['buyer'])]]
    tt = Table(top, colWidths=[87 * mm] * 2)
    tt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.4, LINE),
                            ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE),
                            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6)]))
    el.append(tt)
    el.append(Spacer(1, 3 * mm))
    el.append(Paragraph(f"<b>3. TRANSPORTISTA / CARRIER:</b> {t.get('carrier', '-')}", SMALL))
    el.append(Spacer(1, 2 * mm))
    info = [
        ['CMR No.', t['doc_no'], 'Vehiculo / Matricula', t.get('vehicle_plate', '-')],
        ['Lugar de carga', t.get('pol', '-'), 'Lugar de entrega', t.get('final_place', 'MADRID, ESPANA')],
        ['Fecha de carga', t.get('etd', '-'), 'Frontera de paso', t.get('border_crossing', '-')],
    ]
    it = Table(info, colWidths=[32 * mm, 55 * mm, 32 * mm, 55 * mm])
    it.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 8.3), ('GRID', (0, 0), (-1, -1), 0.35, LINE),
                            ('BACKGROUND', (0, 0), (0, -1), BGHEAD), ('BACKGROUND', (2, 0), (2, -1), BGHEAD),
                            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'), ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
                            ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    el.append(it)
    el.append(Spacer(1, 4 * mm))

    head = ['Marcas y Nos.', 'Bultos', 'Naturaleza de la mercancia', 'Peso bruto (kg)']
    total_gross = sum(g['qty'] * g['kg_unit'] * 1.07 for g in case['goods'])
    total_pkgs = sum(g.get('packages', max(1, round(g['qty'] / 40))) for g in case['goods'])
    goods_desc = '; '.join([_truncate(g['desc'], 60) for g in case['goods'][:3]])
    rows = [head, [case.get('shipping_marks') or case['invoice_no'], str(total_pkgs), Paragraph(goods_desc, SMALL),
                   f"{total_gross:,.1f}".replace(',', 'X').replace('.', ',').replace('X', '.')]]
    tbl = Table(rows, colWidths=[36 * mm, 18 * mm, 88 * mm, 32 * mm])
    tbl.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), BGHEAD), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                             ('FONTSIZE', (0, 0), (-1, -1), 8.3), ('GRID', (0, 0), (-1, -1), 0.35, LINE),
                             ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    el.append(tbl)
    el.append(Spacer(1, 10 * mm))
    firmas = [['9. Firma del expedidor', '16. Firma del transportista', '24. Firma del destinatario'],
              ['', '', ''], ['_________________', '_________________', '_________________']]
    ft = Table(firmas, colWidths=[58 * mm] * 3)
    ft.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 8), ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                            ('TOPPADDING', (0, 1), (-1, 1), 10)]))
    el.append(ft)
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)


# ---------------------------------------------------------------------------
# CERTIFICADO DE ORIGEN (no preferencial)
# ---------------------------------------------------------------------------
def certificate_origin(path, case):
    doc = _doc(path)
    el = []
    el.append(Paragraph("<b>CERTIFICATE OF ORIGIN</b>", H1))
    el.append(Paragraph(f"Issued by the Chamber of Commerce of {case['origin_country_name']}", SMALL))
    el.append(Spacer(1, 3 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 4 * mm))
    top = [[_party_block('1. Exporter', case['seller']), _party_block('2. Consignee', case.get('consignee') or case['buyer'])]]
    tt = Table(top, colWidths=[87 * mm] * 2)
    tt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.4, LINE),
                            ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE),
                            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6)]))
    el.append(tt)
    el.append(Spacer(1, 4 * mm))
    el.append(Paragraph(f"<b>3. Means of transport:</b> {case['transport_mode_label']} — {case['transport'].get('carrier', '-')}", SMALL))
    el.append(Paragraph(f"<b>4. Country of origin:</b> {case['origin_country_name'].upper()}", SMALL))
    el.append(Spacer(1, 4 * mm))

    head = ['Marks/Nos.', 'No. & kind of packages; description of goods', 'Quantity']
    rows = [head]
    for g in case['goods']:
        rows.append([(case.get('shipping_marks') or '-')[:18], Paragraph(g['desc'], SMALL), f"{g['qty']:,.0f} {g['unit']}".replace(',', '.')])
    tbl = Table(rows, colWidths=[30 * mm, 116 * mm, 28 * mm])
    tbl.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), BGHEAD), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                             ('FONTSIZE', (0, 0), (-1, -1), 8.3), ('GRID', (0, 0), (-1, -1), 0.35, LINE),
                             ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    el.append(tbl)
    el.append(Spacer(1, 4 * mm))
    el.append(Paragraph(f"<b>Invoice No.:</b> {case['invoice_no']} &nbsp;&nbsp; <b>Date:</b> {case['invoice_date']}", SMALL))
    el.append(Spacer(1, 10 * mm))
    el.append(Paragraph("The undersigned authority certifies that the goods described above originate in the country "
                        f"shown in box 4, in accordance with the rules of origin in force in {case['origin_country_name']}.", SMALL))
    el.append(Spacer(1, 10 * mm))
    el.append(Paragraph(f"Place and date of issue: {case.get('origin_city', '')}, {case['invoice_date']}<br/><br/>"
                         "_________________________<br/>Authorized signature and stamp<br/>Chamber of Commerce", SMALL))
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)


# ---------------------------------------------------------------------------
# EUR.1 (certificado de origen preferencial)
# ---------------------------------------------------------------------------
def eur1(path, case):
    doc = _doc(path)
    el = []
    el.append(Paragraph("<b>CERTIFICADO DE CIRCULACION EUR.1</b>", H1))
    el.append(Paragraph("Certificado de origen a efectos de la aplicacion de preferencias arancelarias", SMALL))
    el.append(Spacer(1, 3 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 4 * mm))
    top = [[_party_block('1. Exportador', case['seller']), _party_block('2. Certificado utilizado en el comercio preferencial entre', case['buyer'])]]
    tt = Table(top, colWidths=[87 * mm] * 2)
    tt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.4, LINE),
                            ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE),
                            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6)]))
    el.append(tt)
    el.append(Spacer(1, 3 * mm))
    el.append(Paragraph(f"<b>3. Destinatario</b> (mencion facultativa): {case['buyer']['name']}", SMALL))
    origin_eu_tag = " (UNION EUROPEA)" if case['op'] == 'export' else ""
    dest_eu_tag = " (UNION EUROPEA)" if case['op'] == 'import' else ""
    el.append(Paragraph(f"<b>4. Pais, grupo de paises o territorio del que se consideran originarios los productos:</b> {case['origin_country_name'].upper()}{origin_eu_tag}", SMALL))
    el.append(Paragraph(f"<b>5. Pais, grupo de paises o territorio de destino:</b> {case.get('dest_country_name', 'ESPANA').upper()}{dest_eu_tag}", SMALL))
    el.append(Paragraph(f"<b>6. Datos relativos al transporte</b> (mencion facultativa): {case['transport_mode_label']}, {case['transport'].get('doc_no', '-')}", SMALL))
    el.append(Spacer(1, 3 * mm))
    head = ['No. de orden', 'Marcas y numeros; bultos; designacion de las mercancias', 'Masa bruta (kg)']
    rows = [head]
    for i, g in enumerate(case['goods'], 1):
        net = g['qty'] * g['kg_unit'] * 1.07
        rows.append([str(i), Paragraph(g['desc'], SMALL), f"{net:,.1f}".replace(',', 'X').replace('.', ',').replace('X', '.')])
    tbl = Table(rows, colWidths=[22 * mm, 124 * mm, 28 * mm])
    tbl.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), BGHEAD), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                             ('FONTSIZE', (0, 0), (-1, -1), 8.3), ('GRID', (0, 0), (-1, -1), 0.35, LINE),
                             ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    el.append(tbl)
    el.append(Spacer(1, 4 * mm))
    el.append(Paragraph(f"<b>9. Factura No.:</b> {case['invoice_no']} de {case['invoice_date']}", SMALL))
    el.append(Spacer(1, 8 * mm))
    el.append(Paragraph("<b>11. VISADO DE LA ADUANA</b><br/>Declaracion certificada<br/>Documento de exportacion<br/>"
                         f"Aduana de: {case.get('origin_city', '-')}<br/>Pais: {case['origin_country_name']}<br/><br/>"
                         "_________________________<br/>Sello y firma", SMALL))
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)


# ---------------------------------------------------------------------------
# CERTIFICADO DE SEGURO
# ---------------------------------------------------------------------------
def insurance_certificate(path, case):
    doc = _doc(path)
    el = []
    total = sum(g['qty'] * g['unit_price'] for g in case['goods'])
    insured = round(total * 1.10, 2)
    el.append(Paragraph("<b>CERTIFICATE OF MARINE / CARGO INSURANCE</b>", H1))
    el.append(Spacer(1, 3 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 4 * mm))
    el.append(Paragraph(f"<b>Policy No.:</b> POL-{case['invoice_no']}-INS &nbsp;&nbsp; <b>Date of issue:</b> {case['invoice_date']}", SMALL))
    el.append(Spacer(1, 3 * mm))
    el.append(_party_block('Insured / Assured', case['buyer'] if case['incoterm'] in ('EXW', 'FCA', 'FOB', 'CFR', 'FAS') else case['seller']))
    el.append(Spacer(1, 3 * mm))
    el.append(Paragraph(f"<b>Insurer:</b> Mediterranean Marine Insurance Underwriters S.A. (policy issued under Institute Cargo Clauses (A))", SMALL))
    el.append(Spacer(1, 3 * mm))
    goods_desc = '; '.join([_truncate(g['desc'], 60) for g in case['goods'][:3]])
    el.append(Paragraph(f"<b>Interest insured:</b> {goods_desc}", SMALL))
    el.append(Paragraph(f"<b>Voyage/Transit:</b> from {case['origin_city']} ({case['origin_country_name']}) to "
                        f"{case['transport'].get('final_place', 'destino final en Espana')}, via {case['transport_mode_label'].lower()}", SMALL))
    el.append(Paragraph(f"<b>Conveyance:</b> {case['transport'].get('carrier', '-')} / {case['transport'].get('doc_no', '-')}", SMALL))
    el.append(Spacer(1, 3 * mm))
    el.append(Paragraph(f"<b>Amount insured:</b> {insured:,.2f} {case['currency']} (invoice value + 10%)".replace(',', 'X').replace('.', ',').replace('X', '.'), SMALL))
    el.append(Spacer(1, 8 * mm))
    el.append(Paragraph("This Certificate represents and takes the place of the Policy and conveys all rights of the "
                        "original Policy holder for the purpose of collecting any loss or claim.", SMALL))
    el.append(Spacer(1, 8 * mm))
    el.append(Paragraph("_________________________<br/>Authorized signatory, for and on behalf of the Insurer", SMALL))
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)


# ---------------------------------------------------------------------------
# CERTIFICADO GENERICO (sanitario / fitosanitario / veterinario / fumigacion / CE)
# ---------------------------------------------------------------------------
_GENERIC_CERT_TITLES = {
    'sanitary_certificate': ('CERTIFICADO SANITARIO', 'Health Certificate for foodstuffs of non-animal origin'),
    'phytosanitary_certificate': ('CERTIFICADO FITOSANITARIO', 'Phytosanitary Certificate — International Plant Protection Convention (IPPC)'),
    'veterinary_certificate': ('CERTIFICADO VETERINARIO', 'Veterinary Health Certificate for products of animal origin'),
    'fumigation_certificate': ('CERTIFICADO DE FUMIGACION (NIMF-15)', 'Fumigation / Wood Packaging Treatment Certificate — ISPM-15'),
    'ce_certificate': ('DECLARACION DE CONFORMIDAD CE', 'EC Declaration of Conformity'),
    'quality_certificate': ('CERTIFICADO DE CALIDAD', 'Certificate of Quality / Inspection'),
    'import_license': ('LICENCIA DE IMPORTACION', 'Import License / Authorization'),
    'export_license': ('LICENCIA DE EXPORTACION', 'Export License / Authorization'),
    'ched_pp': ('CHED-PP — DOCUMENTO SANITARIO COMUN DE ENTRADA (VEGETALES)', 'Common Health Entry Document for Plants and Plant Products'),
    'ched_p': ('CHED-P — DOCUMENTO SANITARIO COMUN DE ENTRADA (PRODUCTOS ANIMALES)', 'Common Health Entry Document for Products of Animal Origin'),
    'ched_d': ('CHED-D — DOCUMENTO SANITARIO COMUN DE ENTRADA (PIENSOS Y ALIMENTOS)', 'Common Health Entry Document for Feed and Food of Non-Animal Origin'),
    'catch_certificate': ('CERTIFICADO DE CAPTURA', 'Catch Certificate — Reg. (EC) 1005/2008 (IUU Regulation)'),
    'analysis_certificate': ('CERTIFICADO DE ANALISIS DE LABORATORIO', 'Certificate of Analysis (CoA)'),
    'gdp_certificate': ('CERTIFICADO DE BUENAS PRACTICAS DE DISTRIBUCION (GDP)', 'Good Distribution Practice Certificate — cold chain transport'),
}


def generic_certificate(path, case, cert_type):
    title_es, title_en = _GENERIC_CERT_TITLES.get(cert_type, ('CERTIFICADO', 'Certificate'))
    doc = _doc(path)
    el = []
    el.append(Paragraph(f"<b>{title_es}</b>", H1))
    el.append(Paragraph(title_en, SMALL))
    el.append(Spacer(1, 3 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 4 * mm))
    cert_no = f"{cert_type[:3].upper()}-{case['id']}-{case['invoice_no'].split('-')[-1]}"
    el.append(Paragraph(f"<b>Certificate No.:</b> {cert_no} &nbsp;&nbsp; <b>Date of issue:</b> {case['invoice_date']}", SMALL))
    el.append(Spacer(1, 3 * mm))
    top = [[_party_block('Consignor', case['seller']), _party_block('Consignee', case.get('consignee') or case['buyer'])]]
    tt = Table(top, colWidths=[87 * mm] * 2)
    tt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.4, LINE),
                            ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE),
                            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6)]))
    el.append(tt)
    el.append(Spacer(1, 4 * mm))
    goods_desc = '; '.join([g['desc'] for g in case['goods'][:3]])
    el.append(Paragraph(f"<b>Description of goods:</b> {goods_desc}", SMALL))
    el.append(Paragraph(f"<b>Country of origin:</b> {case['origin_country_name']}", SMALL))
    el.append(Paragraph(f"<b>Means of transport:</b> {case['transport_mode_label']}", SMALL))
    el.append(Spacer(1, 6 * mm))

    body = {
        'sanitary_certificate': "The competent health authority certifies that the products described above comply "
                                 "with the food safety requirements in force at origin and are fit for human consumption.",
        'phytosanitary_certificate': "This is to certify that the plants or plant products described above have been "
                                      "inspected and/or tested according to appropriate official procedures and are considered "
                                      "to be free from quarantine pests, and to conform with the current phytosanitary requirements.",
        'veterinary_certificate': "The official veterinarian certifies that the products of animal origin described above "
                                   "come from establishments approved for export and comply with the animal health conditions required.",
        'fumigation_certificate': "This certifies that the wood packaging material used in this shipment has been treated "
                                   "(heat treatment / methyl bromide fumigation) in accordance with ISPM-15 and bears the corresponding mark.",
        'ce_certificate': "The manufacturer declares, under its sole responsibility, that the product described above is in "
                           "conformity with the relevant Union harmonisation legislation and bears the CE marking accordingly.",
        'quality_certificate': "This certificate attests that the goods described above have been inspected and meet the "
                                "quality specifications agreed between buyer and seller.",
        'import_license': "This license authorizes the import of the goods described above into the customs territory of "
                           "the European Union, subject to the conditions and quantitative limits stated herein.",
        'export_license': "This license authorizes the export of the goods described above, in accordance with Regulation "
                           "(EU) 2021/821 (dual-use items) and national export control legislation, where applicable.",
        'ched_pp': "Common Health Entry Document for Plants and Plant Products (CHED-PP), completed by the responsible "
                   "operator in the TRACES NT system in accordance with Regulation (EU) 2017/625, Art. 47-64. This "
                   "consignment was pre-notified to the competent Border Control Post prior to physical arrival, as "
                   "required for plant products subject to official controls under Regulation (EU) 2016/2031.",
        'ched_p': "Common Health Entry Document for Products of Animal Origin (CHED-P), completed in TRACES NT in "
                  "accordance with Regulation (EU) 2017/625, Art. 47-64. The establishment of origin stated in the "
                  "accompanying veterinary certificate must appear on the relevant EU list of approved third-country "
                  "establishments authorised to export to the Union.",
        'ched_d': "Common Health Entry Document for Feed and Food of Non-Animal Origin (CHED-D), completed in TRACES NT. "
                  "This commodity/origin combination is subject to temporarily increased official controls at the border "
                  "in accordance with Implementing Regulation (EU) 2019/1793, Annex I/II.",
        'catch_certificate': "This catch certificate attests, in accordance with Council Regulation (EC) No 1005/2008 "
                              "establishing a system to prevent, deter and eliminate illegal, unreported and unregulated "
                              "(IUU) fishing, that the fishery products described above were caught in accordance with "
                              "applicable conservation and management measures, validated by the competent authority of "
                              "the flag State of the catching vessel(s).",
        'analysis_certificate': "This Certificate of Analysis attests that laboratory testing has been performed on the "
                                 "batch described above, in accordance with the applicable EU/international test methods, "
                                 "and that the results comply with the maximum limits and specifications required for this "
                                 "commodity.",
        'gdp_certificate': "This certificate attests that the carrier/logistics operator responsible for this consignment "
                            "complies with the Good Distribution Practice (GDP) guidelines for the storage and transport of "
                            "temperature-sensitive medicinal/biological products, maintaining an uninterrupted, monitored "
                            "cold chain within the temperature range required for this product.",
    }.get(cert_type, "Official certificate covering the goods described above.")
    el.append(Paragraph(body, SMALL))
    el.append(Spacer(1, 10 * mm))
    el.append(Paragraph(f"Place of issue: {case.get('origin_city', '-')}<br/><br/>_________________________<br/>"
                        "Authorized official signature and stamp", SMALL))
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)


# ---------------------------------------------------------------------------
# FICHA DE DATOS DE SEGURIDAD (FDS/SDS — REACH Anexo II / CLP, 16 secciones)
# ---------------------------------------------------------------------------
def safety_data_sheet(path, case):
    doc = _doc(path)
    el = []
    g = case['goods'][0]
    el.append(_header('SAFETY DATA SHEET (SDS) / FICHA DE DATOS DE SEGURIDAD (FDS)',
                       'Version', f"1.{case['invoice_no'][-2:]}", 'Date of issue', case['invoice_date'],
                       extra_right=['REACH Annex II / Regulation (EC) 1907/2006', 'CLP Regulation (EC) 1272/2008']))
    el.append(Spacer(1, 3 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 3 * mm))

    hazard_class = g.get('hazard_class')
    un_number = g.get('un_number')
    cas_no = g.get('cas_no', 'No asignado / mezcla sin CAS unico')
    flash_point = g.get('flash_point', 'No aplica (no inflamable en las condiciones de ensayo)')

    sections = [
        ("SECCION 1: Identificacion de la sustancia/mezcla y de la sociedad",
         f"<b>Nombre del producto:</b> {g['desc']}<br/>"
         f"<b>Uso identificado:</b> Uso industrial / materia prima<br/>"
         f"<b>Fabricante/proveedor:</b> {case['seller']['name']}, {case['seller'].get('country_name','-')}<br/>"
         f"<b>Telefono de emergencia (24h):</b> Instituto Nacional de Toxicologia y Ciencias Forenses — "
         f"Servicio de Informacion Toxicologica: +34 91 562 04 20"),
        ("SECCION 2: Identificacion de los peligros",
         (f"<b>Clasificacion CLP:</b> Clase de peligro para el transporte {hazard_class} — Grupo de embalaje "
           f"{g.get('packing_group') or 'N/A'}<br/>Indicaciones de peligro (H) e indicaciones de prudencia (P) segun "
           f"ficha del fabricante." if hazard_class else
           "Sustancia/mezcla NO clasificada como mercancia peligrosa para el transporte (sin numero ONU asignado). "
           "Clasificacion CLP conforme a ficha del fabricante para riesgos de manipulacion en almacen.")),
        ("SECCION 3: Composicion/informacion sobre los componentes",
         f"<b>Numero CAS:</b> {cas_no}<br/><b>Numero CE/EINECS:</b> Segun inventario REACH del fabricante<br/>"
         f"Sustancia unica / mezcla segun se indica en el nombre comercial del producto."),
        ("SECCION 4: Primeros auxilios",
         "Contacto ocular: lavar con agua abundante durante 15 minutos. Inhalacion: trasladar a zona ventilada. "
         "Ingestion: no inducir el vomito, buscar atencion medica. Contacto con la piel: lavar con agua y jabon."),
        ("SECCION 5: Medidas de lucha contra incendios",
         f"<b>Punto de inflamacion:</b> {flash_point}<br/>Medios de extincion adecuados: polvo quimico seco, CO2, "
         "espuma resistente al alcohol. No usar chorro de agua directo si el producto es inflamable."),
        ("SECCION 6: Medidas en caso de vertido accidental",
         "Contener el vertido, evitar su entrada en desagues y cursos de agua. Absorber con material inerte "
         "(arena, tierra de diatomeas) y eliminar conforme a la normativa local de residuos."),
        ("SECCION 7: Manipulacion y almacenamiento",
         "Manipular en zona ventilada, con equipo de proteccion individual adecuado. Almacenar en envase original, "
         "cerrado, alejado de fuentes de ignicion e incompatibles quimicos."),
        ("SECCION 8: Controles de exposicion/proteccion individual",
         "Proteccion respiratoria segun evaluacion de riesgo. Guantes resistentes a productos quimicos, gafas de "
         "seguridad y ropa de proteccion segun ficha tecnica del fabricante."),
        ("SECCION 9: Propiedades fisicas y quimicas",
         f"<b>Estado fisico:</b> {'Liquido' if case['goods'][0]['unit']=='LTR' else 'Solido/granulado'}<br/>"
         f"<b>Punto de inflamacion:</b> {flash_point}"),
        ("SECCION 10: Estabilidad y reactividad",
         "Estable en condiciones normales de almacenamiento y manipulacion. Evitar contacto con oxidantes fuertes, "
         "acidos/bases concentrados y fuentes de calor segun incompatibilidades declaradas por el fabricante."),
        ("SECCION 11: Informacion toxicologica",
         "Vease ficha tecnica del fabricante para valores de toxicidad aguda (DL50/CL50) y clasificacion de peligro "
         "para la salud aplicable segun el Reglamento CLP."),
        ("SECCION 12: Informacion ecologica",
         "Evitar la liberacion al medio ambiente. Vease ficha tecnica del fabricante para datos de ecotoxicidad, "
         "persistencia y bioacumulacion."),
        ("SECCION 13: Consideraciones relativas a la eliminacion",
         "Eliminar conforme a la normativa de residuos peligrosos/no peligrosos aplicable en el pais de destino; "
         "no verter por el desague."),
        ("SECCION 14: Informacion relativa al transporte",
         (f"<b>No. ONU:</b> {un_number}<br/><b>Designacion oficial de transporte:</b> {g['desc'][:60]}<br/>"
           f"<b>Clase de peligro:</b> {hazard_class}<br/><b>Grupo de embalaje:</b> {g.get('packing_group') or 'N/A'}<br/>"
           f"Vease Declaracion de Mercancias Peligrosas adjunta." if un_number else
           "Mercancia NO regulada como peligrosa para el transporte por carretera (ADR), mar (IMDG) ni aire (IATA "
           "DGR): no requiere numero ONU ni Declaracion de Mercancias Peligrosas.")),
        ("SECCION 15: Informacion reglamentaria",
         "Sustancia/mezcla sujeta a registro REACH (Reglamento (CE) 1907/2006) por parte del fabricante/importador "
         "responsable en la UE. Clasificacion y etiquetado conforme al Reglamento CLP (CE) 1272/2008."),
        ("SECCION 16: Otra informacion",
         f"Ficha de datos de seguridad emitida para el caso de prueba {case['id']} — revision {case['invoice_date']}. "
         "Documento de prueba QA, no vinculante."),
    ]
    for title, body in sections:
        el.append(Paragraph(f"<b>{title}</b>", H2))
        el.append(Paragraph(body, SMALL))
        el.append(Spacer(1, 2.2 * mm))

    el.append(Spacer(1, 4 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)


# ---------------------------------------------------------------------------
# DECLARACION DE MERCANCIAS PELIGROSAS (multimodal — ADR/IMDG/IATA-DGR)
# ---------------------------------------------------------------------------
def dangerous_goods_declaration(path, case):
    doc = _doc(path)
    el = []
    t = case['transport']
    el.append(Paragraph("<b>SHIPPER'S DECLARATION FOR DANGEROUS GOODS</b>", H1))
    el.append(Paragraph("Declaracion de mercancias peligrosas — documento multimodal conforme a ADR / Codigo IMDG / IATA DGR, "
                        "segun el modo de transporte declarado", SMALL))
    el.append(Spacer(1, 3 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 3 * mm))

    top = [[_party_block('SHIPPER / EXPEDIDOR', case['seller']), _party_block('CONSIGNEE / DESTINATARIO', case.get('consignee') or case['buyer'])]]
    tt = Table(top, colWidths=[87 * mm] * 2)
    tt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.4, LINE),
                            ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE),
                            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6)]))
    el.append(tt)
    el.append(Spacer(1, 3 * mm))

    transport_ref = {'maritime': f"Vessel/Voyage: {t.get('vessel','-')} — B/L {t.get('doc_no','-')}",
                      'air': f"Flight: {t.get('vessel','-')} — AWB {t.get('doc_no','-')}",
                      'road': f"Vehiculo: {t.get('vehicle_plate','-')} — CMR {t.get('doc_no','-')}"}[case['transport_mode']]
    el.append(Paragraph(f"<b>Transport details:</b> {transport_ref}<br/>"
                        f"<b>Regulation applicable:</b> "
                        f"{'IMDG Code (International Maritime Dangerous Goods Code)' if case['transport_mode']=='maritime' else ''}"
                        f"{'IATA Dangerous Goods Regulations (DGR)' if case['transport_mode']=='air' else ''}"
                        f"{'ADR — Acuerdo europeo sobre transporte de mercancias peligrosas por carretera' if case['transport_mode']=='road' else ''}",
                        SMALL))
    el.append(Spacer(1, 4 * mm))

    head = ['UN No.', 'Proper shipping name', 'Class', 'PG', 'Type/qty of packing', 'Packing instr.']
    rows = [head]
    for g in case['goods']:
        un = g.get('un_number', '—')
        cls = g.get('hazard_class', '—')
        pg = g.get('packing_group') or 'N/A'
        pkgs = g.get('packages', max(1, round(g['qty'] / 40)))
        qty_txt = f"{pkgs} {g.get('pack_type','CTN')} / {g['qty']:,.0f} {g['unit']}".replace(',', '.')
        lq_note = ' (Limited Quantity)' if g.get('limited_qty') else ''
        rows.append([un, Paragraph(_truncate(g['desc'], 55) + lq_note, SMALL), cls, pg, qty_txt, 'Segun IMDG/IATA/ADR aplicable'])
    tbl = Table(rows, colWidths=[18 * mm, 60 * mm, 14 * mm, 12 * mm, 34 * mm, 36 * mm])
    tbl.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), BGHEAD), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                             ('FONTSIZE', (0, 0), (-1, -1), 8), ('GRID', (0, 0), (-1, -1), 0.35, LINE),
                             ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    el.append(tbl)
    el.append(Spacer(1, 4 * mm))

    special_notes = [g.get('special_note') for g in case['goods'] if g.get('special_note')]
    if special_notes:
        el.append(Paragraph('<b>Special provisions / disposiciones especiales:</b> ' + ' '.join(special_notes), SMALL))
        el.append(Spacer(1, 3 * mm))

    el.append(Paragraph("<b>24-Hour Emergency Contact / Telefono de emergencia:</b> "
                        "Instituto Nacional de Toxicologia y Ciencias Forenses — Servicio de Informacion "
                        "Toxicologica: +34 91 562 04 20", SMALL))
    el.append(Spacer(1, 8 * mm))
    el.append(Paragraph("I hereby declare that the contents of this consignment are fully and accurately described "
                        "above by the Proper Shipping Name, and are classified, packaged, marked and labelled/placarded, "
                        "and are in all respects in proper condition for transport according to the applicable "
                        "international and national regulations.<br/><br/>"
                        f"For and on behalf of<br/><b>{case['seller']['name']}</b><br/><br/>"
                        "_________________________<br/>Name/title of signatory and date", SMALL))
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)


# ---------------------------------------------------------------------------
# CERTIFICADO DE CONTROL DE TEMPERATURA / CADENA DE FRIO
# ---------------------------------------------------------------------------
def temperature_control_certificate(path, case):
    doc = _doc(path)
    el = []
    g = case['goods'][0]
    t = case['transport']
    temp_range = g.get('temp_range', 'Segun especificacion del producto')
    el.append(_header('TEMPERATURE CONTROL / COLD CHAIN COMPLIANCE CERTIFICATE',
                       'Certificate No.', f"TMP-{case['id']}-{case['invoice_no'].split('-')[-1]}",
                       'Date of issue', case['invoice_date']))
    el.append(Spacer(1, 3 * mm))
    el.append(HRFlowable(width='100%', color=LINE, thickness=0.8))
    el.append(Spacer(1, 3 * mm))

    el.append(Paragraph(f"<b>Product:</b> {g['desc']}", SMALL))
    el.append(Paragraph(f"<b>Required temperature range:</b> {temp_range}", SMALL))
    reefer_unit = f"{t.get('carrier','-').split()[0].upper()}-REEFER-{2000 + int(case['invoice_no'][-4:]) % 900}"
    el.append(Paragraph(f"<b>Reefer/refrigeration unit ID:</b> {reefer_unit}  |  "
                        f"<b>Set point:</b> {temp_range.split(' a ')[0] if ' a ' in temp_range else temp_range}", SMALL))
    el.append(Paragraph(f"<b>Data logger serial:</b> DL-{case['invoice_no'][-6:]}  |  "
                        f"<b>Calibration certificate ref.:</b> CAL-{case['invoice_no'][-6:]}-2026", SMALL))
    el.append(Spacer(1, 4 * mm))

    try:
        d_etd = datetime.strptime(t.get('etd', '01/01/2026'), '%d/%m/%Y')
        d_eta = datetime.strptime(t.get('eta', '01/01/2026'), '%d/%m/%Y')
        mid_date = (d_etd + (d_eta - d_etd) / 2).strftime('%d/%m/%Y')
    except ValueError:
        mid_date = t.get('etd', '-')

    has_deviation = bool(case.get('temp_deviation'))
    range_low = temp_range.split(' a ')[0] if ' a ' in temp_range else temp_range
    range_high = temp_range.split(' a ')[-1] if ' a ' in temp_range else temp_range
    head = ['Checkpoint', 'Date/Time', 'Recorded temperature', 'Within range?']
    checkpoints = [
        ('Origin — loading', t.get('etd', '-'), range_low, 'YES'),
        ('Mid-transit check', mid_date, ('+13.5°C (EXCURSION — 6h)' if has_deviation else range_high), ('NO' if has_deviation else 'YES')),
        ('Arrival — unloading', t.get('eta', '-'), range_low, 'YES'),
    ]
    rows = [head] + [list(c) for c in checkpoints]
    tbl = Table(rows, colWidths=[46 * mm, 34 * mm, 50 * mm, 32 * mm])
    tstyle = [('BACKGROUND', (0, 0), (-1, 0), BGHEAD), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
              ('FONTSIZE', (0, 0), (-1, -1), 8.3), ('GRID', (0, 0), (-1, -1), 0.35, LINE),
              ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]
    if has_deviation:
        tstyle += [('TEXTCOLOR', (2, 2), (3, 2), colors.HexColor('#b03a2e')), ('FONTNAME', (2, 2), (3, 2), 'Helvetica-Bold')]
    tbl.setStyle(TableStyle(tstyle))
    el.append(tbl)
    el.append(Spacer(1, 4 * mm))
    if g.get('gdp_required'):
        el.append(Paragraph("<b>GDP compliance:</b> Transport carried out under Good Distribution Practice (GDP) "
                            "conditions for temperature-sensitive medicinal/biological products; continuous monitoring "
                            "device active for the entire door-to-door transit, including any temporary storage period.", SMALL))
    else:
        el.append(Paragraph("Continuous monitoring device active for the entire door-to-door transit, without gaps, "
                            "including any temporary storage period prior to customs release.", SMALL))
    el.append(Spacer(1, 8 * mm))
    if has_deviation:
        el.append(Paragraph("<b>Non-conformance recorded:</b> the continuous data logger shows a temperature "
                            "excursion above the set point lasting approximately 6 hours during mid-voyage, most "
                            "likely due to a reefer unit power interruption during transhipment. This is reported "
                            "as a commercial/quality matter between shipper and consignee under the sales contract "
                            "and cargo insurance policy; it does NOT by itself affect the validity of the "
                            "phytosanitary certificate issued for this consignment, which remains a separate "
                            "regulatory control.<br/><br/>"
                            "_________________________<br/>Authorized signature — Logistics/Cold Chain Officer", SMALL))
    else:
        el.append(Paragraph("We certify that the cold chain was maintained within the required range for the entire "
                            "duration of this shipment, as evidenced by the continuous data logger record referenced "
                            "above (full data trace available upon request).<br/><br/>"
                            "_________________________<br/>Authorized signature — Logistics/Cold Chain Officer", SMALL))
    el.append(Spacer(1, 6 * mm))
    el.append(_footer_note(f"Documento de prueba generado para el caso {case['id']} — {case['title']}. Uso exclusivo QA LUCI/STRIX AI."))
    doc.build(el)
