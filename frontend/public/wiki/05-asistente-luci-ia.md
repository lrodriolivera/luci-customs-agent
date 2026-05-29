# 5. Asistente LUCI e Inteligencia Artificial

[← Volver al índice](README.md)

> LUCI no es solo un formulario aduanero. Lleva integrada inteligencia artificial en muchas pantallas para automatizar tareas tediosas, anticipar problemas y redactar documentos formales por ti.

---

## El asistente flotante

Esquina inferior izquierda del sidebar — caja azul **«Asistente LUCI · IA»**. Pulsa para abrir el chat.

### Qué puede hacer

Conversación en lenguaje natural sobre **cualquier cosa** de la plataforma:

- Buscar un expediente, MRN, importador.
- Resolver dudas TARIC.
- Explicar normativa CAU/BOE.
- Comparar dos códigos arancelarios.
- Predecir el canal de un envío hipotético.
- Generar borradores de comunicación AEAT.
- Recordar plazos próximos a vencer.

### Ejemplos de prompts útiles

```
- "¿Cuántos expedientes tengo en canal naranja este mes?"
- "Resúmeme los requerimientos pendientes en menos de 48 h"
- "¿Qué TARIC propones para 'colchones espuma poliuretano 1.40 x 2 m'?"
- "Compara TARIC 9404211000 con 9404219000"
- "¿Qué dice el art. 173 CAU sobre modificación de declaraciones?"
- "Genera un borrador de respuesta formal a un requerimiento documental"
- "¿Tengo alguna garantía con utilización superior al 90%?"
```

### Idiomas

El asistente responde en el idioma de tu interfaz. Cambia desde el selector ES/CA/VA/EN/FR/IT/PT.

### Contexto persistente

Recuerda los expedientes que estás viendo y los filtros activos. Si abres un MRN y luego le preguntas «¿qué tipo de inspección espera?», entiende a qué te refieres.

---

## Capacidades de IA en cada pantalla

### 1. Clasificación TARIC desde descripción

**Dónde**: cualquier campo TARIC (botón 🪄 «Sugerir con IA») y pantalla dedicada [`/ml-insights → Clasificación`](04-pantallas/administracion.md#ml-insights).

![ML Clasificación](img/ml-clasificacion.png)

Le das descripción + material + uso → te propone el código TARIC más probable. Confianza % visible.

**Casos validados**:
- «Ordenadores portátiles DELL Latitude» → `8471300000` (95% confianza) ✓
- «Camisetas algodón manga corta» → `6109100000` (95%) ✓
- «Colchones espuma poliuretano» → `9404211000` ✓

Tiempo: 10-20s para clasificación básica.

---

### 2. Predicción de circuito (verde/naranja/rojo/amarillo)

**Dónde**: [`/ml-insights → Predicción Circuito`](04-pantallas/administracion.md#ml-insights) · [`/aeat/monitor → Predecir Canal`](04-pantallas/aeat-integraciones.md#monitor-aeat) · botón flotante en cualquier H1/H7 antes de enviar.

![ML Canal](img/ml-canal.png)

Inputs: país origen + TARIC + valor + EORI operador. Output:

- Canal predicho (NARANJA, etc.)
- Confianza %
- Probabilidades por color (suma 100%)
- 3 factores de riesgo cuantificados

**Caso real**: CN + 8471300000 (laptops) + 50.000 € → NARANJA 45% confianza · Green 0% Yellow 45% Orange 35% Red 22% · Factores: origen alto riesgo +30, falta cert origen +15, operador nuevo +5.

Modelo precision: 78%.

---

### 3. Detección de fraude

**Dónde**: [`/ml-insights → Detección Fraude`](04-pantallas/administracion.md#ml-insights) · automático al crear H1.

Inputs: país origen + TARIC + valor + cantidad. Output:

- **Nivel de Riesgo** (LOW / MEDIUM / HIGH / CRITICAL)
- **Puntuación** /100
- **Alertas detectadas** (subfacturación, valor anormalmente bajo, patrón sospechoso)
- **Recomendaciones** (verificar documentos, contraste con histórico, control físico)

Modelo precision: 92%.

---

### 4. Análisis de expediente con LUCI

**Dónde**: pestaña **IA** dentro del detalle de cualquier expediente. 4 tabs:

| Tab | Función |
|---|---|
| **Suggest documents** | Sugerencia de documentos faltantes según TARIC + origen |
| **Full analysis** | Análisis 360° del expediente (riesgo, valor, oportunidades) |
| **Risk** | Score de riesgo de inspección + factores |
| **Inconsistencies** | Detección de incoherencias (peso vs cantidad, factura vs valor declarado…) |

---

### 5. Análisis IA en tránsito (NCTS)

**Dónde**: detalle de un tránsito → botón violeta **Asistente IA**.

| Tab | Función |
|---|---|
| **Validar Ruta** | Analiza países, oficinas, duración, checkpoints |
| **Predecir Incidencias** | Riesgo retrasos, controles |
| **Sugerir Garantía** | Importe mínimo según tipo + valor + ruta |
| **Análisis Completo** | Combinación holística |

---

### 6. RegimeAdvisor (regímenes especiales)

**Dónde**: [`/special-regimes → Asistente IA`](04-pantallas/regimenes.md#regímenes-aduaneros-especiales).

Le describes la operación en lenguaje natural y LUCI te recomienda el régimen óptimo (51 IP, 53 TA, 71 CW, T1, T2…) con condiciones específicas.

---

### 7. Insights de Analytics y BI

**Dónde**: [`/analytics → Centro de Análisis IA`](04-pantallas/administracion.md#analytics-y-bi).

6 tipos de análisis sobre los datos del tenant:

1. **Insights** — patrones y oportunidades.
2. **Anomalías** — desviaciones respecto al histórico.
3. **Tendencias** — proyecciones futuras.
4. **Reporte Ejecutivo** — informe formal estilo memorial dirección.
5. **KPI Analysis** — desviaciones de KPIs respecto a objetivos.
6. **Análisis Completo** — combinación.

**Ejemplo real** (output de Insights sobre el tenant en pruebas):

> *«Las operaciones aduaneras muestran un rendimiento sólido con 271 declaraciones procesadas y una tasa de error del 1%. Sin embargo, existe una brecha significativa de 476.603 € entre derechos calculados y pagados (14% diferencia) que requiere atención inmediata para optimizar la recaudación y cumplimiento.»*
>
> *Recomendaciones cuantificadas:*
> - *Recuperar 476.603 € pendientes mediante cierre proactivo de DUAs.*
> - *Ahorro 470.103 € vía clasificación automática para reducir tiempo en flujo verde.*
> - *Implementar control de garantías al 80% de utilización para evitar bloqueos.*

---

### 8. Análisis de certificados FNMT

**Dónde**: [`/aeat/certificates`](04-pantallas/aeat-integraciones.md#certificados-aeat) — al importar un nuevo `.p12`.

LUCI analiza automáticamente:
- Subject del certificado
- Capacidades (digitalSignature, nonRepudiation, keyEncipherment)
- Días restantes de validez
- Recomendación de renovar a partir de 90 días vencimiento

---

### 9. Generación de respuestas a notificaciones AEAT

**Dónde**: [`/requirements → Generar respuesta con IA`](03-flujos-diarios/responder-requerimiento.md#redactar-la-respuesta) y [`/communications`](04-pantallas/operaciones.md#comunicaciones).

LUCI redacta texto formal en español, citando artículos CAU relevantes, listando docs aportados. Tú revisas, ajustas, firmas.

---

### 10. Auto-Respuesta inteligente a AEAT

**Dónde**: [`/ml-insights → Auto-Respuesta`](04-pantallas/administracion.md#ml-insights).

Plantillas pre-entrenadas para los 12 tipos más frecuentes de comunicación con AEAT. Pulsas «Usar plantilla» → LUCI rellena con los datos del expediente.

---

## Modelos LUCI bajo el capó

LUCI usa una combinación de modelos según el caso:

| Modelo | Uso |
|---|---|
| **Claude Haiku** | Clasificación TARIC rápida, traducciones, sugerencias inline |
| **Claude Sonnet** | Análisis de expediente, generación de respuestas, business insights |
| **Modelo ML propietario** | Predicción canal (regresión sobre histórico canales del tenant), detección fraude (clasificador anomaly score) |

**Cache compartido Redis**: las consultas frecuentes (TARIC, normativa) se cachean entre todos los usuarios del tenant para reducir coste y latencia.

---

## Privacidad y datos

- Las consultas IA **NO** salen del entorno LUCI cuando contienen PII (datos personales) — encriptación AES-256-GCM en todo el almacenamiento.
- El histórico de tu chat con el asistente queda en tu sesión (eliminable en `/configuration → Privacidad`).
- LUCI registra qué prompts hace cada usuario en el log de auditoría (`/admin → Auditoría`) para trazabilidad GDPR.

---

## Tip productivo: pre-validar antes de declarar

Antes de pulsar «Enviar a AEAT», haz siempre estos 3 pasos:

1. **Predecir canal** → si te dice ROJO con 80% confianza, revisa el valor o documenta mejor.
2. **Análisis de fraude** → si es HIGH/CRITICAL, contrasta el valor con un cotizador, factura, etc.
3. **Inconsistencies** → ejecuta el análisis IA del expediente para descartar fallos antes de que AEAT te los detecte.

Estos 3 segundos extra ahorran horas de respuesta a requerimientos.

---

[← 04. Pantallas](04-pantallas/) · [Índice](README.md) · [Siguiente: 06. Casos reales →](06-casos-reales.md)
