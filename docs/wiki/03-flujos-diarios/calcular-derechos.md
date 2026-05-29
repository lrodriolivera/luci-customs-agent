# Calcular derechos arancelarios

[← Flujos diarios](README.md) · [Índice](../README.md)

> Antes de cotizar al cliente final, suele hacer falta saber cuánto va a pagar de aduana. LUCI tiene una calculadora oficial contra TARIC EU.

---

## ¿Qué calcula LUCI?

| Tributo | Código AEAT | Base | Tipo típico |
|---|---|---|---|
| **Derecho arancelario (MFN)** | A00 | Valor aduanero (CIF) | 0% – 25% según TARIC |
| **Derecho preferencial** | A00 reducido | Valor aduanero | 0% – 14% si origen tiene acuerdo |
| **IVA importación** | B00 | Base = Valor aduanero + Arancel | 21% (general) / 10% / 4% |
| **Impuestos especiales (IIEE)** | C00 | Cantidad o base ad-valorem | Variable según producto |
| **Derecho fijo H7** (jul/2026) | F48 | Por artículo | 3 € fijo (Reg. UE 2026/382) |

---

## Pasos

### 1. Abre la calculadora

Sidebar → **Cálculo y normativa → Calculadora de derechos**.

![Calculadora](../img/calculadora.png)

### 2. Introduce los datos

Form con 4 campos principales:

| Campo | Qué meter | Ejemplo |
|---|---|---|
| **Código TARIC** | 10 dígitos | `9404211000` |
| **País origen** | ISO-2 | `TR` (Turquía) |
| **Valor aduanero** | EUR | `120000` |
| **Cantidad** | unidades | `300` colchones |

Opcionalmente:
- **Peso neto** (kg) si es relevante (algunos TARIC se calculan por kg).
- **Régimen** (4000 importación normal, 4071 reimportación, etc.).

### 3. Pulsa «Calcular»

LUCI consulta TARIC EU oficial y devuelve:

```
Cap.: 94 — Mobiliario
Posición: 9404 — Somieres y artículos de cama
Subpartida: 9404.21 — Colchones de caucho o plástico

DESCRIPCIÓN: Colchones de plástico celular, otros que de caucho

DERECHOS APLICABLES (origen TR, valor 120.000 €):
  - MFN tipo: 3,7%
  - Preferencial (Acuerdo Aduanero TR-UE): 0%
  
TRIBUTOS:
  - A00 Arancel: 0,00 € (preferencia 0%)
  - B00 IVA 21% (sobre 120.000 €): 25.200,00 €
  - C00 IIEE: no aplica
  
TOTAL A INGRESAR: 25.200,00 €
```

### 4. Aplica preferencias arancelarias (si origen lo permite)

Si el país origen tiene un acuerdo con la UE, LUCI te ofrece dos botones:

- **Sin preferencia** → MFN. Para casos en los que el cliente no tiene certificado de origen.
- **Con preferencia** → tipo reducido. Requiere aportar el documento de origen (EUR.1, EUR-MED, FORM A, declaración en factura para envíos < 6.000 €, REX para algunos países…).

LUCI tiene una pantalla dedicada a esto: **Cálculo y normativa → Preferencias arancelarias**.

### 5. Si aplica IIEE (Impuestos Especiales)

Si tu producto es **alcohol, tabaco, hidrocarburos o electricidad**, hay que calcular IIEE. LUCI redirige a:

**Cálculo y normativa → IIEE / SILICIE**

![IIEE / SILICIE](../img/iiee.png)

Detecta automáticamente si el TARIC está sujeto y aplica las tarifas vigentes (Ley 38/1992):
- Cerveza: **5,50 €/hl** por grado
- Cigarrillos: 18.800 €/1.000 unidades (mínimo)
- Diésel: **307 €/1.000 L** (general) / **78 €** (uso agrícola)
- Vino: 0 € (exento, declarable)

### 6. Si el TARIC tiene contingente

Algunos productos tienen **contingentes arancelarios** (cuotas anuales con tipo reducido). Si LUCI detecta uno aplicable, te lo dice:

```
⚠️ Hay 2 contingentes arancelarios disponibles para TARIC 0202.30 (vacuno) origen AR:
  
  - Contingente 094003 «Alta calidad»
    Volumen anual: 22.000 t
    Utilización actual: 72,11%
    Tipo: 12,8%
    Ahorro estimado: 0 € (tipo igual al MFN)
    
  - Contingente 094004 «Mercosur»
    Volumen anual: 5.500 t
    Utilización actual: 99,86% — CRÍTICO
    Tipo: 7,5%
    Ahorro estimado: 6.200 € si entras antes del agotamiento
```

Pantalla dedicada: **Cálculo y normativa → Contingentes**.

![Contingentes](../img/contingentes.png)

---

## ¿Qué pasa si el TARIC es preferencial pero falta documento origen?

LUCI muestra un aviso amarillo:

> ⚠️ Para aplicar el tipo preferencial 0% necesitas aportar `EUR.1` o equivalente. Sin ese documento se aplicará el MFN (3,7%).

Te calcula los **dos escenarios** (con y sin) para que decidas.

---

## Caso real

3 cálculos validados contra TARIC EU oficial:

| TARIC | Producto | Valor | Origen | Resultado |
|---|---|---|---|---|
| `9404211000` | Colchones espuma | 120.000 € | TR | Arancel 0% (preferencial) + IVA 25.200 € = **25.200 €** ✓ |
| `8471300000` | Laptops | 50.000 € | CN | Arancel 0% (ITA) + IVA 10.500 € = **10.500 €** ✓ |
| `6109100090` | Camisetas | 90.347 € | BD | Arancel 12% (MFN) + IVA 22.769 € = **33.610 €** ✓ |

(*Los tres calculados en el caso de pruebas E2E del 4/May/2026, validados contra TARIC EU oficial.*)

---

## ¿Y los aranceles preferenciales se aplican automáticamente al declarar?

**No**. La calculadora te muestra el escenario «mejor caso», pero al hacer la **H1** real:
- Debes indicar el **código de preferencia** correcto en la casilla 36 (`200`, `300`, etc.).
- Aportar el documento de origen.
- Si falta, AEAT cobra el MFN.

---

## Si algo falla

| Problema | Causa | Solución |
|---|---|---|
| LUCI dice «TARIC no encontrado» | Código incorrecto (8 vs 10 dígitos, espacios) | Reintenta sin espacios, comprueba en TARIC EU oficial |
| Tipo MFN distinto al que esperabas | Se ha actualizado el TARIC | LUCI sincroniza diariamente. Confirma con `taric-europa.ec.europa.eu` |
| No detecta contingente | El contingente acaba de agotarse | Verifica volumen disponible en *Contingentes* |
| IIEE no se calcula | TARIC no marcado como sujeto en BD | Reportar — LUCI debe incluirlo |

---

[← Responder requerimiento](responder-requerimiento.md) · [Volver a Flujos diarios](README.md) · [Índice general](../README.md)
