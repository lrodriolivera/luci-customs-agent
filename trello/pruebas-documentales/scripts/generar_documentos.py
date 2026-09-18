# -*- coding: utf-8 -*-
"""
Genera la documentacion de prueba (PDF) para los 43 casos H1 y 21 casos AES
del tablero real de Trello, un directorio por caso, con datos unicos y
variados (paises UE y no-UE), listos para cargarse via el portal del cliente
o via el panel del agente en LUCI.
"""
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(__file__))

from casos_common import expand_case, slugify
from casos_h1 import RAW_H1
from casos_aes import RAW_AES
import pdfgen

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

TRANSPORT_DOC = {
    'maritime': ('bill_of_lading', 'Bill of Lading (B_L)'),
    'air': ('air_waybill', 'Air Waybill (AWB)'),
    'road': ('cmr', 'CMR'),
}

EXTRA_DOC_FUNCS = {
    'certificate_origin': ('certificado_origen', pdfgen.certificate_origin),
    'eur1': ('eur1', pdfgen.eur1),
    'insurance_certificate': ('certificado_seguro', pdfgen.insurance_certificate),
    'sanitary_certificate': ('certificado_sanitario', None),
    'phytosanitary_certificate': ('certificado_fitosanitario', None),
    'veterinary_certificate': ('certificado_veterinario', None),
    'fumigation_certificate': ('certificado_fumigacion', None),
    'ce_certificate': ('declaracion_ce', None),
    'quality_certificate': ('certificado_calidad', None),
    'import_license': ('licencia_importacion', None),
    'export_license': ('licencia_exportacion', None),
}
GENERIC_TYPES = {'sanitary_certificate', 'phytosanitary_certificate', 'veterinary_certificate',
                  'fumigation_certificate', 'ce_certificate', 'quality_certificate',
                  'import_license', 'export_license'}


def _fmt_party(p):
    bits = [p.get('name', ''), p.get('address', ''), f"{p.get('postal','')} {p.get('city','')}".strip(),
            p.get('country_name', '')]
    extra = []
    if p.get('nif'):
        extra.append(f"NIF: {p['nif']}")
    if p.get('eori'):
        extra.append(f"EORI: {p['eori']}")
    if p.get('tax_id'):
        extra.append(f"Tax ID: {p['tax_id']}")
    if extra:
        bits.append(' | '.join(extra))
    return '\n    '.join([b for b in bits if b])


def write_manifest(folder, case, generated_files):
    path = os.path.join(folder, '00_resumen_caso.txt')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(f"CASO {case['id']} — {case['title']}\n")
        f.write('=' * 70 + '\n\n')
        f.write(f"Operacion: {'IMPORTACION (H1)' if case['op']=='import' else 'EXPORTACION (AES)'}\n")
        f.write(f"Modo de transporte: {case['transport_mode_label']}\n")
        f.write(f"Origen mercancia: {case['origin_country_name']} ({case['origin_city']})\n")
        f.write(f"Destino: {case['dest_country_name']}\n")
        f.write(f"Incoterm: {case['incoterm']} {case.get('incoterm_place','')}\n")
        f.write(f"Moneda: {case['currency']}\n\n")
        f.write("VENDEDOR/EXPORTADOR:\n    " + _fmt_party(case['seller']) + '\n\n')
        f.write("COMPRADOR/IMPORTADOR:\n    " + _fmt_party(case['buyer']) + '\n\n')
        if case.get('consignee'):
            f.write("CONSIGNATARIO:\n    " + _fmt_party(case['consignee']) + '\n\n')
        f.write(f"Factura No.: {case['invoice_no']}  Fecha: {case['invoice_date']}\n")
        f.write(f"Documento de transporte: {case['transport']['doc_no']}\n\n")
        f.write("MERCANCIAS:\n")
        for g in case['goods']:
            f.write(f"  - {g['desc']}\n    HS: {g['hs']}  Cantidad: {g['qty']} {g['unit']}  "
                    f"Precio unit.: {g['unit_price']} {case['currency']}\n")
        f.write('\n')
        if case.get('invoice_extra_note'):
            f.write("NOTA DEL CASO (que se prueba):\n  " + case['invoice_extra_note'] + '\n\n')
        f.write("DOCUMENTOS GENERADOS EN ESTA CARPETA:\n")
        for fn in generated_files:
            f.write(f"  - {fn}\n")
        f.write('\n---\nDocumentacion de prueba QA generada para LUCI/STRIX AI. No usar como dato real.\n')


def generate_for_case(raw, group):
    case = expand_case(raw)
    folder_name = f"{raw['n']:02d}-{slugify(case['title'])[:60]}"
    folder = os.path.join(BASE_DIR, group, folder_name)
    os.makedirs(folder, exist_ok=True)

    generated = []

    # 1. Factura comercial (o multi-factura para H1-21)
    if case['id'] == 'H1-21' and len(case['goods']) >= 2:
        for idx, g in enumerate(case['goods'], 1):
            sub = dict(case)
            sub['goods'] = [g]
            sub['invoice_no'] = f"{case['invoice_no']}-{idx}"
            fn = f"01{chr(96+idx)}_factura_comercial_{idx}de{len(case['goods'])}.pdf"
            pdfgen.commercial_invoice(os.path.join(folder, fn), sub)
            generated.append(fn)
    else:
        fn = '01_factura_comercial.pdf'
        pdfgen.commercial_invoice(os.path.join(folder, fn), case)
        generated.append(fn)

    # 2. Packing list
    fn = '02_packing_list.pdf'
    pdfgen.packing_list(os.path.join(folder, fn), case)
    generated.append(fn)

    # 3. Documento de transporte
    doc_key, doc_label = TRANSPORT_DOC[case['transport_mode']]
    fn = f"03_{doc_key}.pdf"
    getattr(pdfgen, doc_key)(os.path.join(folder, fn), case)
    generated.append(fn)

    # 4. Documentos adicionales
    seq = 4
    for doc_type in case.get('extra_docs', []):
        info = EXTRA_DOC_FUNCS.get(doc_type)
        if not info:
            continue
        fname_base, func = info
        fn = f"{seq:02d}_{fname_base}.pdf"
        if doc_type in GENERIC_TYPES:
            pdfgen.generic_certificate(os.path.join(folder, fn), case, doc_type)
        else:
            func(os.path.join(folder, fn), case)
        generated.append(fn)
        seq += 1

    write_manifest(folder, case, generated)
    generated.append('00_resumen_caso.txt')
    return folder, generated


def main():
    total_files = 0
    total_cases = 0
    errors = []

    print(f"Generando documentacion H1 ({len(RAW_H1)} casos)...")
    for raw in RAW_H1:
        try:
            folder, files = generate_for_case(raw, 'H1')
            total_cases += 1
            total_files += len(files)
            print(f"  [OK] {raw['id']}: {len(files)} archivos -> {os.path.relpath(folder, BASE_DIR)}")
        except Exception as e:
            errors.append((raw['id'], str(e)))
            print(f"  [ERROR] {raw['id']}: {e}")
            traceback.print_exc()

    print(f"\nGenerando documentacion AES ({len(RAW_AES)} casos)...")
    for raw in RAW_AES:
        try:
            folder, files = generate_for_case(raw, 'AES')
            total_cases += 1
            total_files += len(files)
            print(f"  [OK] {raw['id']}: {len(files)} archivos -> {os.path.relpath(folder, BASE_DIR)}")
        except Exception as e:
            errors.append((raw['id'], str(e)))
            print(f"  [ERROR] {raw['id']}: {e}")
            traceback.print_exc()

    print(f"\n{'='*60}")
    print(f"TOTAL: {total_cases} casos, {total_files} archivos generados")
    if errors:
        print(f"ERRORES ({len(errors)}):")
        for cid, msg in errors:
            print(f"  - {cid}: {msg}")
    else:
        print("Sin errores.")


if __name__ == '__main__':
    main()
