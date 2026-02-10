# Informe de Gobernanza y Seguridad de IA
## LUCI Customs Agent - Stock Logistic

---

**Documento**: Informe de Cumplimiento para Evaluacion de Riesgos de Seguros
**Version**: 1.0
**Fecha de emision**: 2026-01-22
**Clasificacion**: Confidencial - Uso Interno y Aseguradoras
**Preparado por**: Departamento de Tecnologia - Stock Logistic

---

## 1. Resumen Ejecutivo

LUCI Customs Agent es un sistema de inteligencia artificial disenado para asistir en operaciones aduaneras en Espana. Este documento detalla las medidas de gobernanza, seguridad y control implementadas para garantizar un uso responsable, seguro y conforme a la normativa vigente.

El sistema ha sido desarrollado siguiendo los principios de:
- **Transparencia**: Decisiones explicables y auditables
- **Control humano**: Supervision obligatoria en decisiones criticas
- **Privacidad por diseno**: Proteccion de datos desde la arquitectura
- **Seguridad**: Multiples capas de proteccion y validacion

---

## 2. Evaluacion y Mitigacion del Sesgo Algoritmico

### 2.1 Principios de Diseno

Los algoritmos de machine learning de LUCI se basan exclusivamente en **factores objetivos y regulatorios**, evitando cualquier variable que pueda introducir sesgo discriminatorio:

| Factor Evaluado | Fuente | Justificacion |
|-----------------|--------|---------------|
| Pais de origen | Acuerdos comerciales UE | Determinado por tratados internacionales |
| Codigo TARIC | Regulacion UE 952/2013 | Clasificacion arancelaria oficial |
| Valor aduanero | Declaracion del operador | Base imponible legal |
| Historial operador | Registros AEAT | Cumplimiento previo documentado |
| Certificacion OEA | Registro oficial UE | Estatus de Operador Economico Autorizado |

### 2.2 Medidas de Mitigacion Implementadas

#### 2.2.1 Transparencia en Pesos de Riesgo
```
Ubicacion: backend/src/services/ml/channelPredictionService.js
Lineas: 14-46

Los factores de riesgo estan documentados explicitamente en RISK_WEIGHTS,
basados en patrones historicos de AEAT y normativa aduanera europea,
no en caracteristicas demograficas o personales.
```

#### 2.2.2 Sistema de Feedback Continuo

El sistema implementa endpoints dedicados para correccion de predicciones:

| Endpoint | Funcion |
|----------|---------|
| `POST /api/ml/predict-channel/feedback` | Correccion de prediccion de canal |
| `POST /api/ml/fraud/feedback` | Retroalimentacion de deteccion de fraude |
| `POST /api/ml/classify/feedback` | Correccion de clasificacion TARIC |
| `POST /api/ml/recommendations/feedback` | Evaluacion de recomendaciones |
| `POST /api/ml/auto-response/feedback` | Validacion de respuestas automaticas |

#### 2.2.3 Explicabilidad de Decisiones

Cada prediccion incluye un array `riskFactors` que detalla:
- Factor evaluado
- Severidad (high/medium/low/positive)
- Descripcion en lenguaje natural
- Impacto cuantificado en la decision

**Ejemplo de salida:**
```json
{
  "factor": "origin_country",
  "severity": "high",
  "description": "Pais de origen CN tiene alto riesgo aduanero",
  "impact": "+25% probabilidad inspeccion"
}
```

#### 2.2.4 Monitoreo de Precision

El sistema mantiene metricas de accuracy (`modelAccuracy`) que se actualizan con cada feedback recibido, permitiendo detectar degradacion o sesgo emergente.

---

## 3. Cumplimiento de Normas de Privacidad de Datos

### 3.1 Arquitectura de Proteccion de Datos

#### 3.1.1 Multi-Tenancy con Aislamiento Total

```
Ubicacion: backend/src/services/tenant/tenantService.js

Cada organizacion cliente tiene sus datos completamente aislados
mediante el campo organizationId en todas las colecciones de la
base de datos, impidiendo acceso cruzado entre organizaciones.
```

**Modelo de aislamiento:**
```
Organizacion A ──┬── Usuarios A
                 ├── Expedientes A
                 ├── Declaraciones A
                 └── Documentos A

Organizacion B ──┬── Usuarios B
                 ├── Expedientes B
                 ├── Declaraciones B
                 └── Documentos B
```

#### 3.1.2 Control de Acceso RBAC

Sistema de roles con permisos granulares implementado en `rbacService.js`:

| Rol | Nivel de Acceso | Restricciones |
|-----|-----------------|---------------|
| super_admin | Sistema completo | Solo personal Stock Logistic |
| tenant_admin | Organizacion completa | Limitado a su tenant |
| agent | Operaciones aduaneras | Sin acceso a configuracion |
| operator | Lectura y creacion | Sin aprobacion ni eliminacion |
| client | Solo lectura propia | Solo sus expedientes |

#### 3.1.3 Cifrado de Datos Sensibles

```
Ubicacion: backend/src/services/aeat/certificateService.js
Linea: 19

Los certificados digitales FNMT se almacenan cifrados utilizando
ENCRYPTION_KEY configurable por entorno, nunca en texto plano.
```

#### 3.1.4 Minimizacion de Datos

El portal cliente (`portalController.js`) implementa el principio de minimizacion, exponiendo unicamente:
- ID del expediente
- Estado actual
- Checklist de documentos (sin contenido)
- Informacion basica de mercancias

**Datos NO expuestos al cliente:**
- Valores aduaneros detallados
- Calculos internos
- Comunicaciones con AEAT
- Datos de otros operadores

#### 3.1.5 Logging sin Datos Personales

```
Ubicacion: backend/src/config/logger.js

Sistema Winston configurado para registrar eventos operativos
(IDs de operacion, timestamps, tipos de accion) sin incluir
datos personales identificables (nombres, NIFs, direcciones).
```

### 3.2 Cumplimiento Normativo

| Regulacion | Medida de Cumplimiento |
|------------|------------------------|
| RGPD Art. 5 | Minimizacion de datos, limitacion de finalidad |
| RGPD Art. 25 | Privacidad por diseno y por defecto |
| RGPD Art. 32 | Cifrado, control de acceso, logs de auditoria |
| LOPDGDD | Delegado de Proteccion de Datos designado |

---

## 4. Gestion de Propiedad Intelectual

### 4.1 Fuentes de Datos y Algoritmos

#### 4.1.1 Datasets Utilizados

| Dataset | Origen | Licencia |
|---------|--------|----------|
| Codigos TARIC | Comision Europea | Dominio publico |
| Acuerdos comerciales | EUR-Lex | Acceso publico |
| Valores de referencia | Estadisticas Eurostat | Datos abiertos |
| Patrones de riesgo | Normativa AEAT publica | Acceso publico |

#### 4.1.2 Algoritmos Propios

Los modelos de ML son desarrollos propios que utilizan:
- Reglas basadas en normativa publica (CAU, RDCAU, RECAU)
- Ponderaciones derivadas de analisis estadistico interno
- Sin uso de modelos pre-entrenados de terceros con restricciones de licencia

#### 4.1.3 Dependencias de Codigo Abierto

Todas las librerias utilizadas tienen licencias permisivas:

| Libreria | Licencia | Uso |
|----------|----------|-----|
| Express.js | MIT | Framework web |
| MongoDB Driver | Apache 2.0 | Base de datos |
| node-forge | BSD-3 | Criptografia |
| Winston | MIT | Logging |
| Jest | MIT | Testing |

### 4.2 Due Diligence Realizada

- Revision de licencias de todas las dependencias NPM
- Verificacion de compatibilidad de licencias
- Documentacion de atribuciones requeridas
- Ausencia de dependencias con licencias restrictivas (GPL, AGPL)

---

## 5. Pruebas y Medidas de Seguridad

### 5.1 Suite de Testing

#### 5.1.1 Tests Unitarios de ML

```
Ubicacion: backend/tests/services/ml/

channelPredictionService.test.js  - Prediccion de canal aduanero
fraudDetectionService.test.js     - Deteccion de fraude
classificationService.test.js     - Clasificacion TARIC
autoResponseService.test.js       - Respuestas automaticas
recommendationService.test.js     - Sistema de recomendaciones
```

#### 5.1.2 Cobertura de Tests

| Modulo | Tests | Escenarios Cubiertos |
|--------|-------|----------------------|
| Channel Prediction | 15+ | Todos los canales, edge cases |
| Fraud Detection | 12+ | 6 patrones de fraude |
| Classification | 10+ | Multiples capitulos TARIC |
| Auto-Response | 8+ | Tipos de requerimiento |

### 5.2 Validacion de Entradas

```
Ubicacion: backend/src/middleware/validators.js

Middleware que sanitiza y valida todas las entradas antes
del procesamiento, previniendo:
- Inyeccion de codigo
- Datos malformados
- Valores fuera de rango
```

### 5.3 Manejo de Errores

Cada servicio implementa:
```javascript
try {
  // Logica de negocio
} catch (error) {
  logger.error('Descripcion del error:', error);
  return {
    success: false,
    error: 'Mensaje generico sin exposicion de detalles internos'
  };
}
```

### 5.4 Indicadores de Confianza

Todas las predicciones incluyen `confidence` (0-100%):

| Rango | Interpretacion | Accion |
|-------|----------------|--------|
| 90-100% | Alta confianza | Procesamiento automatico posible |
| 70-89% | Confianza media | Revision recomendada |
| <70% | Baja confianza | Revision humana obligatoria |

### 5.5 Seguridad en Integraciones

#### 5.5.1 Firma Digital XAdES

```
Ubicacion: backend/src/services/aeat/xadesSignatureService.js

Las declaraciones enviadas a AEAT se firman electronicamente
con certificados FNMT siguiendo el estandar XAdES-BES/EPES
requerido por la administracion espanola.
```

#### 5.5.2 Comunicaciones Seguras

- HTTPS obligatorio para todas las APIs
- Certificados SSL/TLS validos
- Tokens JWT con expiracion configurable

---

## 6. Gestion de Componentes de Terceros

### 6.1 Modelo de IA Propio

**Importante**: LUCI NO depende de APIs de IA externas (OpenAI, Google AI, etc.) para sus funciones criticas de:
- Prediccion de canal aduanero
- Deteccion de fraude
- Clasificacion arancelaria
- Generacion de respuestas a requerimientos

Todos estos modulos estan implementados internamente en JavaScript con logica basada en reglas y machine learning clasico.

### 6.2 Servicio de Chat (Opcional)

El modulo `aiService.js` para chat conversacional:
- Es **opcional** y configurable
- Puede desactivarse sin afectar funcionalidad core
- Soporta multiples proveedores o modo offline

### 6.3 Integraciones Oficiales

| Sistema | Tipo | Responsabilidad |
|---------|------|-----------------|
| AEAT | Web Services oficiales | Gobierno de Espana |
| VUA | API oficial | Ministerio de Hacienda |
| TRACES NT | Sistema UE | Comision Europea |
| NCTS | Sistema UE | Comision Europea |

Todas las integraciones utilizan APIs oficiales documentadas y mantenidas por organismos publicos.

### 6.4 Modo Simulacion

```
Ubicacion: backend/src/services/aeat/simulationEngine.js

Todas las integraciones pueden operar en modo simulacion
para testing y desarrollo sin afectar sistemas de produccion
ni incurrir en responsabilidades por envios erroneos.
```

---

## 7. Control Humano sobre Sistemas de IA

### 7.1 Revision Obligatoria

#### 7.1.1 Flag requiresReview

```
Ubicacion: backend/src/services/ml/autoResponseService.js
Linea: 244

response.requiresReview = response.confidence < 80;

Cuando la confianza de una respuesta automatica es inferior
al 80%, se marca automaticamente para revision humana obligatoria.
```

#### 7.1.2 Respuestas como Borradores

Las respuestas generadas por IA son **siempre borradores** que el agente humano:
- Revisa antes de enviar
- Puede modificar libremente
- Debe aprobar explicitamente

### 7.2 Override Manual

```
Ubicacion: backend/src/routes/channels.js
Lineas: 29-30

POST /api/channels/:expeditionId/process
Requiere: requireRole('admin')

Endpoint especifico para que administradores puedan
procesar manualmente cualquier canal, sobrescribiendo
la decision automatica del sistema.
```

### 7.3 Sistema de Permisos APPROVE

El sistema RBAC distingue entre:
- `CREATE`: Crear registros (automatizable)
- `APPROVE`: Aprobar decisiones (requiere humano con rol adecuado)

### 7.4 Clasificacion TARIC

El flujo de clasificacion:
1. Sistema sugiere codigo TARIC basado en descripcion
2. Agente humano revisa la sugerencia
3. Agente confirma o modifica el codigo
4. Solo tras confirmacion se incluye en declaracion

### 7.5 Auditoria Completa

```
Ubicacion: backend/src/models/Expedition.js

Campo: timeline[]

Cada expediente registra todas las acciones con:
- Timestamp exacto
- Usuario que realizo la accion
- Tipo de accion
- Descripcion detallada
- Metadatos adicionales
```

### 7.6 Sistema de Alertas y Deadlines

```
Ubicacion: backend/src/services/deadlineService.js

Sistema que notifica a usuarios humanos:
- Vencimientos proximos de declaraciones
- Plazos de respuesta a requerimientos
- Renovacion de certificados
- Expiracion de garantias
```

---

## 8. Matriz de Riesgos y Controles

| Riesgo | Probabilidad | Impacto | Control Implementado |
|--------|--------------|---------|----------------------|
| Prediccion erronea de canal | Media | Medio | Confidence score + revision humana |
| Clasificacion TARIC incorrecta | Media | Alto | Sugerencia + confirmacion humana obligatoria |
| Fuga de datos entre tenants | Baja | Critico | Aislamiento por organizationId + RBAC |
| Envio no autorizado a AEAT | Baja | Alto | Firma digital + permisos APPROVE |
| Sesgo en decisiones | Baja | Medio | Factores objetivos + feedback + auditoria |
| Fallo de integracion AEAT | Media | Alto | Modo simulacion + reintentos + logs |

---

## 9. Certificaciones y Cumplimiento

### 9.1 Normativa Aplicable

| Regulacion | Estado |
|------------|--------|
| RGPD (UE 2016/679) | Cumplimiento implementado |
| LOPDGDD (Espana) | Cumplimiento implementado |
| CAU (UE 952/2013) | Base de reglas de negocio |
| eIDAS (UE 910/2014) | Firma electronica cualificada |

### 9.2 Certificaciones en Proceso

- ISO 27001 (Seguridad de la Informacion) - Planificado
- SOC 2 Type II - En evaluacion

---

## 10. Contacto y Responsables

| Rol | Responsabilidad |
|-----|-----------------|
| DPO (Delegado Proteccion Datos) | Cumplimiento RGPD |
| CTO | Arquitectura y seguridad tecnica |
| Responsable de ML | Gobernanza de algoritmos |
| Compliance Officer | Cumplimiento normativo aduanero |

---

## 11. Documentacion Complementaria

- `PLAN_AGENTE_ADUANAS_COMPLETO.md` - Plan de desarrollo del sistema
- `FASE_6_PRODUCCION_AVANZADA.md` - Detalles de implementacion
- `backend/tests/README.md` - Documentacion de tests
- Codigo fuente disponible para auditoria bajo NDA

---

**Firma Digital del Documento**

Este documento ha sido preparado para proporcionar informacion veraz y completa sobre las medidas de gobernanza y seguridad de LUCI Customs Agent. La informacion contenida refleja el estado actual del sistema a la fecha de emision.

---

*Documento generado el 2026-01-22*
*Stock Logistic - LUCI Customs Agent*
*Todos los derechos reservados*
