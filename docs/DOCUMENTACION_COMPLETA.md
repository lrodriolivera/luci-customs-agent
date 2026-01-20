# LUCI Customs Agent - Documentacion Completa

**Fecha**: 12 de Enero de 2026
**Version**: 1.3.0
**Estado**: En Desarrollo (60% completado)

---

## 1. VISION GENERAL

LUCI Customs Agent es un **agente aduanero virtual con IA** que busca automatizar y reemplazar las funciones de un representante aduanero humano en Espana. Utiliza modelos de Claude (Sonnet 4 y Opus 4.5) para tareas de clasificacion, generacion de documentos y asistencia.

### 1.1 Objetivo Principal

Automatizar el 80% de las tareas rutinarias de un agente aduanero:
- Clasificacion arancelaria TARIC
- Generacion de declaraciones H1/AES/H7
- Gestion de requerimientos AEAT
- Controles paraduaneros
- Regimenes especiales
- Gestion de garantias

### 1.2 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LUCI CUSTOMS AGENT                               │
│                   (Claude Sonnet 4 + Opus 4.5)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    FRONTEND     │       │     BACKEND     │       │   AI-SERVICE    │
│     (React)     │◄─────►│   (Node.js)     │◄─────►│    (Python)     │
│     :3001       │       │     :5001       │       │     :8003       │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ React + Vite    │       │ MongoDB :27017  │       │ Claude API      │
│ TailwindCSS     │       │ Redis :6379     │       │ - Sonnet 4      │
│ React Router    │       │ GridFS (docs)   │       │ - Opus 4.5      │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## 2. FUNCIONALIDADES IMPLEMENTADAS

### 2.1 FASE 1: Core de Agente Aduanero (100% Completado)

#### 2.1.1 Gestion de Expedientes
- **Estado**: ✅ Completado
- **Archivos**: `Expedition.js`, `expeditionController.js`, `ExpeditionDetail.jsx`
- **Funcionalidades**:
  - Crear/editar/eliminar expedientes
  - Workflow de estados (pending_docs → validating → declaration_draft → submitted → channel)
  - Timeline de eventos
  - Vinculacion con cliente/importador/exportador

#### 2.1.2 Clasificacion Arancelaria TARIC
- **Estado**: ✅ Completado
- **Archivos**: `ClassificationTool.jsx`, `classificationController.js`, `aiService.js`
- **IA**: Claude Opus 4.5
- **Funcionalidades**:
  - Clasificacion automatica por descripcion
  - Validacion de codigos propuestos
  - Sugerencias de codigos alternativos
  - Justificacion de la clasificacion

#### 2.1.3 Generacion de Declaraciones
- **Estado**: ✅ Completado
- **Archivos**: `DeclarationGenerator.jsx`, `declarationController.js`, `h1Generator.js`, `aesGenerator.js`, `h7Generator.js`

| Tipo | Descripcion | IA |
|------|-------------|-----|
| H1 | Importacion estandar | Opus 4.5 |
| AES | Exportacion | Opus 4.5 |
| H7 | Bajo valor (<=150 EUR) | Sonnet 4 |

#### 2.1.4 Envio a AEAT (Simulado)
- **Estado**: ✅ Completado (modo demo)
- **Archivos**: `aeatService.js`, `simulationEngine.js`
- **Funcionalidades**:
  - Envio simulado de H1/AES/H7
  - Generacion de MRN
  - Asignacion de canal (verde/amarillo/naranja/rojo)
  - Generacion de levante (canal verde)

#### 2.1.5 Sistema de Circuitos (Canales)
- **Estado**: ✅ Completado
- **Archivos**: `channelService.js`, `channelController.js`

| Canal | Accion Automatica |
|-------|-------------------|
| Verde | Genera levante automatico |
| Amarillo | Identifica certificados pendientes |
| Naranja | Crea requerimiento documental |
| Rojo | Crea requerimiento de inspeccion fisica |

#### 2.1.6 Gestion de Requerimientos AEAT
- **Estado**: ✅ Completado
- **Archivos**: `Requirement.js`, `requirementController.js`, `RequirementManager.jsx`, `RequirementsList.jsx`
- **Funcionalidades**:
  - Crear requerimientos (automatico y manual)
  - Gestionar documentos solicitados
  - Generar respuestas con IA
  - Enviar a AEAT (simulado)
  - Programar inspecciones fisicas
  - Resolver/rechazar

#### 2.1.7 Controles Paraduaneros
- **Estado**: ✅ Completado
- **Archivos**: `ParaduaneroControl.js`, `paraduaneroController.js`, `ParaduaneroManager.jsx`

| Autoridad | Productos |
|-----------|-----------|
| SOIVRE | Industriales, textiles, juguetes |
| MAPA | Agricultura, fitosanitarios, veterinarios |
| SANIDAD | Alimentarios, cosmeticos |
| MITERD | CITES, residuos, quimicos |
| AEMPS | Medicamentos |

#### 2.1.8 Panel de Alertas Dashboard
- **Estado**: ✅ Completado
- **Archivos**: `dashboard.js`, `Dashboard.jsx`
- **Alertas monitoreadas**:
  - Requerimientos por vencer/vencidos
  - Expedientes en canal naranja/rojo sin atender
  - Garantias con saldo bajo (<20%)
  - Garantias por vencer (30 dias)
  - Regimenes especiales por vencer
  - Controles paraduaneros pendientes

#### 2.1.9 Chat Asistente LUCI
- **Estado**: ✅ Completado
- **Archivos**: `ChatAssistant.jsx`, `aiService.js`
- **IA**: Claude Sonnet 4
- **Funcionalidades**:
  - Consultas de normativa aduanera
  - Ayuda contextual por expediente
  - Base de conocimiento integrada

---

### 2.2 FASE 2: Regimenes Especiales (80% Completado)

#### 2.2.1 Modelo de Regimenes Especiales
- **Estado**: ✅ Completado
- **Archivo**: `SpecialRegime.js`
- **Campos principales**: regimeCode, declarant, holder, goods, guarantee, authorization, discharge

#### 2.2.2 Servicio de Regimenes Especiales
- **Estado**: ✅ Completado
- **Archivo**: `specialRegimeService.js`

| Regimen | Codigo | Plazo Max | Logica Implementada |
|---------|--------|-----------|---------------------|
| Perfeccionamiento Activo | 51 | 3 anos | Autorizacion, activacion, prorroga, ultimacion |
| Importacion Temporal | 53 | 24 meses | Exencion parcial (3%/mes), ultimacion |
| Deposito Aduanero | 71 | Sin limite | Salidas parciales, stock |
| Transito T1 | T1 | 8+ dias | Seguimiento oficinas |
| Transito T2 | T2 | 8+ dias | Seguimiento oficinas |
| TIR | TIR | Variable | Carnet TIR |

#### 2.2.3 Modelo NCTS para Transito
- **Estado**: ✅ Completado
- **Archivo**: `Transit.js` (~400 lineas)
- **Funcionalidades**:
  - Mensajes NCTS (IE015, IE028, IE029, IE044, etc.)
  - Seguimiento de oficinas de transito
  - Precintos y verificacion
  - Procedimiento de busqueda (enquiry)
  - Estadisticas de transito

#### 2.2.4 Sistema de Garantias
- **Estado**: ✅ Completado
- **Archivos**: `Guarantee.js`, `guaranteeService.js`, `GuaranteesManager.jsx`

| Tipo | Descripcion |
|------|-------------|
| CGU | Garantia Global Unica |
| bank_guarantee | Aval bancario |
| deposit | Deposito en efectivo |
| insurance | Seguro de caucion |

**Funcionalidades**:
- Crear/activar/renovar/cancelar garantias
- Consumir/liberar saldo
- Vincular a expedientes
- Alertas de saldo bajo y vencimiento

#### 2.2.5 Pendiente Fase 2
- [ ] Controlador y rutas para Transit (NCTS)
- [ ] Frontend para gestion de transitos
- [ ] Integracion rutas en App.jsx

---

### 2.3 FASE 3: Inteligencia Aduanera (100% Completado) ✅

**Fecha Completado**: 12 de Enero de 2026

#### 2.3.1 Motor de Reglas y Preferencias Arancelarias ✅
- **Estado**: ✅ Completado
- **Archivos Backend**: `rulesEngineController.js`, `rulesEngineService.js`
- **Archivos Frontend**: `RulesEngineAnalyzer.jsx`, `PreferencesCalculator.jsx`
- **Tests**: 100% cobertura (servicios + controladores)

**Funcionalidades**:
- **Motor de Reglas Automático**:
  - Análisis completo de operaciones de importación/exportación
  - Detección automática de requisitos (sanitarios, fitosanitarios, CITES, etc.)
  - Cálculo de derechos arancelarios y VAT
  - Identificación de alertas y warnings por producto
  - Integración con clasificación TARIC

- **Preferencias Arancelarias**:
  - Soporte para 11 acuerdos de libre comercio:
    - CETA (Canadá)
    - JEFTA (Japón)
    - EU-UK (Reino Unido post-Brexit)
    - EU-MERCOSUR (Argentina, Brasil, Uruguay, Paraguay)
    - EU-Chile, EU-México, EU-Corea del Sur
    - EU-Vietnam, EU-Singapur, Turquía, Suiza-Noruega
  - Validación de reglas de origen
  - Cálculo de ahorros arancelarios
  - Identificación de certificados requeridos (EUR.1, Form A, ATR, etc.)

**Endpoints API**:
```
POST /api/rules/analyze              - Análisis completo de operación
POST /api/rules/check-preferences    - Verificar elegibilidad preferencias
GET  /api/rules/info                 - Información del sistema
```

#### 2.3.2 Impuestos Especiales (SILICIE) ✅
- **Estado**: ✅ Completado
- **Archivos Backend**: `exciseDutiesController.js`, `exciseDutiesService.js`
- **Archivos Frontend**: `ExciseDutiesCalculator.jsx`
- **Tests**: 53 tests (33 service + 20 controller)

**Categorías de Productos**:
1. **Bebidas Alcohólicas**:
   - Cerveza (tipos estándar y baja graduación)
   - Vino (exento < 1.2%, intermedio 1.2-15%, estándar > 15%)
   - Productos intermedios (vermut, oporto)
   - Bebidas espirituosas (> 15% alcohol)
   - Tarifas: 0.055-10.97 €/L según tipo y graduación

2. **Labores del Tabaco**:
   - Cigarrillos (componente específico + proporcional + mínimo)
   - Cigarros y cigarritos (16.5% del precio)
   - Picadura de liar (42 €/kg + 12% + mínimo)
   - Otros tabacos de mascar/inhalar

3. **Hidrocarburos**:
   - Gasolinas (436 €/1000L)
   - Gasóleo (331 €/1000L)
   - Queroseno (330 €/1000L)
   - GLP (64 €/1000kg)
   - Fuelóleo (14 €/1000kg)

4. **Electricidad**:
   - Tarifa única: 0.051127 €/MWh
   - Exenciones para pequeños productores y autoconsumo

**Funcionalidades**:
- Detección automática por código TARIC
- Cálculo de impuestos por categoría y subcategoría
- Generación de documentos DUA-SILICIE
- Verificación de exenciones aplicables
- Gestión de garantías (150% del impuesto)
- Integración con sistema EMCS europeo

**Endpoints API**:
```
POST /api/excise/detect              - Detectar producto sujeto a impuestos
POST /api/excise/calculate           - Calcular impuesto para producto
POST /api/excise/calculate-total     - Calcular total múltiples productos
POST /api/excise/generate-document   - Generar documento DUA-SILICIE
POST /api/excise/check-exemptions    - Verificar exenciones
GET  /api/excise/categories          - Obtener categorías
GET  /api/excise/rates               - Obtener tarifas vigentes
GET  /api/excise/exemptions          - Listar exenciones disponibles
GET  /api/excise/info                - Información sistema SILICIE
```

#### 2.3.3 Gestión de Contingentes Arancelarios (TRQ) ✅
- **Estado**: ✅ Completado
- **Archivos Backend**: `quotaController.js`, `quotaService.js`
- **Archivos Frontend**: `QuotaManager.jsx` (3 pestañas: búsqueda, lista, críticos)
- **Tests**: 63 tests (40 service + 23 controller)

**Base de Datos de Contingentes**:
- 10 contingentes activos (periodo 2025-2026)
- Tipos: Autónomos UE, CETA, JEFTA, EU-MERCOSUR
- Productos: Carnes, lácteos, frutas, cereales
- Métodos de asignación: FCFS, tradicional, licencia

**Funcionalidades Principales**:
1. **Búsqueda de Disponibilidad**:
   - Matching avanzado por código TARIC (prefijo + parcial 6 dígitos)
   - Verificación de origen y período vigente
   - Cálculo de utilización en tiempo real
   - Ordenamiento por tarifa más baja

2. **Reserva de Contingentes**:
   - Generación de ID de reserva
   - Validación de disponibilidad
   - Instrucciones específicas por contingente
   - Alertas para contingentes críticos (>95% uso)
   - Requisitos de certificación (EUR.1 para CETA)

3. **Cálculo de Ahorros**:
   - Comparación tarifa intra vs extra-contingente
   - Cálculo de ahorro absoluto y porcentual
   - Recomendaciones de uso

4. **Monitoreo de Contingentes Críticos**:
   - Identificación de contingentes >90% utilizados
   - Estimación de fecha de agotamiento
   - Ordenamiento por nivel de criticidad
   - Alertas automáticas

5. **Reportes y Análisis**:
   - Filtrado por tipo, acuerdo, país de origen
   - Estadísticas por categoría
   - Clasificación de estado (disponible/crítico/agotado)
   - Porcentajes de utilización

**Endpoints API**:
```
POST /api/quotas/check-availability     - Verificar disponibilidad
POST /api/quotas/reserve                - Reservar contingente
POST /api/quotas/calculate-savings      - Calcular ahorros
POST /api/quotas/report                 - Generar reporte con filtros
GET  /api/quotas/by-agreement/:code     - Contingentes por acuerdo
GET  /api/quotas/critical               - Contingentes críticos
GET  /api/quotas/list                   - Listar todos los activos
GET  /api/quotas/:orderNumber           - Obtener por número de orden
GET  /api/quotas/info                   - Información del sistema
```

#### 2.3.4 Mejoras Técnicas Implementadas ✅

**1. Algoritmo de Matching TARIC Mejorado**:
```javascript
// Coincidencia exacta por prefijo
if (normalizedTaric.startsWith(quotaTaric)) return true;

// Coincidencia parcial de primeros 6 dígitos
const minLength = Math.min(quotaTaric.length, normalizedTaric.length);
if (minLength >= 4) {
  const quotaPrefix = quotaTaric.substring(0, Math.min(6, quotaTaric.length));
  const taricPrefix = normalizedTaric.substring(0, Math.min(6, normalizedTaric.length));
  if (quotaPrefix === taricPrefix) return true;
}
```

**2. Suite de Tests Completa**:
| Componente | Tests | Estado |
|------------|-------|--------|
| exciseDutiesService | 33 | ✅ 100% |
| quotaService | 40 | ✅ 100% |
| exciseDutiesController | 20 | ✅ 100% |
| quotaController | 23 | ✅ 100% |
| **TOTAL FASE 3** | **116** | **✅ 100%** |

**3. Correcciones de Bugs**:
- Actualización de períodos de contingentes (2024 → 2025-2026)
- Agregado de campos faltantes (originCountries, agreement)
- Ajuste de lógica de exención para vinos (1.2%-15% = intermedio)
- Corrección de tests con expectativas incorrectas

#### 2.3.5 Resumen de Cobertura Fase 3

| Módulo | Backend | Frontend | Tests | Estado |
|--------|---------|----------|-------|--------|
| Motor de Reglas | ✅ | ✅ | ✅ | 100% |
| Preferencias | ✅ | ✅ | ✅ | 100% |
| Impuestos Especiales | ✅ | ✅ | ✅ | 100% |
| Contingentes | ✅ | ✅ | ✅ | 100% |

**Total Fase 3**: **100% Completado** - 4/4 módulos operativos

---

### 2.4 FASE 4: Operativa Avanzada (0% Completado)

- [ ] Gestor de plazos
- [ ] Comunicacion con inspectores
- [ ] Coordinacion de inspecciones
- [ ] Modulo OEA

---

### 2.5 FASE 5: Integraciones Reales (15% Completado)

#### 2.5.1 Completado
- Estructura de integracion AEAT (simulada)
- Parseo XML
- Firma digital (estructura)

#### 2.5.2 Pendiente
- [ ] AEAT Web Services reales (requiere certificado)
- [ ] VUA (Ventanilla Unica Aduanera)
- [ ] TRACES NT
- [ ] API TARIC UE
- [ ] Tipos de cambio BCE

---

## 3. ESTRUCTURA DE ARCHIVOS

### 3.1 Backend (Node.js/Express)

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # Conexion MongoDB
│   │   └── logger.js            # Winston logger
│   │
│   ├── models/
│   │   ├── User.js              # Usuarios y roles
│   │   ├── Expedition.js        # Expedientes aduaneros
│   │   ├── ChatMessage.js       # Mensajes del chat
│   │   ├── TaricCode.js         # Codigos TARIC
│   │   ├── Requirement.js       # Requerimientos AEAT
│   │   ├── ParaduaneroControl.js # Controles SOIVRE/MAPA/etc
│   │   ├── H7Declaration.js     # Declaraciones bajo valor
│   │   ├── Guarantee.js         # Garantias aduaneras
│   │   ├── SpecialRegime.js     # Regimenes especiales
│   │   ├── Transit.js           # Transitos NCTS (NUEVO)
│   │   └── index.js             # Exportaciones
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── expeditionController.js
│   │   ├── documentController.js
│   │   ├── calculationController.js
│   │   ├── classificationController.js
│   │   ├── declarationController.js
│   │   ├── requirementController.js
│   │   ├── channelController.js
│   │   ├── paraduaneroController.js
│   │   ├── h7Controller.js
│   │   ├── guaranteeController.js
│   │   └── specialRegimeController.js
│   │
│   ├── services/
│   │   ├── aiService.js         # Integracion Claude API
│   │   ├── taricService.js      # Consultas TARIC
│   │   ├── channelService.js    # Logica de circuitos
│   │   ├── paraduaneroService.js
│   │   ├── h7Service.js
│   │   ├── guaranteeService.js
│   │   ├── specialRegimeService.js
│   │   ├── emailService.js
│   │   ├── forms/
│   │   │   ├── h1Generator.js   # Generador XML H1
│   │   │   ├── h7Generator.js   # Generador XML H7
│   │   │   └── aesGenerator.js  # Generador XML AES
│   │   └── aeat/
│   │       ├── aeatConfig.js
│   │       ├── aeatService.js
│   │       ├── simulationEngine.js
│   │       ├── signatureService.js
│   │       └── xmlParser.js
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── expeditions.js
│   │   ├── documents.js
│   │   ├── declarations.js
│   │   ├── portal.js
│   │   ├── chat.js
│   │   ├── classification.js
│   │   ├── calculation.js
│   │   ├── requirements.js
│   │   ├── channels.js
│   │   ├── paraduanero.js
│   │   ├── h7.js
│   │   ├── guarantees.js
│   │   ├── specialRegimes.js
│   │   └── dashboard.js         # (NUEVO)
│   │
│   ├── middleware/
│   │   └── auth.js
│   │
│   └── app.js                   # Entry point
│
├── uploads/                     # Documentos subidos
└── .env                         # Variables de entorno
```

### 3.2 Frontend (React)

```
frontend/
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   └── Login.jsx
│   │   │
│   │   ├── Dashboard/
│   │   │   └── Dashboard.jsx    # Con panel de alertas
│   │   │
│   │   ├── Layout/
│   │   │   ├── MainLayout.jsx
│   │   │   └── PortalLayout.jsx
│   │   │
│   │   ├── Classification/
│   │   │   └── ClassificationTool.jsx
│   │   │
│   │   ├── Declarations/
│   │   │   └── DeclarationGenerator.jsx
│   │   │
│   │   ├── Calculations/
│   │   │   └── DutyCalculator.jsx
│   │   │
│   │   ├── Chat/
│   │   │   └── ChatAssistant.jsx
│   │   │
│   │   ├── Portal/
│   │   │   ├── PortalHome.jsx
│   │   │   ├── PortalDocuments.jsx
│   │   │   ├── PortalChat.jsx
│   │   │   └── PortalStatus.jsx
│   │   │
│   │   ├── Expeditions/
│   │   │   ├── ExpeditionsList.jsx
│   │   │   ├── ExpeditionDetail.jsx
│   │   │   └── ExpeditionForm.jsx
│   │   │
│   │   ├── Requirements/
│   │   │   ├── RequirementManager.jsx
│   │   │   └── RequirementsList.jsx
│   │   │
│   │   ├── H7/
│   │   │   └── H7DeclarationForm.jsx  # (NUEVO)
│   │   │
│   │   ├── Guarantees/
│   │   │   └── GuaranteesManager.jsx  # (NUEVO)
│   │   │
│   │   └── Paraduanero/
│   │       └── ParaduaneroManager.jsx
│   │
│   ├── services/
│   │   └── api.js               # Todas las llamadas API
│   │
│   ├── App.jsx                  # Rutas principales
│   └── main.jsx
│
└── .env                         # VITE_API_URL
```

---

## 4. API ENDPOINTS

### 4.1 Autenticacion
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | /api/auth/login | Iniciar sesion |
| POST | /api/auth/register | Registrar usuario |
| GET | /api/auth/profile | Obtener perfil |

### 4.2 Expedientes
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /api/expeditions | Listar expedientes |
| GET | /api/expeditions/:id | Obtener detalle |
| POST | /api/expeditions | Crear expediente |
| PUT | /api/expeditions/:id | Actualizar |
| DELETE | /api/expeditions/:id | Eliminar |

### 4.3 Declaraciones
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | /api/declarations/h1/generate | Generar H1 con IA |
| POST | /api/declarations/h1/generate-direct | Generar H1 directo |
| POST | /api/declarations/aes/generate | Generar AES |
| POST | /api/declarations/h7/generate | Generar H7 |
| POST | /api/declarations/:id/submit | Enviar a AEAT |
| GET | /api/declarations/:id/xml | Descargar XML |

### 4.4 Requerimientos
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /api/requirements | Listar |
| GET | /api/requirements/stats | Estadisticas |
| POST | /api/requirements | Crear |
| POST | /api/requirements/:id/response | Agregar respuesta |
| POST | /api/requirements/:id/ai-response | Generar respuesta IA |
| POST | /api/requirements/:id/submit | Enviar a AEAT |
| POST | /api/requirements/:id/resolve | Resolver |

### 4.5 Circuitos
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /api/channels/config | Configuracion canales |
| GET | /api/channels/stats | Estadisticas |
| GET | /api/channels/:id/status | Estado canal expediente |
| POST | /api/channels/:id/reevaluate | Reevaluar canal amarillo |
| POST | /api/channels/:id/process | Procesar canal manual |

### 4.6 Garantias
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /api/guarantees | Listar |
| GET | /api/guarantees/stats | Estadisticas |
| GET | /api/guarantees/alerts | Alertas activas |
| POST | /api/guarantees | Crear |
| POST | /api/guarantees/:id/activate | Activar |
| POST | /api/guarantees/:id/consume | Consumir saldo |
| POST | /api/guarantees/:id/release | Liberar saldo |

### 4.7 Regimenes Especiales
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /api/special-regimes | Listar |
| GET | /api/special-regimes/stats | Estadisticas |
| POST | /api/special-regimes | Crear |
| POST | /api/special-regimes/:id/authorize | Autorizar |
| POST | /api/special-regimes/:id/activate | Activar |
| POST | /api/special-regimes/:id/discharge | Ultimar |
| POST | /api/special-regimes/:id/extension | Solicitar prorroga |

### 4.8 Dashboard
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /api/dashboard/alerts | Alertas consolidadas |
| GET | /api/dashboard/stats | Estadisticas generales |

---

## 5. FUNCIONES DE IA

| Funcion | Modelo | Archivo | Descripcion |
|---------|--------|---------|-------------|
| generateChatResponse | Sonnet 4 | aiService.js | Chat contextual |
| askLuci | Sonnet 4 | aiService.js | Preguntas directas |
| classifyProduct | Opus 4.5 | aiService.js | Clasificacion TARIC |
| validateClassification | Opus 4.5 | aiService.js | Validar codigo TARIC |
| validateDocument | Sonnet 4 | aiService.js | Extraer datos documentos |
| generateH1Declaration | Opus 4.5 | aiService.js | Generar H1 |
| generateAESDeclaration | Opus 4.5 | aiService.js | Generar AES |
| generateResponse | Sonnet 4 | aiService.js | Responder requerimientos |

---

## 6. VARIABLES DE ENTORNO

### 6.1 Backend (.env)
```
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/luci-customs
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=<api-key>
FRONTEND_URL=http://localhost:3001
AEAT_SIMULATION_MODE=true
```

### 6.2 AI-Service (.env)
```
ANTHROPIC_API_KEY=<api-key>
PORT=8003
```

### 6.3 Frontend (.env)
```
VITE_API_URL=http://localhost:5001
```

---

## 7. COMO EJECUTAR

### 7.1 Requisitos
- Node.js 18+
- MongoDB 6+
- Python 3.10+ (para AI Service)
- Redis (opcional)

### 7.2 Instalacion

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Editar .env con las variables

# Frontend
cd frontend
npm install
cp .env.example .env

# AI Service
cd ai-service
pip install -r requirements.txt
cp .env.example .env
```

### 7.3 Ejecucion

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev

# Terminal 3 - AI Service
cd ai-service && python main.py
```

### 7.4 URLs
- Frontend: http://localhost:3001
- Backend API: http://localhost:5001
- AI Service: http://localhost:8003
- MongoDB: localhost:27017

---

## 8. PROXIMOS PASOS

### 8.1 Inmediatos (Esta sesion)
1. Integrar rutas H7 y Guarantees en App.jsx
2. Crear controlador/rutas para Transit
3. Probar flujos con datos reales

### 8.2 Corto Plazo
1. ✅ Fase 3 completada (Motor de Reglas, Preferencias, SILICIE, Contingentes)
2. Completar frontend de regimenes especiales
3. Completar frontend de tránsito (NCTS)
4. Implementar Fase 4 (Gestor de plazos, comunicación inspectores)

### 8.3 Largo Plazo
1. Integracion real con AEAT (certificado digital)
2. VUA y TRACES NT
3. Modulo OEA

---

**Documentacion generada por**: Claude Opus 4.5
**Proyecto**: LUCI Customs Agent - Stock Logistic
