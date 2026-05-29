# Pantallas — Declaraciones

[← Pantallas](README.md) · [Índice general](../README.md)

> Todas las **presentaciones formales** ante AEAT y otras autoridades.

---

## Lista de declaraciones

**Ruta**: `/declarations`

### Para qué sirve

Listado unificado de todas las declaraciones del tenant (H1, H7, AES, ENS, NCTS, PUE) con su estado.

### Filtros

- **Tipo** (H1 / H7 / AES / ENS / NCTS / PUE).
- **Estado** (DRAFT / VALIDATED / SUBMITTED / ACCEPTED / REJECTED).
- **Operación**: Importación / Exportación.
- **Rango fechas**.

> **Nota técnica**: Antes la pantalla solo mostraba estados PROCESSING/DOCS_RECEIVED. Bug corregido — ahora muestra todos.

### Botones

- **+ Nueva H1**, **+ Nueva H7**, **+ Nueva AES**, etc. — atajos a los formularios.
- **Exportar** lista filtrada.

---

## H1 — DUA importación

**Ruta**: `/declarations/h1` y `/declarations/h1/new`

### Para qué sirve

Crear, listar y enviar declaraciones aduaneras de **importación estándar** (mercancía con valor superior a 150 €).

### Características clave

- 60 campos, 6 secciones (cabecera / declarante / importador / vendedor-comprador / transporte / mercancía / docs / tributos).
- Cálculo automático de tributos (A00 arancel, B00 IVA).
- Validación en tiempo real contra TARIC EU.
- Sugerencia IA de TARIC desde descripción del producto.
- Soporte para preferencias arancelarias (casilla 36 con códigos `100`/`200`/`300`).

> Detalle del flujo: [Declarar H1 importación](../03-flujos-diarios/declarar-h1-importacion.md).

---

## H7 — DUA bajo valor (e-commerce)

**Ruta**: `/declarations/h7` y `/declarations/h7/new`

### Para qué sirve

Crear, listar y enviar declaraciones simplificadas para envíos B2C con valor ≤ 150 €.

### Características clave

- 25 campos, formulario más corto que H1.
- Procesamiento masivo desde **manifiesto CSV** del courier (ver [Manifiesto CSV](../03-flujos-diarios/manifiesto-csv-masivo.md)).
- Códigos AEAT específicos: `F48` para H7 e-commerce.
- Preparado para el **Reg. (UE) 2026/382** (1/Jul/2026): supresión franquicia 150 € + derecho fijo 3 €/artículo.

> Detalle: [Declarar H7 e-commerce](../03-flujos-diarios/declarar-h7-ecommerce.md).

---

## AES — Automated Export System

**Ruta**: `/declarations/aes` y `/declarations/aes/new`

### Para qué sirve

Declaraciones de **exportación**. Sustituye al antiguo EXS desde Phase 5 NCTS.

### Características clave

- 50 campos similares a H1 pero sentido inverso.
- Genera el **EAD** (Export Accompanying Document) que viaja con la mercancía hasta la salida UE.
- Integración con AEAT para asignación de canal de exportación.
- Confirmación automática de salida UE (LUCI vigila el evento `Exit Confirmed`).

### Cuándo usarlo

- Cualquier exportación a país no UE.
- Reexportación tras tránsito o régimen especial.
- Ventas DDP donde tú asumes la exportación en nombre del cliente.

---

## ENS — Entry Summary Declaration

**Ruta**: `/declarations/ens` y `/declarations/ens/new`

![ENS lista](../img/ens.png)

### Para qué sirve

Declaración sumaria de entrada — anuncio de mercancía **antes** de su llegada al territorio aduanero UE. Sirve para análisis de riesgo previa.

### Hallazgo crítico de pruebas (4/May/2026)

> ⚠️ **Importante**: AEAT PRE solo acepta ENS **legacy CC315A para modo RAIL** (ferrocarril). Para los demás modos, AEAT responde con CC316A indicando que se deben presentar vía **ICS2**:
>
> - **ROAD**: «Las ENS de carretera se declaran solo en ICS2».
> - **AIR**: «Las ENS aéreas se declaran solo en ICS2 Release 2».
> - **SEA**: «Las ENS marítimas se declaran solo en ICS2 Release 3, salvo RO-RO».
> - **RAIL**: ✓ Sigue por ENS legacy CC315A.
>
> LUCI muestra un **Alert warning amarillo** en el Step 0 cuando intentas declarar un ENS de modo distinto a RAIL.

### Características

- 4 modos de transporte (RAIL / ROAD / AIR / SEA).
- Wizard de 4 pasos (transporte / carrier / consignment / goods).
- Generación de XML CC315A SOAP.
- Validación AEAT y respuesta CC328A (aceptación) / CC316A (redirección a ICS2) / rechazo.

### Caso real

**MRN ferrocarril aceptado**: `26ES009999Z0000677` — ENS-2026-000034, código AEAT CC328A, fecha 04/05/2026 05:29.

---

## NCTS — New Computerised Transit System

**Ruta**: `/declarations/ncts` y `/transit`

![Tránsitos](../img/transitos.png)

### Para qué sirve

Declaraciones de tránsito comunitario y TIR / ATA. Mercancía que circula por la UE sin pagar derechos hasta el destino.

### Características

NCTS Phase 5 (vigente desde 2024).

5 tipos:

| Tipo | Descripción |
|---|---|
| **T1** | Tránsito comunitario externo (mercancía no UE) — el más común |
| **T2** | Tránsito comunitario interno |
| **T2F** | Tránsito comunitario fiscal (Canarias, Ceuta, Melilla) — requiere garantía |
| **TIR** | Tránsito internacional con cuaderno TIR — requiere garantía + carnet |
| **ATA** | Cuaderno ATA — requiere carnet, sin garantía |

### Asistente IA TransitAIPanel

Botón violeta arriba a la derecha del detalle de un tránsito. 4 tabs:

- **Validar Ruta** — analiza la ruta, valida países y oficinas, calcula duración y checkpoints.
- **Predecir Incidencias** — estima riesgo de retrasos, controles, restricciones.
- **Sugerir Garantía** — calcula garantía mínima requerida.
- **Análisis Completo** — combinación holística.

### Caso real

**MRN tránsito real**: `26ES002801500473J5` (24/Abr/2026), canal verde, levante inmediato.

---

## PUE — Punto Único de Entrada

**Ruta**: `/pue`

![PUE](../img/pue.png)

### Para qué sirve

Solicitud de **controles paraduaneros**: SOIVRE (calidad comercial), ROHS/RAEE (electrónica), seguridad de productos, calidad ecológica.

### Características

- Manager con tabs por tipo de control (SOIVRE / ROHS_RAEE / Calidad Ecológica / Seguridad / Productos Sanitarios).
- Dialog de 6 pasos para crear nueva solicitud.
- **MRN lookup** auto-rellena datos desde una H1 ya enviada (ahorras tipear el importador, TARIC, descripción).
- Detail page con timeline del control.

### Estado actual

> ⚠️ AEAT PRE devuelve error 1230 «especificidad incorrecta» en algunos envíos. Pendiente respuesta de Jose Antonio (AEAT/DIT). En producción real funcionará.

### Subtipos

PUE-COM (comercial), PUE-ROHS, PUE-CAL (calidad), PUE-ECO (ecológica), PUE-SEG (seguridad).

---

## Atajos útiles

- Desde una H1 con MRN → botón **Crear PUE asociada** te abre el wizard PUE prerrellenado.
- Desde un expediente con docs validados → botón **Generar todas las declaraciones** crea H1+ENS+PUE en cadena (si aplican).
- Desde una AES con MRN → botón **Confirmar salida** vigila el evento Exit Confirmed UE.

---

[← Operaciones](operaciones.md) · [Siguiente: Cálculo y normativa →](calculo-normativa.md)
