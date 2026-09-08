# LUCI Customs Agent - Project Memory

> Actualizado 8/Sep/2026. Version anterior (vigente hasta 2/Mar/2026) quedo
> obsoleta tras la migracion a homelab y 5+ meses de trabajo no reflejados
> aqui — ver git log para el detalle real de cada cambio.

## Company
- **Empresa**: STRIX AI SL (NIF: B22477020, EORI: ESB22477020)
- **Representante**: Jenifer Romero (NIF: 70073780W, CEO no tecnica)
- **Tech Lead**: Luis Rodriguez (luis.rodriguez@strixai.es)
- **Comercial**: Rodrigo Godoy (rodrigo.godoy@strixai.es)

## Git — Forgejo, NO GitHub
- **Remote**: `https://git.strixai.es/strixai/luci-customs-agent.git`, rama `main`
- SSH alternativo: `ssh://git@git.strixai.es:2222/strixai/luci-customs-agent.git`
- Verificar siempre `git remote -v` antes de push — un remote a GitHub es un error

## Deploy — HOMELAB (Docker), ya NO AWS EC2
- Convertido a checkout de git el 1/Ago/2026 (antes era copia manual de ficheros,
  lo que dejo meses de cambios sin commitear: SMTP Resend, fix `formaRepresentacion`,
  migracion a Bedrock del ai-service, los Dockerfile)
- Ruta: `/srv/homelab/luci/`, vía Cloudflare Tunnel
- **Actualizar**: `git pull` → `docker compose build luci-backend luci-frontend luci-ai` → `docker compose up -d` (backend antes que frontend)
- **Antes de tocar nada**: `git status` debe estar limpio salvo lo no versionado; si hay modificados, alguien edito el servidor a mano — commitear o descartar antes de seguir
- No versionado (en `.gitignore`, con copia solo en el servidor, SIN backup externo):
  `backend/.env`, `ai-service/.env`, `certs/strixai_fnmt.p12`, `data/` (volumenes Mongo/uploads)
- Backup Mongo: cron diario 03:30 → `/srv/backups/luci/`, retencion 30 dias (solo Mongo, no `.env`/certs)
- Homelab sin salida directa a internet → Surfshark VPN necesaria (MTU 1280 rompe TLS de contenedores); salida siempre por WiFi
- **URL**: `https://aduanas.strixai.es` | admin `luis.rodriguez@strixai.es`/`Juancho_1301`, `tester@strixai.es`/`Tester2026!`
- Auth: **Cognito muerto** (caido en incidente AWS 15/Jul–6/Ago, no restaurado) → login por JWT legacy

## Project Structure
- **Frontend**: React + Vite + Tailwind, MUI v7 (migracion parcial desde v5, quedan ~75 `<Grid item xs>` por migrar a `size={{}}`)
- **Backend**: Express + MongoDB
- **AI service**: servicio separado (`ai-service/`), usa Amazon Bedrock

## AI Service — Bedrock, Opus 5 + Sonnet 5
- Perfil `luci-bedrock` en cuenta AWS propia (367509577730, reactivada 6/Ago)
- Modelos actuales: Opus 5 + Sonnet 5 (migrado desde Claude 4.6)
- Opus 5 razona: `content[0]` es `reasoningContent`, `.text` sale `undefined` sin error si no se contempla — ver fix en `aiService.js`
- Backoff en `callClaude`: los 503/524 son de Cloudflare y no llegan al backend
- 448 bloques `catch` saneados (no silencian errores)

## Cobertura de tests — META ≥80% CUMPLIDA (6/Ago/2026)
- **Backend**: 81,30% branches / ~84,82% lines, 8097 tests
- **Frontend**: 80,63% lines / 88,37% branches, 2603 tests
- Medir SIEMPRE desde `backend/`, bateria `--runInBand`
- CI en verde (ejecucion 185) — llevaba roto desde la 45 por dependencias fantasma
  (`lucide-react`, `mongodb-memory-server` solo existian en la maquina de un dev)
- Regla anti-flaky: `waitFor(mock llamado)` NO espera al render (~200 sitios afectados);
  `toLocaleString()` sin locale sigue el locale del proceso, no fijar sin `es-ES`

## Seguridad multi-tenant — auditoria completa, RESUELTA
- 9 routers servian datos SIN TOKEN (incluido panel admin `/api/admin/users`, y `/api/oea` con NIF/EORI — RGPD)
- Auditoria completa: 42 routers / 704 rutas → `backend/SECURITY_AUDIT.md`
- Barridos sin hallazgos adicionales: accesos por id, propiedad de recursos
- Analytics ya no inventa datos: `aggregate()` de Mongoose NO castea `tenantId` automaticamente — hay que hacerlo explicito
- Pagos acotados por organizacion, roles de super admin unificados, `requireRole('admin')` es de tenant (no global)

## AEAT Integration
- **Certificate**: FNMT Jenifer Romero (70073780W, R: B22477020), valido hasta 14/10/2027
- **PRE URLs**: prewww1.aeat.es (cert), prewww10.aeat.es (seal)
- **PROD URLs**: www1/www2.agenciatributaria.gob.es
- **DIT contact**: Jose Antonio, `atenusu@correo.aeat.es`
- **REGLA DE ORO**: AEAT SIEMPRE en test (`AEAT_ENVIRONMENT=test`), NUNCA produccion sin autorizacion explicita

### XML Builders — 6 validados contra AEAT PRE, 5/6 con MRN real
| Builder | XSD | Key rules |
|---------|-----|-----------|
| **H1** `h1XmlBuilder.js` | ImportacionCompletaV1Ent.xsd | `unqualified`, C181IdentMedioTransporteLlegada (no C18) |
| **H7** `h7XmlBuilder.js` | DeclaSimpliImporV1Ent.xsd | Reescrito a esquema `AltaH7V1Ent`; MRN real recibido (canal verde) |
| **AES** `aesXmlBuilder.js` | CC515CV1Ent.xsd | `qualified` ent:, orden ExportOperation especifico |
| **NCTS** `nctsXmlBuilder.js` (T1) | CC015CV1Ent.xsd | `qualified` ent:, EORI=no name/address; CC007 con 6 errores→1, queda error 856 (dato de PRE, requiere G4/DSDT de Jose Antonio referenciando un transito nuestro) |
| **ENS** `ensXmlBuilder.js` | IE315V5Ent.xsd | Root=`CC315A`, legacy HEAHEA/GOOITEGDS; MRN reales recibidos, incluido IE313 de rectificacion aceptado |
| **PUE** `soivreXmlBuilder.js` | ROHSSolicitudCertificadoV1Ent.xsd | Unico sin MRN real — bloqueado, requiere H1 previo aceptado |
- ⚠️ Bug XAdES SIN corregir: digest de SignedProperties calculado sobre el ID, no sobre el bloque XML — primer sospechoso si AEAT rechaza por digest
- Combinacion PRE valida H7 y NCTS T1 documentadas en memoria de sesion; NCTS rechaza algunos TARIC del catalogo local que si acepta el arancel (ej. `73043100` no, `73041100` si)

## Normativa
- **Reg. (UE) 2026/382** ✅ IMPLEMENTADO (1/Jul/2026): fin franquicia 150€, umbral minimis 22€ eliminado,
  derecho fijo 3€/articulo (IOSS-exento o postal, transitorio hasta 1/Jul/2028). Logica en `config/reg2026382.js`

## Bugs criticos encontrados y corregidos en campaña E2E (7-10/Ago/2026)
Patron recurrente: LUCI presentaba como dato/veredicto/intercambio con AEAT algo que
en realidad no habia obtenido ni calculado (fallbacks de IA fingiendo exito, avisos
"Modo demo" invertidos, tipos impositivos inventados, fallos de red presentados como
respuestas). Muchos tests fijaban el comportamiento incorrecto o mockeaban contratos
que la fuente real no tiene.
- `/declarations`, `/classification`, `/channels`, `/requirements`, `/h7`, `/ens` (API + navegador),
  `/transit` (NCTS T1, IA, veredictos, jurisdiccion, control), `/calculator`, `/preferences`,
  `/rules-engine`, `/excise-duties`, `/quotas`, `/regulations` — todos con bugs reales encontrados y corregidos
- Mas grave: `/excise-duties` — casi ningun tipo de IIEE coincidia con la Ley 38/1992
  (todo el vino como producto intermedio, ~8.500€ inexistentes por contenedor)
- `/quotas` y aranceles: 378 aranceles repoblados + 1.682 contingentes de 2026 sincronizados desde fuente oficial (DDS2)
- `notifyArrival` en ENS tenia un boton `[DEMO] Simular levante automatico` que concedia
  el levante real sin verificacion — corregido
- `sendEmail` devolvia `{success:false}` sin lanzar en 3 rutas; ahora se comprueba el `success` en todos los llamantes

## Public API v1
- API keys: `POST /api/v1/keys` (JWT), luego `Authorization: Bearer lca_xxx`
- Endpoints: `/api/v1/taric/:code`, `/api/v1/classify`, `/api/v1/calculate`, `/api/v1/countries`
- Rate limiting: 60 req/min, 5000 req/dia por key

## Pendientes activos (ver memoria de sesion para detalle y enlaces)
- Backfill NCTS: queda por decidir que hacer con `2026ES00642137` (status released, sin mensajes que lo respalden)
- `/ens`: metodos `amend`, `addDocument`, `searchByContainer`, `searchByBOL`, `getDeadlines` sin UI que los llame
- Corregir comentario de orden en `ensXmlBuilder.js` (documenta orden incorrecto de campos)
- Cotejar codigos de aduana de `entryOffices.js` con censo oficial AEAT (marcado PENDING)
- Politica de refresco del catalogo de contingentes (sync no puede correr en el homelab, hoy es manual)
- Migrar los ~75 `<Grid item xs>` de MUI v5 restantes a `size={{}}` de v7
- Barrer 24 llamadas restantes con `maxTokens: 4096` que pueden truncar analisis de IA
- Tránsito: corregir 14 MRN invalidos ya sembrados; `cancelled` en el enum sin transicion que lo asigne
- Completar barrido de la clave reservada `type` de Mongoose: falta `InspectorCommunication.petition`
- i18n: `TransitManager.jsx` con ~7 literales en castellano sin traducir
- Refactor `aiService.js` (6.490 lineas) + consolidar 6 builders
- 252 findings de tenant restantes; Worker BullMQ para AEAT async; Pytest para ai-service
- Backend: pedir a AEAT habilitar `IE314V5SOAP` en PRE (anulacion de ENS no verificable sin esto)
- Backend: pedir a Jose Antonio un G4/DSDT en PRE que referencie un transito nuestro (unico blocker E2E de NCTS)

## Otros proyectos relacionados (mismo ecosistema STRIX AI)
- **300dec/Correos ADU002** ⚠️ PAUSADO — EventBridge disabled, 8 Lambdas sin comprobar, repo sin remote
- **AXEL** ⚠️ EC2 stopped — `axel.strixai.es` inaccesible
- Otros repos Forgejo: `strixbid`, `strixai-landing`, `pocstocklogistic`, `strix-bucanera`

## Investors
- Pre-Seed 150-300K€, valoracion 1.0-1.5M pre-money. Docs en `investors/`
- Pendiente de Jenifer: direccion fiscal, capital social, CVs → ENISA + Lanzadera
