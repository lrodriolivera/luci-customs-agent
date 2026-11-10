#!/usr/bin/env python3
"""Genera rohsRaee.json y soivreSeguridad.json a partir de los Excel oficiales.

Fuentes (Secretaria de Estado de Comercio, servicio de inspeccion SOIVRE):
  - LISTA_TARIC_ROHS_RAEE_10_FEBRERO_2023_publicado.xlsx, hoja "LISTA TARIC ROHS RAEE PUE"
  - Listado_productos_soivre_COM_comparado_con_taric_PUBLICADA.xlsx,
    hoja "5-TARIC - Cod. SOIVRE DEFINITIV"

La unica version oficial valida es la publicada en https://estacice.comercio.es y en
https://comercio.serviciosmin.gob.es/estacice-pue-sede/ : al actualizar las listas,
descargar alli los Excel y volver a ejecutar:

    python3 generar_listas.py <rohs_raee.xlsx> <soivre.xlsx>

Solo usa la biblioteca estandar: lee el XML del .xlsx sin ejecutar nada del fichero.
"""
import html
import json
import os
import re
import sys
import zipfile


def leer_hojas(path):
    z = zipfile.ZipFile(path)
    cadenas = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in re.findall(r'<si>(.*?)</si>', z.read('xl/sharedStrings.xml').decode('utf8'), re.S):
            cadenas.append(html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', si, re.S))))
    libro = z.read('xl/workbook.xml').decode('utf8')
    nombres = re.findall(r'<sheet [^>]*name="([^"]+)"', libro)
    ficheros = sorted((n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml', n)),
                      key=lambda n: int(re.search(r'(\d+)\.xml', n).group(1)))
    hojas = {}
    for nombre, fichero in zip(nombres, ficheros):
        filas = []
        for fila_xml in re.findall(r'<row [^>]*>(.*?)</row>', z.read(fichero).decode('utf8'), re.S):
            fila = {}
            for col, attrs, valor in re.findall(
                    r'<c r="([A-Z]+)\d+"([^>]*)>(?:<f>.*?</f>)?(?:<v>(.*?)</v>)?', fila_xml, re.S):
                if valor != '':
                    fila[col] = (cadenas[int(valor)] if 't="s"' in attrs else html.unescape(valor)).strip()
            filas.append(fila)
        hojas[html.unescape(nombre)] = filas
    return hojas


def es_si(valor):
    return str(valor or '').strip().upper().replace('Í', 'I') == 'SI'


def limpiar(texto):
    return re.sub(r'\s+', ' ', str(texto or '').replace('\xa0', ' ')).strip()


def generar_rohs_raee(path):
    filas = leer_hojas(path)['LISTA TARIC ROHS RAEE PUE']
    entradas = []
    for fila in filas:
        prefijo = re.sub(r'\D', '', fila.get('B', ''))
        if not re.fullmatch(r'\d{6,10}', prefijo):
            continue  # cabeceras y filas de seccion/capitulo sin codigo
        entrada = {
            'prefijo': prefijo,
            'descripcion': limpiar(fila.get('D')).lstrip('- ').strip(),
            'raee': es_si(fila.get('F')),
            'rohs': es_si(fila.get('G')),
        }
        nota = limpiar(fila.get('E'))
        if nota:
            entrada['nota'] = nota
        entradas.append(entrada)
    return {
        'fuente': 'LISTA TARIC ROHS RAEE PUE (Secretaria de Estado de Comercio, SOIVRE)',
        'version': '2023-02-09',
        'oficial': 'https://estacice.comercio.es',
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


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    destino = os.path.dirname(os.path.abspath(__file__))
    for nombre, datos in (('rohsRaee.json', generar_rohs_raee(sys.argv[1])),
                          ('soivreSeguridad.json', generar_soivre(sys.argv[2]))):
        with open(os.path.join(destino, nombre), 'w', encoding='utf8') as f:
            json.dump(datos, f, ensure_ascii=False, indent=1)
            f.write('\n')
        print(nombre, len(datos['entradas']), 'entradas')


if __name__ == '__main__':
    main()
