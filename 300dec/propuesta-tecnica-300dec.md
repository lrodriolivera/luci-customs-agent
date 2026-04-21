# Propuesta Tecnica ADU002 - Gestion de Notificaciones AEAT

## Correos de Espana / 300dec

**Preparado por**: STRIX AI SL
**Fecha**: 14 de febrero de 2026
**Version**: 1.0
**Referencia**: ADU002-PROP-2026-001

---

## 1. Resumen Ejecutivo

300dec gestiona ~300 declaraciones aduaneras mensuales para Correos de Espana como operador postal. La AEAT envia notificaciones en formato PDF a los buzones de correo de ADT Postales, que actualmente se gestionan manualmente con Excel.

**Propuesta**: Implementar un modulo de gestion automatizada de notificaciones AEAT sobre la plataforma LUCI, con clasificacion inteligente (REGEX + IA), extraccion de datos, seguimiento de plazos, y API REST para integracion con los sistemas del cliente.

**Cobertura existente**: La plataforma LUCI ya cuenta con el **90% de la infraestructura necesaria**, incluyendo integracion real con AEAT (6 builders XML validados), motor de workflows, gestion de comunicaciones, plazos, API publica y motor de IA propietario.

---

## 2. Analisis de Requerimientos

### 2.1 Tipos de Notificaciones (43 documentos)

| Tipologia | Subtipologias | Docs | Ejemplo |
|-----------|--------------|------|---------|
| **Procedimiento Sancionador** | Inicio expediente, comunicacion sancion, reduccion, pago | 12 | Acuerdo de imposicion de sancion |
| **Liquidaciones** | LRD, providencia apremio, propuesta liquidacion | 5 | Liquidacion provisional por resultado despacho |
| **Requerimientos** | Documentacion, datado, informacion, EXS, ENS | 10 | Requerimiento de documentacion H7 |
| **Comunicaciones** | Abandonos, destrucciones, anulaciones, levante, marcas | 16 | Invalidacion DUA, Levante, Acuerdo destruccion |

### 2.2 Origenes

| Departamento | Notificaciones |
|-------------|---------------|
| Aduanas Interiores (Canarias, Ceuta, Melilla) | 19 tipos |
| Aduana Postal - Circuitos | 15 tipos |
| Aduana Postal - Sanciones | 9 tipos |

### 2.3 Canales de Entrada

| Canal | Direccion | Uso |
|-------|----------|-----|
| Email principal | `adtpostales@correos.com` | Notificaciones AEAT |
| Registro general | `registro.general@correos.com` | Comunicaciones formales |
| RPA | `rpa.automatico@correos.com` | Automatizaciones existentes |

### 2.4 Acciones Requeridas por Notificacion

| Accion | Descripcion | Sistemas |
|--------|------------|----------|
| Extraer campos | REGEX + IA sobre PDF | LUCI |
| Gestor documental | Archivar PDF con metadatos | AGORA |
| Consulta TARIC | Verificar clasificacion arancelaria | TARIC/SINTRA |
| Consulta SAI | Sistema Aduanero Integrado | SAI AEAT |
| Web Aduanas | Finalizar notificacion | Portal AEAT |
| MINERVA/Oficina Dato | Sistemas internos Correos | MINERVA |
| Email | Notificar cliente/terceros | SMTP |
| Generar fichero | Exportar datos estructurados | CSV/Excel |

---

## 3. Arquitectura Propuesta

### 3.1 Opcion Recomendada: Modulo integrado en LUCI con tenant isolation

**Flujo de procesamiento:**

1. **Entrada** - Emails con PDFs llegan a buzones Correos (IMAP/Webhook)
2. **Clasificacion** - LUCI clasifica el PDF en 43 tipos (REGEX rapido + LUCI IA fallback)
3. **Extraccion** - LUCI IA extrae datos estructurados (MRN, CSV, importes, plazos, partes)
4. **Gestion** - Archivo en gestor documental + workflow automatizado por tipo
5. **Acciones** - Respuesta a AEAT, email a cliente, cambio de estados en sistemas
6. **API** - Sistemas 300dec consultan y operan via API REST v2

**Componentes:**

| Capa | Componente | Funcion |
|------|-----------|---------|
| **Entrada** | Email Listener | Detecta emails, extrae PDFs adjuntos |
| **IA** | Clasificador LUCI | REGEX (43 patrones) + LUCI IA (fallback) |
| **IA** | Extractor LUCI | MRN, CSV, importes, plazos, partes, tipo DUA |
| **Datos** | Gestor Documental | Archivo, metadatos, busqueda, historial |
| **Automatizacion** | Workflow Engine | Plazos, alertas, acciones, escalado |
| **Integracion** | AEAT Integration | Web Aduanas, XML Builders, Cert FNMT |
| **Integracion** | Sistemas Externos | SAI, TARIC, SINTRA, MINERVA, Integrador |
| **API** | REST v2 | Notificaciones, pendientes, respuestas, estadisticas |

### 3.2 Opcion Alternativa: Microservicio independiente

Un servicio separado que consume la API publica v1 de LUCI. Mayor aislamiento pero duplica infraestructura. Recomendado solo si se requiere despliegue en infraestructura del cliente.

### 3.3 Justificacion de la recomendacion

| Criterio | Integrado (Rec.) | Microservicio |
|----------|:---------------:|:------------:|
| Reutilizacion codigo | 90% | 40% |
| Tiempo desarrollo | 3-4 semanas | 6-8 semanas |
| Coste mantenimiento | Bajo | Alto |
| Aislamiento | Multi-tenant | Total |
| Escalabilidad | Vertical | Horizontal |
| Integracion AEAT | Nativa (certs) | Via API |

---

## 4. Modulos LUCI Existentes Reutilizables

### 4.1 Cobertura actual

| Capacidad | Modulo LUCI | Estado | Cobertura |
|-----------|------------|--------|-----------|
| Clasificacion IA | Motor de clasificacion LUCI | Produccion | 80% |
| Extraccion datos PDF | Validador documental + IA LUCI | Produccion | 90% |
| Gestor documental | Sistema de documentos + upload | Produccion | 95% |
| Comunicaciones AEAT | Modulo de comunicaciones inspector | Produccion | 95% |
| Plazos y alertas | Sistema de plazos y deadlines | Produccion | 95% |
| Envio AEAT | Servicio de envio AEAT + 6 XML builders | **Validado AEAT** | 80% |
| Email | Servicio de email transaccional | Produccion | 90% |
| API REST | API publica + autenticacion API keys | Produccion | 95% |
| Workflows | Motor de workflows + acciones | Produccion | 85% |
| PDF generation | Generador PDF profesional | Produccion | 90% |

### 4.2 Gaps a desarrollar

| Gap | Descripcion | Esfuerzo | Alcance |
|-----|------------|----------|---------|
| 43 patrones REGEX | Clasificadores para cada tipo de notificacion | 3 dias | Alc0 |
| Prompt IA AEAT | Prompt especializado para notificaciones AEAT | 2 dias | Alc0 |
| Email listener | IMAP/webhook para recibir emails con PDFs | 2 dias | Alc0 |
| Modelo NotificacionAEAT | Schema con campos especificos | 1 dia | Alc0 |
| API v2 endpoints | Endpoints especificos para 300dec | 2 dias | Alc0 |
| Web Aduanas automation | Automatizar finalizacion en portal AEAT | 1 semana | Alc1 |
| MINERVA/Oficina Dato | Integracion sistemas internos Correos | 1 semana | Alc2 |
| SAI/SINTRA/TARIC | Consultas automaticas sistemas AEAT | 1 semana | Alc3 |

---

## 5. Alcances y Estimaciones

### 5.1 Alcance 0 - Clasificacion + Extraccion + Gestor (Alc0)

**19 tipos de documento** | **Esfuerzo: 2 semanas**

Funcionalidades:
- Recepcion automatica de emails con PDFs de AEAT
- Clasificacion en 43 tipos usando REGEX (rapido) + LUCI IA (fallback)
- Extraccion de datos estructurados: MRN, CSV, importes, plazos, partes
- Almacenamiento en gestor documental con metadatos y busqueda
- Panel de gestion de notificaciones (lista, filtros, detalle)
- API REST para consulta desde sistemas del cliente
- Alertas por email de nuevas notificaciones

Tecnologias:
- REGEX patterns definidos en catalogo configurable
- LUCI IA para clasificacion inteligente + extraccion de datos
- MongoDB con indices por tipo, fecha, MRN, estado
- API key authentication con rate limiting

**Precio estimado: 8.000 - 12.000 EUR**

### 5.2 Alcance 1 - Alc0 + Web Aduanas (Alc1)

**9 tipos adicionales** | **Esfuerzo: 1 semana adicional**

Funcionalidades adicionales:
- Finalizar notificaciones en Web Aduanas automaticamente
- Workflow configurable: notificacion -> clasificar -> extraer -> finalizar
- Tracking de estado por notificacion
- Dashboard de notificaciones pendientes/finalizadas

**Precio adicional: 5.000 - 7.000 EUR**

### 5.3 Alcance 2 - Alc1 + MINERVA/Oficina Dato (Alc2)

**12 tipos adicionales** | **Esfuerzo: 1 semana adicional**

Funcionalidades adicionales:
- Integracion con MINERVA y Oficina Dato (sistemas Correos)
- Consultas automaticas y cambio de estados
- Envio a sistemas terceros (CECA/LINCE)
- Generacion de ficheros de salida

**Precio adicional: 7.000 - 10.000 EUR**

### 5.4 Alcance 3 - Alc2 + SAI/SINTRA/TARIC completo (Alc3)

**3 tipos adicionales (alta complejidad)** | **Esfuerzo: 1 semana adicional**

Funcionalidades adicionales:
- Integracion SAI (Sistema Aduanero Integrado)
- Consultas SINTRA (cambio de estado)
- Integracion TARIC completa (verificacion clasificacion)
- Workflow complejo: requerimiento -> consulta SAI -> envio cliente -> seguimiento -> respuesta AEAT

**Precio adicional: 6.000 - 8.000 EUR**

---

## 6. Resumen Comercial

| Alcance | Documentos | Tiempo | Precio |
|---------|-----------|--------|--------|
| **Alc0** | 19 | 2 sem | 8.000 - 12.000 EUR |
| **Alc0 + Alc1** | 28 | 3 sem | 13.000 - 19.000 EUR |
| **Alc0 + Alc1 + Alc2** | 40 | 4 sem | 20.000 - 29.000 EUR |
| **Completo (Alc0-3)** | 43 | 4 sem | 26.000 - 37.000 EUR |

### Costes recurrentes mensuales (estimados)

| Concepto | Coste/mes |
|----------|----------|
| Infraestructura cloud (compartida LUCI) | ~30 EUR |
| LUCI IA (clasificacion + extraccion) | ~50-150 EUR (segun volumen) |
| Mantenimiento y soporte | 500 EUR/mes |
| **Total recurrente** | **~580 - 680 EUR/mes** |

---

## 7. Cronograma - Implementacion completa en 4 semanas

### Semana 1: Alc0 Core
- Modelo de datos NotificacionAEAT
- 43 patrones REGEX para clasificacion
- Email listener (IMAP)
- Prompt LUCI IA para extraccion de campos
- Clasificador hibrido (REGEX + IA)

### Semana 2: Alc0 + Alc1
- API REST v2 endpoints para 300dec
- Gestor documental con metadatos
- Panel de gestion de notificaciones
- Web Aduanas automation (finalizar notificaciones)
- Testing Alc0 + Alc1

### Semana 3: Alc2
- Integracion MINERVA/Oficina Dato
- Workflows por tipo de notificacion
- Plazos y alertas automaticas
- Envio a sistemas terceros (CECA/LINCE)
- Generacion de ficheros

### Semana 4: Alc3 + Testing + Deploy
- Integracion SAI/SINTRA/TARIC
- Testing end-to-end con PDFs reales
- Documentacion API
- Deploy produccion
- Capacitacion equipo 300dec

---

## 8. Ventajas Competitivas LUCI

1. **Integracion AEAT real probada**: 6 XML builders validados contra AEAT, ENS con MRN reales
2. **IA propietaria de ultima generacion**: Motor LUCI IA para clasificacion y extraccion con aprendizaje continuo
3. **Plataforma multi-tenant**: Aislamiento de datos por cliente nativo
4. **API REST production-ready**: API keys, rate limiting, IP whitelist
5. **Unica solucion espanola con IA + AEAT real**: No existe competidor directo en el mercado espanol
6. **Implementacion rapida**: 90% de infraestructura existente permite delivery en 4 semanas

---

## 9. Proximos Pasos

1. **Revision** de esta propuesta con el equipo 300dec
2. **Definicion del alcance** inicial (recomendamos Alc0+Alc1 como MVP)
3. **Acceso a muestras de PDFs** de notificaciones AEAT reales para calibrar clasificadores
4. **Documentacion de APIs** de sistemas externos (MINERVA, SAI, SINTRA) si aplica
5. **Kickoff** del proyecto con planificacion detallada

---

**Contacto**:
STRIX AI SL | NIF: B22477020
Jenifer Romero | `despacho@strixai.es`
`https://aduanas.strixai.es`
