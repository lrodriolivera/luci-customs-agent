# -*- coding: utf-8 -*-
"""
Genera, para cada uno de los 64 casos H1/AES ya existentes, 2 juegos de
documentos adicionales con mercancia inusual/compleja pensada especificamente
para poner a prueba la clasificacion TARIC con IA de LUCI. Se guardan como
subcarpetas dentro de la carpeta del caso original correspondiente:
  H1/01-.../mercancia-extrana-1/
  H1/01-.../mercancia-extrana-2/
"""
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(__file__))

from casos_common import expand_case, slugify, build_extrano_variant
from casos_h1 import RAW_H1
from casos_aes import RAW_AES
from productos_raros import PRODUCTOS_RAROS
import pdfgen
from generar_documentos import TRANSPORT_DOC, EXTRA_DOC_FUNCS, GENERIC_TYPES, write_manifest, BASE_DIR

PRODUCT_KEYS = list(PRODUCTOS_RAROS.keys())

# Cantidad/precio unitario base por producto (unidad acorde a PRODUCTOS_RAROS[key]['unit'])
BASE_QTY_PRICE = {
    'mochila_solar': (180, 34.50),
    'peluche_termico': (960, 6.80),
    'tabla_hibrida_patinete': (85, 165.00),
    'dron_camara_profesional': (60, 420.00),
    'cigarrillo_electronico_kit': (2400, 8.90),
    'reloj_multifuncion': (320, 58.00),
    'impresora_3d_alimentos': (18, 890.00),
    'chaqueta_calefactable': (140, 72.00),
    'cesta_regalo_gourmet': (450, 22.50),
    'mueble_desmontado_incompleto': (90, 118.00),
    'gnomo_jardin_solar': (720, 9.40),
    'bolsa_pet_reciclado': (5200, 1.35),
    'pintura_dedos_comestible': (600, 4.20),
    'mascara_proteccion_hibrida': (18000, 0.28),
    'instrumento_musical_electronico': (45, 195.00),
    'kit_camping_multiuso': (210, 38.00),
    'silla_convertible_mesa': (160, 64.00),
    'joya_impresa_3d_titanio': (25, 340.00),
    'alfombra_calefactada_electrica': (70, 210.00),
    'perfume_solido_metal': (980, 12.60),
    'cortina_purificadora_aire': (340, 28.00),
    'huevos_hormiga_comestibles': (85, 145.00),
    'banco_madera_maceta_integrada': (40, 155.00),
    'muneca_coleccionista_porcelana': (150, 210.00),
    'cinturon_lastre_buceo_reciclado': (310, 26.50),
}


def _qty_price(producto_key, seed):
    base_qty, base_price = BASE_QTY_PRICE[producto_key]
    qty = base_qty + (seed % 37)
    price = round(base_price * (1 + (seed % 13) / 100.0), 2)
    return qty, price


def write_manifest_extrano(folder, case, generated_files, challenge):
    """Como write_manifest pero añade la nota de reto de clasificacion."""
    write_manifest(folder, case, generated_files)
    path = os.path.join(folder, '00_resumen_caso.txt')
    with open(path, 'a', encoding='utf-8') as f:
        f.write("\n--- RETO DE CLASIFICACION TARIC (uso interno QA, no aparece en la factura) ---\n")
        f.write(challenge + '\n')
        f.write("\nNOTA: la factura NO indica un codigo TARIC de confianza — el codigo que figura es el\n"
                "que sugiere el propio proveedor extranjero (a menudo generico o incorrecto), tal y como\n"
                "ocurriria en un envio real. El objetivo de este caso es que el agente / LUCI clasifiquen\n"
                "la mercancia de verdad a partir de la descripcion, no que copien un codigo ya dado.\n")


def generate_variant(raw_base, variant_letter, producto_key, folder_case, seed_offset):
    producto_data = PRODUCTOS_RAROS[producto_key]
    seed = sum((i + 1) * ord(c) for i, c in enumerate(raw_base['id'])) + seed_offset
    qty, price = _qty_price(producto_key, seed)

    new_raw = build_extrano_variant(raw_base, producto_key, variant_letter, producto_data, qty, price)
    case = expand_case(new_raw)

    sub_folder = os.path.join(folder_case, f"mercancia-extrana-{variant_letter}")
    os.makedirs(sub_folder, exist_ok=True)

    generated = []
    fn = '01_factura_comercial.pdf'
    pdfgen.commercial_invoice(os.path.join(sub_folder, fn), case)
    generated.append(fn)

    fn = '02_packing_list.pdf'
    pdfgen.packing_list(os.path.join(sub_folder, fn), case)
    generated.append(fn)

    doc_key, _ = TRANSPORT_DOC[case['transport_mode']]
    fn = f"03_{doc_key}.pdf"
    getattr(pdfgen, doc_key)(os.path.join(sub_folder, fn), case)
    generated.append(fn)

    write_manifest_extrano(sub_folder, case, generated, producto_data['challenge'])
    generated.append('00_resumen_caso.txt')
    return sub_folder, generated


def main():
    all_raw = [(r, 'H1') for r in RAW_H1] + [(r, 'AES') for r in RAW_AES]
    product_cycle_index = 0
    total_files = 0
    total_variants = 0
    errors = []

    for raw, group in all_raw:
        folder_name = f"{raw['n']:02d}-{slugify(raw['title'])[:60]}"
        folder_case = os.path.join(BASE_DIR, group, folder_name)
        if not os.path.isdir(folder_case):
            errors.append((raw['id'], f"Carpeta base no existe: {folder_case}"))
            continue

        for letter_idx, letter in enumerate(['a', 'b']):
            producto_key = PRODUCT_KEYS[product_cycle_index % len(PRODUCT_KEYS)]
            product_cycle_index += 1
            try:
                sub_folder, files = generate_variant(raw, letter, producto_key, folder_case, seed_offset=letter_idx * 9973)
                total_variants += 1
                total_files += len(files)
                print(f"  [OK] {raw['id']} extrana-{letter} ({producto_key}): {len(files)} archivos -> "
                      f"{os.path.relpath(sub_folder, BASE_DIR)}")
            except Exception as e:
                errors.append((f"{raw['id']}-{letter}", str(e)))
                print(f"  [ERROR] {raw['id']} extrana-{letter}: {e}")
                traceback.print_exc()

    print(f"\n{'='*60}")
    print(f"TOTAL: {total_variants} variantes 'mercancia extrana', {total_files} archivos generados")
    if errors:
        print(f"ERRORES ({len(errors)}):")
        for cid, msg in errors:
            print(f"  - {cid}: {msg}")
    else:
        print("Sin errores.")


if __name__ == '__main__':
    main()
