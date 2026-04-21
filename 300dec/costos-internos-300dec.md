# Costos de Desarrollo Interno - ADU002

**Proyecto**: Notificaciones AEAT - 300dec
**Fecha**: 17 de febrero de 2026
**Equipo**: 2 desarrolladores + Claude Code

---

## Equipo y Tarifas

| Recurso | EUR/h |
|---------|:-----:|
| Dev Lead (Backend + Arquitectura + AEAT) | 35 |
| Dev Full-Stack (Frontend + Backend) | 30 |
| Claude Code (asistente IA) | 3 |

---

## Alcance 0 - Clasificacion + Extraccion + Gestor (19 docs)

| Tarea | Recurso | Horas | EUR |
|-------|---------|:-----:|:---:|
| Modelo NotificacionAEAT | Dev Lead | 4 | 140 |
| Email Listener IMAP | Dev Lead | 10 | 350 |
| Motor REGEX (43 patrones) | Dev Lead + Claude | 8+6 | 298 |
| Clasificador IA fallback | Dev Lead | 8 | 280 |
| Extractor IA campos | Dev Lead | 8 | 280 |
| Gestor documental | Dev Lead | 6 | 210 |
| API REST v2 | Dev Lead + Claude | 8+4 | 292 |
| Panel gestion notificaciones | Dev Full-Stack | 14 | 420 |
| Alertas email | Dev Full-Stack | 4 | 120 |
| Auth API keys + rate limiting | Dev Lead | 3 | 105 |
| Testing + validacion PDFs | Dev Full-Stack + Claude | 8+4 | 252 |
| **Subtotal** | | **95h** | **2.747** |

## Alcance 1 - Web Aduanas (9 docs)

| Tarea | Recurso | Horas | EUR |
|-------|---------|:-----:|:---:|
| Automatizacion Web Aduanas | Dev Lead | 10 | 350 |
| Workflow engine | Dev Lead + Claude | 8+3 | 289 |
| Tracking estados | Dev Lead | 4 | 140 |
| Dashboard pendientes/finalizadas | Dev Full-Stack | 8 | 240 |
| Patrones REGEX Alc1 | Dev Lead + Claude | 3+3 | 114 |
| Testing E2E | Dev Full-Stack + Claude | 6+3 | 189 |
| **Subtotal** | | **48h** | **1.322** |

## Alcance 2 - MINERVA / Oficina Dato (10 docs)

| Tarea | Recurso | Horas | EUR |
|-------|---------|:-----:|:---:|
| Integracion MINERVA | Dev Lead | 10 | 350 |
| Integracion Oficina Dato | Dev Lead | 6 | 210 |
| Integracion CECA/LINCE | Dev Lead | 6 | 210 |
| Ficheros salida (CSV/Excel) | Dev Full-Stack + Claude | 3+2 | 96 |
| Control duplicados | Dev Lead | 3 | 105 |
| Workflows por tipo | Dev Lead + Claude | 6+3 | 219 |
| Plazos y alertas | Dev Full-Stack | 5 | 150 |
| Patrones REGEX Alc2 | Claude + Dev Lead | 3+2 | 79 |
| Panel frontend ampliado | Dev Full-Stack | 6 | 180 |
| Testing integraciones | Dev Full-Stack + Claude | 5+2 | 156 |
| **Subtotal** | | **62h** | **1.755** |

## Alcance 3 - SAI / SINTRA / TARIC (5 docs)

| Tarea | Recurso | Horas | EUR |
|-------|---------|:-----:|:---:|
| Integracion SAI | Dev Lead | 10 | 350 |
| Integracion SINTRA | Dev Lead | 6 | 210 |
| Integracion TARIC | Dev Lead | 5 | 175 |
| Workflow complejo | Dev Lead + Claude | 6+3 | 219 |
| Plazos complejos (10/20/30 dias) | Dev Lead | 5 | 175 |
| Propuesta liquidacion | Dev Lead + Claude | 5+2 | 181 |
| Integracion Integrador | Dev Lead | 5 | 175 |
| Patrones REGEX Alc3 | Claude + Dev Lead | 2+1 | 41 |
| Testing E2E | Dev Full-Stack + Claude | 6+3 | 189 |
| **Subtotal** | | **59h** | **1.715** |

---

## Resumen

| Alcance | Horas | Coste | Acumulado |
|---------|:-----:|:-----:|:---------:|
| Alc0 | 95h | 2.747 | 2.747 |
| Alc1 | 48h | 1.322 | 4.069 |
| Alc2 | 62h | 1.755 | 5.824 |
| Alc3 | 59h | 1.715 | 7.539 |
| **Total** | **264h** | | **7.539 EUR** |

## Horas por Recurso

| Recurso | Horas | Coste |
|---------|:-----:|:-----:|
| Dev Lead | 156h | 5.460 |
| Dev Full-Stack | 60h | 1.800 |
| Claude Code | 48h | 144 |
| **Total** | **264h** | **7.404 EUR** |

## Adicionales

| Concepto | EUR |
|----------|:---:|
| Config entorno (tenant, API keys) | 100 |
| Documentacion (Claude Code) | 200 |
| Capacitacion (2 sesiones x 2h) | 250 |
| Deploy produccion | 150 |
| **Total adicionales** | **700** |

**Coste total desarrollo: 8.239 EUR**
