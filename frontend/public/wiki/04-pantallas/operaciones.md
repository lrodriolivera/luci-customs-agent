# Pantallas — Operaciones

[← Pantallas](README.md) · [Índice general](../README.md)

> Tu zona principal. Lo que tocas todos los días.

---

## Dashboard inicial

**Ruta**: `/` (es lo primero que ves al hacer login)

![Dashboard](../img/dashboard.png)

### Para qué sirve

Resumen del estado del tenant en un solo vistazo: KPIs, alertas urgentes, expediciones recientes y métricas de plataforma.

### Qué muestra

| Bloque | Contenido |
|---|---|
| **4 KPI cards** | Total expediciones · Activas · Verde · Inspeccionar |
| **Acciones rápidas** | 4 botones (Clasificación / Calculadora / PUE / Declaraciones) |
| **Alertas** | Garantías próximas a expirar, MRN canal naranja/rojo, requerimientos sin respuesta |
| **Expediciones recientes** | Últimas 5 con MRN, estado y badge de canal |
| **AI Engine** | TARIC en BD (21.946), consultas IA del último mes |
| **Plataforma** | Capítulos CAU (97), idiomas (7), datos generales |

### Botones / acciones

- Click en cualquier KPI → te lleva al listado filtrado correspondiente.
- Click en una expedición reciente → detalle de esa expedición.
- Click en una alerta → la alerta se marca como vista al actuar sobre ella.
- **Refrescar** (icono ↻) → recarga datos sin recargar página.

---

## Expedientes

**Ruta**: `/expeditions`

![Expedientes lista](../img/expedientes-lista.png)

### Para qué sirve

Listado paginado de todos los expedientes (carpetas de operación) del tenant. Tu punto de partida para crear, buscar y entrar en cualquier expediente.

### Qué muestra

Tabla con columnas:

| Columna | Contenido |
|---|---|
| **Referencia** | EXP-2026-XXXXXX (ID interno LUCI) |
| **Tipo** | Importación / Exportación |
| **Importador** | Razón social + EORI |
| **Estado** | DRAFT / DOCS_RECEIVED / DOCS_VALIDATED / DECLARATION_GENERATED / SUBMITTED / MRN_ASSIGNED / RELEASED / CANCELLED |
| **Canal** | 🟢 verde / 🟠 naranja / 🔴 rojo / 🟡 amarillo / — (si todavía sin MRN) |
| **MRN** | Si ya enviado a AEAT |
| **Fecha** | Creación / última actualización |

### Filtros

- **Estado** (multi-select): filtrar por uno o varios estados.
- **Tipo**: Importación / Exportación / Todos.
- **Canal**: cualquiera de los 4 + sin canal todavía.
- **Búsqueda libre**: ID expediente, importador, MRN, descripción mercancía.
- **Rango fechas**: desde / hasta.

### Botones

- **+ Nueva expedición** → wizard 3 pasos. Ver [Crear un expediente](../03-flujos-diarios/crear-expediente.md).
- **Exportar CSV** → descarga el listado filtrado.
- Click sobre fila → detalle de la expedición con 5 pestañas (General · Documentos · Declaraciones · Comunicaciones · Timeline).

### Detalle del expediente

Cuando entras en uno:

- **Tabs IA** (botones violeta arriba): suggest-documents, full-analysis, risk, inconsistencies — Ver [Asistente IA](../05-asistente-luci-ia.md).
- **Pestaña Documentos**: subir, validar, eliminar. Cada doc tiene estado PENDING / VALIDATED / REJECTED.
- **Pestaña Declaraciones**: + Nueva H1/H7/AES, listar las que ya hay, ver su MRN.
- **Pestaña Comunicaciones**: chat con cliente vía portal, emails enviados, notificaciones AEAT recibidas.
- **Pestaña Timeline**: línea cronológica de todo lo que ha pasado (creación, docs, declaración, MRN, alertas).

---

## Circuitos

**Ruta**: `/channels`

### Para qué sirve

Vista alternativa de los expedientes agrupados por **canal asignado**. Útil para gestionar la carga de inspecciones físicas (rojo), aforos (amarillo) o controles documentales (naranja).

### Qué muestra

4 pestañas, una por canal:

- 🟢 **Verde** — listo para retirar mercancía.
- 🟠 **Naranja** — pendiente aporte documental.
- 🔴 **Rojo** — inspección física pendiente o en curso.
- 🟡 **Amarillo** — aforo pendiente.

Tabla con MRN, expediente, fecha asignación, vencimiento de cada acción requerida.

### Filtros

- Rango fechas.
- Aduana (si gestionas varias).
- Importador.

> **Nota técnica**: Antiguamente el filtro «Todas las fechas» enviaba `endDate` sin `startDate`, causando que el backend recortara datos y se vieran solo 4 verdes en vez de 30. Bug ya corregido en versiones actuales.

---

## Requerimientos

**Ruta**: `/requirements`

### Para qué sirve

Listado de **requerimientos AEAT** pendientes de respuesta. El sitio donde gestionas las preguntas y solicitudes oficiales de la Administración.

### Qué muestra

Tabla con:

| Columna | Contenido |
|---|---|
| **Referencia** | R-2026-NNNN |
| **MRN afectado** | Vincula al expediente |
| **Tipo** | Documental / Aclaración / Inspección física / Aforo / Análisis lab |
| **Plazo restante** | Cuenta atrás visual (rojo si < 48 h) |
| **Estado** | PENDIENTE / RESPONDIDO / RESUELTO |

### Botones

- **+ Nuevo requerimiento** (raro — solo si AEAT te lo notifica fuera de banda y tienes que crearlo manualmente).
- Click sobre fila → ver [Responder requerimiento](../03-flujos-diarios/responder-requerimiento.md).

---

## Inspecciones

**Ruta**: `/inspections`

![Inspecciones](../img/inspecciones.png)

### Para qué sirve

Gestor unificado de las inspecciones físicas, documentales, aforos y análisis. Lo que en muchas agencias se lleva en Excel/agenda.

### Qué muestra

3 pestañas:

- **Dashboard**: contadores (Hoy / Pendientes / En curso / Esta semana) + por tipo (Scanner / Física / Documental) + por resultado.
- **Lista**: tabla con todas las inspecciones, filtros por estado y tipo.
- **Calendario**: vista mensual con citas de inspección destacadas.

### Filtros

- Estado (`scheduled`, `in_progress`, `completed`, `rejected`).
- Tipo (`physical`, `scanner`, `documental`).
- Aduana.

### Botones

- **+ Crear inspección** (manual, raro — normalmente vienen automáticas de AEAT).
- Click sobre fila → detalle (funcionario asignado, mercancía, resultado, comentarios).

---

## Comunicaciones

**Ruta**: `/communications`

![Comunicaciones](../img/comunicaciones.png)

### Para qué sirve

Canal formal con **inspectores AEAT** y autoridades paraduaneras (SOIVRE, MAPA, sanidad). Útil para coordinar inspecciones, solicitar aplazamientos, presentar recursos.

### Qué muestra

3 pestañas:

- **Dashboard**: 4 stats cards (Pendientes / Vencidas / Esperando respuesta / Recursos activos).
- **Todas**: listado con filtros por categoría (Coordinación / Recursos / Solicitudes / Respuestas) y estado (sent / received / draft / closed).
- **Recursos**: solo las comunicaciones tipo «recurso administrativo».

### Categorías

12 tipos disponibles: aplazamiento inspección, justificación valor, alegaciones a propuesta de regularización, solicitud devolución…

### Botones

- **+ Nueva comunicación** → asistente de redacción con plantillas.
- Adjuntos hasta 10 MB.
- LUCI puede generar borrador con IA.

---

## Plazos

**Ruta**: `/deadlines`

![Plazos](../img/plazos.png)

### Para qué sirve

Calendario unificado de **fechas límite**: respuestas a requerimientos, vencimientos de garantías, plazos de inspección, recursos administrativos.

### Qué muestra

- **Total vencidos**: 18 (en este tenant)
- **Total pendientes**: 8
- **6 categorías**: Requerimientos / Inspecciones / Recursos / Garantías / Documentos pendientes / Inscripciones OEA

### Filtros

- Categoría.
- Estado (vencido / pendiente / cumplido).
- Rango fechas.

### Botones

- **+ Crear plazo** (manual, raro).
- **Extender** (si AEAT permite prórroga).
- Click → detalle con cuenta atrás y enlace al expediente.

---

## Garantías

**Ruta**: `/guarantees`

![Garantías](../img/garantias.png)

### Para qué sirve

Registro de **garantías aduaneras** activas (avales bancarios, depósitos, seguros de caución, fianzas). Necesarias para respaldar derechos potenciales.

### Qué muestra

- **4 stats cards**: Activas / Total importe / Disponible / Consumido (con barras de utilización).
- **6 tipos**: CGU (Garantía global) / Individual / Depósito / Aval bancario / Seguro caución / Fianza.
- **7 estados**: emitida / activa / consumida / vencida / cancelada / impugnada / suspendida.
- **8 usos**: derechos arancelarios / IVA / IIEE / depósito temporal / tránsito / régimen especial / IOSS / ROHS.

### Botones del header

- **Análisis IA** (violeta) — LUCI evalúa si tu nivel de garantía es adecuado al volumen de operaciones.
- **Calculadora de garantía** — calcula el importe mínimo para una operación específica.
- **+ Nueva garantía** — registrar nueva.

### Filtros

- Estado, tipo, importador.

### Detalle de una garantía

- Importe total, consumido, disponible.
- Vencimiento.
- Operaciones afectadas (lista de MRNs).
- Documentos asociados.

---

## Atajos útiles entre pantallas

- Desde un expediente → click MRN → te lleva a [Monitor AEAT](aeat-integraciones.md#monitor-aeat).
- Desde una alerta del Dashboard → te lleva al expediente afectado.
- Desde una garantía → te lista las declaraciones que la consumen.
- Desde Inspecciones → click MRN → expediente.

---

[← Pantallas](README.md) · [Siguiente: Declaraciones →](declaraciones.md)
