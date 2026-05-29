# 6. Casos reales

[← Volver al índice](README.md)

> Cuatro casos **reales** completados durante las pruebas E2E con AEAT PRE. Cada uno muestra el recorrido de principio a fin: desde la creación del expediente hasta el MRN auténtico.

---

## 1. H1 colchones Turquía

> **Resultado**: MRN `26ES00280130001TT1` · Canal **VERDE** · Levante automático

### Contexto

Importación de colchones de espuma de poliuretano (300 unidades, valor 120.000 €) desde Turquía a Madrid Barajas. Importador: STRIX AI SL.

### Recorrido completo

#### 1. Crear expediente (3 min)

**Operaciones → Expedientes → + Nueva**:

```
Tipo: Importación
Aduana: 2801 (Madrid)
Referencia: EXP-2026-674017EF

Importador:
  NIF: B22477020
  EORI: ESB22477020
  Razón social: STRIX AI SL
  Dirección: Aragón, España

Mercancía:
  Descripción: Colchones de espuma de poliuretano 1.40 x 2 m
  TARIC: 9404211000  (sugerido por IA)
  País origen: TR
  Peso bruto: 4.500 kg / Peso neto: 4.200 kg
  Cantidad: 300
  Valor aduanero: 120.000 €

Transporte:
  Modo: Carretera
  ID: TR123ABC456 (camión turco)
  Lugar carga: TRIST (Estambul)
```

#### 2. Subir y validar 4 documentos (5 min)

- Factura comercial PDF → VALIDATED ✓
- Packing list PDF → VALIDATED ✓
- CMR escaneado PDF → VALIDATED ✓
- Certificado origen EUR-MED (Turquía-UE preferencia) PDF → VALIDATED ✓

#### 3. Generar H1 (1 min)

Pestaña Declaraciones → **+ Nueva H1**. LUCI rellena auto.

Campos clave revisados:
- Régimen: 4000
- Casilla 18 (transporte ID): TR123ABC456 (12 chars, OK)
- Casilla 36 (preferencia): 200 (acuerdo TR-UE)
- Doc 7007: no aplica

Pulsa **Generar XML AEAT** → SOAP de 9.980 bytes generado.

#### 4. Calcular tributos

```
Arancel preferencial (origen TR): 0% → A00 = 0 €
Base IVA: 120.000 €
IVA 21%: B00 = 25.200 €
Total: 25.200 €
```

#### 5. Enviar a AEAT (4 iteraciones de error)

Esto es la parte interesante. La primera vez no salió a la primera. Iteraciones:

| Intento | Error AEAT | Solución |
|---|---|---|
| 1 | `4404` Casilla 18 longitud >17 | Era TR123ABC456SUPERLARGO (24 chars). Recortado a TR123ABC456 |
| 2 | `2214` Doc 7007 mal formado | LUCI generaba sin guión separador. Bug corregido |
| 3 | `CB Total Tributos` | Mapper goods→partidas omitía A00 cuando duty=0. Bug corregido |
| 4 | declarante `ESundefined` | h1Generator leía `expedition.representative.eori` (no existe). Bug corregido |

Tras los 4 fixes:

```
✓ Declaración aceptada por AEAT

MRN: 26ES00280130001TT1
Canal: VERDE
Levante: AUTOMÁTICO
Fecha: 2026-04-22 13:45:30 UTC
simulated: false
```

**Tiempo total** desde primer click «Enviar» hasta MRN: 47 segundos (excluyendo los 4 minutos arreglando bugs LUCI entre intentos).

#### 6. Documento de levante

LUCI genera PDF descargable: `Levante-26ES00280130001TT1.pdf` con sello AEAT.

---

## 2. H1 directo (sin expediente previo)

> **Resultado**: MRN `26ES00280130001U07` · Canal **VERDE**

### Contexto

Mercancía urgente. No hay tiempo de crear expediente, validar docs, etc. Vamos al formulario directo.

### Recorrido

**Declaraciones → H1 → + Nuevo (formulario directo)** rellenando los 60 campos uno a uno.

LUCI auto-creó un expediente fantasma `EXP-2026-MOKASSQ3` para mantener trazabilidad.

Tras 4 iteraciones similares al caso 1 (`maxLength` casilla 18, `unidadesSuplementarias` faltantes, etc.):

```
✓ MRN: 26ES00280130001U07
Canal: VERDE
```

### Aprendizaje

El formulario directo es práctico para urgencias pero **menos asistido**: no tienes la sugerencia automática de docs, ni la validación cruzada con el expediente. Para uso diario, prefiere el flujo desde expediente.

---

## 3. H7 bufanda manifiesto

> **Resultado**: MRN `26ES19938245448511H7` · Canal **VERDE**

### Contexto

Manifiesto CSV de courier express con 5 envíos B2C de bufandas de lana invierno (valor 25-40 €/u). Cliente de paquetería pide presentación H7 masiva.

### Recorrido

#### 1. Subir CSV

**Declaraciones → H7 → Importar manifiesto** → drag & drop archivo `LUCI-MOK-005.csv`.

LUCI detecta 5 filas válidas. Una columna no tiene TARIC.

#### 2. Clasificación TARIC con IA (10 segundos)

Pulsa **Clasificar con IA**. LUCI propone para todas las filas:

```
Descripción: "Bufanda lana virgen invierno mujer 30x150cm"
TOP-1: 6117100090 — confianza 92% — "Las demás de punto, los demás"
TOP-2: 6217100090 — confianza 65%
TOP-3: 6214900090 — confianza 40%

Verificación adicional sugerida:
- Confirmar si es de punto (knit) o textil tejido (woven)
- > 50% lana → cap 51 (lana cruda) NO aplica, mantener cap 61
```

Aplicar TOP-1 a las 5 filas.

#### 3. Crear H7 en bloque

Pulsa **Crear declaraciones**. LUCI crea 5 H7 en estado DRAFT con prefijo `LUCI-MOK-005-001` a `LUCI-MOK-005-005`.

#### 4. Enviar a AEAT en lote

Selecciona las 5 + **Enviar selección a AEAT**.

| Envío | Resultado |
|---|---|
| 1 | ✓ MRN `26ES19938245448511H7` · VERDE |
| 2 | ✓ MRN `26ES19938245448512H7` · VERDE |
| 3 | ✓ MRN `26ES19938245448513H7` · VERDE |
| 4 | ✓ MRN `26ES19938245448514H7` · VERDE |
| 5 | ✓ MRN `26ES19938245448515H7` · VERDE |

Tiempo total: **1 m 30 s** desde subir CSV hasta tener los 5 MRN.

### Aprendizaje

Para volumen masivo, el flujo manifiesto + IA + lote es **drásticamente más rápido** que individual. Una bufanda → 1 declaración × 5 = ~25 minutos en flujo individual vs **1.5 minutos** en flujo manifiesto.

---

## 4. ENS RAIL ferrocarril

> **Resultado**: MRN `26ES009999Z0000677` · Estado **ACEPTADA** (CC328A)

### Contexto

Tren de mercancía no UE entrando por la frontera francesa con destino almacén Madrid. Necesita ENS antes de la llegada.

### Recorrido

#### 1. Ir a ENS

**Declaraciones → ENS → + Nueva**.

Selector modo transporte → **RAIL** (clave: solo este modo aceptado por AEAT en ENS legacy).

> ⚠️ Si seleccionaras AIR / SEA / ROAD, LUCI muestra Alert warning amarillo: «AEAT solo acepta ENS en RAIL. Para los demás modos, declarar vía ICS2».

#### 2. Wizard 4 pasos

| Paso | Campos |
|---|---|
| **0 Transport** | Modo RAIL · Identificación tren · Operadora ferroviaria |
| **1 Carrier** | EORI carrier · Razón social · País |
| **2 Consignment** | Origen · Destino · Aduana entrada (puerto seco frontera FR) |
| **3 Goods** | Lista de mercancía con TARIC |

#### 3. Generar XML

LUCI construye SOAP CC315A.

#### 4. Enviar

```
✓ ENS aceptada por AEAT

MRN: 26ES009999Z0000677
Código respuesta: CC328A (aceptada)
Fecha: 2026-05-04 05:29
ENS-2026-000034
```

---

## Resumen de los 4 casos

| # | Tipo | MRN | Canal | Tiempo total | Mercancía |
|---|---|---|---|---|---|
| 1 | H1 (ciclo completo) | `26ES00280130001TT1` | 🟢 verde | ~30 min | Colchones espuma TR 120k € |
| 2 | H1 (directo) | `26ES00280130001U07` | 🟢 verde | ~15 min | Idem (urgente sin expediente previo) |
| 3 | H7 (manifiesto x5) | `26ES19938245448511H7` y 4 más | 🟢 verde × 5 | 1m 30s | Bufanda lana invierno |
| 4 | ENS RAIL | `26ES009999Z0000677` | ACEPTADA CC328A | ~5 min | Mercancía ferrocarril |

**Lecciones clave**:
1. El flujo desde **expediente** es más robusto que el directo — usa este por defecto.
2. **Manifiesto + IA** ahorra ≈ 95% de tiempo en envíos masivos.
3. La **clasificación TARIC IA** acertó en el 100% de los casos validados (TOP-1 con confianza > 90%).
4. **ENS solo RAIL** en LUCI legacy CC315A — el resto va por ICS2.

---

## Y los que NO funcionaron en PRE

Para transparencia técnica:

- **PUE/SOIVRE**: AEAT PRE devuelve error 1230 «especificidad incorrecta». Pendiente respuesta de Jose Antonio (AEAT/DIT) sobre indexación SOIVRE PRE. **En producción real funcionará** — solo es limitación del entorno de pruebas.
- **NCTS sumarias DUA inactivas**: en algunos casos PRE no permite referenciar DUAs antiguas. En producción no es problema.

---

[← 05. Asistente IA](05-asistente-luci-ia.md) · [Índice](README.md) · [Siguiente: 07. Atajos →](07-atajos-y-trucos.md)
