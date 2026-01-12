# LUCI - Agente Aduanero Inteligente

**Powered by Claude Sonnet 4 & Claude Opus 4.5** | Especializado en Comercio Exterior España/UE

## Descripcion General

LUCI es la segunda solucion del ecosistema COMEX de Stock Logistic. A diferencia de AXEL (POC de cotizaciones terrestres), LUCI es una **solucion completa** que actua como un agente aduanero virtual, capaz de:

- Gestionar expedientes de importacion/exportacion
- Validar documentacion de comercio exterior mediante IA
- Clasificar mercancias segun codigo TARIC automaticamente
- Rellenar formularios H1 (importacion) y AES (exportacion)
- Calcular aranceles, IVA e impuestos especiales
- Guiar a clientes mediante portal web con checklist dinamico

## Arquitectura del Sistema

```
+-----------------------------------------------------------------------+
|                         LUCI CUSTOMS AGENT                            |
|                  (Claude Sonnet 4 + Claude Opus 4.5)                  |
+-----------------------------------------------------------------------+
                                    |
        +---------------------------+---------------------------+
        |                           |                           |
        v                           v                           v
+-------------------+     +-------------------+     +-------------------+
|    FRONTEND       |     |     BACKEND       |     |   AI-SERVICE      |
|    (React)        |<--->|   (Node.js)       |<--->|   (Python)        |
|    :3001          |     |     :5001         |     |     :8003         |
+-------------------+     +-------------------+     +-------------------+
        |                           |                           |
        v                           v                           v
+-------------------+     +-------------------+     +-------------------+
| Portal Cliente    |     |    MongoDB        |     | Claude Sonnet 4   |
| (Link unico)      |     |  (Expedientes)    |     | - Chat asistente  |
|                   |     |                   |     | - Validacion docs |
| Dashboard Interno |     |    GridFS         |     |                   |
| (Agentes)         |     |  (Documentos)     |     | Claude Opus 4.5   |
|                   |     |                   |     | - Clasificacion   |
| Chat con LUCI     |     |    Redis          |     | - Llenado H1/AES  |
+-------------------+     |  (Sesiones)       |     | - Calculos        |
                          +-------------------+     +-------------------+
```

## Stack Tecnologico

| Componente | Tecnologia | Version |
|------------|------------|---------|
| **Backend** | Node.js + Express | 18+ |
| **Base de Datos** | MongoDB + Mongoose | 7.x |
| **Frontend** | React + Tailwind CSS | 18.x |
| **IA Principal** | Claude Opus 4.5 | API |
| **IA Chat** | Claude Sonnet 4 | API |
| **OCR** | Tesseract.js + Claude Vision | 4.x |
| **Cache** | Redis | 7.x |
| **Email** | Nodemailer | 6.x |

## Normativa Implementada

| Normativa | Descripcion | Estado |
|-----------|-------------|--------|
| **CAU** | Codigo Aduanero de la Union (Reglamento UE 952/2013) | Implementado |
| **Sistema H1** | Nuevo sistema importacion AEAT (obligatorio 14/10/2025) | Implementado |
| **Sistema H7** | Envios de bajo valor (<150 EUR) | Implementado |
| **AES** | Automated Export System | Implementado |
| **TARIC** | Arancel Integrado de la UE (10 digitos + 4 adicionales) | Implementado |
| **RDCAU** | Reglamento Delegado (UE) 2015/2446 | Referencia |
| **RECAU** | Reglamento de Ejecucion (UE) 2015/2447 | Referencia |

## Estructura del Proyecto

```
luci-customs-agent/
├── backend/                    # API Node.js/Express
│   ├── src/
│   │   ├── config/            # Configuracion DB, logger, etc.
│   │   ├── controllers/       # Logica de negocio
│   │   ├── middleware/        # Auth, validacion, uploads
│   │   ├── models/            # Esquemas Mongoose
│   │   ├── routes/            # Definicion de rutas API
│   │   ├── services/          # Servicios especializados
│   │   │   ├── ai/           # Integracion Claude API
│   │   │   ├── classification/# Clasificacion TARIC
│   │   │   ├── calculation/   # Calculos aranceles/IVA
│   │   │   ├── documents/     # Validacion documentos
│   │   │   └── forms/         # Generacion H1/AES
│   │   └── utils/             # Utilidades
│   ├── uploads/               # Documentos subidos
│   └── tests/                 # Tests unitarios
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── components/        # Componentes React
│   │   │   ├── Dashboard/    # Panel principal agentes
│   │   │   ├── Portal/       # Portal cliente externo
│   │   │   ├── Expeditions/  # Gestion expedientes
│   │   │   ├── Documents/    # Visor/upload documentos
│   │   │   ├── Declarations/ # Formularios H1/AES
│   │   │   ├── Chat/         # Chat con LUCI
│   │   │   └── Layout/       # Componentes layout
│   │   ├── context/          # React Context
│   │   ├── hooks/            # Custom hooks
│   │   ├── services/         # API calls
│   │   └── utils/            # Utilidades
│   └── public/
│
├── ai-service/                 # Servicio IA Python
│   ├── prompts/               # System prompts especializados
│   ├── knowledge_base/        # Base de conocimiento
│   │   ├── normativa/        # Legislacion
│   │   ├── procedimientos/   # Guias operativas
│   │   ├── taric/            # Reglas clasificacion
│   │   └── ejemplos/         # Casos de uso
│   ├── models/               # Clases/tipos
│   └── utils/                # OCR, PDF parsing
│
└── docs/                       # Documentacion tecnica
```

## Flujo de Trabajo

### 1. Creacion de Expediente
```
Agente interno -> Crea expediente -> Sistema genera checklist automatico
                                    segun tipo operacion y mercancia
```

### 2. Portal del Cliente (Link Unico)
```
Cliente recibe link -> Ve checklist documentos -> Sube documentos
                                                        |
                                                        v
                                        LUCI valida en tiempo real
                                                        |
                                                        v
                                        Chat para resolver dudas
```

### 3. Validacion Inteligente
```
Documento subido -> OCR + Claude Vision -> Extraccion datos
                                                  |
                                                  v
                                    Verificacion coherencia
                                    (Factura vs Packing vs BL)
                                                  |
                                                  v
                                    Deteccion errores/omisiones
```

### 4. Clasificacion Arancelaria
```
Descripcion mercancia -> Claude Opus 4.5 -> Sugerencia codigo TARIC
                                                    |
                                                    v
                                        Verificacion restricciones
                                                    |
                                                    v
                                        Certificados necesarios
```

### 5. Llenado Automatico H1/AES
```
Documentos validados -> Generacion declaracion -> Calculo aranceles + IVA
                                                            |
                                                            v
                                                Agente revisa y aprueba
                                                            |
                                                            v
                                                Exporta XML para AEAT
```

### 6. Seguimiento
```
Declaracion enviada -> Circuito Verde/Naranja/Rojo
                                |
                                v
                    Gestion requerimientos (si aplica)
                                |
                                v
                            Levante
                                |
                                v
                        Archivo expediente
```

## Distribucion de Modelos IA

| Tarea | Modelo | Razon |
|-------|--------|-------|
| Chat asistente cliente | Sonnet 4 | Rapido, economico, conversacional |
| Validacion documentos | Sonnet 4 | OCR + verificacion basica |
| Clasificacion TARIC | Opus 4.5 | Razonamiento profundo necesario |
| Llenado H1/AES | Opus 4.5 | Complejidad alta, precision critica |
| Calculo aranceles/IVA | Opus 4.5 | Sin margen de error en calculos |

## Documentos Soportados

### Importacion
| Documento | Obligatorio | Datos Extraidos |
|-----------|-------------|-----------------|
| Factura Comercial | Si | Valor, descripcion, Incoterm, origen |
| Packing List | Si | Bultos, pesos bruto/neto, marcas |
| BL/AWB/CMR | Si | Carrier, fechas, puertos, contenedores |
| Autorizacion Despacho | Si | Tipo representacion, NIF poderdante |
| Certificado Origen | Segun caso | Pais origen, preferencia arancelaria |
| EUR.1/ATR/Form A | Segun caso | Preferencia 200, 300, 400 |
| Cert. Fitosanitario | Productos vegetales | Validez 60 dias |
| Cert. Sanitario | Alimentos/POA | Requisitos UE 2017/625 |

### Exportacion
| Documento | Obligatorio |
|-----------|-------------|
| Factura Comercial | Si |
| Packing List | Si |
| Documento Transporte | Si |
| Licencias Exportacion | Segun producto |

## Variables de Entorno

### Backend (.env)
```env
# Server
PORT=5001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/luci-customs

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Claude AI
ANTHROPIC_API_KEY=your-anthropic-api-key
AI_SERVICE_URL=http://localhost:8003

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend
FRONTEND_URL=http://localhost:3001

# File Upload
MAX_FILE_SIZE=52428800
UPLOAD_PATH=./uploads
```

### AI-Service (.env)
```env
ANTHROPIC_API_KEY=your-anthropic-api-key
PORT=8003
LOG_LEVEL=INFO
```

## Inicio Rapido

### Requisitos Previos
- Node.js 18+
- MongoDB 6+
- Python 3.10+
- Redis 7+ (opcional, para cache)

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tus credenciales
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

### AI-Service
```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python main.py
```

### URLs de Acceso
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:5001
- **AI Service**: http://localhost:8003
- **Portal Cliente**: http://localhost:3001/portal/{token}
- **Health Check**: http://localhost:5001/health

## API Endpoints

### Autenticacion
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | /api/auth/register | Registro de usuario |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Usuario actual |

### Expedientes
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /api/expeditions | Listar expedientes |
| POST | /api/expeditions | Crear expediente |
| GET | /api/expeditions/:id | Detalle expediente |
| PUT | /api/expeditions/:id | Actualizar expediente |
| DELETE | /api/expeditions/:id | Eliminar expediente |
| POST | /api/expeditions/:id/checklist | Generar checklist |

### Portal Cliente
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /api/portal/:token | Obtener expediente por token |
| POST | /api/portal/:token/documents | Subir documento |
| GET | /api/portal/:token/chat | Historial chat |
| POST | /api/portal/:token/chat | Enviar mensaje |

### Documentos
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | /api/documents/upload | Subir documento |
| GET | /api/documents/:id | Descargar documento |
| POST | /api/documents/:id/validate | Validar con IA |
| GET | /api/documents/:id/extracted | Datos extraidos |

### Clasificacion
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | /api/classification/suggest | Sugerir codigo TARIC |
| GET | /api/classification/taric/:code | Info codigo TARIC |
| POST | /api/classification/validate | Validar clasificacion |

### Declaraciones
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | /api/declarations/h1/generate | Generar H1 |
| POST | /api/declarations/aes/generate | Generar AES |
| GET | /api/declarations/:id/xml | Exportar XML |
| POST | /api/declarations/:id/submit | Simular envio AEAT |

### Calculos
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | /api/calculation/duties | Calcular aranceles |
| POST | /api/calculation/vat | Calcular IVA |
| POST | /api/calculation/total | Calculo completo |
| GET | /api/calculation/exchange-rate | Tipo de cambio |

## Regimenes Aduaneros Implementados

| Codigo | Descripcion | Uso |
|--------|-------------|-----|
| 40 | Despacho a libre practica | Importacion normal con pago IVA |
| 42 | Libre practica + entrega intraUE | Sin IVA (se paga en destino UE) |
| 44 | Libre practica con uso final | Aranceles reducidos por uso especifico |
| 51 | Perfeccionamiento activo | Transformacion y reexportacion |
| 53 | Importacion temporal | Uso temporal sin pago aranceles |
| 61 | Reimportacion | Devolucion de mercancias exportadas |
| 71 | Deposito aduanero | Almacenamiento sin pago |

## Preferencias Arancelarias

| Codigo | Descripcion | Certificado |
|--------|-------------|-------------|
| 100 | Arancel normal (terceros paises) | Ninguno |
| 200 | SPG (Sistema Preferencias Generalizadas) | Form A / REX |
| 300 | Acuerdo preferencial | EUR.1 / EUR-MED |
| 400 | Union aduanera | ATR (Turquia) |

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# AI-Service tests
cd ai-service
pytest
```

## Contribucion

1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Add nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## Licencia

Copyright 2025 Stock Logistic. Todos los derechos reservados.

---

**LUCI** - Parte del ecosistema COMEX de Stock Logistic
- AXEL: Cotizaciones transporte terrestre (POC)
- LUCI: Agente aduanero inteligente (Solucion completa)
