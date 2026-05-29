# Pantallas — Regímenes aduaneros

[← Pantallas](README.md) · [Índice general](../README.md)

> Lo que **no es** una simple importación o exportación: regímenes especiales, garantías, estatus OEA y tránsitos.

---

## Regímenes aduaneros especiales

**Ruta**: `/special-regimes`

![Regímenes especiales](../img/regimenes-especiales.png)

### Para qué sirve

Gestionar operaciones que no son importación/exportación pura, sino que entran en regímenes especiales del CAU (arts. 210-262).

### 5 tipos soportados

| Código | Régimen | Cuándo aplica |
|---|---|---|
| **51 IP** | Perfeccionamiento Activo (Inward Processing) | Importas materia para transformar y reexportar — derechos suspendidos |
| **53 TA** | Importación Temporal (Temporary Admission) | Mercancía de paso (ferias, demos, alquiler) |
| **71 CW** | Almacén Aduanero (Customs Warehouse) | Stock de mercancía no UE en bonded warehouse |
| **T1** | Tránsito comunitario externo | Mercancía no UE que circula | 
| **T2** | Tránsito comunitario interno | Mercancía UE que cruza territorio no UE |

### Estructura de la pantalla

- **3 botones header**: Actualizar · Asistente IA (gradient) · + Nuevo Régimen.
- **5 cards interactivas** (filtros por tipo).
- **4 cards resumen** (Total / Ultimados / Derechos suspendidos / Por vencer).

### Asistente IA — RegimeAdvisor

Botón violeta «Asistente IA». Modal con 4 tipos de operación + descripción libre. LUCI analiza y recomienda el régimen óptimo.

> Ejemplo: «Tengo cuero crudo argentino que voy a curtir en España y vender el 80% a UK, el 20% en España» → LUCI recomienda **Perfeccionamiento Activo (51 IP)** con condiciones específicas.

Endpoint: `/api/special-regimes/ai/advise`.

---

## Garantías aduaneras

Ver detalle en [Pantallas → Operaciones → Garantías](operaciones.md#garantías). Resumen:

- 6 tipos: CGU global / Individual / Depósito / Aval bancario / Seguro caución / Fianza.
- 7 estados: emitida / activa / consumida / vencida / cancelada / impugnada / suspendida.
- 8 usos: derechos / IVA / IIEE / depósito temporal / tránsito / régimen especial / IOSS / ROHS.
- Cálculo automático del importe disponible y consumido.

### Botones especiales

- **Análisis IA**: evalúa si tu nivel de garantía es suficiente para el volumen actual.
- **Calculadora de garantía**: dado un MRN o expediente, calcula la garantía mínima requerida.

---

## OEA — Operador Económico Autorizado

**Ruta**: `/oea`

![OEA](../img/oea.png)

### Para qué sirve

Gestionar las **certificaciones OEA** (Operador Económico Autorizado) — el «sello de confianza» de AEAT que da acceso a procedimientos simplificados, menos inspecciones y vía rápida.

### 4 tabs

| Tab | Contenido |
|---|---|
| **Certificaciones** | OEAs activas en el tenant — 4 reales en este momento (2 OEAC, 1 OEAF) |
| **Beneficios** | Lista de simplificaciones desbloqueadas con cada tipo OEA |
| **Simplificaciones** | 6 procedimientos simplificados disponibles (despacho domiciliario, autoliquidación de IVA, etc.) |
| **Reconocimiento mutuo** | 7 acuerdos: USA C-TPAT, Japón AEO, China AEO, Suiza, Noruega, UK, Andorra |

### 5 stats cards

- Total / Aprobados (2) / En revisión / Pendientes / Por tipo

### Tipos OEA

- **OEAC** — Operador Económico Autorizado para Cumplimiento (vía rápida, menos controles)
- **OEAF** — Operador Económico Autorizado para Facilitación (procedimientos simplificados)
- Combinado: las grandes empresas suelen tener ambos.

### OEAs ejemplo en BD

- Importaciones García OEAC
- Electrónica Ibérica OEAC
- Farmacéutica Novax OEAF
- Textiles del Mediterráneo OEAC

### Botones

- **+ Nueva Solicitud OEA**: abre wizard de solicitud.
- **Renovar**: para certificaciones próximas a vencimiento.
- **Auditoría interna**: checklist autodiagnóstico previo a la inspección AEAT.

---

## Tránsitos NCTS

**Ruta**: `/transit`

![Tránsitos](../img/transitos.png)

### Para qué sirve

Listar y gestionar declaraciones de tránsito (T1, T2, T2F, TIR, ATA). Vista alternativa a [Declaraciones → NCTS](declaraciones.md#ncts--new-computerised-transit-system).

### 4 stats cards

- **Total**: 15 (en este tenant)
- **T1**: 15
- **T2**: 0
- **TIR**: 0

### Asistente IA — TransitAIPanel

Botón violeta arriba a la derecha. Modal con 4 tabs:

| Tab | Función |
|---|---|
| **Validar Ruta** | Analiza países atravesados, oficinas de salida/destino, calcula duración |
| **Predecir Incidencias** | Riesgo de retrasos, controles aleatorios, restricciones |
| **Sugerir Garantía** | Importe mínimo según tipo + valor + ruta |
| **Análisis Completo** | Combinación holística |

### Endpoints IA

- `/api/transit/:id/ai/validate-route`
- `/api/transit/:id/ai/predict-incidents`
- `/api/transit/:id/ai/suggest-guarantee`
- `/api/transit/:id/ai/full-analysis`

### Caso real

NCTS desbloqueado el 24/Abr/2026 con MRN real `26ES002801500473J5`, canal verde, levante inmediato. Fix técnico: `PreviousDocument` en `nctsXmlBuilder.js` debe usar `type=N337` + MRN sin prefijo `DUA` + sin `measurementUnitAndQualifier` (corrección de Jose Antonio).

---

## Atajos útiles

- Desde Régimen Especial → al ultimar (consumar) → genera automáticamente AES o H1 final.
- Desde Garantía CGU → ver MRNs que la consumen → enlace al detalle de cada uno.
- Desde OEA → simplificaciones → enlace a la pantalla donde se aplican (despacho domiciliario en `/expeditions`, IVA diferido en `/declarations`).
- Desde Tránsito → click MRN → expediente.

---

[← Control aduanero](control-aduanero.md) · [Siguiente: AEAT e Integraciones →](aeat-integraciones.md)
