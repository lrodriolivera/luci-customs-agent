# PROMPT: Scaffolding de Nuevo Proyecto SaaS con IA

> Copia y pega este prompt en Claude Code para arrancar un nuevo proyecto con la misma arquitectura de LUCI Customs Agent.
> Reemplaza los valores entre `{{}}` con los datos de tu proyecto.

---

## PROMPT

Necesito que crees un proyecto SaaS completo con la siguiente arquitectura y stack tecnico. El proyecto se llama **{{NOMBRE_PROYECTO}}** y su proposito es **{{DESCRIPCION_CORTA}}**.

### Stack Tecnico

**Backend**: Express.js + MongoDB (Mongoose) + Node.js 18+
**Frontend**: React 18 + Vite + Tailwind CSS + React Router v6
**IA**: Anthropic Claude API (Sonnet 4.5 para tareas rapidas, Opus 4.5 para analisis complejos)
**Deploy**: AWS EC2 (t3.micro inicial) + PM2 + Nginx reverse proxy
**Auth**: JWT (7 dias expiracion) + bcrypt + roles/permisos granulares
**Pagos**: Stripe (suscripcion mensual)
**Dominio**: {{DOMINIO}} con SSL Let's Encrypt

### Estructura del Proyecto

Crea esta estructura de directorios:

```
{{NOMBRE_PROYECTO}}/
├── backend/
│   ├── src/
│   │   ├── app.js                    # Express app principal
│   │   ├── config/
│   │   │   ├── database.js           # Conexion MongoDB
│   │   │   └── logger.js             # Winston logger
│   │   ├── controllers/              # Handlers de rutas (async/await)
│   │   ├── routes/                   # Definicion de rutas Express
│   │   ├── models/                   # Schemas Mongoose
│   │   ├── services/                 # Logica de negocio pura
│   │   │   └── aiService.js          # Integracion Claude API
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT + roles + permisos
│   │   │   └── validators.js         # express-validator
│   │   ├── utils/
│   │   └── scripts/                  # Seeds y mantenimiento
│   ├── .env.example
│   ├── package.json
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Router principal
│   │   ├── components/               # Organizados por feature/dominio
│   │   │   ├── Auth/
│   │   │   ├── Layout/
│   │   │   │   ├── MainLayout.jsx    # Layout con sidebar
│   │   │   │   └── Sidebar.jsx       # Sidebar dark (slate-900)
│   │   │   ├── Dashboard/
│   │   │   └── Chat/                 # Asistente IA FAB flotante
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Provider de autenticacion
│   │   ├── services/
│   │   │   └── api.js                # Axios con interceptors
│   │   ├── hooks/
│   │   └── styles/
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── package.json
│   └── index.html
└── deploy/
    └── setup-server.sh               # Script de setup AWS
```

### Patrones Obligatorios

#### 1. Backend - app.js
```javascript
// Cada grupo de rutas en su propio try-catch para que un fallo no rompa las demas
try { routeX = require('./routes/routeX'); } catch(e) { console.error('Route X not loaded:', e.message); }

// Middleware stack
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Rutas con prefijo /api/
if (authRoutes) app.use('/api/auth', authRoutes);
if (featureRoutes) app.use('/api/{{feature}}', auth, featureRoutes);
```

#### 2. Respuesta API estandar
```javascript
// SIEMPRE este formato
res.json({ success: true, data: {...} });
res.status(400).json({ success: false, error: 'Mensaje descriptivo' });
```

#### 3. Controladores (async/await)
```javascript
const create = async (req, res) => {
  try {
    const result = await service.create(req.body, req.user._id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('Error creating:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
```

#### 4. Servicios (logica pura, sin req/res)
```javascript
// Los servicios NUNCA importan Express, solo modelos y otros servicios
async function create(data, userId) {
  const item = new Model({ ...data, owner: userId });
  await item.save();
  return item;
}
module.exports = { create, update, delete: softDelete, list };
```

#### 5. Modelos Mongoose
```javascript
const Schema = new mongoose.Schema({
  // Campos de negocio
  name: { type: String, required: true },
  status: { type: String, enum: ['draft', 'active', 'completed'], default: 'draft' },

  // Relaciones
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Permisos/estado
  isActive: { type: Boolean, default: true },  // Soft delete

  // AI cache
  aiAnalysis: { type: mongoose.Schema.Types.Mixed },

  // Timeline/historial
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });

// Metodos de instancia
Schema.methods.toPublicJSON = function() { ... };

// Metodos estaticos
Schema.statics.findByOwner = function(userId) { return this.find({ owner: userId, isActive: true }); };
```

#### 6. Auth Middleware
```javascript
// JWT verificacion + roles + permisos granulares
const auth = async (req, res, next) => { /* verificar token */ };
const requireRole = (...roles) => (req, res, next) => { /* verificar rol */ };
const requirePermission = (perm) => (req, res, next) => { /* verificar permiso */ };
```

#### 7. AI Service (aiService.js)
```javascript
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET = 'claude-sonnet-4-5-20250929';    // Tareas rapidas, chat
const OPUS = 'claude-opus-4-6';                  // Analisis complejos

const SYSTEM_PROMPTS = {
  chat: `Eres {{NOMBRE_ASISTENTE}}, un asistente virtual experto en {{DOMINIO}}.
         Responde siempre en espanol. Se conciso y profesional.`,
  analysis: `Eres un experto en {{DOMINIO}}. Analiza la informacion proporcionada
             y responde en formato JSON cuando se te pida.`,
  // Agregar prompts especializados por funcionalidad
};

class AIService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    if (!this.apiKey) logger.warn('ANTHROPIC_API_KEY no configurada - modo mock activo');
  }

  async callClaude(model, systemPrompt, userMessage, options = {}) {
    if (!this.apiKey) return this._mockResponse(userMessage);

    const response = await axios.post(ANTHROPIC_API_URL, {
      model,
      max_tokens: options.maxTokens || 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      timeout: options.timeout || 60000
    });

    return {
      content: response.data.content[0].text,
      tokensUsed: response.data.usage?.input_tokens + response.data.usage?.output_tokens
    };
  }

  // Patron: cache DB-first, AI-fallback
  async analyzeWithCache(key, analysisFunction) {
    // 1. Buscar en cache MongoDB
    const cached = await AICache.findOne({ key, expiresAt: { $gt: new Date() } });
    if (cached) return cached.result;

    // 2. Llamar a Claude
    const result = await analysisFunction();

    // 3. Cachear permanentemente
    await AICache.findOneAndUpdate({ key }, { key, result, expiresAt: new Date(Date.now() + 30*24*60*60*1000) }, { upsert: true });

    return result;
  }

  // Parseo seguro de respuestas JSON de Claude
  _parseJSON(text) {
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      return JSON.parse(jsonMatch ? jsonMatch[1] : text);
    } catch {
      return { raw: text };
    }
  }

  _mockResponse(message) {
    return { content: `[MODO DEMO] Respuesta simulada para: ${message.substring(0, 100)}`, tokensUsed: 0 };
  }
}

module.exports = new AIService();
```

#### 8. Frontend - api.js
```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Interceptor: adjuntar token JWT
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: redirigir a login si 401
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// APIs agrupadas por recurso
export const authAPI = {
  login: (creds) => api.post('/api/auth/login', creds),
  register: (data) => api.post('/api/auth/register', data),
  profile: () => api.get('/api/auth/me')
};

export const {{feature}}API = {
  list: (params) => api.get('/api/{{feature}}', { params }),
  get: (id) => api.get(`/api/{{feature}}/${id}`),
  create: (data) => api.post('/api/{{feature}}', data),
  update: (id, data) => api.put(`/api/{{feature}}/${id}`, data),
  delete: (id) => api.delete(`/api/{{feature}}/${id}`),
  // AI endpoints con timeout extendido
  aiAnalyze: (id) => api.post(`/api/{{feature}}/${id}/ai/analyze`, {}, { timeout: 90000 })
};
```

#### 9. Frontend - AuthContext
```javascript
// Token en localStorage, user en context, interceptor automatico
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const login = async (email, password) => { /* POST /api/auth/login, save token */ };
  const logout = () => { /* clear localStorage, redirect */ };
  return <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>{children}</AuthContext.Provider>;
};
```

#### 10. Tailwind Config
```javascript
// Colores personalizados de la marca
colors: {
  brand: {
    light: '#e0f2fe',
    DEFAULT: '#0284c7',  // Color principal
    dark: '#0369a1'
  }
}
// Usar: bg-brand, text-brand, border-brand-dark, etc.
```

#### 11. Sidebar Dark (MainLayout.jsx)
```jsx
// Sidebar: bg-slate-900, collapsible groups, auto-expand active section
// Content: bg-gray-50, max-w-screen-2xl
// Pattern: <MainLayout> renders <Sidebar /> + <Outlet /> (React Router)
```

### Configuracion .env

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/{{db_name}}
JWT_SECRET={{generar_random_64_chars}}
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=sk-ant-{{tu_key}}
FRONTEND_URL=http://localhost:3001
STRIPE_SECRET_KEY=sk_test_{{tu_key}}
STRIPE_WEBHOOK_SECRET=whsec_{{tu_key}}
```

### Vite Config

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': { target: 'http://localhost:5001', changeOrigin: true }
    }
  }
});
```

### UI en Espanol
- Todo el texto de la UI en espanol sin acentos en el codigo (ejemplo: "Declaracion" no "Declaración")
- Iconos: Heroicons v2 `@heroicons/react/24/outline`
- Toasts: `react-hot-toast`
- Fechas: formato DD/MM/YYYY

### Servicio de IA Separado (ai-service/)

El proyecto incluye un **microservicio de IA en Python/FastAPI** que centraliza todas las llamadas a Claude. El backend Node.js llama a este servicio via HTTP interno.

#### Estructura ai-service/

```
ai-service/
├── main.py                      # FastAPI app (endpoints de IA)
├── services/
│   ├── __init__.py
│   ├── claude_service.py        # Wrapper Anthropic API (Sonnet para chat, Opus para analisis)
│   ├── classification_service.py # Clasificacion/categorizacion con IA
│   ├── document_service.py      # OCR + Claude Vision para documentos
│   ├── knowledge_service.py     # Base de conocimiento con busqueda semantica
│   └── {{domain}}_service.py    # Servicios IA especificos del dominio
├── models/                      # Pydantic models para request/response
├── prompts/                     # System prompts organizados por funcionalidad
├── knowledge_base/              # Documentos de referencia del dominio
├── utils/
├── requirements.txt
├── .env.example
└── venv/
```

#### main.py - Patron FastAPI

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.claude_service import ClaudeService
from services.classification_service import ClassificationService
from services.document_service import DocumentService
from services.knowledge_service import KnowledgeService

# Initialize services
claude_service = ClaudeService()
classification_service = ClassificationService()
document_service = DocumentService()
knowledge_service = KnowledgeService()

app = FastAPI(title="{{NOMBRE}} AI Service", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- Pydantic Models ---
class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, str]]] = None
    context_type: str = "client"  # "client" or "agent"

class ChatResponse(BaseModel):
    message: str
    model: str
    tokens_used: int
    confidence: float
    sources: List[str] = []

class ClassificationRequest(BaseModel):
    description: str
    additional_info: Optional[Dict[str, Any]] = None
    language: str = "es"

# --- Endpoints ---
@app.get("/health")
async def health():
    return {"status": "healthy", "claude_configured": claude_service.is_configured()}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        response = await claude_service.chat(
            message=request.message,
            context=request.context,
            conversation_history=request.conversation_history,
            context_type=request.context_type
        )
        return ChatResponse(**response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/classify")
async def classify(request: ClassificationRequest):
    try:
        return await classification_service.classify(
            description=request.description,
            additional_info=request.additional_info
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/validate-document")
async def validate_document(document_type: str, content: str = None, file_path: str = None):
    try:
        return await document_service.validate(document_type=document_type, content=content, file_path=file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze(data: Dict[str, Any], analysis_type: str = "general"):
    """Endpoint generico de analisis IA - cada proyecto lo especializa"""
    try:
        return await claude_service.analyze(data=data, analysis_type=analysis_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/knowledge/search")
async def search_knowledge(query: str, limit: int = 5):
    return knowledge_service.search(query, limit=limit)
```

#### claude_service.py - Wrapper Anthropic

```python
import os
import json
import anthropic

SONNET = os.getenv("DEFAULT_CHAT_MODEL", "claude-sonnet-4-5-20250929")
OPUS = os.getenv("DEFAULT_COMPLEX_MODEL", "claude-opus-4-6")

SYSTEM_PROMPTS = {
    "chat_client": """Eres {{NOMBRE_ASISTENTE}}, un asistente virtual experto en {{DOMINIO}}.
Responde en espanol, se conciso y profesional. No inventes informacion.""",
    "chat_agent": """Eres {{NOMBRE_ASISTENTE}}, un asistente tecnico para profesionales de {{DOMINIO}}.
Proporciona informacion tecnica precisa y detallada.""",
    "analysis": """Eres un experto en {{DOMINIO}}. Analiza los datos proporcionados.
Responde en formato JSON cuando se pida.""",
    "classification": """Eres un experto clasificador en {{DOMINIO}}.
Analiza la descripcion y sugiere la categoria mas apropiada con nivel de confianza.""",
}

class ClaudeService:
    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        if self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)

    def is_configured(self):
        return bool(self.api_key)

    async def _call(self, model, system, user_msg, max_tokens=4096):
        if not self.is_configured():
            return {"content": f"[MOCK] {user_msg[:100]}", "tokens_used": 0, "model": model}
        response = self.client.messages.create(
            model=model, max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_msg}]
        )
        return {
            "content": response.content[0].text,
            "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
            "model": model
        }

    async def chat(self, message, context=None, conversation_history=None, context_type="client"):
        prompt_key = f"chat_{context_type}"
        system = SYSTEM_PROMPTS.get(prompt_key, SYSTEM_PROMPTS["chat_client"])
        user_msg = message
        if context:
            user_msg = f"CONTEXTO: {json.dumps(context, ensure_ascii=False)}\n\nMENSAJE: {message}"
        result = await self._call(SONNET, system, user_msg)
        return {"message": result["content"], "model": result["model"],
                "tokens_used": result["tokens_used"], "confidence": 0.85, "sources": []}

    async def analyze(self, data, analysis_type="general"):
        system = SYSTEM_PROMPTS.get("analysis", SYSTEM_PROMPTS["chat_agent"])
        user_msg = f"Tipo de analisis: {analysis_type}\nDatos: {json.dumps(data, ensure_ascii=False)}"
        result = await self._call(OPUS, system, user_msg)
        # Parse JSON response
        try:
            content = result["content"]
            json_match = __import__("re").search(r"```(?:json)?\s*([\s\S]*?)```", content)
            parsed = json.loads(json_match.group(1) if json_match else content)
            return {"analysis": parsed, "model": result["model"], "tokens_used": result["tokens_used"]}
        except:
            return {"analysis": {"raw": result["content"]}, "model": result["model"], "tokens_used": result["tokens_used"]}
```

#### .env.example (ai-service)

```env
ANTHROPIC_API_KEY=sk-ant-{{tu_key}}
HOST=0.0.0.0
PORT=8003
DEBUG=true
LOG_LEVEL=INFO
DEFAULT_CHAT_MODEL=claude-sonnet-4-5-20250929
DEFAULT_COMPLEX_MODEL=claude-opus-4-6
MAX_REQUESTS_PER_MINUTE=60
KNOWLEDGE_BASE_PATH=./knowledge_base
```

#### requirements.txt

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6
anthropic==0.18.0
PyPDF2==3.0.1
pytesseract==0.3.10
Pillow==10.2.0
pandas==2.2.0
pydantic==2.5.3
httpx==0.26.0
python-dotenv==1.0.0
```

#### Conexion Backend Node.js → ai-service Python

En el backend, `aiService.js` llama al ai-service asi:

```javascript
// En el backend Node.js, llamar al ai-service Python
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8003';

async function callAIService(endpoint, data) {
  const response = await axios.post(`${AI_SERVICE_URL}${endpoint}`, data, { timeout: 90000 });
  return response.data;
}

// Ejemplos de uso
const chatResponse = await callAIService('/chat', { message, context, context_type: 'agent' });
const classification = await callAIService('/classify', { description: 'producto X' });
const analysis = await callAIService('/analyze', { data: entityData, analysis_type: 'risk' });
```

En `vite.config.js` del frontend, agregar proxy:

```javascript
proxy: {
  '/api': { target: 'http://localhost:5001', changeOrigin: true },
  '/ai': { target: 'http://localhost:8003', changeOrigin: true, rewrite: p => p.replace(/^\/ai/, '') }
}
```

### Deploy a AWS

El proyecto se despliega en la misma cuenta AWS que LUCI Customs Agent:
- **SSH Key**: `~/.ssh/aws-keys/luci-customs-key.pem`
- **Servidor**: EC2 t3.micro con Ubuntu
- **Dominio**: {{DOMINIO}} con SSL Let's Encrypt
- **Backend**: PM2 en `/opt/{{nombre}}/backend/`
- **Frontend**: Vite build en `/opt/{{nombre}}/frontend/dist/`
- **Nginx**: Reverse proxy, sirve static files + proxy /api/ al backend
- **MongoDB**: Local (migrar a Atlas con 50+ usuarios)
- **Backups**: Cron diario 3AM con mongodump, retencion 30 dias

### Comandos de deploy
```bash
# Build frontend
cd frontend && npm run build

# Deploy frontend
rsync -avz --delete dist/ ubuntu@{{DOMINIO}}:/opt/{{nombre}}/frontend/dist/

# Deploy backend
rsync -avz --delete --exclude='node_modules' --exclude='.env' --exclude='uploads' backend/ ubuntu@{{DOMINIO}}:/opt/{{nombre}}/backend/

# Deploy ai-service
rsync -avz --delete --exclude='venv' --exclude='__pycache__' --exclude='.env' ai-service/ ubuntu@{{DOMINIO}}:/opt/{{nombre}}/ai-service/

# Restart all
ssh ubuntu@{{DOMINIO}} "cd /opt/{{nombre}}/backend && npm install --production && pm2 restart {{nombre}}-backend && pm2 restart {{nombre}}-ai-service"
```

#### Setup ai-service en servidor (primera vez)

```bash
ssh ubuntu@{{DOMINIO}}
cd /opt/{{nombre}}/ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con ANTHROPIC_API_KEY

# Registrar en PM2
pm2 start "venv/bin/uvicorn main:app --host 0.0.0.0 --port 8003" --name {{nombre}}-ai-service
pm2 save
```

### Funcionalidades base a implementar

1. **Auth**: Login, registro, JWT, roles (admin/user/viewer), permisos granulares
2. **Dashboard**: Metricas principales, graficos, actividad reciente
3. **CRUD principal**: Listado con filtros/paginacion, detalle, crear/editar, soft-delete
4. **Chat IA**: Boton flotante (FAB) con asistente Claude, historial de conversacion
5. **Analisis IA**: Boton "Analizar con IA" en cada entidad principal
6. **PDFs**: Generacion con PDFKit para documentos principales
7. **Stripe billing**: 3 planes (Free, Pro, Enterprise), webhook, limites por plan
8. **API publica v1**: API keys JWT, rate limiting, documentacion

### Lo que NO necesito

- No uses TypeScript (JavaScript puro ES6+)
- No uses frameworks CSS (solo Tailwind utility classes)
- No crees archivos README ni documentacion extra
- No agregues tests unitarios (los hare despues)
- No uses Docker (deploy directo con PM2)
- No uses GraphQL (REST puro)

### Empieza creando

1. **ai-service/**: `main.py`, `services/claude_service.py`, `services/classification_service.py`, `services/document_service.py`, `services/knowledge_service.py`, `requirements.txt`, `.env.example`
2. **Backend**: `app.js`, `config/`, `models/User.js`, `controllers/authController.js`, `routes/auth.js`, `middleware/auth.js`, `services/aiService.js` (que llama al ai-service)
3. **Frontend**: `App.jsx`, `components/Auth/Login.jsx`, `components/Layout/MainLayout.jsx`, `context/AuthContext.jsx`, `services/api.js`
4. Los `.env.example` (backend + ai-service) con todas las variables
5. El `tailwind.config.js` con colores de marca
6. El `vite.config.js` con proxy a backend (/api) y ai-service (/ai)

La funcionalidad principal del proyecto es: **{{DESCRIPCION_DETALLADA}}**

Las entidades principales del dominio son: **{{LISTA_ENTIDADES}}**
