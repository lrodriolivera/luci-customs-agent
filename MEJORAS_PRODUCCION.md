# LUCI - Plan de Mejoras para Producción

**Fecha:** 23 de Enero de 2026
**Proyecto:** LUCI - Agente Aduanero Inteligente
**Estado:** Desarrollo para Producción

---

## 1. CRÍTICO PARA PRODUCCIÓN

Estas mejoras son **obligatorias** antes de ir a producción.

### 1.1 Integración AEAT Real

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | 100% simulada en `simulationEngine.js` |
| **Archivo** | `backend/src/services/aeat/simulationEngine.js` |
| **Qué falta** | Conexión SOAP real a AEAT, manejo de respuestas XML |
| **Requiere** | Certificados digitales, acceso a entorno AEAT |
| **Complejidad** | Alta |
| **Impacto** | Crítico - Sin esto no se pueden enviar declaraciones |

**Tareas:**
- [ ] Obtener certificados digitales para AEAT
- [ ] Configurar acceso a entorno de pruebas AEAT
- [ ] Implementar cliente SOAP para H1/AES
- [ ] Manejar respuestas y errores de AEAT
- [ ] Implementar retry logic con exponential backoff
- [ ] Rate limiting para no saturar AEAT

### 1.2 Firma Digital XAdES

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | Mock en `signatureService.js` línea 52, 66 |
| **Archivo** | `backend/src/services/aeat/signatureService.js` |
| **Qué falta** | Firma XAdES-BES real con certificados x509 |
| **Requiere** | Certificados PKCS#12 válidos |
| **Complejidad** | Alta |
| **Impacto** | Crítico - Declaraciones rechazadas sin firma válida |

**Tareas:**
- [ ] Implementar XAdES-BES signature real
- [ ] Soporte para certificados PKCS#12
- [ ] Timestamp autorizado de firma
- [ ] Validación de certificados antes de usar
- [ ] Manejo de expiración de certificados

### 1.3 Integración TRACES Real

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | Simulada en `tracesService.js` |
| **Archivo** | `backend/src/services/traces/tracesService.js` |
| **Qué falta** | Submission real de CHEDs a TRACES |
| **Requiere** | Credenciales TRACES, API keys |
| **Complejidad** | Alta |
| **Impacto** | Alto - No se pueden gestionar certificados sanitarios |

**Tareas:**
- [ ] Implementar CHED submission real
- [ ] Soporte para CHED-A, CHED-P, CHED-D, CHED-PP
- [ ] Polling de estados de CHED
- [ ] Notificaciones cuando CHED es aprobado/rechazado
- [ ] Manejo de errores y reintentos

### 1.4 Pasarela de Pagos Real

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | Mock en `PortalPayments.jsx` líneas 81-82 |
| **Archivo** | `frontend/src/components/Portal/PortalPayments.jsx` |
| **Qué falta** | Integración con pasarela real |
| **Opciones** | Stripe, Redsys, PayPal |
| **Complejidad** | Media |
| **Impacto** | Alto - No se pueden cobrar derechos aduaneros |

**Tareas:**
- [ ] Seleccionar pasarela de pagos
- [ ] Implementar integración backend
- [ ] Implementar UI de pago segura
- [ ] Webhooks para confirmación de pagos
- [ ] Gestión de reembolsos
- [ ] Cumplimiento PCI-DSS

### 1.5 Autenticación 2FA/MFA

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | Solo JWT básico |
| **Qué falta** | Segundo factor de autenticación |
| **Opciones** | TOTP (Google Authenticator), SMS, Email |
| **Complejidad** | Media |
| **Impacto** | Crítico - Vulnerabilidad de seguridad |

**Tareas:**
- [ ] Implementar TOTP con speakeasy/otplib
- [ ] UI para configurar 2FA
- [ ] Códigos de backup
- [ ] Opción de 2FA obligatorio para admins
- [ ] Audit log de accesos

### 1.6 Testing Completo

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | 39 tests backend, 0 tests frontend |
| **Objetivo** | Cobertura >80% |
| **Complejidad** | Media |
| **Impacto** | Alto - Prevenir bugs en producción |

**Tareas:**
- [ ] Tests unitarios de componentes React críticos
- [ ] Tests de integración de flujos principales
- [ ] Tests E2E con Playwright/Cypress
- [ ] Tests de servicios AEAT, TRACES
- [ ] CI/CD con tests automáticos

### 1.7 Logging y Monitoreo

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | 93 console.log, logs básicos |
| **Qué falta** | Logging estructurado, APM, alerting |
| **Complejidad** | Media |
| **Impacto** | Alto - Detectar y resolver problemas en producción |

**Tareas:**
- [ ] Reemplazar console.log con logger estructurado
- [ ] Centralizar logs (ELK Stack / CloudWatch)
- [ ] Implementar APM (New Relic / Datadog)
- [ ] Alertas automáticas por errores críticos
- [ ] Dashboard de salud del sistema

---

## 2. ALTA PRIORIDAD

Mejoras importantes que deberían implementarse pronto después de producción.

### 2.1 Notificaciones Real-Time

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | Polling periódico |
| **Mejora** | WebSocket para notificaciones instantáneas |
| **Complejidad** | Media |
| **Impacto** | Alto |

**Beneficios:**
- Alertas inmediatas de deadlines
- Respuestas de AEAT en tiempo real
- Actualizaciones de TRACES
- Documentos subidos por clientes

**Tareas:**
- [ ] Implementar Socket.io en backend
- [ ] Crear NotificationService
- [ ] UI de notificaciones en frontend
- [ ] Persistencia de notificaciones no leídas
- [ ] Configuración por usuario

### 2.2 Chat LUCI Contextual

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | Chat genérico sin contexto |
| **Mejora** | LUCI conoce el expediente que está viendo el usuario |
| **Complejidad** | Media |
| **Impacto** | Alto |

**Funcionalidades:**
- Sugerir documentos faltantes del expediente actual
- Avisar de requisitos no cumplidos
- Calcular deuda aduanera con datos del expediente
- Responder preguntas específicas del caso

**Tareas:**
- [ ] Pasar contexto de expediente al chat
- [ ] Prompts específicos por tipo de consulta
- [ ] Historial de conversaciones por expediente
- [ ] Búsqueda en historial

### 2.3 Análisis de Documentos con IA

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | Upload manual de documentos |
| **Mejora** | OCR y extracción automática de datos |
| **Complejidad** | Alta |
| **Impacto** | Alto |

**Funcionalidades:**
- OCR de facturas comerciales
- Extracción de datos de packing lists
- Identificación de problemas en documentos
- Sugerencias de corrección

**Tareas:**
- [ ] Integrar servicio OCR (Tesseract / AWS Textract)
- [ ] Modelos de extracción por tipo de documento
- [ ] Validación automática de datos extraídos
- [ ] UI para revisar y corregir extracciones

### 2.4 Validaciones Avanzadas

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | Validaciones básicas de formato |
| **Mejora** | Validación contra bases de datos reales |
| **Complejidad** | Media |
| **Impacto** | Alto |

**Validaciones a implementar:**
- TARIC codes contra base de datos oficial
- EORI contra VIES
- NIF/CIF españoles
- Países y códigos ISO
- Códigos de aduana

**Tareas:**
- [ ] Integrar API de validación VIES
- [ ] Base de datos local de TARIC codes
- [ ] Validación en tiempo real en formularios
- [ ] Mensajes de error descriptivos

### 2.5 Dashboard Predictivo

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | Métricas históricas básicas |
| **Mejora** | Predicciones basadas en ML |
| **Complejidad** | Alta |
| **Impacto** | Alto |

**Métricas a añadir:**
- Predicción de canal (verde/naranja/rojo)
- Carga prevista próxima semana
- Expedientes con riesgo de retraso
- Tasa de canal verde vs media nacional

**Tareas:**
- [ ] Modelo de predicción de canal
- [ ] Análisis de tendencias históricas
- [ ] Alertas de desviaciones
- [ ] Benchmarking por tipo de producto/país

---

## 3. PRIORIDAD MEDIA

Mejoras de calidad y experiencia de usuario.

### 3.1 Mejoras de UX

| Mejora | Complejidad | Impacto |
|--------|-------------|---------|
| Skeleton loaders en vez de spinners | Baja | Medio |
| Error boundaries React | Baja | Medio |
| Guardado automático de borradores | Baja | Alto |
| Optimistic updates | Media | Medio |
| Cancelación de operaciones en progreso | Media | Medio |

### 3.2 Caché con Redis

| Aspecto | Detalle |
|---------|---------|
| **Beneficio** | Mejorar performance significativamente |
| **Complejidad** | Media |
| **Impacto** | Alto |

**Datos a cachear:**
- Resultados de búsqueda TARIC
- Datos de cliente frecuentes
- Sesiones de usuario
- Configuraciones del sistema

### 3.3 Documentación API (Swagger/OpenAPI)

| Aspecto | Detalle |
|---------|---------|
| **Estado actual** | Sin documentación formal de APIs |
| **Complejidad** | Baja |
| **Impacto** | Medio |

**Tareas:**
- [ ] Documentar todos los endpoints con OpenAPI 3.0
- [ ] Generar UI interactiva con Swagger UI
- [ ] Ejemplos de request/response
- [ ] Autenticación documentada

### 3.4 Integraciones Adicionales

| Integración | Estado | Prioridad |
|-------------|--------|-----------|
| NCTS (Tránsitos) | 30% config | Media |
| VUA (Ventanilla Única) | 20% config | Media |
| EUR-Lex scraper | Solo búsqueda | Baja |
| BOE alertas | Catálogo básico | Baja |

---

## 4. MEJORAS RÁPIDAS (Quick Wins)

Implementables en menos de 1 día cada una.

| Mejora | Tiempo estimado | Impacto |
|--------|-----------------|---------|
| Añadir índices MongoDB faltantes | 2 horas | Alto |
| Multiidioma en chat (EN, FR) | 4 horas | Medio |
| Exportar dashboard a PDF | 4 horas | Medio |
| Alertas email cuando integraciones fallan | 3 horas | Alto |
| Limpieza de console.log | 2 horas | Bajo |
| Soft deletes en modelos | 3 horas | Medio |

---

## 5. DEUDA TÉCNICA

Problemas a resolver eventualmente.

| Problema | Ubicación | Impacto |
|----------|-----------|---------|
| 93 console.log en código | Frontend/Backend | Bajo |
| 44 componentes con placeholders | Frontend | Medio |
| Falta de error handling consistente | Backend controllers | Alto |
| Queries sin optimizar | Varios servicios | Medio |
| Código duplicado en controllers | Backend | Bajo |

---

## 6. REQUISITOS EXTERNOS

Necesarios para implementar mejoras críticas.

### Para AEAT:
- [ ] Certificado digital de representante aduanero
- [ ] Alta en sistema AEAT
- [ ] Acceso a entorno de pruebas
- [ ] Documentación técnica de AEAT

### Para TRACES:
- [ ] Credenciales de acceso TRACES
- [ ] API keys
- [ ] Documentación de API

### Para Pagos:
- [ ] Cuenta en pasarela seleccionada
- [ ] Certificación PCI-DSS (si aplica)
- [ ] Cuenta bancaria para liquidaciones

### Para 2FA:
- [ ] Servicio SMS (si se usa SMS como 2FA)
- [ ] Dominio verificado para emails

---

## 7. ESTIMACIÓN DE TIEMPOS

| Fase | Mejoras | Tiempo estimado |
|------|---------|-----------------|
| **Fase 1** | AEAT real, Firma XAdES, 2FA | 4-6 semanas |
| **Fase 2** | TRACES, Pagos, Tests | 3-4 semanas |
| **Fase 3** | Notificaciones, Chat contextual | 2-3 semanas |
| **Fase 4** | Dashboard predictivo, OCR | 3-4 semanas |
| **Fase 5** | Integraciones adicionales | 2-3 semanas |

**Total estimado para producción completa:** 14-20 semanas

---

## 8. PRÓXIMOS PASOS RECOMENDADOS

1. **Inmediato:** Obtener certificados y accesos AEAT/TRACES
2. **Semana 1-2:** Implementar 2FA/MFA
3. **Semana 3-6:** Integración AEAT real
4. **Semana 7-8:** Integración TRACES real
5. **Semana 9-10:** Pasarela de pagos
6. **Semana 11-12:** Tests completos
7. **Semana 13-14:** Logging y monitoreo
8. **Post-lanzamiento:** Mejoras de prioridad alta y media

---

*Documento generado el 23/01/2026 - LUCI Customs Agent*
