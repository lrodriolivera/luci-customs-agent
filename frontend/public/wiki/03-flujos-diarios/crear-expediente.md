# Crear un expediente

[← Flujos diarios](README.md) · [Índice](../README.md)

> El expediente es la «carpeta» donde LUCI guarda todo lo de una operación: documentos, declaraciones, comunicaciones con AEAT, garantías afectadas. Antes de declarar nada, crea el expediente.

---

## Antes de empezar

Necesitas a mano:

- Datos del **importador** o **exportador** (NIF, EORI, razón social, dirección).
- Tipo de operación (importación / exportación).
- Aduana donde se va a presentar (ej. Madrid Barajas → 2801).
- Una **referencia** propia (factura del cliente, número de expediente interno…).
- Si tienes ya: TARIC, valor declarado, transportista. Si no, los rellenas más tarde.

---

## Pasos

### 1. Ir a Expedientes

Sidebar izquierdo → **Operaciones → Expedientes** (o pulsa el botón **Nueva Expedición** del Dashboard).

![Expedientes lista](../img/expedientes-lista.png)

### 2. Pulsar «Nueva Expedición»

Botón azul arriba a la derecha. Se abre un wizard de **3 pasos**.

### 3. Paso 1 — Tipo + Cliente

11 campos:

| Campo | Qué meter | Obligatorio |
|---|---|---|
| **Tipo operación** | Importación / Exportación | ✓ |
| **Aduana** | Código de 4-6 dígitos (ej. `2801`) | ✓ |
| **Referencia interna** | Tu número de expediente | ✓ |
| **NIF importador** | El de quien recibe la mercancía | ✓ |
| **EORI importador** | `ES + NIF` normalmente | ✓ |
| **Razón social** | Nombre legal de la empresa | ✓ |
| **Dirección importador** | Calle, ciudad, CP, país | ✓ |
| **NIF exportador** | El de quien envía (si es exportación, este será el cliente) | Recomendado |
| **País origen** | ISO-2 (ej. `CN`, `TR`, `US`) | ✓ |
| **País destino** | ISO-2 | ✓ |
| **Modo transporte** | Aire / Mar / Carretera / Ferrocarril | ✓ |

> **Truco**: si el importador ya existe en tu tenant, escribe los primeros 3 caracteres del NIF y aparecerá la lista filtrada con autocomplete. LUCI rellena los datos.

Pulsa **Siguiente**.

### 4. Paso 2 — Mercancías

7 campos por cada bulto. Puedes añadir varios con el botón **+ Añadir mercancía**.

| Campo | Qué meter |
|---|---|
| **Descripción** | Texto libre («colchón de espuma de poliuretano para hotel») |
| **Código TARIC** | 10 dígitos. Si no lo sabes, pulsa el botón 🪄 «Sugerir con IA» — LUCI te propone el código más probable basándose en la descripción |
| **País origen mercancía** | Puede ser distinto del país emisor (ej. fabricado en Vietnam, enviado desde China) |
| **Peso bruto / neto** | En kg, sin unidades. LUCI valida `bruto ≥ neto` |
| **Cantidad** | Número de unidades |
| **Valor aduanero** | EUR. Es el valor sobre el que se calculan los derechos (típicamente factura comercial + flete + seguro hasta UE) |
| **Unidades suplementarias** | Solo si el TARIC lo exige (ej. m², litros, pares). LUCI te avisa si faltan |

> 🪄 **IA**: si tienes la descripción pero no el TARIC, pulsa el icono varita y LUCI te propone los 3 códigos más probables con su capítulo y duty. Aceptar o seguir buscando.

Pulsa **Siguiente**.

### 5. Paso 3 — Transporte

3 campos:

| Campo | Qué meter |
|---|---|
| **Identificación transporte** | Matrícula camión / nº vuelo / nombre buque + nº viaje. Máx **17 caracteres** (la AEAT corta en la casilla 18 si te pasas) |
| **Nacionalidad transporte** | ISO-2 |
| **Lugar carga** | Código UN/LOCODE (ej. `CNSHA` Shanghai) |

Pulsa **Crear expediente**.

### 6. Confirmación

LUCI te lleva a la página de detalle del expediente recién creado. Verás:

- Su número interno (ej. `EXP-2026-674017EF`).
- Estado inicial: `DRAFT` (borrador).
- 4-5 pestañas: General · Documentos · Declaraciones · Comunicaciones · Timeline.

Ya puedes:
- Subir documentos (factura, packing list, certificado origen).
- Crear la declaración H1 / H7 / AES desde el botón **+ Nueva declaración**.

---

## Si algo falla

| Problema | Causa probable | Solución |
|---|---|---|
| El botón **Nueva Expedición** está deshabilitado | Tu rol es `viewer` | Pide a un admin que te suba a `agent` o superior |
| El TARIC que sugiere LUCI te parece raro | Descripción ambigua | Refina la descripción (material, uso, dimensiones) y vuelve a sugerir |
| AEAT rechaza luego «casilla 18 longitud > 17» | Pasaste el límite | Edita el campo «Identificación transporte» y recórtalo |
| El EORI del importador no es válido | El operador no está dado de alta | Pide al importador que lo solicite a AEAT antes de continuar |
| `unidades suplementarias` obligatorias y vacías | El TARIC del producto exige medida adicional | Consulta TARIC EU oficial (m², kg netos por par, etc.) y rellena |

---

## Siguiente paso

Con el expediente creado, normalmente vas a:

- **Subir docs** y validarlos → pestaña *Documentos*. Cada doc puede pasar a `VALIDATED` antes de poder declarar.
- **Generar la declaración** → [Declarar H1](declarar-h1-importacion.md) o [Declarar H7](declarar-h7-ecommerce.md).
- **Enviar a AEAT** → [Enviar a AEAT y MRN](enviar-aeat-y-mrn.md).

---

[← Flujos diarios](README.md) · [Índice general](../README.md)
