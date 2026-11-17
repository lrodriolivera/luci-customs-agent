#!/usr/bin/env python3
"""Genera rohsRaee.json y soivreSeguridad.json a partir de los Excel oficiales.

Fuentes (Secretaria de Estado de Comercio, servicio de inspeccion SOIVRE),
enlazadas desde https://estacice.comercio.es (seccion de ayuda):
  - LISTA_TARIC_ROHS_RAEE_20_ABRIL_2026.xlsx (actualizada a 20/04/2026, con
    efecto desde el 18/05/2026), hojas "LISTA TARIC ROSRAE PUE ROHS" (se
    tramita por PUE ROHS) y "LISTA TARIC ROHS RAEE PUE COM" (control RoHS/RAEE
    adicional al de seguridad, tramitado por PUE COM). Antes: version de
    09/02/2023, solo hoja PUE ROHS.
  - Listado_productos_soivre_COM_comparado_con_taric_PUBLICADA.xlsx,
    hoja "5-TARIC - Cod. SOIVRE DEFINITIV"

La unica version oficial valida es la publicada en https://estacice.comercio.es y en
https://comercio.serviciosmin.gob.es/estacice-pue-sede/ : al actualizar las listas,
descargar alli los Excel y volver a ejecutar:

    python3 -I generar_listas.py <rohs_raee.xlsx> <soivre.xlsx>
    python3 -I generar_listas.py --rohs <rohs_raee.xlsx>      # solo RoHS/RAEE

Las filas tachadas del Excel son bajas (SOIVRE no borra la fila) y se omiten.

Solo usa la biblioteca estandar: lee el XML del .xlsx sin ejecutar nada del fichero.
"""
import hashlib
import html
import json
import os
import re
import sys
import zipfile


def _estilos_tachados(z):
    """Indices de estilo de celda (cellXfs) cuya fuente lleva tachado."""
    estilos = z.read('xl/styles.xml').decode('utf8')
    bloque_fuentes = re.search(r'<fonts[^>]*>(.*?)</fonts>', estilos, re.S).group(1)
    fuentes = re.findall(r'<font\b[^>]*?(?:/>|>.*?</font>)', bloque_fuentes, re.S)
    tachadas = {i for i, f in enumerate(fuentes) if '<strike' in f and '<strike val="0"' not in f}
    bloque_xf = re.search(r'<cellXfs[^>]*>(.*?)</cellXfs>', estilos, re.S).group(1)
    xfs = re.findall(r'<xf\b[^>]*?(?:/>|>.*?</xf>)', bloque_xf, re.S)
    return {i for i, xf in enumerate(xfs)
            if int(re.search(r'fontId="(\d+)"', xf).group(1)) in tachadas}


def leer_hojas(path):
    """Lee las hojas del .xlsx como listas de filas {columna: texto}.

    Cada fila lleva ademas '_tachada': True si la celda del codigo (columna B)
    esta tachada. SOIVRE da de baja las partidas tachandolas en rojo, sin
    borrar la fila (control de versiones del Excel de 16/01/2026 y 20/04/2026).
    """
    z = zipfile.ZipFile(path)
    cadenas, cadenas_tachadas = [], set()
    if 'xl/sharedStrings.xml' in z.namelist():
        for i, si in enumerate(re.findall(r'<si>(.*?)</si>', z.read('xl/sharedStrings.xml').decode('utf8'), re.S)):
            cadenas.append(html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', si, re.S))))
            if '<strike/>' in si:
                cadenas_tachadas.add(i)
    estilos_tachados = _estilos_tachados(z)
    destinos = {}
    for rel in re.findall(r'<Relationship [^>]*>', z.read('xl/_rels/workbook.xml.rels').decode('utf8')):
        destinos[re.search(r'Id="([^"]+)"', rel).group(1)] = re.search(r'Target="([^"]+)"', rel).group(1)
    hojas = {}
    for nombre, rid in re.findall(r'<sheet [^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"',
                                  z.read('xl/workbook.xml').decode('utf8')):
        fichero = 'xl/' + destinos[rid].lstrip('/').replace('xl/', '', 1)
        filas = []
        for fila_xml in re.findall(r'<row [^>]*>(.*?)</row>', z.read(fichero).decode('utf8'), re.S):
            fila = {'_tachada': False}
            for col, attrs, valor in re.findall(
                    r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(?:<f>.*?</f>)?(?:<v>(.*?)</v>)?)', fila_xml, re.S):
                if not valor:
                    continue
                es_cadena = 't="s"' in attrs
                fila[col] = (cadenas[int(valor)] if es_cadena else html.unescape(valor)).strip()
                if col == 'B':
                    estilo = re.search(r' s="(\d+)"', attrs)
                    fila['_tachada'] = bool((estilo and int(estilo.group(1)) in estilos_tachados)
                                            or (es_cadena and int(valor) in cadenas_tachadas))
            filas.append(fila)
        hojas[html.unescape(nombre)] = filas
    return hojas


def es_si(valor):
    return str(valor or '').strip().upper().replace('Í', 'I') == 'SI'


def limpiar(texto):
    return re.sub(r'\s+', ' ', str(texto or '').replace('\xa0', ' ')).strip()


URL_AYUDA_ESTACICE = 'https://comerciomig2.serviciosmin.gob.es/WEBEstacice/ayuda/'
MESES = {m: i + 1 for i, m in enumerate((
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO',
    'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'))}


def _fecha(texto, patron):
    """Fecha ISO de la primera coincidencia 'D DE MES DE AAAA' tras el patron, o None."""
    m = re.search(patron + r'\s+(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})', texto.upper())
    if not m or m.group(2) not in MESES:
        return None
    return '%s-%02d-%02d' % (m.group(3), MESES[m.group(2)], int(m.group(1)))


def _prefijo(codigo):
    """Prefijo TARIC (4, 6, 8 o 10 digitos) de '8516 29 91', 'Ex. 6101', '9613.10'..."""
    if not re.match(r'\s*(ex\.?\s*)?\d', codigo or '', re.I):
        return None  # cabeceras como "TARIC 2026"
    digitos = re.sub(r'\D', '', codigo)
    return digitos if len(digitos) in (4, 6, 8, 10) else None


def _entradas(filas, pue, col_nota, col_raee, col_rohs):
    entradas = []
    for fila in filas:
        prefijo = _prefijo(fila.get('B'))
        if not prefijo or fila['_tachada']:
            continue  # cabeceras, secciones/capitulos sin codigo y bajas tachadas
        entrada = {
            'prefijo': prefijo,
            'descripcion': limpiar(fila.get('D')).lstrip('- ').strip(),
            'raee': es_si(fila.get(col_raee)),
            'rohs': es_si(fila.get(col_rohs)),
            'pue': pue,
        }
        nota = limpiar(fila.get(col_nota))
        if nota:
            entrada['nota'] = nota
        entradas.append(entrada)
    return entradas


def generar_rohs_raee(path):
    hojas = leer_hojas(path)
    hoja_rohs = next(n for n in hojas if n.startswith('LISTA TARIC') and not n.endswith('COM'))
    hoja_com = next((n for n in hojas if n.startswith('LISTA TARIC') and n.endswith('PUE COM')), None)
    entradas = _entradas(hojas[hoja_rohs], 'ROHS', 'E', 'F', 'G')
    if hoja_com:
        entradas += _entradas(hojas[hoja_com], 'COM', 'A', 'E', 'F')
    vistos = {}
    for e in entradas:
        if e['prefijo'] in vistos:
            sys.exit('Prefijo repetido en la lista: %s (%s y %s)' % (e['prefijo'], vistos[e['prefijo']], e['pue']))
        vistos[e['prefijo']] = e['pue']
    versiones = ' '.join(f.get('A', '') for f in hojas.get('Control de versiones', []))
    version = _fecha(versiones, r'ACTUALIZADA A')
    if not version:
        sys.exit('No se encuentra "ACTUALIZADA A <fecha>" en la hoja "Control de versiones"')
    with open(path, 'rb') as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()
    return {
        'fuente': 'LISTA TARIC ROHS RAEE PUE (Secretaria de Estado de Comercio, SOIVRE): hojas PUE ROHS y PUE COM',
        'version': version,
        'vigenteDesde': _fecha(versiones, r'CON EFECTO DESDE EL') or version,
        'oficial': 'https://estacice.comercio.es',
        'documento': URL_AYUDA_ESTACICE + os.path.basename(path),
        'sha256': sha256,
        'entradas': sorted(entradas, key=lambda e: e['prefijo']),
    }


def generar_soivre(path):
    filas = leer_hojas(path)['5-TARIC - Cod. SOIVRE DEFINITIV']
    por_taric = {}
    for fila in filas[1:]:
        taric = re.sub(r'\D', '', fila.get('C', ''))
        if not re.fullmatch(r'\d{10}', taric):
            continue  # codigos SOIVRE adicionales de la misma partida, sin TARIC propio
        por_taric.setdefault(taric, {
            'taric': taric,
            'grupo': limpiar(fila.get('E')),
            'descripcion': limpiar(fila.get('G') or fila.get('D')),
        })
    return {
        'fuente': 'Listado de productos SOIVRE comparado con TARIC, pestana 5 (anexo RD 330/2008)',
        'version': 'publicada con los productos de la Orden PJC/161/2026',
        'oficial': 'https://comercio.serviciosmin.gob.es/estacice-pue-sede/',
        'entradas': [por_taric[k] for k in sorted(por_taric)],
    }


def _escribir(nombre, datos):
    destino = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(destino, nombre), 'w', encoding='utf8') as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(nombre, len(datos['entradas']), 'entradas')


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--rohs':
        _escribir('rohsRaee.json', generar_rohs_raee(sys.argv[2]))
    elif len(sys.argv) == 3:
        _escribir('rohsRaee.json', generar_rohs_raee(sys.argv[1]))
        _escribir('soivreSeguridad.json', generar_soivre(sys.argv[2]))
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
