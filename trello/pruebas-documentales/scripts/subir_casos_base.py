# -*- coding: utf-8 -*-
"""
Sube a Trello los PDF de los 64 casos base (43 H1 + 21 AES) que ya existian
en el tablero real ANTES de esta sesion (tarjetas con formato 'NN. Titulo...').
Esas tarjetas nunca tuvieron adjuntos: solo se habian generado los documentos
en disco. Cada PDF se sube con nombre unico prefijado por el id del caso
(ej. 'H1-01_01_factura_comercial.pdf') para evitar el mismo problema de
nombres repetidos que se corrigio en los 143 casos nuevos.
"""
import os
import re
import sys
import time
import requests

KEY = os.environ['TRELLO_KEY']
TOKEN = os.environ['TRELLO_TOKEN']
API = 'https://api.trello.com/1'
AUTH = {'key': KEY, 'token': TOKEN}

LIST_H1 = '6aa16ecbc7406993d339f9d9'
LIST_AES = '6aa16ecd4823f0d01316c815'

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def _req(method, path, retries=5, **kwargs):
    url = f"{API}{path}"
    params = kwargs.pop('params', {})
    params.update(AUTH)
    for attempt in range(retries):
        r = requests.request(method, url, params=params, timeout=30, **kwargs)
        if r.status_code == 429:
            time.sleep(3 * (attempt + 1))
            continue
        if r.status_code >= 400:
            raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
        return r.json() if r.text else {}
    raise RuntimeError(f"{method} {path}: agotados los reintentos tras 429")


def get_list_cards(id_list):
    return _req('GET', f'/lists/{id_list}/cards', params={'fields': 'name'})


def upload_attachment(card_id, filepath, new_name):
    with open(filepath, 'rb') as fh:
        files = {'file': (new_name, fh, 'application/pdf')}
        return _req('POST', f'/cards/{card_id}/attachments', files=files)


def card_number(name):
    m = re.match(r'^(\d+)\.', name.strip())
    return int(m.group(1)) if m else None


def local_folder(group, n):
    root = os.path.join(BASE_DIR, group)
    for entry in os.listdir(root):
        if entry.startswith(f"{n:02d}-"):
            return os.path.join(root, entry)
    return None


def root_pdfs(folder):
    return sorted(f for f in os.listdir(folder)
                  if f.endswith('.pdf') and os.path.isfile(os.path.join(folder, f)))


def process_group(group, id_list, case_id_prefix):
    cards = get_list_cards(id_list)
    originales = [c for c in cards if 'extrana' not in c['name'].lower()]
    total, errors = 0, []
    for c in sorted(originales, key=lambda x: card_number(x['name']) or 0):
        n = card_number(c['name'])
        if n is None:
            errors.append((c['name'], 'no se pudo extraer numero de tarjeta'))
            continue
        folder = local_folder(group, n)
        if not folder:
            errors.append((c['name'], f'carpeta local no encontrada para n={n}'))
            continue
        case_id = f"{case_id_prefix}-{n:02d}"
        pdfs = root_pdfs(folder)
        if not pdfs:
            errors.append((c['name'], f'sin PDFs en {folder}'))
            continue
        try:
            for fn in pdfs:
                new_name = f"{case_id}_{fn}"
                upload_attachment(c['id'], os.path.join(folder, fn), new_name)
                time.sleep(0.35)
            print(f"  [OK] {case_id}: {len(pdfs)} adjuntos -> {c['name'][:60]}")
            total += len(pdfs)
        except Exception as e:
            errors.append((c['name'], str(e)))
            print(f"  [ERROR] {case_id}: {e}")
    return total, errors


def main():
    total_all, errors_all = 0, []
    print("=== Casos base H1 (43) ===")
    t, e = process_group('H1', LIST_H1, 'H1')
    total_all += t
    errors_all += e
    print("\n=== Casos base AES (21) ===")
    t, e = process_group('AES', LIST_AES, 'AES')
    total_all += t
    errors_all += e

    print(f"\n{'='*60}")
    print(f"TOTAL adjuntos subidos: {total_all}")
    if errors_all:
        print(f"ERRORES ({len(errors_all)}):")
        for name, msg in errors_all:
            print(f"  - {name}: {msg}")
    else:
        print("Sin errores.")


if __name__ == '__main__':
    main()
