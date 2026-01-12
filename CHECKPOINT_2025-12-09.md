# CHECKPOINT - LUCI Customs Agent
## Fecha: 2025-12-09 16:10 UTC (13:10 hora local)

---

## 1. RESUMEN EJECUTIVO

LUCI Customs Agent es un sistema de gestión aduanera inteligente con IA (Claude) para Stock Logistic. El sistema permite:
- Gestionar expedientes de importación/exportación
- Clasificar mercancías con códigos TARIC
- Calcular aranceles e impuestos
- Generar declaraciones H1 para la AEAT
- Portal web para que clientes suban documentos
- Chat con IA para asistencia aduanera

---

## 2. ARQUITECTURA DEL SISTEMA

```
luci-customs-agent/
├── backend/          # Node.js + Express + MongoDB (Puerto 5001)
├── frontend/         # React + Vite + TailwindCSS (Puerto 3003)
├── ai-service/       # Python + FastAPI + Claude API (Puerto 8003)
└── docs/             # Documentación
```

### Stack Tecnológico
- **Backend**: Node.js 20, Express 4.18, MongoDB 7, Mongoose 8
- **Frontend**: React 18, Vite 5, TailwindCSS 3, React Router 6
- **AI Service**: Python 3.10+, FastAPI, Anthropic Claude API
- **Base de datos**: MongoDB local (luci-customs)

---

## 3. ESTADO DE LOS SERVICIOS

| Servicio | Puerto | Estado | Comando para iniciar |
|----------|--------|--------|---------------------|
| Backend | 5001 | ✅ Funcionando | `cd backend && node src/app.js` |
| Frontend | 3003 | ✅ Funcionando | `cd frontend && npm run dev` |
| AI-Service | 8003 | ✅ Funcionando | `cd ai-service && python main.py` |
| MongoDB | 27017 | ✅ Funcionando | `sudo systemctl start mongod` |

### URLs de acceso
- Frontend: http://localhost:3003
- Backend API: http://localhost:5001
- AI Service: http://localhost:8003
- Health checks:
  - http://localhost:5001/health
  - http://localhost:8003/health

---

## 4. CREDENCIALES Y CONFIGURACIÓN

### Usuario de prueba
```
Email: admin@stocklogistic.com
Password: admin123
Rol: admin
```

### API Keys (en archivos .env)
```
# backend/.env
ANTHROPIC_API_KEY=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
JWT_SECRET=luci-customs-agent-jwt-secret-key-2025
MONGODB_URI=mongodb://localhost:27017/luci-customs
FRONTEND_URL=http://localhost:3003

# ai-service/.env
ANTHROPIC_API_KEY=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
KNOWLEDGE_BASE_PATH=/home/rypcloud/Documentos/Logistic/POC/Aduanas/drive-download-20251209T114959Z-1-001
```

---

## 5. FUNCIONALIDADES IMPLEMENTADAS

### 5.1 Backend (100% funcional)

#### Autenticación
- [x] Login/Logout con JWT
- [x] Registro de usuarios
- [x] Roles: admin, agent, client
- [x] Middleware de autenticación

#### Expedientes
- [x] CRUD completo de expedientes
- [x] Estados: draft, pending_documents, documents_complete, classification_pending, ready_for_declaration, submitted, customs_review, completed, cancelled
- [x] Timeline de eventos
- [x] Checklist de documentos automático
- [x] Portal del cliente con token único

#### Documentos
- [x] Upload de archivos (PDF, imágenes, Excel)
- [x] Validación por tipo de documento
- [x] Extracción de datos con IA
- [x] Almacenamiento en /uploads

#### Clasificación TARIC
- [x] Servicio TARIC completo (`backend/src/services/taricService.js`)
- [x] Base de datos local con 20+ códigos comunes
- [x] Cálculo de aranceles (ad valorem y específicos)
- [x] Preferencias arancelarias (100, 200, 300, 400)
- [x] Acuerdos comerciales: SPG, UE-Japón, UE-Korea, UE-Canadá, Turquía, etc.
- [x] Cálculo de IVA (21%, 10%, 4%)
- [x] Documentos requeridos por código

#### Declaraciones
- [x] Generación de H1 con IA
- [x] Exportación a XML (formato AEAT)
- [x] Envío simulado a AEAT (modo test)
- [x] Simulación de respuestas (MRN, canal verde/naranja/rojo)

#### Portal del Cliente
- [x] Acceso sin login mediante token UUID
- [x] Subida de documentos
- [x] Chat con LUCI (IA)
- [x] Vista del checklist

### 5.2 Frontend (100% funcional)

#### Páginas implementadas
- [x] `/login` - Inicio de sesión
- [x] `/` - Dashboard con estadísticas
- [x] `/expeditions` - Lista de expedientes
- [x] `/expeditions/new` - Crear expediente
- [x] `/expeditions/:id` - Detalle de expediente
- [x] `/classification` - Clasificador TARIC con IA
- [x] `/calculator` - Calculadora de aranceles
- [x] `/chat` - Chat con LUCI
- [x] `/portal/:token` - Portal del cliente

#### Componentes clave
- `ExpeditionDetail.jsx` - Detalle con modal de portal link
- `ExpeditionList.jsx` - Lista con filtros
- `ExpeditionNew.jsx` - Formulario de creación
- `Classification.jsx` - Clasificador TARIC
- `Calculator.jsx` - Calculadora de derechos
- `Chat.jsx` - Chat con IA
- `ClientPortal.jsx` - Portal para clientes

### 5.3 AI-Service (100% funcional)

#### Endpoints
- `POST /chat` - Chat conversacional con Claude
- `POST /analyze-document` - Análisis de documentos
- `POST /classify` - Clasificación TARIC con IA
- `POST /generate-declaration` - Generación de H1
- `GET /knowledge/categories` - Categorías de conocimiento
- `GET /knowledge/h1-guidance/:field` - Guía de campos H1
- `GET /knowledge/regime/:code` - Info de regímenes
- `GET /knowledge/incoterm/:code` - Info de Incoterms
- `GET /knowledge/documents` - Lista documentos FIGAD

#### Knowledge Base
- 13 categorías de contenido aduanero
- 40 documentos FIGAD indexados
- Guía completa de campos H1
- Información de regímenes (40, 42, 44, 51, 53, 61, 71)
- Incoterms y su impacto en valor en aduana

---

## 6. ENDPOINTS API PRINCIPALES

### Autenticación
```
POST /api/auth/login          - Login
POST /api/auth/register       - Registro
GET  /api/auth/me             - Usuario actual
POST /api/auth/logout         - Logout
```

### Expedientes
```
GET    /api/expeditions              - Listar expedientes
POST   /api/expeditions              - Crear expediente
GET    /api/expeditions/:id          - Obtener expediente
PUT    /api/expeditions/:id          - Actualizar expediente
DELETE /api/expeditions/:id          - Eliminar expediente
GET    /api/expeditions/:id/checklist      - Obtener checklist
POST   /api/expeditions/:id/send-portal-link - Enviar link portal
GET    /api/expeditions/stats        - Estadísticas
```

### Documentos
```
POST   /api/documents/upload/:expeditionId  - Subir documento
GET    /api/documents/:expeditionId         - Listar documentos
DELETE /api/documents/:id                   - Eliminar documento
POST   /api/documents/:id/validate          - Validar documento
```

### Clasificación TARIC
```
GET  /api/classification/chapters           - Capítulos TARIC
GET  /api/classification/search?q=          - Buscar códigos
GET  /api/classification/taric/:code        - Info de código
POST /api/classification/suggest            - Sugerir código (IA)
POST /api/classification/validate           - Validar clasificación
POST /api/classification/apply              - Aplicar a expediente
POST /api/classification/calculate-duties   - Calcular aranceles  [NUEVO]
GET  /api/classification/required-documents/:code - Documentos requeridos [NUEVO]
GET  /api/classification/preferences/:origin      - Preferencias por país [NUEVO]
POST /api/classification/seed               - Poblar base TARIC [NUEVO]
```

### Declaraciones
```
POST /api/declarations/generate-h1    - Generar H1
GET  /api/declarations/:id/export-xml - Exportar XML
POST /api/declarations/:id/submit     - Enviar a AEAT
GET  /api/declarations/:id/status     - Estado declaración
```

### Portal Cliente
```
GET  /api/portal/:token              - Acceso al portal
POST /api/portal/:token/upload       - Subir documento
GET  /api/portal/:token/chat         - Chat con LUCI
POST /api/portal/:token/message      - Enviar mensaje
```

---

## 7. BASE DE DATOS

### Colecciones MongoDB
```
luci-customs.users           - Usuarios del sistema
luci-customs.expeditions     - Expedientes
luci-customs.chatmessages    - Mensajes de chat
luci-customs.tariccodes      - Códigos TARIC (para poblar)
```

### Datos de prueba existentes
- 1 usuario admin
- 5 expedientes de prueba
- Varios documentos subidos

---

## 8. ARCHIVOS CLAVE MODIFICADOS EN ESTA SESIÓN

### Backend
```
backend/src/services/taricService.js        - [NUEVO] Servicio TARIC completo
backend/src/controllers/classificationController.js - Añadidos endpoints de cálculo
backend/src/routes/classification.js        - Nuevas rutas TARIC
```

### Frontend
```
frontend/src/components/Expeditions/ExpeditionDetail.jsx - Modal portal link
```

### Documentación
```
docs/EMAIL_CONFIG.md          - [NUEVO] Guía de configuración email
CHECKPOINT_2025-12-09.md      - [NUEVO] Este archivo
```

---

## 9. TAREAS PENDIENTES (TODO)

### Alta prioridad
- [ ] Integrar API TARIC real de la UE (actualmente usa datos locales)
- [ ] Implementar OCR para extracción de PDFs escaneados
- [ ] Conectar con AEAT real (actualmente simulado)

### Media prioridad
- [ ] Configurar email automático (documentado en docs/EMAIL_CONFIG.md)
- [ ] Añadir más códigos TARIC a la base de datos local
- [ ] Implementar notificaciones push
- [ ] Dashboard con gráficas de rendimiento

### Baja prioridad
- [ ] Tests automatizados
- [ ] Dockerizar aplicación
- [ ] CI/CD pipeline
- [ ] Documentación API (Swagger)

---

## 10. CÓMO CONTINUAR EN PRÓXIMA SESIÓN

### Paso 1: Iniciar servicios
```bash
# Terminal 1 - MongoDB (si no está corriendo)
sudo systemctl start mongod

# Terminal 2 - Backend
cd /home/rypcloud/Documentos/Logistic/POC/luci-customs-agent/backend
node src/app.js

# Terminal 3 - AI Service
cd /home/rypcloud/Documentos/Logistic/POC/luci-customs-agent/ai-service
source venv/bin/activate  # si hay virtualenv
python main.py

# Terminal 4 - Frontend
cd /home/rypcloud/Documentos/Logistic/POC/luci-customs-agent/frontend
npm run dev
```

### Paso 2: Verificar que todo funciona
```bash
curl http://localhost:5001/health
curl http://localhost:8003/health
# Frontend en navegador: http://localhost:3003
```

### Paso 3: Login
```
URL: http://localhost:3003/login
Email: admin@stocklogistic.com
Password: admin123
```

---

## 11. RUTAS DE ARCHIVOS IMPORTANTES

```
/home/rypcloud/Documentos/Logistic/POC/luci-customs-agent/
├── backend/
│   ├── .env                    # Configuración backend
│   ├── src/
│   │   ├── app.js              # Entry point
│   │   ├── config/
│   │   │   ├── database.js     # Conexión MongoDB
│   │   │   └── logger.js       # Winston logger
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── expeditionController.js
│   │   │   ├── documentController.js
│   │   │   ├── classificationController.js
│   │   │   ├── declarationController.js
│   │   │   └── portalController.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Expedition.js
│   │   │   ├── ChatMessage.js
│   │   │   └── TaricCode.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── expeditions.js
│   │   │   ├── documents.js
│   │   │   ├── classification.js
│   │   │   ├── declarations.js
│   │   │   └── portal.js
│   │   ├── services/
│   │   │   ├── aiService.js      # Conexión con ai-service
│   │   │   ├── taricService.js   # [NUEVO] Servicio TARIC
│   │   │   ├── emailService.js   # Envío de emails
│   │   │   └── aeatService.js    # Conexión AEAT (simulada)
│   │   └── middleware/
│   │       ├── auth.js
│   │       └── validators.js
│   └── uploads/                  # Documentos subidos
│
├── frontend/
│   ├── .env                      # VITE_API_URL=http://localhost:5001
│   ├── src/
│   │   ├── App.jsx               # Router principal
│   │   ├── main.jsx              # Entry point
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── Expeditions/
│   │   │   │   ├── ExpeditionList.jsx
│   │   │   │   ├── ExpeditionDetail.jsx
│   │   │   │   └── ExpeditionNew.jsx
│   │   │   ├── Portal/
│   │   │   │   └── ClientPortal.jsx
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Classification.jsx
│   │   │   ├── Calculator.jsx
│   │   │   ├── Chat.jsx
│   │   │   └── Login.jsx
│   │   └── services/
│   │       └── api.js            # Axios config
│   └── index.html
│
├── ai-service/
│   ├── .env                      # API key Claude
│   ├── main.py                   # Entry point FastAPI
│   ├── requirements.txt          # Dependencias Python
│   └── services/
│       ├── claude_service.py     # Integración Claude
│       ├── classification_service.py
│       ├── document_service.py
│       └── knowledge_service.py  # Knowledge base FIGAD
│
├── docs/
│   ├── EMAIL_CONFIG.md           # [NUEVO] Configuración email
│   └── ...
│
└── CHECKPOINT_2025-12-09.md      # [NUEVO] Este archivo
```

---

## 12. DOCUMENTOS FIGAD DISPONIBLES

Ubicación: `/home/rypcloud/Documentos/Logistic/POC/Aduanas/drive-download-20251209T114959Z-1-001/FIGAD REPRESENTANTE ADUANERO/`

40 documentos PDF de formación aduanera:
- Introducción CAU
- Clasificación arancelaria
- Origen de mercancías
- Valor en aduana
- Controles MAPA/MITERD/Sanidad
- Procedimientos aduaneros
- Sistema H1
- Regímenes especiales
- IVA e impuestos especiales
- Y más...

---

## 13. COMANDOS ÚTILES

```bash
# Ver logs del backend
tail -f backend/logs/combined.log

# Verificar puertos en uso
lsof -i :5001 -i :3003 -i :8003

# Matar proceso en puerto específico
lsof -ti :5001 | xargs kill -9

# Probar endpoint con curl
curl -s http://localhost:5001/api/expeditions \
  -H "Authorization: Bearer TOKEN" | python3 -m json.tool

# Conectar a MongoDB
mongosh luci-customs

# Ver expedientes en MongoDB
db.expeditions.find().pretty()
```

---

## 14. NOTAS ADICIONALES

1. **Email no configurado**: El envío de email está documentado pero no activo. Usar método manual (copiar link del modal).

2. **AEAT simulada**: Las respuestas de la AEAT son simuladas. El servicio `aeatService.js` tiene modo test.

3. **TARIC local**: La base de datos TARIC usa códigos comunes locales. Para producción, integrar con API de la UE.

4. **Sin tests**: No hay tests automatizados aún. Prioridad baja.

5. **Sin Docker**: La aplicación corre directamente. Dockerizar para producción.

---

## 15. CONTACTO Y SOPORTE

- **Proyecto**: LUCI Customs Agent
- **Cliente**: Stock Logistic
- **Desarrollador**: Claude (Anthropic)
- **Fecha checkpoint**: 2025-12-09

---

*Este checkpoint fue generado automáticamente. Para continuar el desarrollo, leer este documento y seguir los pasos de la sección 10.*
