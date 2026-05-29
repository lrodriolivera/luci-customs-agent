# Pantallas — Administración

[← Pantallas](README.md) · [Índice general](../README.md)

> Pantallas para administradores del tenant: análisis de negocio, IA, configuración general, gestión de usuarios.

> **Permisos**: la mayoría de estas pantallas requieren rol `admin` o `supervisor`. Si tu rol es `agent` o `viewer`, no las verás en el sidebar.

---

## Analytics y BI

**Ruta**: `/analytics`

![Analytics](../img/analytics.png)

### Para qué sirve

Dashboard de **business intelligence** con KPIs operativos, financieros y de cumplimiento. Análisis avanzado con IA.

### Estructura

- **Header**: Centro de Análisis IA + selector periodo (8 opciones) + Refresh.
- **Real-time bar**: indicador animado verde + AEAT conectado/latencia + declaraciones activas + pendientes + alertas críticas/warning.
- **4 tabs**: Visión General · KPIs · Financiero · Cumplimiento.

### Tab Visión General

- **4 stats cards**: Declaraciones · Valor Aduanero · Cumplimiento · Tiempo Medio.
- **Distribución por canal** (gráfico): Verde 70% · Naranja 17% · Rojo 5% · Amarillo 4%.
- **Declaraciones por tipo** (gráfico): H1, H7, AES, NCTS, ICS2.
- **Insights de LUCI** (card destacada con IA real): resumen ejecutivo + recomendaciones + oportunidades cuantificadas.

### Tab KPIs

- **Salud del Sistema** — score circular grande (78/100 en este tenant).
- KPIs por categoría (Operacionales / Financieros / Cumplimiento / Calidad / Eficiencia).
- Alertas activas con severity y botón **Reconocer**.

### Tab Financiero

- 3 cards: Derechos Calculados / Pagados / Ahorros Potenciales.
- Barra «Utilización de Garantías» con código color (verde < 60% / amarillo 60-80% / rojo > 80%).

### Tab Cumplimiento

- 4 cards: Tasa Error / Rechazo / Envíos a Tiempo / Tasa Inspección.
- SVG circular grande **Completitud Documental**.

### Modal «Centro de Análisis IA»

Botón gradient luci/luci-dark con SparklesIcon. 6 sub-tabs:

| Sub-tab | Endpoint | Tiempo |
|---|---|---|
| **Insights** | `/api/analytics/ai/insights` | ~40s |
| **Anomalías** | `/api/analytics/ai/anomalies` | ~30s |
| **Tendencias** | `/api/analytics/ai/trends` | ~30s |
| **Reporte Ejecutivo** | `/api/analytics/ai/executive-report` | ~60s |
| **KPI Analysis** | `/api/analytics/ai/kpi-analysis` | ~30s |
| **Análisis Completo** | `/api/analytics/ai/full-analysis` | ~90s |

Cada uno devuelve análisis estructurado de Claude con resumen, insights principales, recomendaciones cuantificadas (€), oportunidades.

### Caso real

Insights reales generados:

> *«Las operaciones aduaneras muestran un rendimiento sólido con 271 declaraciones procesadas y una tasa de error del 1%. Sin embargo, existe una brecha significativa de 476.603 € entre derechos calculados y pagados (14% diferencia) que requiere atención inmediata para optimizar la recaudación y cumplimiento.»*

5 recomendaciones específicas + 5 oportunidades cuantificadas (recuperar €476.603 pendientes, ahorro €470.103 vía clasificación automática para flujo verde, etc.).

---

## ML Insights

**Ruta**: `/ml-insights`

![ML Insights](../img/ml-insights.png)

### Para qué sirve

Centro de **inteligencia artificial** específico de LUCI. Modelos ML especializados en aduanas con interfaz directa.

### 6 tabs

| Tab | Función |
|---|---|
| **Vista General** | 5 stats cards + Estado del Sistema + Confianza de Modelos |
| **Clasificación** | Form descripción + material + uso → IA propone TARIC |
| **Detección Fraude** | Form origen + TARIC + valor + cantidad → análisis riesgo |
| **Predicción Circuito** | Form origen + TARIC + valor + EORI → canal predicho + probabilidades |
| **Recomendaciones** | Sugerencias de optimización |
| **Auto-Respuesta** | Plantillas IA para responder a notificaciones AEAT |

### Tab Clasificación

![Clasificación TARIC](../img/ml-clasificacion.png)

- 3 inputs: Descripción producto (textarea) + Material + Uso principal.
- Botón azul **Clasificar con ML** + icono Sparkles.
- Resultado: TARIC sugerido + confianza % (low / medium / high) + alternativas + verificaciones adicionales.

### Tab Predicción Circuito

![Predicción Circuito](../img/ml-canal.png)

- Inputs: País origen + TARIC + Valor + EORI operador (opcional).
- Botón violeta **Predecir Circuito**.
- Resultado: Canal (NARANJA, etc.) + Confianza % + Probabilidades 4 colores + 3 factores de riesgo cuantificados (origen alto riesgo +30, falta cert origen +15, operador nuevo +5).

### Tab Detección Fraude

- Inputs: País origen + TARIC + Valor + Cantidad.
- Botón rojo **Analizar Fraude**.
- Resultado: Nivel de Riesgo (LOW/MEDIUM/HIGH/CRITICAL) + Puntuación /100 + Alertas detectadas + Recomendaciones.

### Modelos y precisión

- Clasificación TARIC: 85%
- Predicción Circuito: 78%
- Detección Fraude: 92%

---

## Configuración (Settings)

**Ruta**: `/settings`

![Configuración](../img/settings.png)

### Para qué sirve

Configuración de la **organización** (tenant): info empresa, marca, valores por defecto, notificaciones, seguridad, roles, aduanas, integraciones.

### 8 tabs

| Tab | Contenido |
|---|---|
| **General** | Nombre · Slug · NIF/CIF · EORI · REA · Tipo · Dirección · Estado de la cuenta |
| **Marca** | Logo (drag & drop) · Color principal (color picker) · Display name |
| **Valores por Defecto** | Aduana · Moneda (EUR/USD/GBP) · Idioma · Timezone · Formato fecha |
| **Notificaciones** | 4 toggles: Email Alertas · Recordatorios Plazos · Notificaciones Canal · Reporte Semanal |
| **Seguridad** | MFA toggle · Sesión timeout · IP whitelist · Política contraseña (longitud, expiración, requisitos) |
| **Roles** | Tabla con 5 roles built-in: Administrador (8) · Gestor · Agente Aduanero (3) · Operador · Visualizador. Botón **+ Crear rol custom** |
| **Aduanas** | 5 países (ES + NL activos · BE/DE/FR «Próximamente»). EORI + entorno + cert por país. Botón **Subir certificado** |
| **Integraciones** | Cards: Certificado AEAT (Configurado verde) · API Key · Webhooks |

### Botones globales

- **Guardar Cambios** (header, violeta) — guarda toda la sección activa.
- **+ Importar Certificado** (en tab Aduanas) — sube `.p12/.pfx` con password + alias.

### Datos del tenant cargados

Tras los fixes, la pantalla muestra los datos reales del tenant logado (en este caso STRIX AI SL):

- Nombre: STRIX AI SL
- NIF/CIF: B22477020
- EORI: ESB22477020
- Plan: Professional
- Estado: Activa

---

## Admin Panel

**Ruta**: `/admin`

![Admin Panel](../img/admin-panel.png)

### Para qué sirve

Panel administrativo del tenant: gestión de **usuarios**, configuración global del sistema, logs de **auditoría**.

> **Solo accesible si tu rol es `admin`**.

### 4 tabs

| Tab | Contenido |
|---|---|
| **Dashboard** | 4 stats cards (Total Usuarios · Actividad 24h · Estado AEAT · Asistente IA) + Usuarios por Rol |
| **Usuarios** | Tabla con todos los usuarios del tenant + filtros (search/role/status) + acciones (Editar / Reset password / Eliminar) + botón + Nuevo Usuario |
| **Configuración** | 4 secciones (General / Notificaciones / Seguridad / Integraciones) cada una con su botón Guardar |
| **Auditoría** | Logs de actividad con filtros por módulo y acción |

### Tab Usuarios — gestionar accesos

- 11 usuarios reales en el tenant (8 Admin + 3 Agente).
- Tabla con avatar circular + email + rol + status + última conexión + 3 acciones.
- Modal **Nuevo Usuario**: email + nombre + rol (default «Agente Aduanero») + checkbox «Generar contraseña automática».
- Acción **Reset password** → genera contraseña temporal y la muestra en modal (tú se la pasas al usuario).

### Tab Auditoría — qué pasó

- 4 stats cards (Total eventos / Últimos 7 días / Módulo más activo / Usuario más activo).
- Filtros por módulo (8: auth, expeditions, declarations, inspections, settings, users, aeat, reports) y acción (LOGIN / CREATE / UPDATE / DELETE / EXPORT / SUBMIT / CONFIG_CHANGE).
- Tabla con 5 columnas (Fecha/Hora · Usuario · Acción + emoji · Módulo · Descripción).

### Sin panel IA dedicado

El stat «Asistente IA Activo» del Dashboard solo refleja el estado del servicio Claude. Esta es una pantalla de administración pura, no de inteligencia.

---

## Atajos útiles

- Desde Analytics → click sobre KPI «Tasa Error» → te lleva a la lista filtrada de declaraciones rechazadas.
- Desde ML Insights → click resultado clasificación → enlace a TARIC en Calculadora.
- Desde Settings → tab Aduanas → cargar nuevo país → activa la integración inmediatamente.
- Desde Admin → Usuarios → Reset → la contraseña temporal se muestra una sola vez (cópiala antes de cerrar el modal).

---

[← AEAT e Integraciones](aeat-integraciones.md) · [Volver a Pantallas](README.md) · [Índice general](../README.md)
