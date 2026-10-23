# Prompt de traspaso — LUCI Customs Agent (post-migración a homelab)

> Abre una sesión de Claude Code en `/srv/homelab/luci/` (el stack dockerizado ya desplegado)
> y pega TODO lo de abajo (desde "---") como primer mensaje.
> El código fuente original está en `/home/rypcloud/Documentos/Logistic/POC/luci-customs-agent/`.
> Generado 2026-07-15.

---

Necesito que revises, completes y arregles lo que falte en el despliegue de **LUCI Customs Agent** en mi homelab. Te explico el contexto completo de lo que ya se hizo, por qué, y qué queda pendiente.

## Contexto: por qué se migró (y con prisa)

LUCI corría en un EC2 de AWS (`aduanas.strixai.ai`, eu-west-1). La **cuenta AWS 367509577730 fue suspendida por impago el 2026-07-15** — credenciales IAM muertas (`InvalidAccessKeyId`), sin consola ni CLI. Hubo que migrar LUCI **desde el código local** (`/home/rypcloud/Documentos/Logistic/POC/luci-customs-agent/`, actualizado) al homelab (HP ProBook, Docker en `/srv/homelab/luci/`), sustituyendo todas las dependencias de esa cuenta AWS. Se priorizó dejarlo **funcionando** rápido; por eso puede haber cosas a medias o sin validar a fondo.

## Qué se hizo y por qué (decisiones ya tomadas — respétalas salvo que encuentres algo roto)

**Arquitectura desplegada** (`/srv/homelab/luci/docker-compose.yml`, red docker externa `homelab`):
- `luci-mongo` (mongo:7), `luci-redis` (redis:7) — infra
- `luci-backend` (Express, :5001) — build desde `backend/Dockerfile` (node:20-slim)
- `luci-ai` (FastAPI, :8003) — build desde `ai-service/Dockerfile`
- `luci-frontend` (React/Vite → nginx) — build desde `frontend/Dockerfile`, proxea `/api` al backend
- Publicado en internet vía **Cloudflare Tunnel**: `aduanas.strixai.ai` → `http://luci-frontend:80` (Path vacío). NO se exponen puertos al LAN.

**Sustituciones AWS aplicadas** (la cuenta original está caída):
- **IA — Bedrock con cuenta UMMIA 405894862059** (NO la cuenta vieja, cuya key estaba además en cuarentena). Credenciales en `backend/.env` y `ai-service/.env` como `BEDROCK_ACCESS_KEY_ID` / `BEDROCK_SECRET_ACCESS_KEY` (origen: `/home/rypcloud/Documentos/Rene/consultoria-ummia/credenciales aws_ummia/luis_rodriguez_accessKeys.csv`). Región us-east-1. Verificado con un `ConverseCommand` real (respondió OK).
- **Auth: `JWT_LEGACY_MODE=true`** en `backend/.env` → LUCI NO usa Cognito (que estaba en la cuenta AWS caída). Auth por JWT propio.
- **Cert FNMT para AEAT**: copiado a `/srv/homelab/luci/certs/strixai_fnmt.p12` (chmod 600, gitignored), montado read-only en el backend en `/app/certs/strixai_fnmt.p12`. `.env`: `AEAT_CERTIFICATE_PATH=/app/certs/strixai_fnmt.p12`, `AEAT_ENVIRONMENT=production`, `AEAT_FORCE_SIMULATION=false`.
- **Redis**: se añadió `luci-redis` al stack porque el backend daba `/health` 503 DEGRADED sin él (`REDIS_URL=redis://luci-redis:6379`).
- **MongoDB nueva y vacía**: el Mongo del EC2 (`localhost:27017`) se perdió con la suspensión, no había dump. Se arrancó con BD nueva.

**Fixes que hicieron falta durante la migración**:
- `ai-service/requirements.txt`: se añadió `anthropic` (faltaba, daba `ModuleNotFoundError: No module named 'anthropic'`).
- `ai-service/Dockerfile`: se añadió `tesseract-ocr tesseract-ocr-spa poppler-utils` (el ai-service hace OCR de documentos con pytesseract/pdf2image).
- `frontend/nginx.conf`: proxea `/api` al backend con `proxy_set_header Authorization $http_authorization` (fix histórico documentado en el MEMORY.md del proyecto original).
- El `.env` de backend/ai-service se ajustó para hosts docker: `MONGODB_URI=mongodb://luci-mongo:27017/luci`, `AI_SERVICE_URL=http://luci-ai:8003`, `BACKEND_URL=http://luci-backend:5001`.

**Datos cargados** (BD nueva, ejecutados dentro de `luci-backend`):
- `node src/scripts/createIndexes.js` → 29 índices Mongo.
- `node src/scripts/seedDemoData.js` → datos demo (25 expedientes, 35 H7, requerimientos, inspecciones, etc.).
- `node src/scripts/createSuperAdmin.js` → usuario **`tester@strixai.ai` / `Tester2026!`** (admin, 9/9 permisos, Enterprise). Login verificado por API. ⚠️ El usuario `test@luci.es`/`test123` que menciona el MEMORY.md original NO existe en esta BD — ningún seed actual lo crea.

## Estado verificado al cierre de la migración
- 5/5 contenedores `Up`, `/health` = OK (mongo+redis connected), ai-service `/health` 200.
- Bedrock OK (converse real). Login OK por el túnel (`https://aduanas.strixai.ai/api/auth/login`).
- Frontend sirve la SPA y proxea `/api` (200/200 end-to-end).

## Lo que queda pendiente / puede estar roto — REVISA Y ARREGLA

1. **Catálogo TARIC real NO cargado** (lo más importante). La BD solo tiene los datos de `seedDemoData`. Los códigos TARIC reales (miles) no están. Los scripts en `backend/scripts/` (`downloadTaricFromUK.js`, `scrapeTaricEC.js`, `importTaricFromEC.js`, `generateTaricHierarchy.js`, `translateTaricToSpanish.js`, `importTaricData.js`) **descargan/scrapean de fuentes externas** (UK, Comisión Europea) — proceso largo y frágil, no hay JSON pre-generado en el repo. **Tarea**: investiga cuál es el flujo correcto y en qué orden, verifica que las fuentes externas responden, y carga el TARIC. Si alguna fuente está caída o el proceso es inviable, dímelo con opciones (p.ej. buscar un export previo, o cargar un subconjunto).

2. **La clasificación arancelaria (el core del producto) no está validada end-to-end.** Solo probé login y health. Hay que verificar que el flujo real funciona: subir un producto/documento → el ai-service (Bedrock) clasifica → devuelve código TARIC. Esto depende en parte del punto 1 (sin TARIC cargado, la clasificación puede fallar o dar resultados pobres). **Tarea**: prueba el flujo de clasificación de punta a punta y arregla lo que falle.

3. **Integración AEAT (envío de declaraciones) sin probar.** El cert FNMT está montado y `AEAT_ENVIRONMENT=production`, pero NO se ha probado ningún envío real a AEAT desde el homelab. El MEMORY.md original documenta 6 builders XML (H1/H7/AES/NCTS/ENS/PUE) validados contra AEAT PRE. **Tarea**: verifica que el cert se carga bien en runtime (revisa logs del backend al iniciar un submit), y valida al menos un envío en entorno PRE antes de confiar en PROD. ⚠️ CUIDADO: `AEAT_ENVIRONMENT=production` — si vas a probar, considera cambiar a PRE primero para no mandar algo real a la Agencia Tributaria. Pregúntame antes de cualquier envío a PROD.

4. **ai-service: revisar que usa Bedrock (no una API key rota).** Confirma en el código del ai-service (`ai-service/main.py`, `services/`) qué usa realmente para la IA. Se le pusieron tanto credenciales Bedrock (UMMIA) como se añadió el módulo `anthropic` — verifica que no haya una `ANTHROPIC_API_KEY` vieja sin créditos o una ruta de código que apunte a la cuenta AWS caída.

5. **Stripe / SMTP / otras integraciones**: el `.env` tiene claves de Stripe (LIVE?), SMTP, etc. que venían del EC2. Revisa que no haya nada apuntando a servicios de la cuenta AWS suspendida (SES en particular — LUCI usaba SES; ahora debería ir por SMTP directo). Verifica `EMAIL_FROM`, `SMTP_*`.

6. **Warning de Node 20 vs AWS SDK**: el backend avisa que el AWS SDK v3 requerirá node >=22 en 2027. No urge, pero anótalo.

## Reglas / cómo trabajar
- **NO rehacer lo que ya funciona** (arquitectura docker, sustituciones AWS, auth JWT legacy, cert montado). Solo arreglar lo roto y completar lo que falta.
- Secretos: todo va en `.env` gitignored (`backend/.env`, `ai-service/.env`). El cert en `certs/` (gitignored). NO commitees secretos ni el cert.
- El stack se maneja con `docker compose` desde `/srv/homelab/luci/`. Para ejecutar scripts del backend: `docker exec luci-backend node src/scripts/XXX.js`.
- Cambios de código: edítalos en `/srv/homelab/luci/` (es la copia desplegada) y rebuild con `docker compose build <servicio> && docker compose up -d <servicio>`. Nota: el build del frontend (Vite) es lento por WiFi y una vez se colgó BuildKit — si pasa, mátalo y relánzalo.
- El repo de despliegue es `/srv/homelab` (git local, rama main, sin remote). Commitea los arreglos ahí con mensajes claros.
- Publicación pública: por Cloudflare Tunnel (yo, Luis, lo hago manual en el dashboard — Path SIEMPRE vacío). No necesitas tocar eso salvo que cambie un nombre de contenedor.
- ⚠️ La cuenta AWS 367509577730 sigue suspendida. NO asumas que puedes usar ningún servicio de esa cuenta (S3, SES, Cognito, Bedrock viejo). Bedrock va por UMMIA (405894862059).

Empieza revisando el estado actual del stack (`docker compose ps`, logs, `/health`) y el punto 1 (TARIC). Antes de procesos largos (scraping TARIC) o acciones sensibles (envíos AEAT PROD), pregúntame.
