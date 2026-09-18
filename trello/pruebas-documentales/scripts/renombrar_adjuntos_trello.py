# -*- coding: utf-8 -*-
"""
Corrige el nombre de los adjuntos ya subidos a Trello para los 15 casos de
borde y las 128 variantes de mercancia extrana: Trello no permite renombrar
un adjunto, asi que se borra el actual y se vuelve a subir con un nombre que
incluye el id del caso (ej. 'BORDE-01_factura_comercial.pdf' en vez de
'01_factura_comercial.pdf'), para que se distingan a simple vista en la
lista de adjuntos de cada tarjeta.
"""
import os
import sys
import time
import requests

sys.path.insert(0, os.path.dirname(__file__))
from casos_h1 import RAW_H1
from casos_aes import RAW_AES
from casos_borde import RAW_BORDE
from casos_common import slugify

KEY = os.environ['TRELLO_KEY']
TOKEN = os.environ['TRELLO_TOKEN']
API = 'https://api.trello.com/1'
AUTH = {'key': KEY, 'token': TOKEN}
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def _req(method, path, retries=4, **kwargs):
    url = f"{API}{path}"
    params = kwargs.pop('params', {})
    params.update(AUTH)
    for attempt in range(retries):
        r = requests.request(method, url, params=params, **kwargs, timeout=30)
        if r.status_code == 429:
            time.sleep(3 * (attempt + 1))
            continue
        if r.status_code >= 400:
            raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
        return r.json() if r.text else {}
    raise RuntimeError(f"{method} {path}: agotados los reintentos tras 429")


def get_all_cards():
    return _req('GET', '/boards/twFILESR/cards', params={'fields': 'name'})


def get_attachments(card_id):
    return _req('GET', f'/cards/{card_id}/attachments', params={'fields': 'name'})


def delete_attachment(card_id, att_id):
    return _req('DELETE', f'/cards/{card_id}/attachments/{att_id}')


def upload_attachment(card_id, filepath, new_name):
    with open(filepath, 'rb') as fh:
        files = {'file': (new_name, fh, 'application/pdf')}
        return _req('POST', f'/cards/{card_id}/attachments', files=files)


def build_case_folder_map():
    """id_caso -> ruta de carpeta local, para los 3 grupos nuevos."""
    m = {}
    for r in RAW_H1:
        folder_base = os.path.join(BASE_DIR, 'H1', f"{r['n']:02d}-{slugify(r['title'])[:60]}")
        for letter in ('a', 'b'):
            case_id = f"{r['id']}-EXTRANA-{letter}"
            m[case_id] = os.path.join(folder_base, f'mercancia-extrana-{letter}')
    for r in RAW_AES:
        folder_base = os.path.join(BASE_DIR, 'AES', f"{r['n']:02d}-{slugify(r['title'])[:60]}")
        for letter in ('a', 'b'):
            case_id = f"{r['id']}-EXTRANA-{letter}"
            m[case_id] = os.path.join(folder_base, f'mercancia-extrana-{letter}')
    for r in RAW_BORDE:
        folder = os.path.join(BASE_DIR, 'CASOS-BORDE-TARIC', f"{r['n']:02d}-{slugify(r['title'])[:70]}")
        m[r['id']] = folder
    return m


def extract_case_id(card_name):
    """Extrae el id del caso del nombre de la tarjeta, ej.
    'H1-01-EXTRANA-a — ...' -> 'H1-01-EXTRANA-a'; 'BORDE-06 — ...' -> 'BORDE-06'."""
    return card_name.split(' — ', 1)[0].strip()


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=None)
    args = ap.parse_args()

    case_map = build_case_folder_map()
    cards = get_all_cards()
    relevant = [c for c in cards if extract_case_id(c['name']) in case_map]
    if args.limit:
        relevant = relevant[:args.limit]
    print(f"Tarjetas a corregir: {len(relevant)} (de {len(cards)} totales en el tablero)")

    total_att = 0
    errors = []
    for i, card in enumerate(relevant, 1):
        case_id = extract_case_id(card['name'])
        folder = case_map[case_id]
        if not os.path.isdir(folder):
            errors.append((case_id, f"carpeta no encontrada: {folder}"))
            continue
        try:
            atts = get_attachments(card['id'])
            for att in atts:
                if not att['name'].endswith('.pdf'):
                    continue
                delete_attachment(card['id'], att['id'])
                time.sleep(0.2)
                local_path = os.path.join(folder, att['name'])
                if not os.path.exists(local_path):
                    errors.append((case_id, f"archivo local no encontrado: {local_path}"))
                    continue
                new_name = f"{case_id}_{att['name']}"
                upload_attachment(card['id'], local_path, new_name)
                total_att += 1
                time.sleep(0.35)
            print(f"  [OK] {i}/{len(relevant)} {case_id}: adjuntos renombrados")
        except Exception as e:
            errors.append((case_id, str(e)))
            print(f"  [ERROR] {case_id}: {e}")

    print(f"\n{'='*60}")
    print(f"TOTAL adjuntos re-subidos con nombre unico: {total_att}")
    if errors:
        print(f"ERRORES ({len(errors)}):")
        for cid, msg in errors:
            print(f"  - {cid}: {msg}")
    else:
        print("Sin errores.")


if __name__ == '__main__':
    main()
