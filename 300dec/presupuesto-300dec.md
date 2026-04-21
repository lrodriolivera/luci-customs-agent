# Presupuesto de Desarrollo - ADU002

## Gestion Automatizada de Notificaciones AEAT

**Cliente**: 300dec / Correos de Espana
**Proveedor**: STRIX AI SL
**Fecha**: 17 de febrero de 2026
**Referencia**: ADU002-PRES-2026-001
**Validez**: 30 dias

---

## 1. Objeto del Presupuesto

Desarrollo e implantacion de un modulo de gestion automatizada de notificaciones AEAT sobre la plataforma LUCI, que incluye:

- Recepcion automatica de emails con PDFs de AEAT
- Clasificacion inteligente en 43 tipos de documento (REGEX + IA)
- Extraccion de datos estructurados (MRN, CSV, importes, plazos, partes)
- Gestor documental con metadatos y busqueda
- Automatizacion de acciones por tipo de notificacion
- API REST para integracion con sistemas del cliente

---

## 2. Alcances y Precios

### Alcance 0 - Clasificacion + Extraccion + Gestor Documental

**19 tipos de documento** | **Plazo: 2 semanas**

| Funcionalidad | Detalle |
|---------------|---------|
| Recepcion emails | Listener IMAP para buzones Correos con extraccion de PDFs |
| Clasificacion | 43 patrones REGEX + clasificador IA como fallback |
| Extraccion datos | MRN, CSV, importes, plazos, partes implicadas |
| Gestor documental | Archivo PDF con metadatos, busqueda e historial |
| Panel de gestion | Lista de notificaciones, filtros por tipo/fecha/estado, detalle |
| API REST v2 | Endpoints de consulta para sistemas 300dec |
| Alertas | Notificaciones por email de nuevas entradas |

**Precio: 10.000 EUR**

---

### Alcance 1 - Alc0 + Web Aduanas

**9 tipos de documento adicionales** | **Plazo: 1 semana adicional**

| Funcionalidad | Detalle |
|---------------|---------|
| Web Aduanas | Finalizacion automatica de notificaciones en portal AEAT |
| Workflows | Motor configurable: recepcion -> clasificar -> extraer -> finalizar |
| Tracking | Estados y transiciones por notificacion |
| Dashboard | Panel de pendientes y finalizadas con metricas |

**Precio adicional: 5.000 EUR**

---

### Alcance 2 - Alc1 + MINERVA / Oficina Dato

**10 tipos de documento adicionales** | **Plazo: 1 semana adicional**

| Funcionalidad | Detalle |
|---------------|---------|
| MINERVA | Consultas automaticas y cambio de estados |
| Oficina Dato | Integracion con sistema de gestion interno |
| CECA/LINCE | Envio a sistemas terceros |
| Ficheros salida | Generacion de ficheros estructurados (CSV/Excel) |
| Control duplicados | Deteccion por Ref AEAT y/o CSV |
| Plazos y alertas | Sistema de alertas automaticas con escalado |

**Precio adicional: 7.000 EUR**

---

### Alcance 3 - Alc2 + SAI / SINTRA / TARIC

**5 tipos de documento adicionales (alta complejidad)** | **Plazo: 1 semana adicional**

| Funcionalidad | Detalle |
|---------------|---------|
| SAI | Integracion Sistema Aduanero Integrado |
| SINTRA | Cambio de estado de envios |
| TARIC | Verificacion de clasificacion arancelaria |
| Workflow complejo | Requerimiento -> SAI -> cliente -> seguimiento -> AEAT |
| Plazos avanzados | Logica de 10, 20 y 30 dias con reenvios automaticos |
| Liquidaciones | Presupuesto -> cliente -> renuncia de alegaciones |

**Precio adicional: 6.000 EUR**

---

## 3. Resumen de Precios

| Opcion | Alcance | Documentos | Plazo | Precio |
|--------|---------|:----------:|:-----:|:------:|
| **MVP** | Alc0 | 19 | 2 semanas | **10.000 EUR** |
| **Recomendado** | Alc0 + Alc1 | 28 | 3 semanas | **15.000 EUR** |
| **Avanzado** | Alc0 + Alc1 + Alc2 | 38 | 4 semanas | **22.000 EUR** |
| **Completo** | Alc0 + Alc1 + Alc2 + Alc3 | 43 | 5 semanas | **28.000 EUR** |

*Todos los precios son netos + IVA aplicable.*

---

## 4. Servicios Incluidos en Todos los Alcances

| Servicio | Detalle |
|----------|---------|
| Configuracion de entorno | Tenant aislado, API keys, configuracion DNS |
| Documentacion tecnica | Especificacion API v2 completa |
| Manual operativo | Guia de uso del panel de gestion |
| Capacitacion | 2 sesiones de formacion (2h cada una) |
| Despliegue en produccion | Instalacion y puesta en marcha |
| Soporte post-lanzamiento | 30 dias de soporte incluido tras el go-live |

---

## 5. Costes Recurrentes Mensuales

| Concepto | Coste/mes |
|----------|:---------:|
| Infraestructura cloud (compartida) | 30 EUR |
| Motor IA - clasificacion y extraccion (~300 docs/mes) | 120 EUR |
| Almacenamiento documental | 15 EUR |
| Monitorizacion y alertas | 15 EUR |
| Mantenimiento y soporte tecnico | 500 EUR |
| **Total mensual** | **680 EUR/mes** |

---

## 6. Cronograma de Entregas

| Semana | Entregable | Alcance |
|:------:|-----------|:-------:|
| 1 | Email listener + clasificacion + extraccion + modelo de datos | Alc0 |
| 2 | API v2 + panel de gestion + gestor documental + alertas | Alc0 |
| 3 | Web Aduanas + workflows + dashboard + tracking | Alc1 |
| 4 | MINERVA + Oficina Dato + CECA/LINCE + ficheros + plazos | Alc2 |
| 5 | SAI + SINTRA + TARIC + testing E2E + deploy produccion | Alc3 |

---

## 7. Condiciones

- **Forma de pago**: 50% al inicio del proyecto, 50% a la entrega
- **Validez**: Este presupuesto es valido durante 30 dias desde la fecha de emision
- **Requisitos del cliente**: Acceso a muestras de PDFs de notificaciones AEAT reales para calibracion de clasificadores. Documentacion de APIs de sistemas externos (MINERVA, SAI, SINTRA) si aplica en el alcance contratado
- **Propiedad intelectual**: El codigo desarrollado especificamente para 300dec es propiedad del cliente. La plataforma LUCI subyacente permanece propiedad de STRIX AI SL
- **SLA**: Disponibilidad del 99.5% en horario laboral (L-V 8:00-20:00)

---

## 8. Tecnologia y Garantias

| Aspecto | Detalle |
|---------|---------|
| Plataforma base | LUCI - plataforma aduanera con 90% de infraestructura existente |
| Integracion AEAT | 6 XML builders validados contra AEAT con certificado FNMT |
| Motor IA | Clasificacion y extraccion con aprendizaje continuo |
| Seguridad | Aislamiento multi-tenant, cifrado en transito y en reposo |
| API | REST v2 con autenticacion por API keys y rate limiting |
| Infraestructura | Cloud con backups diarios y monitorizacion 24/7 |

---

**Contacto**:
STRIX AI SL | NIF: B22477020
Jenifer Romero | `despacho@strixai.es`
`https://aduanas.strixai.es`
