# -*- coding: utf-8 -*-
"""
Genera la documentacion de prueba (PDF) para los 34 casos nuevos (20 H1 +
14 AES) de las 5 categorias pedidas: perecederos vegetales, alimentos con
riesgo sanitario reforzado, quimicos, mercancias peligrosas para el
transporte y cadena de frio farmaceutica/biologica. Reutiliza el motor de
generar_documentos.py (generate_for_case/write_manifest) registrando los
tipos de documento nuevos antes de generar.
"""
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(__file__))

import pdfgen
import generar_documentos as gd
from casos_categorias_especiales import RAW_H1_ESP, RAW_AES_ESP

# Registrar los 3 documentos "a medida" nuevos (funcion propia, no generica)
gd.EXTRA_DOC_FUNCS.update({
    'safety_data_sheet': ('ficha_datos_seguridad', pdfgen.safety_data_sheet),
    'dangerous_goods_declaration': ('declaracion_mercancias_peligrosas', pdfgen.dangerous_goods_declaration),
    'temperature_control_certificate': ('certificado_control_temperatura', pdfgen.temperature_control_certificate),
})

# Registrar los 6 tipos de certificado generico nuevos (reusan pdfgen.generic_certificate)
_NEW_GENERIC = {
    'ched_pp': 'ched_vegetales',
    'ched_p': 'ched_animal',
    'ched_d': 'ched_alimentos',
    'catch_certificate': 'certificado_captura',
    'analysis_certificate': 'certificado_analisis',
    'gdp_certificate': 'certificado_gdp',
}
for key, fname in _NEW_GENERIC.items():
    gd.EXTRA_DOC_FUNCS[key] = (fname, None)
gd.GENERIC_TYPES.update(_NEW_GENERIC.keys())


def main():
    total_files = 0
    total_cases = 0
    errors = []

    print(f"Generando documentacion H1 categorias especiales ({len(RAW_H1_ESP)} casos)...")
    for raw in RAW_H1_ESP:
        try:
            folder, files = gd.generate_for_case(raw, 'H1')
            total_cases += 1
            total_files += len(files)
            print(f"  [OK] {raw['id']}: {len(files)} archivos -> {os.path.relpath(folder, gd.BASE_DIR)}")
        except Exception as e:
            errors.append((raw['id'], str(e)))
            print(f"  [ERROR] {raw['id']}: {e}")
            traceback.print_exc()

    print(f"\nGenerando documentacion AES categorias especiales ({len(RAW_AES_ESP)} casos)...")
    for raw in RAW_AES_ESP:
        try:
            folder, files = gd.generate_for_case(raw, 'AES')
            total_cases += 1
            total_files += len(files)
            print(f"  [OK] {raw['id']}: {len(files)} archivos -> {os.path.relpath(folder, gd.BASE_DIR)}")
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
