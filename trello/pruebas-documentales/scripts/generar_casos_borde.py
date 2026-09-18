# -*- coding: utf-8 -*-
"""
Genera los casos de borde de clasificacion TARIC (independientes de los 64
casos H1/AES del tablero de Trello) en su propio directorio
CASOS-BORDE-TARIC/, cada uno con su kit completo de documentos y un resumen
que explica la base normativa (GRI/Nota legal) de la disputa de clasificacion.
"""
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(__file__))

from casos_common import expand_case, slugify
from casos_borde import RAW_BORDE
import pdfgen
from generar_documentos import TRANSPORT_DOC, EXTRA_DOC_FUNCS, GENERIC_TYPES, write_manifest, BASE_DIR

BORDE_DIR = os.path.join(BASE_DIR, 'CASOS-BORDE-TARIC')


def write_manifest_borde(folder, case, generated_files):
    write_manifest(folder, case, generated_files)
    path = os.path.join(folder, '00_resumen_caso.txt')
    with open(path, 'a', encoding='utf-8') as f:
        f.write("\n--- CASO DE BORDE: FUNDAMENTO DE LA DISPUTA DE CLASIFICACION ---\n")
        f.write(f"Base normativa/tecnica: {case.get('gri_basis', '-')}\n\n")
        f.write(case.get('classification_challenge', '') + '\n')
        f.write("\nNOTA: la factura NO indica un codigo TARIC de confianza — el codigo que figura es el\n"
                "que sugeriria de forma naive/erronea el proveedor o transitario en un envio real. El\n"
                "objetivo de este caso es verificar si el agente / LUCI llegan a la clasificacion correcta\n"
                "razonando desde las Reglas Generales de Interpretacion, no copiando el codigo de la factura.\n")


def generate_borde_case(raw):
    case = expand_case(raw)
    folder_name = f"{raw['n']:02d}-{slugify(raw['title'])[:70]}"
    folder = os.path.join(BORDE_DIR, folder_name)
    os.makedirs(folder, exist_ok=True)

    generated = []
    fn = '01_factura_comercial.pdf'
    pdfgen.commercial_invoice(os.path.join(folder, fn), case)
    generated.append(fn)

    fn = '02_packing_list.pdf'
    pdfgen.packing_list(os.path.join(folder, fn), case)
    generated.append(fn)

    doc_key, _ = TRANSPORT_DOC[case['transport_mode']]
    fn = f"03_{doc_key}.pdf"
    getattr(pdfgen, doc_key)(os.path.join(folder, fn), case)
    generated.append(fn)

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

    write_manifest_borde(folder, case, generated)
    generated.append('00_resumen_caso.txt')
    return folder, generated


def main():
    os.makedirs(BORDE_DIR, exist_ok=True)
    total_files = 0
    total_cases = 0
    errors = []

    print(f"Generando casos de borde TARIC ({len(RAW_BORDE)} casos)...")
    for raw in RAW_BORDE:
        try:
            folder, files = generate_borde_case(raw)
            total_cases += 1
            total_files += len(files)
            print(f"  [OK] {raw['id']}: {len(files)} archivos -> {os.path.relpath(folder, BASE_DIR)}")
        except Exception as e:
            errors.append((raw['id'], str(e)))
            print(f"  [ERROR] {raw['id']}: {e}")
            traceback.print_exc()

    print(f"\n{'='*60}")
    print(f"TOTAL: {total_cases} casos de borde, {total_files} archivos generados")
    if errors:
        print(f"ERRORES ({len(errors)}):")
        for cid, msg in errors:
            print(f"  - {cid}: {msg}")
    else:
        print("Sin errores.")


if __name__ == '__main__':
    main()
