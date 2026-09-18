# -*- coding: utf-8 -*-
"""
Sube a Trello (tablero real twFILESR) los 34 casos nuevos (20 H1 + 14 AES) de
las 5 categorias: perecederos vegetales, alimentos, quimicos, mercancias
peligrosas y cadena de frio farmaceutica. Cada tarjeta se crea en la lista H1
o AES existente, con los PDF de su carpeta como adjuntos, subidos desde el
principio con nombre unico prefijado por el id del caso (evita el problema de
nombres repetidos que hubo que corregir en el lote anterior).
"""
import os
import sys
import time
import requests

sys.path.insert(0, os.path.dirname(__file__))
from casos_categorias_especiales import RAW_H1_ESP, RAW_AES_ESP
import generar_categorias_especiales as gce  # noqa: F401  (registra los tipos de doc nuevos, no usado directo)
from casos_common import slugify

KEY = os.environ['TRELLO_KEY']
TOKEN = os.environ['TRELLO_TOKEN']
API = 'https://api.trello.com/1'
AUTH = {'key': KEY, 'token': TOKEN}

LABEL_PENDIENTE = '6aa16ee0acd898b409fff531'
LIST_H1 = '6aa16ecbc7406993d339f9d9'
LIST_AES = '6aa16ecd4823f0d01316c815'

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


def create_card(id_list, name, desc):
    return _req('POST', '/cards', params={
        'idList': id_list, 'name': name, 'desc': desc, 'pos': 'bottom',
        'idLabels': LABEL_PENDIENTE,
    })


def attach_file(id_card, filepath, new_name):
    with open(filepath, 'rb') as fh:
        files = {'file': (new_name, fh, 'application/pdf')}
        return _req('POST', f'/cards/{id_card}/attachments', files=files)


def read_manifest(folder):
    path = os.path.join(folder, '00_resumen_caso.txt')
    with open(path, encoding='utf-8') as f:
        return f.read()


def pdfs_in(folder):
    return sorted([f for f in os.listdir(folder) if f.endswith('.pdf')])


def folder_for(raw, group):
    return os.path.join(BASE_DIR, group, f"{raw['n']:02d}-{slugify(raw['title'])[:60]}")


def upload_case(id_list, raw, group):
    folder = folder_for(raw, group)
    desc = read_manifest(folder)
    title = f"{raw['id']} — {raw['title']}"
    card = create_card(id_list, title, desc)
    card_id = card['id']
    files = pdfs_in(folder)
    for fn in files:
        new_name = f"{raw['id']}_{fn}"
        attach_file(card_id, os.path.join(folder, fn), new_name)
        time.sleep(0.35)
    print(f"  [OK] {raw['id']}: tarjeta creada ({card_id}) + {len(files)} adjuntos -> {title[:70]}")
    return card_id


def main():
    total, errors = 0, []
    print(f"=== Subiendo {len(RAW_H1_ESP)} casos H1 (categorias especiales) ===")
    for raw in RAW_H1_ESP:
        try:
            upload_case(LIST_H1, raw, 'H1')
            total += 1
        except Exception as e:
            errors.append((raw['id'], str(e)))
            print(f"  [ERROR] {raw['id']}: {e}")

    print(f"\n=== Subiendo {len(RAW_AES_ESP)} casos AES (categorias especiales) ===")
    for raw in RAW_AES_ESP:
        try:
            upload_case(LIST_AES, raw, 'AES')
            total += 1
        except Exception as e:
            errors.append((raw['id'], str(e)))
            print(f"  [ERROR] {raw['id']}: {e}")

    print(f"\n{'='*60}")
    print(f"TOTAL tarjetas creadas: {total}")
    if errors:
        print(f"ERRORES ({len(errors)}):")
        for cid, msg in errors:
            print(f"  - {cid}: {msg}")
    else:
        print("Sin errores.")


if __name__ == '__main__':
    main()
