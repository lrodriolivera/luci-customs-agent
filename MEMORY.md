# LUCI Customs Agent - Project Memory

## Company
- **Empresa**: STRIX AI SL (NIF: B22477020, EORI: ESB22477020)
- **Representante**: Jenifer Romero (NIF: 70073780W)
- **IMPORTANTE**: Todas las referencias son STRIX AI SL, NO Stock Logistic (corregido 11/Feb/2026)

## Project Structure
- **Frontend**: React + Vite + Tailwind at `luci-customs-agent/frontend/`
- **Backend**: Express + MongoDB at `luci-customs-agent/backend/`
- **Deploy**: AWS EC2 at `aduanas.strixai.es` via SSH key at `~/.ssh/aws-keys/luci-customs-key.pem`
- **PM2**: `pm2 restart luci-backend` after backend changes
- **Build**: `npm run build` in frontend dir, `scp -r dist/* ubuntu@aduanas.strixai.es:/opt/luci-customs/frontend/dist/`
- **Git**: `https://github.com/lrodriolivera/luci-customs-agent` (private)

## Deploy Gotchas
- **Cert symlink**: Archivo real en `/opt/luci-customs/certs/strixai_fnmt.p12`. `.env` apunta ahi
- **Portal/Stripe**: `portal.js` requiere `stripe`, try-catch en `app.js`
- **Backups**: Cron diario 3AM en `/opt/luci-customs/backup-mongodb.sh`, 30 dias
- **Permisos**: `.env` y `.p12` con chmod 600
- **Deploy rapido backend**: `scp -i key file ubuntu@aduanas.strixai.es:/opt/luci-customs/backend/... && pm2 restart luci-backend`
- **ENS tenantId**: Nuevas declaraciones ENS necesitan `tenantId` del usuario (fix 14/Feb/2026)
- **Nginx Authorization**: Header `Authorization` debe pasarse explicitamente con `proxy_set_header Authorization $http_authorization` en `/api/` (fix 2/Mar/2026)
- **Backend port**: 5001 (no 3001)

## Key Patterns
- Auth token: login via `test@luci.es` / `test123` (admin, ALL permissions active)
- Tailwind custom colors: `bg-luci` (#0284c7), `bg-luci-light`, `bg-luci-dark`
- All UI text in Spanish (no accents in code strings)
- Heroicons v2 `@heroicons/react/24/outline`
- Sidebar: dark (slate-900), 7 collapsable groups, auto-expand active
- Emails: `despacho@strixai.es`, `luci@strixai.es`, `soporte@strixai.es`

## Database Gotchas
- TARIC codes stored as 10-digit padded strings (e.g., "8471300000")
- 98 chapter placeholder entries at `level: 2` with code "XX00000000"
- Mongoose `supplementaryUnit` schema has `type` keyword conflict
- MongoDB `description: {es, en}` - frontend needs `getDesc()` helper
- Real expedition: `EXP-STRIX-REAL-001` (STRIX AI SL, servidores 45k EUR)
- **ENS consignor/consignee**: stored at root level `doc.consignor`/`doc.consignee`, NOT inside houseConsignments

## AEAT Integration - ENS FUNCIONANDO END-TO-END (14/Feb/2026)
- **Certificate**: FNMT Jenifer Romero (70073780W, R: B22477020), valid until 14/10/2027
- **Cert path on server**: `/opt/luci-customs/certs/strixai_fnmt.p12`
- **PRE URLs**: prewww1.aeat.es (cert), prewww10.aeat.es (seal)
- **PROD URLs**: www1/www2.agenciatributaria.gob.es
- **DIT contact**: Jose Antonio, `atenusu@correo.aeat.es` (Atencion al Usuario, Aplicaciones de Aduanas)

### XML Builders - All 6 validated against AEAT PRE
| Builder | XSD | Key rules |
|---------|-----|-----------|
| **H1** `h1XmlBuilder.js` | ImportacionCompletaV1Ent.xsd | `unqualified`, C181IdentMedioTransporteLlegada (no C18), order: C17b,C181,C19,C20,C21,C221...C30,CB |
| **H7** `h7XmlBuilder.js` | DeclaSimpliImporV1Ent.xsd | `unqualified`, formaRepresentacion parametrizable |
| **AES** `aesXmlBuilder.js` | CC515CV1Ent.xsd | `qualified` ent:, ExportOperation order: LRN,declarationType,additionalDeclarationType,security,totalAmountInvoiced,invoiceCurrency |
| **NCTS** `nctsXmlBuilder.js` | CC015CV1Ent.xsd | `qualified` ent:, EORI=no name/address, ContactPerson obligatorio, referenceNumberUCR en Consignment |
| **ENS** `ensXmlBuilder.js` | IE315V5Ent.xsd | Root=`CC315A`, `unqualified`, legacy HEAHEA/GOOITEGDS, C501: nombre+direccion juntos, order: ITI,TRAREP,PERLODSUMDEC(TINPLD1),CUSOFFFENT730,TRACARENT601 |
| **PUE** `soivreXmlBuilder.js` | ROHSSolicitudCertificadoV1Ent.xsd | Root=`ROHSSolicitudCertificadoV1Ent` con `roh:`, endpoint `/wlpl/AD44-JDIT/ws/rohs/ROHSsolicitudV1SOAP` |

### ENS End-to-End Flow (FUNCIONANDO 14/Feb/2026)
- Frontend: `/ens` → crear ENS → "Enviar a AEAT" → MRN recibido
- `ensService.submitToAEAT()` → `aeatSubmitService.submitENS()` (usa legacy CC315A, NO ensGenerator CC315C)
- `ensGenerator.js` genera CC315C (ICS2 moderno) - NO USAR para AEAT PRE, solo para futuro ICS2
- `aeatSubmitService.submitENS()` convierte Mongoose doc a builder data, maneja goods→houseConsignment
- Parser mejorado: reconoce CC328A (aceptado), CC316A (rechazo funcional), CD917B (error XML)
- **4 ENS aceptadas en PRE** (14/Feb/2026): MRN 26ES009999Z0000072/0000080/0000099/0000104
- ENS edit route: `/ens/:id/edit` (ENSEditPage wrapper en App.jsx)
- Chat history route: `GET /api/chat/history` (global, antes de `/:expeditionId` para evitar CastError)

### AEAT Submission Flow
- Frontend buttons → `declarationsAPI.submit()` / `transitAPI.submit()` / `ensAPI.submit()` / `pueAPI.submit()`
- Backend controllers → `aeatSubmitService.submitH1/H7/AES/NCTS/ENS/PUE()`
- `aeatSubmitService.js`: genera XML con builder → envia HTTPS+cert a AEAT → parsea respuesta SOAP
- Respuesta: `{success, mrn, channel, code, csv, error, rawResponse}`

### AEAT PRE Testing
- Recintos prueba: `009999` (Peninsula), `009998` (Canarias)
- Forzar canal naranja: aduana `ES004611`, rojo: `ES001131`
- **EORI DADO DE ALTA EN PRE** (13/Feb/2026) por Jose Antonio
- **H1/H7/AES/NCTS bloqueados** por ubicaciones no configuradas en PRE
- Email preparado para Jose Antonio: `email-aeat-pre-ubicaciones.md` → enviar a `atenusu@correo.aeat.es`
- **Reglas AEAT descubiertas**:
  - ENS C501: si hay nombre, incluir direccion completa (calle+CP+ciudad+pais). Si hay EORI, solo EORI
  - AES/NCTS: si EORI presente, NO enviar name/Address (reglas 1289/1290/1499/1626)
  - Declarante=Importador → formaRepresentacion='1' (directa), no '2'
  - Declarante NIF con EORI format (ESB22477020, no B22477020)
  - ENS legacy: ferrocarril (2) funciona, aereo/maritimo/carretera requieren ICS2
  - AES ExportOperation order: ...security, totalAmountInvoiced, invoiceCurrency (NO al reves)
  - NCTS: guaranteeType 8 → amountToBeCovered=0, LocationOfGoods type=B qualifier=Y + authorisationNumber
  - PUE ROHS: requiere H1 previo con partidas ROHS aceptado, endpoint descubierto del WSDL oficial
- Test script: `backend/tests/aeat-pre-test-6builders.js`

## Stripe Billing - FULLY CONFIGURED (12/Feb/2026)
- Account configured (test mode), 3 products: Professional, Business, Enterprise
- Stripe SDK v17.7.0, CLI v1.35.0 at `~/.local/bin/stripe`
- **Prices**: Monthly + Yearly for all plans (2 months free on yearly = 10x monthly)
- **Frontend**: BillingDashboard with monthly/yearly toggle
- **IMPORTANT**: User.js schema needed `tenantId` + `organizationId` fields
- `paymentService.js`: createSubscriptionCheckout, webhook handlers, refunds, manual payments

## PDF Generation
- `pdfGenerator.js` with PDFKit: H1 (DUA), H7, AES, ENS, NCTS, PUE SOIVRE/ROHS
- Declarante en casillas 14 y 54: "STRIX AI SL / B22477020"
- **Documentos MD→PDF**: `pandoc` (MD→HTML) + `weasyprint` (HTML→PDF) con `style.css`
- Comando: `pandoc file.md -s --css=style.css -t html5 --metadata title=" " -o temp.html && weasyprint temp.html output.pdf`
- Ocultar titulo pandoc duplicado: `#title-block-header { display: none; }` en CSS
- **Word**: `pandoc file.md -o file.docx` (directo)

## Public API v1
- API keys: `POST /api/v1/keys` (JWT), then use `Authorization: Bearer lca_xxx`
- Endpoints: `/api/v1/taric/:code`, `/api/v1/classify`, `/api/v1/calculate`, `/api/v1/countries`
- Rate limiting: 60 req/min, 5000 req/day per key

## AWS
- Access Key CSV at `luci-customs-agent/Credenciales_AWS/AgenteAduana_accessKeys.csv`
- Deploy: EC2 via SSH key `~/.ssh/aws-keys/luci-customs-key.pem`
- SSL: Let's Encrypt, valid until 22/Apr/2026, CN=aduanas.strixai.es
- MongoDB backups: `/opt/luci-customs/backups/`, cron 3AM, 30-day retention

## AI Service
- Uses Anthropic Claude API (ANTHROPIC_API_KEY in .env)
- Models: 23 calls Opus 4.6, 16 calls Sonnet 4.6 in aiService.js (model IDs: claude-opus-4-6-20250514, claude-sonnet-4-6-20250514)
- Cost per user: ~1.46 EUR/mes (optimizable a ~0.30 EUR con Haiku 4.5 + caching, model ID: claude-haiku-4-5-20251001)
- **Actualizado a Claude 4.6** (2/Mar/2026): desplegado en produccion

## Completed Phases
1. IVA rates, baseDutyRate fix, country catalog
2. 195 countries ISO, Exportador Autorizado/REX/EUR.1
3. 2-digit chapter search, TaricTreeBrowser, skeleton loaders
4. Seasonal tariffs (date-dependent duty rates)
5. PUE SOIVRE overhaul (MRN+Clave Zeta, catalogs, RII)
6. AI Tree Generation with progressive cache
7. UX: Dark sidebar, premium dashboard, landing page, FAB assistant
8. Stripe billing, AEAT real connection, Public API, PDF generation
9. AEAT full integration: 6/6 builders validated, rebranding STRIX AI SL
10. Production hardening: Stripe AWS, permanent cert, backups, permissions
11. Business analysis + competitive research + PDF + PPTX presentation
12. **AEAT PRE testing: ENS end-to-end working, 4 MRN reales recibidos (14/Feb/2026)**
13. **AWS incident recovery + full backend verification 33/33 endpoints (14/Feb/2026)**
14. **Propuesta 300dec/Correos: propuesta tecnica + presupuesto + costos internos (17/Feb/2026)**
15. **Modelos Claude 4.6 + fix nginx Auth + fix chat/history (2/Mar/2026)**

## AWS Incident (14/Feb/2026)
- Otra instalacion en la misma EC2 daño la instancia: host key cambio, MongoDB vaciado, certs borrados, cron perdido
- **Restaurado**: SSH (nueva host key), certificado FNMT, .env completo, cron backups, usuario admin, tenant, expedicion, 117 TARIC codes
- **Perdido sin recuperar**: 4 ENS con MRN reales (datos de test, regenerables), historial busquedas, cache IA
- **Leccion**: SIEMPRE verificar backups existen antes de asumir que estan. El cron existia pero nunca habia ejecutado un backup real
- **Backend verificado**: 33/33 endpoints OK post-restauracion

## Checkpoints
- `checkpoint-2026-02-11-aeat-6-6-validado` - 6/6 XML builders pass AEAT PRE
- `checkpoint-2026-02-11-aeat-completo` - Integration complete + rebranding
- `checkpoint-2026-02-11-produccion-ready` - Production-ready (Stripe, certs, backups, perms)

## Pending / Next Steps
1. ~~Alta EORI ESB22477020 en AEAT PRE~~ ✅ HECHO
2. ~~Testear builders contra AEAT PRE~~ ✅ 6/6 estructura validada, ENS aceptado
3. ~~AWS incident recovery~~ ✅ 33/33 endpoints verificados
4. **Enviar email a Jose Antonio** (`atenusu@correo.aeat.es`) pidiendo ubicaciones en PRE para recinto 009999
5. **Esperar ubicaciones PRE** → entonces H1/H7/AES/NCTS pasaran
6. **PUE ROHS**: necesita H1 aceptado con partidas ROHS primero
7. Verificar EORI en produccion
8. Optimizar costos IA: migrar a Haiku 4.5 + Prompt Caching
9. Primeros 3 clientes: demo grabada + contactar transitarios Zaragoza
10. Stripe produccion (live mode)
11. Email transaccional real (SES/SendGrid)

## 300dec / Correos de Espana - Proyecto ADU002 (17/Feb/2026)
- **Cliente**: 300dec (gestiona ~300 declaraciones/mes para Correos como operador postal)
- **Proyecto**: Gestion automatizada de 43 tipos de notificaciones AEAT
- **Directorio**: `luci-customs-agent/300dec/`
- **Documentos generados**:
  - `propuesta-tecnica-300dec.md/pdf/docx` - Propuesta tecnica completa
  - `presupuesto-300dec.md/pdf/docx` - Presupuesto cliente (sin costos internos)
  - `costos-internos-300dec.md/pdf/docx` - Costos desarrollo interno (CONFIDENCIAL)
  - `costos-desarrollo-300dec.md/pdf/docx` - Costos detallados con margenes
  - `Planteamiento_Alcances_ADU002.xlsx` - Excel original del cliente con 43 docs
  - `style.css` - Estilo PDF (teal #0f4c5c headers, verde #065f46 h3, cyan #0ea5e9 bordes)
- **Alcances y precios cliente**:
  - Alc0 (19 docs, 2 sem): 10.000 EUR
  - Alc0+1 (28 docs, 3 sem): 15.000 EUR
  - Alc0+1+2 (38 docs, 4 sem): 22.000 EUR
  - Completo (43 docs, 5 sem): 28.000 EUR
- **Costos internos** (2 devs + Claude Code): 7.539 EUR + 700 adicionales = 8.239 EUR total
- **Margenes**: ~72-74%
- **Recurrente**: 680 EUR/mes (infra + IA + mantenimiento)

## Marketing
- `marketing/cold-emails.md` - 5 templates
- `marketing/linkedin-posts.md` - 11 posts (4 weeks)
- `marketing/guion-video-demo.md` - 2:30 min video script
- Plans: Starter (free), Professional (149 EUR/mo), Business (349 EUR/mo), Enterprise (custom)
