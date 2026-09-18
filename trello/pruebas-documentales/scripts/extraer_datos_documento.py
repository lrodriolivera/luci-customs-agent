# -*- coding: utf-8 -*-
"""
Extrae, desde el codigo fuente (no de memoria), los datos completos de los
241 casos de prueba del tablero LUCI, para construir el documento de
entrega a la agente aduanera. Reproduce EXACTAMENTE la logica de:
  - generar_extranos.py (para los 128 casos "mercancia extrana": mismo
    orden de iteracion, mismo indice global de producto, misma semilla)
  - subir_a_trello.py / subir_categorias_especiales.py (para el nombre
    exacto de la tarjeta de Trello de cada grupo)
Escribe el resultado en casos_documento_agente.json.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from casos_common import expand_case, build_extrano_variant
from casos_h1 import RAW_H1
from casos_aes import RAW_AES
from casos_borde import RAW_BORDE
from casos_categorias_especiales import RAW_H1_ESP, RAW_AES_ESP
from productos_raros import PRODUCTOS_RAROS
from generar_extranos import PRODUCT_KEYS, _qty_price

DOC_LABELS = {
    'certificate_origin': 'Certificado de origen (no preferencial)',
    'eur1': 'Certificado EUR.1 (origen preferencial)',
    'insurance_certificate': 'Certificado de seguro de transporte',
    'sanitary_certificate': 'Certificado sanitario',
    'phytosanitary_certificate': 'Certificado fitosanitario',
    'veterinary_certificate': 'Certificado veterinario',
    'fumigation_certificate': 'Certificado de fumigación / tratamiento NIMF-15',
    'ce_certificate': 'Declaración de conformidad CE',
    'quality_certificate': 'Certificado de calidad',
    'import_license': 'Licencia de importación',
    'export_license': 'Licencia de exportación',
    'ched_pp': 'CHED-PP (documento sanitario de entrada — vegetales)',
    'ched_p': 'CHED-P (documento sanitario de entrada — origen animal)',
    'ched_d': 'CHED-D (documento sanitario de entrada — alimentos/piensos)',
    'catch_certificate': 'Certificado de captura (pesca INDNR)',
    'analysis_certificate': 'Certificado de análisis de laboratorio',
    'gdp_certificate': 'Certificado de Buenas Prácticas de Distribución (GDP)',
    'safety_data_sheet': 'Ficha de datos de seguridad (FDS/SDS)',
    'dangerous_goods_declaration': 'Declaración de mercancías peligrosas (DGD)',
    'temperature_control_certificate': 'Certificado de control de temperatura / cadena de frío',
}
TRANSPORT_LABELS = {'maritime': 'Bill of Lading (B/L)', 'air': 'Air Waybill (AWB)', 'road': 'CMR'}


def base_docs(case):
    docs = ['Factura comercial', 'Packing list', TRANSPORT_LABELS[case['transport_mode']]]
    for d in case.get('extra_docs', []):
        docs.append(DOC_LABELS.get(d, d))
    return docs


def que_se_prueba(case):
    parts = []
    if case.get('invoice_extra_note'):
        parts.append(case['invoice_extra_note'])
    if case.get('classification_challenge'):
        parts.append("Reto de clasificación TARIC: " + case['classification_challenge'])
    if case.get('gri_basis'):
        parts.append("Base normativa (GRI/nota legal): " + case['gri_basis'])
    return ' '.join(parts) if parts else '(ver manifiesto del caso — sin nota adicional)'


def _es(txt):
    return txt.replace('Espana', 'España')


def ruta_txt(case):
    dest = _es(case.get('dest_country_name', 'España'))
    return _es(f"{case['origin_country_name']} → {dest} | {case['transport_mode_label']} | "
               f"Incoterm {case['incoterm']} {case.get('incoterm_place', '')}".strip())


records = []

# 1) H1 base (43) y AES base (21) — tarjetas "NN. Titulo"
for raw in RAW_H1:
    c = expand_case(raw)
    records.append(dict(
        grupo='H1 — Casos base', id=c['id'],
        tarjeta_trello=f"{c['id']} — {c['title']}",
        titulo=c['title'], ruta=ruta_txt(c), que_se_prueba=que_se_prueba(c),
        documentos=base_docs(c),
    ))
for raw in RAW_AES:
    c = expand_case(raw)
    records.append(dict(
        grupo='AES — Casos base', id=c['id'],
        tarjeta_trello=f"{c['id']} — {c['title']}",
        titulo=c['title'], ruta=ruta_txt(c), que_se_prueba=que_se_prueba(c),
        documentos=base_docs(c),
    ))

# 2) Mercancia extrana (128) — misma logica exacta que generar_extranos.py
all_raw_extranas = [(r, 'H1') for r in RAW_H1] + [(r, 'AES') for r in RAW_AES]
product_cycle_index = 0
for raw, group in all_raw_extranas:
    for letter_idx, letter in enumerate(['a', 'b']):
        producto_key = PRODUCT_KEYS[product_cycle_index % len(PRODUCT_KEYS)]
        product_cycle_index += 1
        producto_data = PRODUCTOS_RAROS[producto_key]
        seed = sum((i + 1) * ord(ch) for i, ch in enumerate(raw['id'])) + letter_idx * 9973
        qty, price = _qty_price(producto_key, seed)
        new_raw = build_extrano_variant(raw, producto_key, letter, producto_data, qty, price)
        c = expand_case(new_raw)
        records.append(dict(
            grupo=f'{group} — Mercancía extraña (test clasificación TARIC)', id=c['id'],
            tarjeta_trello=f"{c['id']} — {c['title']}",
            titulo=c['title'], ruta=ruta_txt(c), que_se_prueba=que_se_prueba(c),
            documentos=base_docs(c),
        ))

# 3) Casos de borde TARIC (15)
for raw in RAW_BORDE:
    c = expand_case(raw)
    records.append(dict(
        grupo='Casos de borde — Clasificación TARIC', id=c['id'],
        tarjeta_trello=f"{c['id']} — {c['title']}",
        titulo=c['title'], ruta=ruta_txt(c), que_se_prueba=que_se_prueba(c),
        documentos=base_docs(c),
    ))

# 4) Categorias especiales (34)
for raw in RAW_H1_ESP:
    c = expand_case(raw)
    records.append(dict(
        grupo='H1 — Categorías especiales (perecederos/alimentos/químicos/peligrosos/frío)', id=c['id'],
        tarjeta_trello=f"{raw['id']} — {raw['title']}",
        titulo=c['title'], ruta=ruta_txt(c), que_se_prueba=que_se_prueba(c),
        documentos=base_docs(c),
    ))
for raw in RAW_AES_ESP:
    c = expand_case(raw)
    records.append(dict(
        grupo='AES — Categorías especiales (perecederos/alimentos/químicos/peligrosos/frío)', id=c['id'],
        tarjeta_trello=f"{raw['id']} — {raw['title']}",
        titulo=c['title'], ruta=ruta_txt(c), que_se_prueba=que_se_prueba(c),
        documentos=base_docs(c),
    ))

out_path = os.path.join(os.path.dirname(__file__), 'casos_documento_agente.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Total casos extraidos: {len(records)}")
from collections import Counter
for grupo, n in Counter(r['grupo'] for r in records).items():
    print(f"  {grupo}: {n}")
print(f"Escrito en: {out_path}")
