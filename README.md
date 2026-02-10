<div align="center">

# LUCI - Agente Aduanero Inteligente

**Plataforma SaaS de gestion aduanera potenciada con inteligencia artificial**

[![Stack](https://img.shields.io/badge/React_+_Express_+_MongoDB-blue?style=flat-square)](#tech-stack)
[![AI](https://img.shields.io/badge/Claude_Sonnet_4-blueviolet?style=flat-square)](#motor-ia)
[![Deploy](https://img.shields.io/badge/AWS_EC2-orange?style=flat-square)](#deploy)

[Demo en vivo](https://aduanas.strixai.es/landing) · [Solicitar Demo](https://aduanas.strixai.es/landing#contact)

</div>

---

## Que es LUCI

LUCI es una plataforma integral de despacho aduanero que utiliza inteligencia artificial para automatizar clasificacion arancelaria, calculo de derechos, gestion de declaraciones y procesos de inspeccion.

Desarrollado por **[Strix AI](https://strixai.es)** para agentes de aduanas, freight forwarders e importadores/exportadores.

---

## Funcionalidades

| Modulo | Descripcion |
|--------|-------------|
| **Clasificacion TARIC con IA** | Arbol arancelario completo generado con IA bajo demanda. Busqueda por codigo o texto. Cache progresivo en MongoDB |
| **Calculadora de Derechos** | Aranceles, IVA (general/reducido/superreducido), preferencias (EUR.1, SPG, REX), tarifas estacionales, precios de entrada |
| **PUE SOIVRE / ROHS** | Solicitudes de inspeccion con autorrelleno desde MRN, validacion RII contra Ministerio de Industria, bifurcacion SOIVRE vs ROHS/RAEE |
| **Declaraciones** | H1 (importacion), H7 (e-commerce), ENS/ICS2 (entrada sumaria) con asistencia IA |
| **Regimenes Especiales** | Garantias CGU, OEA, transitos NCTS, regimenes (40, 42, 44, 51...) |
| **Asistente IA 24/7** | Chat con Claude para normativa CAU, procedimientos y clasificacion. Boton flotante desde cualquier pantalla |
| **Motor de Reglas** | Preferencias arancelarias, impuestos especiales, contingentes, normativa CAU/BOE |
| **Control Aduanero** | Plazos, inspecciones, comunicaciones con AEAT, consultas ADDS |

---

## Tech Stack

| Capa | Tecnologia |
|------|------------|
| **Frontend** | React 18, Vite 5, Tailwind CSS, Heroicons v2, React Router v6 |
| **Backend** | Express.js, Node.js 18+, Mongoose ODM, JWT, Helmet, PM2 |
| **Base de datos** | MongoDB 6+ |
| **IA** | Claude Sonnet 4 (Anthropic API), servicio Python FastAPI en puerto 8003 |
| **Infra** | AWS EC2 (Ubuntu), Nginx + SSL Let's Encrypt |

---

## Arquitectura

```
┌──────────────────────────────────────────────────────┐
│                  NGINX (443/SSL)                     │
│               aduanas.strixai.es                     │
├────────────┬─────────────────┬───────────────────────┤
│  /         │  /api           │  /ai                  │
│  Frontend  │  Backend API    │  AI Service           │
│  (static)  │  (port 5001)   │  (port 8003)          │
├────────────┼─────────────────┼───────────────────────┤
│ React SPA  │ Express.js      │ Python/Uvicorn        │
│ Tailwind   │ JWT Auth        │ Claude Sonnet 4       │
│ Vite build │ Mongoose        │ Knowledge Base        │
└────────────┴───────┬─────────┴───────────────────────┘
                     │
               ┌─────▼─────┐
               │  MongoDB  │
               └───────────┘
```

---

## Estructura del proyecto

```
luci-customs-agent/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Landing/          # Pagina comercial publica
│       │   ├── Layout/           # Sidebar dark, FloatingAssistant
│       │   ├── Dashboard/        # Dashboard premium con hero dark
│       │   ├── Classification/   # TARIC + TaricTreeBrowser (IA)
│       │   ├── Calculations/     # Calculadora de derechos
│       │   ├── PUE/              # SOIVRE/ROHS wizard 6 pasos
│       │   ├── Chat/             # Asistente LUCI
│       │   └── ...               # 20+ modulos
│       ├── services/api.js       # Cliente API (Axios)
│       └── styles/index.css      # Tailwind + tema custom
├── backend/
│   └── src/
│       ├── controllers/          # Logica de negocio
│       ├── models/               # Schemas (TaricCode, Expedition, PUE...)
│       ├── routes/               # 30+ archivos de rutas
│       ├── services/             # aiService, taricService, dutyCalculation
│       ├── data/                 # seasonalTariffs, soivreCatalogs
│       └── middleware/           # Auth, validators, rate limiting
├── ai-service/                   # Servicio Python IA
├── marketing/                    # Emails, LinkedIn posts, guion video
└── deploy/                       # Scripts de deploy
```

---

## Motor IA

LUCI utiliza un sistema multi-fuente para la clasificacion arancelaria:

```
Consulta usuario
      │
      ▼
  MongoDB (cache) ──encontrado──▶ Respuesta instantanea
      │
   no encontrado
      │
      ▼
  Claude Sonnet 4 ──genera──▶ Respuesta + cache en MongoDB
      │
      ▼
  Proxima consulta = instantanea
```

- **Arbol TARIC generado bajo demanda**: cuando un usuario navega un capitulo nuevo, la IA genera las partidas/subpartidas y las cachea permanentemente
- **195 paises** con preferencias arancelarias
- **Tarifas estacionales** para productos agricolas (tomates, melones, citricos...)
- **IVA inteligente**: detecta automaticamente tipo reducido (10%) para alimentos, superreducido (4%) para basicos

---

## Setup local

```bash
# Clonar
git clone https://github.com/lrodriolivera/luci-customs-agent.git
cd luci-customs-agent

# Backend
cd backend
cp .env.example .env    # Configurar ANTHROPIC_API_KEY, MONGODB_URI, JWT_SECRET
npm install
npm run dev

# Frontend (otra terminal)
cd frontend
npm install
npm run dev             # http://localhost:3001
```

### Variables de entorno (backend/.env)

```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/luci-customs
JWT_SECRET=your-secret-key
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
```

---

## Deploy

```bash
# Frontend
cd frontend && npm run build
rsync -avz --delete dist/ ubuntu@servidor:/opt/luci-customs/frontend/dist/

# Backend
rsync -avz backend/src/ ubuntu@servidor:/opt/luci-customs/backend/src/
ssh ubuntu@servidor "pm2 restart luci-backend"
```

---

## API Endpoints principales

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Autenticacion JWT |
| `GET` | `/api/classification/search?q=` | Busqueda TARIC (codigo o texto, IA fallback) |
| `GET` | `/api/classification/tree?parent=` | Arbol jerarquico con generacion IA |
| `GET` | `/api/classification/taric/:code` | Detalle codigo TARIC |
| `POST` | `/api/calculation/duties` | Calculo de aranceles + IVA |
| `GET` | `/api/pue/catalogs/all` | Catalogos SOIVRE/ROHS |
| `POST` | `/api/pue/validate-rii` | Validacion RII por NIF |
| `GET` | `/api/dashboard/alerts` | Alertas activas |

---

## Planes

| Plan | Precio | Incluye |
|------|--------|---------|
| **Starter** | Gratis | 10 clasificaciones IA/mes, calculadora basica, 1 usuario |
| **Professional** | 149 EUR/mes | IA ilimitada, PUE SOIVRE, declaraciones, 5 usuarios |
| **Enterprise** | Personalizado | Todo + API + integraciones custom + SLA 99.9% |

---

## Roadmap

- [x] Clasificacion TARIC con IA + cache progresivo
- [x] Calculo de derechos con tarifas estacionales
- [x] PUE SOIVRE/ROHS con autorrelleno MRN
- [x] Landing page comercial con pricing
- [x] Dashboard premium con hero dark
- [x] Sidebar dark con grupos colapsables
- [x] FAB asistente IA flotante
- [ ] Integracion real AEAT (certificados digitales)
- [ ] Multi-tenancy con facturacion Stripe
- [ ] App movil (React Native)
- [ ] API publica para integraciones ERP

---

## Licencia

Software propietario. &copy; 2026 Strix AI. Todos los derechos reservados.

---

<div align="center">

**[Strix AI](https://strixai.es)**

</div>
