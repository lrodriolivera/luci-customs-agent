# Declarar una H1 de importación

[← Flujos diarios](README.md) · [Índice](../README.md)

> La H1 es el DUA estándar de importación: cualquier mercancía con valor superior a 150 € o sometida a control especial. Es la declaración más común.

---

## Antes de empezar

- Tener el [expediente creado](crear-expediente.md) y al menos los 4 documentos básicos validados:
  - Factura comercial
  - Packing list
  - Conocimiento de embarque (BL / AWB / CMR)
  - Certificado de origen (si aplica preferencia)
- Conocer:
  - **TARIC** correcto (la sugerencia IA te ayuda).
  - **Valor aduanero** (factura + flete + seguro hasta llegada UE).
  - **Régimen** que solicitas (4000 = importación a libre práctica + consumo es lo más común).
- Tener **certificado FNMT del declarante** importado en *AEAT e Integraciones → Certificados AEAT*.

---

## Pasos

### Opción A — Desde el expediente (recomendado)

1. Abre el expediente en **Operaciones → Expedientes** y entra en su detalle.
2. Pestaña **Declaraciones** → botón **+ Nueva declaración H1**.
3. LUCI rellena automáticamente todos los campos comunes (importador, mercancías, transporte).
4. Revisa y completa los campos AEAT específicos (ver tabla más abajo).
5. Pulsa **Generar XML AEAT**. LUCI construye el SOAP y te lo muestra antes de firmar.
6. Pulsa **Firmar y enviar a AEAT** → ver [Enviar a AEAT](enviar-aeat-y-mrn.md).

### Opción B — Formulario directo `/declarations/h1/new`

Si el expediente no existe (mercancía urgente, atajo), puedes ir directo a **Declaraciones → H1 directo** desde el sidebar.

![Listado declaraciones](../img/declaraciones-lista.png)

Verás un formulario largo con **60 campos** agrupados en 6 secciones:

| Sección | Campos clave |
|---|---|
| **Cabecera** | LRN (LUCI lo genera) · Régimen (4000) · Tipo declaración (H1) · Aduana presentación |
| **Declarante** | EORI · NIF · Razón social · Dirección · Representación (1=directa, 2=indirecta, 3=por cuenta propia) |
| **Importador** | EORI · NIF · Razón social · Dirección |
| **Vendedor / Comprador** | Mismos campos × 2. Si vendedor = exportador, indica el origen extracomunitario |
| **Transporte** | Modo · Identificación (≤ 17 chars) · Nacionalidad · Aduana entrada (ej. 2801) · Lugar carga (UN/LOCODE) |
| **Mercancía** (por cada partida) | TARIC 10 dígitos · Descripción comercial · País origen · Peso bruto/neto · Cantidad · Unidades suplementarias · Valor aduanero · Régimen aduanero solicitado |
| **Documentos** | Códigos AEAT (ej. `N380` factura, `N705` AWB, `N703` CMR, `N740` BL, `1A04` packing list) + número documento |
| **Tributos** | LUCI los calcula automáticamente: A00 (arancel), B00 (IVA), C00 (impuestos especiales si aplica) |

> **Tip TARIC**: si tienes dudas con la clasificación, abre el [Asistente LUCI](../05-asistente-luci-ia.md) y pregúntale: *"Ayúdame a clasificar colchones de espuma de poliuretano de 1.40 m × 2 m"*. Te devolverá el TARIC más probable + alternativas + verificaciones a hacer.

### Pasos finales

7. **Validar campos**: LUCI muestra avisos amarillos (no bloqueantes) y errores rojos (bloqueantes) en tiempo real.
8. **Calcular tributos**: pulsa **Calcular derechos** abajo. Verás:
   - Arancel (A00) calculado contra TARIC EU oficial (MFN o preferencial si aportas certificado origen).
   - IVA (B00) sobre la base imponible (= valor aduanero + arancel).
   - Total a pagar.
9. **Generar XML**: pulsa **Generar XML AEAT**. LUCI construye el SOAP completo de la operación.
10. **Firmar y enviar**: ver [Enviar a AEAT](enviar-aeat-y-mrn.md).

---

## Campos críticos — cómo rellenarlos sin errores

| Campo | Valor típico | Errores típicos |
|---|---|---|
| **LRN** | `LUCI-2026-XXXXXX` (lo genera LUCI) | Si lo cambias manualmente, debe ser único en tu tenant |
| **Régimen aduanero** | `4000` (importación + libre práctica) | Otros: `5100` depósito, `7100` perfeccionamiento activo, `4054` reimportación |
| **Casilla 1** (declaración) | `IM` para importación | Otros: `EX` exportación, `CO` combinado |
| **Casilla 18** (transporte ID) | Matrícula / vuelo / buque, **máx 17 chars** | AEAT rechaza si > 17 |
| **Casilla 30** (ubicación mercancía) | Código alfanumérico ubicación destino | Si no sabes, deja `EEEEEE` (genérico de la aduana) |
| **Casilla 36** (preferencia) | `100` ningún acuerdo · `200` SPG · `300` ALC | Si pones preferencia, **debes** tener documento de origen aportado |
| **Casilla 47** (cálculo tributos) | Lo calcula LUCI | Si manipulas, AEAT comparará con su propio cálculo |
| **Doc 7007** (DUA previo) | Solo si referencias otro DUA | Formato `YYYYMMDD-XXXXXXXX` (8+1+8 chars) |

---

## Si algo falla

### Errores AEAT habituales

| Código | Mensaje | Causa | Solución |
|---|---|---|---|
| `1180` | Declarante no autorizado | EORI no está dado de alta para H1 | Verifica dato; si correcto, pide alta a AEAT |
| `4404` | Casilla 18 longitud excede 17 | Te pasaste con la matrícula/ID transporte | Recorta a 17 chars |
| `2214` | Documento 7007 mal formado | Formato distinto a `YYYYMMDD-XXXXXXXX` | Corregir |
| `CB Total Tributos` | Cabecera con arancel pero partida con `dutyAmount=0` no incluye A00 | Mapper LUCI mismatcheaba | Ya corregido — si lo ves, reportar |
| `2004` | Doc previo (casilla 40) inexistente | El MRN previo es inválido o no existe | Quitar la referencia o corregir |

### Validación interna LUCI

- **«Unidades suplementarias requeridas»** → tu TARIC exige una unidad medida adicional (m², kg netos, pares, etc.). Consulta TARIC EU oficial.
- **«Valor aduanero anormalmente bajo»** → LUCI compara con el valor histórico del TARIC. Si declaras 50 € por kg de algo que normalmente vale 500 €/kg, te avisa (puede ser tu caso real, pero confirma).
- **«EORI declarante distinto del certificado FNMT»** → asegúrate de que el certificado importado coincide con el EORI declarante.

---

## Caso real

> Para ver una H1 completa con MRN real obtenido en AEAT PRE, consulta [Caso real: colchones de Turquía](../06-casos-reales.md#1-h1-colchones-turquia).

---

[← Flujos diarios](README.md) · [Siguiente: H7 e-commerce →](declarar-h7-ecommerce.md)
