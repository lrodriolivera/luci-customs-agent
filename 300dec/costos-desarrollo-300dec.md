# Costos de Desarrollo - Prototipo ADU002

## Proyecto: Gestion de Notificaciones AEAT para 300dec / Correos de Espana

**Preparado por**: STRIX AI SL
**Fecha**: 17 de febrero de 2026
**Referencia**: ADU002-COST-2026-001
**Version**: 1.1

---

## 1. Equipo y Tarifas

| Recurso | Tarifa (EUR/h) | Rol |
|---------|:--------------:|-----|
| Desarrollador Lead (Backend + Arquitectura + AEAT) | 35 | Integraciones, API, modelos, IA, AEAT |
| Desarrollador Full-Stack (Frontend + Backend) | 30 | Panel gestion, UI, servicios de soporte |
| Asistente IA (Claude Code) | 3 | Generacion de codigo, REGEX, tests, docs |

*Equipo de 2 desarrolladores con asistencia de IA generativa para aceleracion del desarrollo.*
*El uso de Claude Code reduce entre un 40-60% el tiempo de desarrollo en tareas de codificacion, generacion de patrones y testing.*

---

## 2. Desglose por Alcance

### 2.1 Alcance 0 - Clasificacion + Extraccion + Gestor Documental

**19 documentos** | **Duracion: 2 semanas**

| Tarea | Recurso | Horas | Coste (EUR) |
|-------|---------|:-----:|:-----------:|
| Modelo de datos NotificacionAEAT (schema MongoDB) | Dev Lead | 4 | 140 |
| Email Listener IMAP (recepcion + extraccion PDFs) | Dev Lead | 10 | 350 |
| Motor de clasificacion REGEX (43 patrones) | Dev Lead + Claude Code | 8+6 | 298 |
| Clasificador IA fallback (prompt especializado AEAT) | Dev Lead | 8 | 280 |
| Extractor IA de campos (MRN, CSV, importes, plazos, partes) | Dev Lead | 8 | 280 |
| Gestor documental (archivo, metadatos, busqueda) | Dev Lead | 6 | 210 |
| API REST v2 - endpoints notificaciones 300dec | Dev Lead + Claude Code | 8+4 | 292 |
| Panel de gestion notificaciones (lista, filtros, detalle) | Dev Full-Stack | 14 | 420 |
| Alertas por email de nuevas notificaciones | Dev Full-Stack | 4 | 120 |
| Autenticacion API keys + rate limiting | Dev Lead | 3 | 105 |
| Testing funcional + validacion con PDFs reales | Dev Full-Stack + Claude Code | 8+4 | 252 |
| **Subtotal Alc0** | | **95** | **2.747** |

### 2.2 Alcance 1 - Web Aduanas (Alc0 + Web Aduanas)

**9 documentos adicionales** | **Duracion: 1 semana adicional**

| Tarea | Recurso | Horas | Coste (EUR) |
|-------|---------|:-----:|:-----------:|
| Automatizacion Web Aduanas (finalizar notificaciones) | Dev Lead | 10 | 350 |
| Workflow engine: notificacion -> clasificar -> extraer -> finalizar | Dev Lead + Claude Code | 8+3 | 289 |
| Tracking de estado por notificacion (estados, transiciones) | Dev Lead | 4 | 140 |
| Dashboard pendientes/finalizadas | Dev Full-Stack | 8 | 240 |
| Patrones REGEX Alc1 (9 docs adicionales) | Dev Lead + Claude Code | 3+3 | 114 |
| Testing E2E Web Aduanas + workflows | Dev Full-Stack + Claude Code | 6+3 | 189 |
| **Subtotal Alc1** | | **48** | **1.322** |

### 2.3 Alcance 2 - MINERVA / Oficina Dato (Alc1 + Sistemas Correos)

**10 documentos adicionales** | **Duracion: 1 semana adicional**

| Tarea | Recurso | Horas | Coste (EUR) |
|-------|---------|:-----:|:-----------:|
| Integracion MINERVA (consultas + cambio estados) | Dev Lead | 10 | 350 |
| Integracion Oficina Dato | Dev Lead | 6 | 210 |
| Integracion CECA/LINCE (envio a sistemas terceros) | Dev Lead | 6 | 210 |
| Generacion ficheros de salida (CSV/Excel) | Dev Full-Stack + Claude Code | 3+2 | 96 |
| Control duplicados (Ref AEAT, CSV) | Dev Lead | 3 | 105 |
| Workflows por tipo: sanciones, liquidaciones, comunicaciones | Dev Lead + Claude Code | 6+3 | 219 |
| Plazos y alertas automaticas | Dev Full-Stack | 5 | 150 |
| Patrones REGEX Alc2 (10 docs adicionales) | Claude Code + Dev Lead | 3+2 | 79 |
| Panel frontend ampliado (MINERVA, ficheros) | Dev Full-Stack | 6 | 180 |
| Testing integraciones sistemas Correos | Dev Full-Stack + Claude Code | 5+2 | 156 |
| **Subtotal Alc2** | | **62** | **1.755** |

### 2.4 Alcance 3 - SAI / SINTRA / TARIC (Completo)

**5 documentos adicionales (alta complejidad)** | **Duracion: 1 semana adicional**

| Tarea | Recurso | Horas | Coste (EUR) |
|-------|---------|:-----:|:-----------:|
| Integracion SAI - Sistema Aduanero Integrado | Dev Lead | 10 | 350 |
| Integracion SINTRA (cambio de estado envios) | Dev Lead | 6 | 210 |
| Integracion TARIC completa (verificacion clasificacion) | Dev Lead | 5 | 175 |
| Workflow complejo: requerimiento -> SAI -> cliente -> seguimiento -> AEAT | Dev Lead + Claude Code | 6+3 | 219 |
| Logica de plazos complejos (10, 20, 30 dias, reenvios automaticos) | Dev Lead | 5 | 175 |
| Propuesta liquidacion: presupuesto -> cliente -> renuncia alegaciones | Dev Lead + Claude Code | 5+2 | 181 |
| Integracion Integrador (cambio estados, envio presupuestos) | Dev Lead | 5 | 175 |
| Patrones REGEX Alc3 (5 docs adicionales) | Claude Code + Dev Lead | 2+1 | 41 |
| Testing E2E flujos complejos + SAI/SINTRA | Dev Full-Stack + Claude Code | 6+3 | 189 |
| **Subtotal Alc3** | | **59** | **1.715** |

---

## 3. Resumen de Costos Internos por Alcance

| Alcance | Documentos | Horas | Coste Interno | Acumulado |
|---------|:----------:|:-----:|:-------------:|:---------:|
| **Alc0** - Clasificacion + Extraccion + Gestor | 19 | 95 | 2.747 EUR | 2.747 EUR |
| **Alc1** - + Web Aduanas | 9 | 48 | 1.322 EUR | 4.069 EUR |
| **Alc2** - + MINERVA / Oficina Dato | 10 | 62 | 1.755 EUR | 5.824 EUR |
| **Alc3** - + SAI / SINTRA / TARIC | 5 | 59 | 1.715 EUR | 7.539 EUR |
| **TOTAL** | **43** | **264** | | **7.539 EUR** |

---

## 4. Costes Adicionales Internos (No Recurrentes)

| Concepto | Coste (EUR) |
|----------|:-----------:|
| Configuracion entorno 300dec (tenant, API keys, DNS) | 100 |
| Documentacion tecnica API v2 (generada con Claude Code) | 100 |
| Documentacion operativa y manual de uso | 100 |
| Capacitacion equipo 300dec (2 sesiones x 2h) | 250 |
| Deploy produccion + configuracion infraestructura | 150 |
| **Subtotal adicionales** | **700** |

---

## 5. Costes Recurrentes Mensuales

| Concepto | Coste/mes (EUR) |
|----------|:---------------:|
| Infraestructura cloud (compartida con LUCI) | 30 |
| IA - clasificacion + extraccion (~300 docs/mes) | 80 |
| IA - picos de volumen (estimado) | 40 |
| Almacenamiento documental (PDFs, metadatos) | 15 |
| Monitorizacion y alertas | 15 |
| Mantenimiento correctivo + evolutivo menor | 500 |
| **Total recurrente** | **680 EUR/mes** |

---

## 6. Resumen Ejecutivo - Coste Interno vs Precio Cliente

| Opcion | Alcance | Docs | Tiempo | Coste Interno | Precio Cliente | Margen |
|--------|---------|:----:|:------:|:-------------:|:--------------:|:------:|
| **MVP** | Alc0 | 19 | 2 sem | 2.747 EUR | 10.000 EUR | 72% |
| **Recomendado** | Alc0 + Alc1 | 28 | 3 sem | 4.069 EUR | 15.000 EUR | 73% |
| **Avanzado** | Alc0 + Alc1 + Alc2 | 38 | 4 sem | 5.824 EUR | 22.000 EUR | 74% |
| **Completo** | Alc0 - Alc3 | 43 | 5 sem | 7.539 EUR | 28.000 EUR | 73% |

*Costes adicionales internos (docs, capacitacion, deploy): +700 EUR.*
*Margen calculado sobre precio cliente sin adicionales.*

---

## 7. Desglose de Horas por Recurso

| Recurso | Alc0 | Alc1 | Alc2 | Alc3 | Total Horas | Coste Total |
|---------|:----:|:----:|:----:|:----:|:-----------:|:-----------:|
| Dev Lead (Backend + Arq + AEAT) | 55 | 25 | 34 | 42 | 156 | 5.460 EUR |
| Dev Full-Stack (Frontend + Backend) | 26 | 14 | 14 | 6 | 60 | 1.800 EUR |
| Claude Code (IA asistente) | 14 | 9 | 14 | 11 | 48 | 144 EUR |
| **Total** | **95** | **48** | **62** | **59** | **264** | **7.404 EUR** |

*Nota: Las diferencias de redondeo entre tablas se deben al calculo mixto de horas Dev+Claude en tareas compartidas.*

---

## 8. Impacto de Claude Code en el Desarrollo

| Actividad | Sin IA | Con Claude Code | Ahorro |
|-----------|:------:|:---------------:|:------:|
| Generacion de 43 patrones REGEX | 24h | 8h dev + 6h IA | 67% |
| Scaffolding API endpoints | 16h | 8h dev + 4h IA | 50% |
| Generacion tests E2E | 16h | 6h dev + 3h IA | 56% |
| Documentacion tecnica | 12h | 2h dev + 2h IA | 67% |
| Workflows y logica de negocio | 20h | 12h dev + 6h IA | 40% |
| **Promedio reduccion** | | | **55%** |

**Horas estimadas sin Claude Code**: ~580h
**Horas reales con Claude Code**: ~264h
**Reduccion total**: **55%**

---

## 9. Ventajas de Coste - Reutilizacion LUCI

| Componente reutilizado | Coste desarrollo desde cero | Ahorro |
|------------------------|:---------------------------:|:------:|
| Motor IA (clasificacion + extraccion) | 12.000 EUR | 10.500 EUR |
| Integracion AEAT (6 XML builders + cert FNMT) | 18.000 EUR | 16.500 EUR |
| API REST + autenticacion + rate limiting | 4.000 EUR | 3.500 EUR |
| Gestor documental base | 3.000 EUR | 2.500 EUR |
| Sistema de plazos y alertas | 3.000 EUR | 2.500 EUR |
| PDF generation | 2.000 EUR | 1.700 EUR |
| Infraestructura cloud + deploy | 3.000 EUR | 2.800 EUR |
| **Total ahorro por reutilizacion** | | **40.000 EUR** |

**Coste estimado desarrollo desde cero (equipo convencional)**: ~57.000 EUR
**Coste con LUCI + equipo reducido + Claude Code**: ~7.539 EUR
**Ahorro total**: **87%**

---

**Contacto**:
STRIX AI SL | NIF: B22477020
Jenifer Romero | `despacho@strixai.es`
`https://aduanas.strixai.es`
