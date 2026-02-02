# PLAN DE DESARROLLO: LUCI como Agente de Aduanas Completo

**Fecha de creacion**: 2026-01-12
**Ultima actualizacion**: 2026-01-22
**Version**: 1.2.0
**Estado**: COMPLETADO - Fase 6 finalizada

---

## 1. OBJETIVO

Transformar LUCI de un sistema de gestion de expedientes aduaneros a un **agente de aduanas virtual completo** que replique todas las funciones de un representante aduanero humano en Espana.

---

## 2. ESTADO ACTUAL vs OBJETIVO

| Funcion del Agente Humano | Estado Actual | Estado |
|---------------------------|---------------|--------|
| Presentar declaraciones H1 | Integracion AEAT con firma XAdES | ✅ Completado |
| Presentar declaraciones AES | Integracion AEAT con firma XAdES | ✅ Completado |
| Presentar H7 (bajo valor) | Implementado completo | ✅ Completado |
| Gestionar transito (NCTS) | Implementado con garantias | ✅ Completado |
| Seguir circuitos (verde/naranja/rojo) | Implementado completo | ✅ Completado |
| Responder requerimientos AEAT | Sistema completo con auto-respuestas ML | ✅ Completado |
| Coordinar SOIVRE | Implementado | ✅ Completado |
| Coordinar MAPA/Veterinario | Implementado | ✅ Completado |
| Coordinar Sanidad | Implementado | ✅ Completado |
| Gestionar garantias/avales | Sistema completo NRC | ✅ Completado |
| Calcular impuestos especiales | SILICIE implementado | ✅ Completado |
| Gestionar deposito temporal | Regimen 71 implementado | ✅ Completado |
| Regimenes especiales (51, 53, 71) | Todos implementados | ✅ Completado |
| Preferencias arancelarias | EUR.1, Form A, ATR completo | ✅ Completado |
| Validar certificados origen | Automatizado con ML | ✅ Completado |
| Gestionar OEA | Modulo completo con beneficios | ✅ Completado |
| Control de plazos/vencimientos | Sistema de deadlines completo | ✅ Completado |
| Comunicacion con inspector | Implementado con alegaciones | ✅ Completado |
| TRACES NT (trazabilidad) | Integracion implementada | ✅ Completado |
| Prediccion canal aduanero | ML implementado | ✅ Completado |
| Deteccion de fraude | ML implementado | ✅ Completado |
| Workflow Engine | Motor completo con triggers y batch | ✅ Completado |
| Portal cliente self-service | Completo con self-service y stats | ✅ Completado |
| API publica para ERPs | REST API v1 con API keys | ✅ Completado |
| Pasarela de pagos online | Stripe integration | ✅ Completado |

---

## 3. FASES DE DESARROLLO

### FASE 1: Core de Agente Aduanero (Semanas 1-4)
**Prioridad**: CRITICA | **Estado**: COMPLETADA ✓

| # | Funcionalidad | Descripcion | Estado |
|---|---------------|-------------|--------|
| 1.1 | Gestion de Requerimientos AEAT | Sistema completo para recibir, gestionar y responder requerimientos | Completado |
| 1.2 | Circuitos Completos | Verde, amarillo, naranja, rojo con flujos reales | Completado |
| 1.3 | Controles Paraduaneros | SOIVRE, MAPA, Sanidad, MITERD | Completado |
| 1.4 | Declaracion H7 | Envios bajo valor (<150 EUR) | Completado |
| 1.5 | Sistema de Garantias | Garantias individuales, globales, avales NRC | Completado |

### FASE 2: Regimenes Especiales (Semanas 5-8)
**Prioridad**: ALTA | **Estado**: COMPLETADA ✓

| # | Funcionalidad | Descripcion | Estado |
|---|---------------|-------------|--------|
| 2.1 | Perfeccionamiento Activo (51) | Importar sin aranceles para transformar y reexportar | Completado |
| 2.2 | Importacion Temporal (53) | Uso temporal sin pago de derechos | Completado |
| 2.3 | Deposito Aduanero (71) | Almacenamiento sin pago de derechos | Completado |
| 2.4 | Transito NCTS | T1/T2 con garantia y control | Completado |

### FASE 3: Inteligencia Aduanera (Semanas 9-12)
**Prioridad**: MEDIA-ALTA | **Estado**: COMPLETADA ✓

| # | Funcionalidad | Descripcion | Estado |
|---|---------------|-------------|--------|
| 3.1 | Motor de Reglas | Determinar automaticamente requisitos por origen+TARIC | Completado |
| 3.2 | Preferencias Arancelarias | EUR.1, Form A, ATR, acumulacion origen | Completado |
| 3.3 | Impuestos Especiales | SILICIE, alcohol, hidrocarburos, tabaco | Completado |
| 3.4 | Gestion de Contingentes | Consulta y solicitud de cupos | Completado |

### FASE 4: Operativa Avanzada (Semanas 13-16)
**Prioridad**: MEDIA | **Estado**: COMPLETADA ✓

| # | Funcionalidad | Descripcion | Estado |
|---|---------------|-------------|--------|
| 4.1 | Gestor de Plazos | Alertas de vencimientos y deadlines | Completado |
| 4.2 | Comunicacion Inspectores | Respuestas, alegaciones, recursos | Completado |
| 4.3 | Coordinacion Inspecciones | Citas, documentacion, actas | Completado |
| 4.4 | Modulo OEA | Beneficios y simplificaciones | Completado |

### FASE 5: Integraciones Reales (Semanas 17-24)
**Prioridad**: CRITICA para produccion | **Estado**: COMPLETADA ✓

| # | Funcionalidad | Descripcion | Estado |
|---|---------------|-------------|--------|
| 5.1 | AEAT Web Services | H1, AES, consultas, firma digital | Completado (simulacion) |
| 5.2 | VUA | Ventanilla Unica Aduanera | Completado (simulacion) |
| 5.3 | TRACES NT | Trazabilidad productos regulados | Completado (simulacion) |
| 5.4 | NCTS | Sistema de Transito Comunitario | Completado (simulacion) |
| 5.5 | Integration Manager | Gestion centralizada de integraciones | Completado |

### FASE 6: Produccion Avanzada y Escalabilidad (Semanas 25-36)
**Prioridad**: CRITICA para comercializacion | **Estado**: COMPLETADA ✓ (100% - 7/7 completado)

| # | Funcionalidad | Descripcion | Estado |
|---|---------------|-------------|--------|
| 6.1 | Integracion Real AEAT | Certificados digitales, firma XAdES, web services reales | Completado ✓ |
| 6.2 | Analytics y BI | Dashboard KPIs, reportes automaticos, predicciones | Completado ✓ |
| 6.3 | Multi-Tenancy | Multiples organizaciones, facturacion, RBAC | Completado ✓ |
| 6.4 | App Movil | React Native, push notifications, escaneo docs | Completado ✓ |
| 6.5 | ML Avanzado | Prediccion circuitos, deteccion fraude, mejora clasificacion | Completado ✓ |
| 6.6 | Workflow Engine | Automatizacion de flujos, triggers, procesamiento lotes | Completado ✓ |
| 6.7 | Portal Cliente Avanzado | Self-service, pagos online, API publica | Completado ✓ |

**Ver documento detallado**: [FASE_6_PRODUCCION_AVANZADA.md](./FASE_6_PRODUCCION_AVANZADA.md)

---

## 4. DETALLE DE FUNCIONALIDADES

### 4.1 Sistema de Requerimientos AEAT

**Descripcion**: Cuando AEAT asigna canal naranja o rojo, el sistema debe:
1. Recibir notificacion del requerimiento
2. Parsear tipo de requerimiento y documentos solicitados
3. Notificar al agente y cliente
4. Permitir preparar respuesta con justificaciones
5. Adjuntar documentacion adicional
6. Enviar respuesta a AEAT
7. Dar seguimiento hasta resolucion (levante o rechazo)

**Tipos de requerimientos**:
- Documental: Solicitud de facturas, BL, certificados
- Valoracion: Justificacion del valor declarado
- Clasificacion: Justificacion del codigo TARIC
- Origen: Verificacion de origen de la mercancia
- Fisico: Coordinacion de inspeccion fisica

**Modelo de datos**:
```javascript
{
  expeditionId: ObjectId,
  mrn: String,
  requirementType: ['documentary', 'valuation', 'classification', 'origin', 'physical'],
  status: ['pending', 'in_progress', 'responded', 'resolved', 'rejected'],
  requestedDocuments: [String],
  deadline: Date,
  inspectorNotes: String,
  responses: [{
    date: Date,
    documents: [ObjectId],
    notes: String,
    submittedBy: ObjectId
  }],
  resolution: {
    date: Date,
    result: ['approved', 'rejected', 'partial'],
    notes: String
  }
}
```

### 4.2 Circuitos de Control Completos

**Canal Verde** (90% de operaciones):
- Levante automatico
- Notificacion inmediata al cliente
- Generacion de justificante de levante
- Actualizacion de estado del expediente

**Canal Amarillo** (certificados pendientes):
- Identificar certificados faltantes
- Notificar al cliente que documentos necesita
- Permitir subida de certificados
- Re-evaluar automaticamente

**Canal Naranja** (revision documental):
- Crear requerimiento asociado
- Preparar documentacion solicitada
- Enviar respuesta
- Seguimiento hasta resolucion

**Canal Rojo** (inspeccion fisica):
- Coordinar cita con recinto aduanero
- Preparar expediente fisico
- Acompanar inspeccion (checklist)
- Registrar resultado de inspeccion
- Gestionar incidencias

### 4.3 Controles Paraduaneros

**SOIVRE** (Servicio Oficial de Inspeccion):
- Productos industriales sensibles (juguetes, electricos, EPI)
- Generar solicitud de inspeccion
- Seguimiento de resultado
- Integracion con Ministerio de Comercio

**MAPA** (Ministerio de Agricultura):
- Productos de origen animal/vegetal no alimentarios
- Control veterinario
- Control fitosanitario
- Certificados de importacion

**Sanidad Exterior**:
- Productos para consumo humano
- Medicamentos y cosmeticos
- Productos sanitarios
- Certificado sanitario

**MITERD** (Transicion Ecologica):
- Residuos y sustancias peligrosas
- CITES (especies protegidas)
- Productos quimicos (REACH)

### 4.4 Sistema de Garantias

**Tipos de garantia**:
- Individual: Por operacion especifica
- Global: Cubre multiples operaciones
- Reducida: Para OEA (30%, 50%, 100% exencion)

**Funcionalidades**:
- Calcular garantia necesaria por operacion
- Verificar saldo disponible en garantia global
- Generar aval con NRC para AEAT
- Controlar consumo de garantia
- Alertar cuando se agota
- Gestionar aplazamiento de pago (10/30 dias)

---

## 5. APIs Y ENDPOINTS AEAT

(Ver documento separado: api-references/AEAT_ENDPOINTS.md)

---

## 6. METRICAS DE EXITO

| Metrica | Objetivo |
|---------|----------|
| Tiempo medio de despacho | < 4 horas (canal verde) |
| Tasa de errores en declaraciones | < 2% |
| Tiempo respuesta a requerimientos | < 24 horas |
| Satisfaccion del cliente | > 4.5/5 |
| Automatizacion de procesos | > 80% |

---

## 7. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Cambios en APIs AEAT | Media | Alto | Arquitectura modular, tests de integracion |
| Errores en clasificacion TARIC | Media | Alto | Validacion humana, logs de auditoria |
| Caida de servicios externos | Baja | Alto | Cache local, modo offline, reintentos |
| Cambios normativos | Alta | Medio | Base de conocimiento actualizable |

---

## 8. EQUIPO Y RECURSOS

- Desarrollo backend: 1 persona
- Desarrollo frontend: 1 persona
- Integraciones AEAT: Requiere certificado digital representante
- Testing: Entorno de pruebas AEAT

---

## 9. REFERENCIAS

- CAU: Reglamento (UE) 952/2013
- RDCAU: Reglamento Delegado (UE) 2015/2446
- RECAU: Reglamento de Ejecucion (UE) 2015/2447
- Manual H1 AEAT: sede.agenciatributaria.gob.es
- Especificaciones NCTS: ec.europa.eu/taxation_customs

---

**Documento creado por**: Claude Code
**Proyecto**: LUCI Customs Agent - Stock Logistic
