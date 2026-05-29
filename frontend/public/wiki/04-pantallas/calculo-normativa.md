# Pantallas — Cálculo y normativa

[← Pantallas](README.md) · [Índice general](../README.md)

> Las herramientas para saber **cuánto se paga**, **qué reglas aplican** y **qué dice la norma**.

---

## Calculadora de derechos

**Ruta**: `/calculator`

![Calculadora](../img/calculadora.png)

### Para qué sirve

Calcular el coste aduanero total de una operación: arancel (MFN o preferencial) + IVA + IIEE si aplica.

### Características

- Consulta TARIC EU oficial (21.946 códigos).
- 4 campos: TARIC + país origen + valor + cantidad.
- Calcula MFN y preferencial en paralelo si origen tiene acuerdo.
- Sugiere [contingentes](#contingentes-arancelarios) si aplican.
- Detecta sujeción a [IIEE](#iiee--silicie) automáticamente.

> Detalle: [Calcular derechos](../03-flujos-diarios/calcular-derechos.md).

---

## Calculadora de preferencias arancelarias

**Ruta**: `/preferences`

![Preferencias](../img/preferencias.png)

### Para qué sirve

Identificar qué **acuerdos preferenciales** aplican a un origen y calcular el ahorro frente al MFN.

### Características

- 195 países en el combobox de origen, agrupados por «Más comunes» y «Todos los países».
- Acuerdos preferenciales soportados: ITA, EUR-MED, GSP+, Mercosur, CETA, Japan-EPA, UK-EU TCA, Vietnam EVFTA, Chile, México, Suiza, Noruega, Andorra…
- 3 tabs: Calculadora · Acuerdos · Reglas de origen.
- Output: tipo MFN, tipo preferencial, ahorro, documento origen requerido.

### Bug histórico

> En versiones anteriores el combobox países mostraba `()` en vez de los nombres. Bug corregido — ahora muestra todos correctamente con optgroups.

---

## Motor de Reglas Aduaneras

**Ruta**: `/rules-engine`

![Motor de Reglas](../img/motor-reglas.png)

### Para qué sirve

Análisis avanzado de una operación cruzando: TARIC + origen + destino + régimen + valor → identifica **todas las reglas aplicables**: aranceles, prohibiciones, autorizaciones, certificados sanitarios, etiquetado, ROHS/RAEE…

### Cómo se usa

1. Selecciona TARIC, origen, destino, régimen, valor.
2. Pulsa **Analizar**.
3. LUCI devuelve:
   - Reglas que aplican.
   - Documentos obligatorios (certificado origen, FITOSANITARIO, EUR.1, etc.).
   - Autoridades implicadas (AEAT, SOIVRE, MAPA, sanidad…).
   - Avisos si hay restricciones, prohibiciones, contingentes.

---

## Clasificación TARIC

**Ruta**: `/classification`

### Para qué sirve

Buscar y validar códigos TARIC. **Sugerencia con IA** desde una descripción libre.

### Características

- Búsqueda por código (parcial o completo) o por descripción.
- Navegación por capítulos / partidas / subpartidas.
- IA: dado «colchones espuma poliuretano 1,40×2 m» propone TOP-3 TARIC.
- Confianza (alta / media / baja).
- Verificaciones adicionales sugeridas (ej. «verificar composición textil > 50% algodón»).

### Modelos de IA usados

- **Clasificación TARIC**: precisión 85% en pruebas de validación cruzada.
- Tiempo respuesta: 10-20s.

---

## IIEE / SILICIE

**Ruta**: `/excise-duties`

![IIEE](../img/iiee.png)

### Para qué sirve

Calcular **Impuestos Especiales** sobre alcohol, tabaco, hidrocarburos, electricidad. Conforme a Ley 38/1992.

### Características

- Detección automática de sujeción desde TARIC.
- 2 fases: Detect (TARIC → sujeto sí/no) + Calc (cantidad → cuota).

### Tarifas vigentes ejemplos

| Producto | Tarifa | Mínimo |
|---|---|---|
| Cerveza | 5,50 €/hl por grado | — |
| Cigarrillos | Variable | 18.800 €/1.000 unidades |
| Diésel general | 307 €/1.000 L | — |
| Diésel uso agrícola | 78 €/1.000 L | — |
| Vino | 0 € (exento, declarable) | — |

### Casos validados

- Cerveza 1.000 L 5° → **5,50 €**
- Cigarrillos 200 unidades → **18,80 €** (mínimo)
- Diésel 10.000 L → **3.310 €**
- Laptops (TARIC 8471) → **No sujeto** (LUCI lo detecta y avisa)

---

## Contingentes arancelarios

**Ruta**: `/quotas`

![Contingentes](../img/contingentes.png)

### Para qué sirve

Buscar y monitorizar **cuotas anuales** UE con tipo reducido. Ej.: 22.000 t de vacuno argentino al año a tipo MFN, 5.500 t adicionales Mercosur a 7,5%.

### 3 pestañas

- **Buscar disponibilidad** → introduces TARIC + origen → LUCI te dice qué contingentes aplican y su utilización actual.
- **Todos los contingentes** → catálogo completo (11 contingentes EU activos en BD LUCI).
- **Contingentes críticos** → los que están al > 90% utilización.

### Estado actual

4 contingentes críticos en BD:
- Leche desnatada AR (94,85% utilización, agotamiento estimado 27 días).
- Pollo BR (89%).
- Mantequilla NZ (87%).
- Quesos UY (91%).

---

## Buscador de Normativa

**Ruta**: `/regulations`

![Normativa](../img/normativa.png)

### Para qué sirve

Búsqueda jurídica en **EUR-Lex** (CAU) y **BOE** (legislación española) de cualquier norma aduanera o tributaria.

### 3 pestañas

- **Todos**: combinada EU + España.
- **EUR-Lex CAU**: 10 normas pre-cargadas (Reg. 952/2013 CAU + sus actos delegados y de ejecución).
- **BOE España**: 15 normas pre-cargadas (LGT, LIVA, LIE, contrabando, hidrocarburos, garantías…).

### Análisis con LUCI

Botón violeta — abre panel con preguntas sugeridas:
- «¿Qué dice el art. 173 del CAU sobre modificaciones?»
- «¿Cuál es el plazo de prescripción de la deuda aduanera?»
- «¿Qué documentos requiere el ROHS para importar?»

LUCI cita el artículo concreto, el contexto y la jurisprudencia AEAT relevante.

---

## Atajos útiles

- Desde Calculadora → si TARIC tiene preferencial → botón directo a Preferencias.
- Desde Preferencias → si requiere certificado origen → enlace al apartado correspondiente del expediente.
- Desde Motor Reglas → si detecta autorización SOIVRE → enlace a [PUE](declaraciones.md#pue--punto-unico-de-entrada).
- Desde Normativa → click sobre artículo → pestaña «Análisis» abre el chat IA con ese contexto cargado.

---

[← Declaraciones](declaraciones.md) · [Siguiente: Control aduanero →](control-aduanero.md)
