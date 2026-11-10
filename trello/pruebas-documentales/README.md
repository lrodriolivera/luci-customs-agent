# Pruebas de usuario (UAT) con agente aduanero — casos, PDF y tablero de Trello

Tablero: **LUCI — Pruebas de usuario** (https://trello.com/b/twFILESR), 289 tarjetas:
241 casos documentales con PDF adjuntos (H1, AES, casos de borde TARIC) y 48 pruebas
funcionales de pantalla. La guía para la agente es `LUCI-Guia-Casos-Prueba-Agente-Aduanera.docx`
(no se versiona; se genera con los scripts de abajo).

## Qué hay en cada carpeta

- `H1/`, `AES/`, `CASOS-BORDE-TARIC/`: una carpeta por caso con `00_resumen_caso.txt`
  (manifiesto, versionado) y sus PDF (no versionados: `*.pdf` está en `.gitignore`).
- `scripts/`: generadores y utilidades. Los datos de los casos están en
  `casos_h1.py`, `casos_aes.py`, `casos_borde.py`, `casos_categorias_especiales.py`,
  `productos_*.py` y `pools.py` (empresas ficticias con NIF de formato válido).
  `notas_es.py` tiene la explicación en español de cada caso base; la nota en inglés
  impresa en la factura es la que emite el proveedor extranjero y se mantiene así.

## Regenerar todo

Requiere Python 3 con `reportlab` y `requests` (un venv vale) y Node con el paquete `docx`.

```bash
cd trello/pruebas-documentales/scripts
python generar_documentos.py              # 64 casos base
python generar_extranos.py                # 128 variantes de mercancía extraña
python generar_categorias_especiales.py   # 34 casos de categorías especiales
python generar_casos_borde.py             # 15 casos de borde TARIC
python extraer_datos_documento.py         # -> casos_documento_agente.json (241 casos)
node generar_documento_agente.js          # -> ../LUCI-Guia-Casos-Prueba-Agente-Aduanera.docx
```

`casos_funcionales.json` (las 48 pruebas de pantalla) se exporta del tablero: nombre,
prioridad, cómo llegar, condición y resultado esperado de cada tarjeta.

## Sincronizar el tablero de Trello

`actualizar_trello.py` sustituye los adjuntos de las 241 tarjetas documentales por los PDF
actuales (nombre `<ID>_<fichero>.pdf`) y actualiza la descripción de las 177 tarjetas cuya
descripción es el manifiesto (variantes, categorías especiales y casos de borde). Las 64
tarjetas base conservan su descripción funcional. Sube primero los nuevos y borra después
los antiguos, así ninguna tarjeta se queda sin documentos si se corta a mitad.

```bash
export TRELLO_KEY=... TRELLO_TOKEN=...     # o --credenciales <fichero>, fuera del repo
python scripts/actualizar_trello.py --dry-run
python scripts/actualizar_trello.py --solo H1-01   # piloto
python scripts/actualizar_trello.py
```

## Antes de la ronda con la agente

1. Confirmar que el backend apunta a la AEAT de **preproducción** (`AEAT_ENVIRONMENT`): 64
   tarjetas piden «Enviar a AEAT» con importadores ficticios.
2. Crear su usuario en LUCI, en una organización con el EORI guardado en Ajustes > Aduanas.
3. Entregarle la guía `.docx` y el acceso al tablero. El usuario y la contraseña van por
   un canal aparte, nunca en Trello ni en la guía.
