# Declarar una H7 de e-commerce

[← Flujos diarios](README.md) · [Índice](../README.md)

> La H7 es la versión simplificada del DUA para envíos B2C de **valor ≤ 150 €** (envíos express, paquetería, ventas online). Tiene menos campos y validaciones más ligeras que la H1.

---

## Cuándo usar H7 vs H1

| Característica | H7 (bajo valor) | H1 (estándar) |
|---|---|---|
| Valor mercancía | ≤ 150 € por envío | > 150 € o cualquiera |
| Carácter | B2C / e-commerce | B2B / cualquier |
| Régimen | 4000 simplificado | 4000 completo |
| Campos | ~25 | ~60 |
| Tiempo declaración | 5-8 min | 10-15 min |
| IOSS | Sí (vendedor con número IOSS valido cobra IVA online) | N/A |
| Derecho fijo (jul/2026) | 3 € por artículo (Reg. UE 2026/382) | N/A |

> **Importante 1/Jul/2026**: el Reglamento (UE) 2026/382 suprime la franquicia de 150 € e introduce un **derecho fijo de 3 € por artículo**. LUCI ya está preparado (flag `aplicarDerechoFijo2026` en `h7XmlBuilder.js`), no activado todavía. Te avisaremos.

---

## Antes de empezar

- Tu **EORI** dado de alta para H7 (no todos los EORI son válidos para H7 inicialmente).
- El **manifiesto** del courier o, si es uno solo, los datos del envío:
  - Tracking number / referencia
  - Destinatario completo (nombre, dirección, NIF si lo tiene)
  - Descripción + valor + peso por bulto
  - País origen
  - Tipo / código IOSS del vendedor (si aplica)

---

## Pasos

### Opción A — Un solo envío

1. Sidebar → **Declaraciones → H7** → botón **+ Nuevo**.
2. Rellena los **25 campos**:

| Sección | Campos |
|---|---|
| **Cabecera** | LRN · Aduana presentación |
| **Declarante** | EORI · NIF · Razón social |
| **Destinatario** | Nombre · NIF (si tiene) · Dirección · País |
| **Vendedor** | Nombre · IOSS si aplica |
| **Mercancía** | Descripción · TARIC · País origen · Peso · Cantidad · Valor · Moneda |
| **Transporte** | Modo · Tracking number |
| **Documentos** | Factura comercial número y fecha |
| **Canal** | LUCI sugiere; tú confirmas |

3. **Generar XML AEAT** → revisa.
4. **Firmar y enviar** → MRN en segundos si todo OK.

### Opción B — Manifiesto CSV masivo

Si el courier te envía un Excel/CSV con 30+ envíos, ve a [Manifiesto CSV masivo](manifiesto-csv-masivo.md). LUCI procesa todos en lote, **clasifica TARIC con IA** los que no lo traigan y crea las H7 una a una.

---

## Campos H7 críticos

| Campo | Valor | Notas |
|---|---|---|
| **TARIC** | 10 dígitos | LUCI sugiere si solo das descripción |
| **Valor aduanero** | EUR | Si la factura está en USD, LUCI convierte con tipo cambio AEAT |
| **País origen** | ISO-2 | Solo el del producto, no el del expedidor |
| **Código adicional** | `F48` para H7 e-commerce | Antes era `C07` — corregido en la última versión LUCI |
| **Marcas** | Marca + número | Obligatorio para H7. Si no tiene, poner `S/M N/N` |
| **Doc 7007** | Formato `YYYYMMDD-XXXXXXXX` | Solo si referencias DUA previo |
| **Ubicación mercancía** | `EEEEEE` (genérico aduana 2801) | No usar `LUCI01` u otros customs |
| **Transporte (casilla 25)** | `N703` (CMR carretera) o equivalente | Antes se usaba `N740` para todo — corregido |

---

## Resultado esperado

Tras pulsar **Enviar a AEAT**:

- Si todo OK: pantalla verde con `MRN: 26ESxxxxxxxxxxH7` + canal asignado (verde / naranja / rojo / amarillo).
- Levante automático en canal verde → puedes entregar al destinatario sin más trámite.

![H7 con MRN verde](../img/h7-mrn-verde.png)

---

## Si algo falla

| Código | Mensaje | Causa | Solución |
|---|---|---|---|
| `1180` | NIF declarante no autorizado | EORI no apto H7 (caso típico STRIX en pruebas) | LUCI hace fallback a MRN simulado en PRE. En producción real → solicitar alta a AEAT |
| `4405` | Código adicional erróneo | Usaste `C07` en vez de `F48` | LUCI ya genera `F48` por defecto |
| Marcas obligatorias | El campo está vacío | Añade marca + nº (`S/M N/N` si no tiene) |
| Doc 7007 mal formado | Formato distinto | Corregir a `YYYYMMDD-XXXXXXXX` |
| Ubicación no válida | `LUCI01` u otro custom | Cambiar a `EEEEEE` |

---

## Caso real

Ver [Caso real: bufanda lana — H7 manifiesto](../06-casos-reales.md#3-h7-bufanda-manifiesto).

---

## ¿Y la H7 con derecho fijo (Jul/2026)?

Cuando entre en vigor el Reg. (UE) 2026/382:

- LUCI activará automáticamente la flag `aplicarDerechoFijo2026`.
- Cada partida sumará **3 € fijos por artículo** además del IVA.
- IOSS cubre IVA pero **no** el derecho fijo: el destinatario o el vendedor (si DDP) lo paga.
- LUCI mostrará un aviso amarillo cuando crees H7 con valor < 150 € recordándote el cambio.

---

[← H1 importación](declarar-h1-importacion.md) · [Siguiente: Manifiesto CSV →](manifiesto-csv-masivo.md)
