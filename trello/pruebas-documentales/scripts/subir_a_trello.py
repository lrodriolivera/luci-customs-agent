# -*- coding: utf-8 -*-
"""
Sube a Trello (tablero real twFILESR) las tarjetas nuevas generadas:
  - 15 casos de borde de clasificacion TARIC -> lista nueva
  - 128 variantes "mercancia extrana" -> lista H1 o AES existente segun el caso padre
Cada tarjeta incluye la descripcion (leida del manifest 00_resumen_caso.txt real),
la etiqueta "Estado: Pendiente", y los PDF de su carpeta como adjuntos.
"""
import os
import sys
import time
import requests

KEY = os.environ['TRELLO_KEY']
TOKEN = os.environ['TRELLO_TOKEN']
BOARD = '6aa16c4ca4298f7b15f6b171'  # id real del tablero (twFILESR es el shortLink, no valido para /lists)
API = 'https://api.trello.com/1'

LABEL_PENDIENTE = '6aa16ee0acd898b409fff531'
LIST_H1 = '6aa16ecbc7406993d339f9d9'
LIST_AES = '6aa16ecd4823f0d01316c815'

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

AUTH = {'key': KEY, 'token': TOKEN}


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


def create_list(name):
    return _req('POST', '/lists', params={'name': name, 'idBoard': BOARD, 'pos': 'bottom'})


def create_card(id_list, name, desc):
    return _req('POST', '/cards', params={
        'idList': id_list, 'name': name, 'desc': desc, 'pos': 'bottom',
        'idLabels': LABEL_PENDIENTE,
    })


def attach_file(id_card, filepath):
    with open(filepath, 'rb') as fh:
        files = {'file': (os.path.basename(filepath), fh, 'application/pdf')}
        return _req('POST', f'/cards/{id_card}/attachments', files=files)


def read_manifest(folder):
    path = os.path.join(folder, '00_resumen_caso.txt')
    if not os.path.exists(path):
        return "(sin resumen disponible)"
    with open(path, encoding='utf-8') as f:
        return f.read()


def pdfs_in(folder):
    return sorted([f for f in os.listdir(folder) if f.endswith('.pdf')])


def upload_case(id_list, title, folder, tag):
    desc = read_manifest(folder)
    card = create_card(id_list, title, desc)
    card_id = card['id']
    files = pdfs_in(folder)
    for fn in files:
        attach_file(card_id, os.path.join(folder, fn))
        time.sleep(0.35)
    print(f"  [OK] {tag}: tarjeta creada ({card_id}) + {len(files)} adjuntos -> {title[:70]}")
    return card_id


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', choices=['borde', 'extranas', 'all'], default='all')
    ap.add_argument('--start', type=int, default=0, help='saltar los primeros N items (para reanudar)')
    ap.add_argument('--limit', type=int, default=None, help='procesar como maximo N items (para pruebas piloto)')
    ap.add_argument('--list-id-borde', default=None, help='reusar una lista de borde ya creada en vez de crear otra')
    args = ap.parse_args()

    total = 0
    errors = []

    if args.only in ('borde', 'all'):
        if args.list_id_borde:
            id_lista_borde = args.list_id_borde
            print(f"Reusando lista de borde existente: {id_lista_borde}")
        else:
            print("=== Creando lista 'Clasificacion TARIC - Casos de Borde' ===")
            nueva_lista = create_list('Clasificación TARIC — Casos de Borde')
            id_lista_borde = nueva_lista['id']
            print(f"Lista creada: {id_lista_borde}")

        borde_root = os.path.join(BASE_DIR, 'CASOS-BORDE-TARIC')
        subfolders = sorted(os.listdir(borde_root))
        processed = 0
        for i, sf in enumerate(subfolders):
            if i < args.start:
                continue
            if args.limit is not None and processed >= args.limit:
                break
            folder = os.path.join(borde_root, sf)
            if not os.path.isdir(folder):
                continue
            processed += 1
            # Extraer titulo real de la primera linea del manifest
            manifest = read_manifest(folder)
            first_line = manifest.split('\n', 1)[0]
            title = first_line.replace('CASO ', '').strip()
            try:
                upload_case(id_lista_borde, title, folder, f"BORDE {i+1}/{len(subfolders)}")
                total += 1
            except Exception as e:
                errors.append((sf, str(e)))
                print(f"  [ERROR] {sf}: {e}")

    if args.only in ('extranas', 'all'):
        print("\n=== Subiendo variantes 'mercancia extrana' (H1/AES existentes) ===")
        for group, id_list in (('H1', LIST_H1), ('AES', LIST_AES)):
            group_root = os.path.join(BASE_DIR, group)
            case_folders = sorted(os.listdir(group_root))
            idx_global = 0
            for cf in case_folders:
                case_folder = os.path.join(group_root, cf)
                if not os.path.isdir(case_folder):
                    continue
                for letter in ('a', 'b'):
                    sub = os.path.join(case_folder, f'mercancia-extrana-{letter}')
                    if not os.path.isdir(sub):
                        continue
                    idx_global += 1
                    if idx_global <= args.start and args.only == 'extranas':
                        continue
                    manifest = read_manifest(sub)
                    first_line = manifest.split('\n', 1)[0]
                    title = first_line.replace('CASO ', '').strip()
                    try:
                        upload_case(id_list, title, sub, f"{group} extrana {idx_global}")
                        total += 1
                    except Exception as e:
                        errors.append((sub, str(e)))
                        print(f"  [ERROR] {sub}: {e}")

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
