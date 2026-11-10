# -*- coding: utf-8 -*-
"""
Sincroniza el tablero real de Trello con los documentos regenerados en disco.

Para cada carpeta de caso con 00_resumen_caso.txt (H1/, AES/, CASOS-BORDE-TARIC/ y
sus subcarpetas de mercancia extrana) localiza la tarjeta cuyo nombre empieza por
el id del caso ("H1-01 — ...", "H1-01-EXTRANA-a — ...", "BORDE-01 — ...") y:
  - sustituye los adjuntos por los PDF actuales, con el nombre unico
    "<ID>_<fichero>.pdf" (misma convencion que subir_casos_base.py);
  - en las tarjetas cuya descripcion es el manifiesto (variantes, categorias
    especiales y casos de borde) actualiza la descripcion con el manifiesto nuevo;
    las 64 tarjetas base conservan su descripcion funcional (Como llegar, etc.).

Credenciales: TRELLO_KEY y TRELLO_TOKEN en el entorno (o --credenciales <fichero>
con el token ATT... y la clave de 32 hex en lineas sueltas). No se imprimen nunca.

Uso:
  python actualizar_trello.py --dry-run          # solo muestra el plan
  python actualizar_trello.py                    # ejecuta
  python actualizar_trello.py --solo H1-01       # una tarjeta (piloto)
"""
import argparse
import os
import re
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(__file__))
from notas_es import NOTAS_ES  # noqa: E402

BOARD = '6aa16c4ca4298f7b15f6b171'
API = 'https://api.trello.com/1'
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
GRUPOS = ['H1', 'AES', 'CASOS-BORDE-TARIC']


def credenciales(ruta):
    key, token = os.environ.get('TRELLO_KEY'), os.environ.get('TRELLO_TOKEN')
    if ruta:
        lineas = [l.strip() for l in open(ruta, encoding='utf-8', errors='replace').read().splitlines()]
        token = next(l for l in lineas if l.startswith('ATT') and len(l) > 60)
        key = next(l for l in lineas if re.fullmatch(r'[0-9a-f]{32}', l))
    if not key or not token:
        sys.exit('Faltan TRELLO_KEY/TRELLO_TOKEN (o --credenciales)')
    return {'key': key, 'token': token}


class Trello:
    def __init__(self, auth):
        self.auth = auth
        self.s = requests.Session()

    def req(self, method, path, retries=5, **kw):
        for intento in range(retries):
            r = self.s.request(method, f'{API}{path}', params={**self.auth, **kw.pop('params', {})}, timeout=120, **kw)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(3 * (intento + 1))
                continue
            r.raise_for_status()
            return r.json() if r.text else None
        raise RuntimeError(f'{method} {path}: agotados los reintentos ({r.status_code})')

    def tarjetas(self):
        return self.req('GET', f'/boards/{BOARD}/cards', params={'filter': 'open', 'fields': 'name,desc',
                        'attachments': 'true', 'attachment_fields': 'name'})

    def borrar_adjunto(self, id_card, id_att):
        self.req('DELETE', f'/cards/{id_card}/attachments/{id_att}')

    def subir(self, id_card, ruta, nombre):
        with open(ruta, 'rb') as f:
            self.req('POST', f'/cards/{id_card}/attachments', files={'file': (nombre, f, 'application/pdf')},
                     data={'name': nombre})

    def descripcion(self, id_card, desc):
        self.req('PUT', f'/cards/{id_card}', data={'desc': desc})


def casos_en_disco():
    """[(id, carpeta, manifiesto, [pdf...])] para toda carpeta con manifiesto."""
    casos = []
    for grupo in GRUPOS:
        for raiz, _dirs, files in os.walk(os.path.join(BASE_DIR, grupo)):
            if '00_resumen_caso.txt' not in files:
                continue
            manifiesto = open(os.path.join(raiz, '00_resumen_caso.txt'), encoding='utf-8').read()
            m = re.match(r'CASO (\S+) —', manifiesto)
            if not m:
                raise RuntimeError(f'manifiesto sin id: {raiz}')
            pdfs = sorted(f for f in files if f.lower().endswith('.pdf'))
            casos.append((m.group(1), raiz, manifiesto, pdfs))
    return casos


def es_tarjeta_base(case_id):
    """Las 64 tarjetas base (H1-01..43, AES-01..21) tienen descripcion funcional propia, no el
    manifiesto. Las categorias especiales (H1-44.., AES-22..) si llevan el manifiesto."""
    return case_id in NOTAS_ES


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--solo', help='id de caso (p. ej. H1-01) para un piloto')
    ap.add_argument('--credenciales', help='fichero con token y clave (no se imprime)')
    ap.add_argument('--pausa', type=float, default=0.35)
    args = ap.parse_args()

    t = Trello(credenciales(args.credenciales))
    tarjetas = t.tarjetas()
    por_id = {}
    for c in tarjetas:
        m = re.match(r'^(\S+) — ', c['name'])
        if m:
            por_id.setdefault(m.group(1), []).append(c)

    casos = casos_en_disco()
    if args.solo:
        casos = [c for c in casos if c[0] == args.solo]
    sin_tarjeta = [cid for cid, *_ in casos if cid not in por_id]
    repetidas = [cid for cid, *_ in casos if len(por_id.get(cid, [])) > 1]
    if sin_tarjeta or repetidas:
        sys.exit(f'casos sin tarjeta: {sin_tarjeta[:5]} | ids con varias tarjetas: {repetidas[:5]}')

    n_adj = sum(len(p) for *_, p in casos)
    n_desc = sum(1 for cid, *_ in casos if not es_tarjeta_base(cid))
    print(f'casos en disco: {len(casos)} | PDF a subir: {n_adj} | descripciones a actualizar: {n_desc}')
    if args.dry_run:
        for cid, carpeta, _m, pdfs in casos[:5]:
            print(f'  {cid}: {len(pdfs)} PDF, adjuntos actuales {len(por_id[cid][0]["attachments"])}, '
                  f'{"desc=manifiesto" if not es_tarjeta_base(cid) else "desc sin cambios"}')
        return

    hechos = 0
    for cid, carpeta, manifiesto, pdfs in casos:
        card = por_id[cid][0]
        # Primero se suben los nuevos y luego se borran los viejos: si falla a mitad,
        # la tarjeta nunca se queda sin documentos.
        viejos = [a for a in card['attachments']]
        for fn in pdfs:
            t.subir(card['id'], os.path.join(carpeta, fn), f'{cid}_{fn}')
            time.sleep(args.pausa)
        for a in viejos:
            t.borrar_adjunto(card['id'], a['id'])
            time.sleep(args.pausa / 2)
        if not es_tarjeta_base(cid):
            t.descripcion(card['id'], manifiesto)
            time.sleep(args.pausa / 2)
        hechos += 1
        print(f'  [OK] {cid}: {len(pdfs)} PDF subidos, {len(viejos)} antiguos borrados'
              f'{", descripcion actualizada" if not es_tarjeta_base(cid) else ""}', flush=True)
    print(f'TOTAL: {hechos} tarjetas sincronizadas')


if __name__ == '__main__':
    main()
