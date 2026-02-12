# ANALISIS DE PRODUCCION - LUCI Customs Agent

**Fecha**: 12 de Febrero de 2026
**Empresa**: STRIX AI SL (NIF: B22477020)
**Plataforma**: https://aduanas.strixai.es

---

## SCORE GLOBAL: ~75% listo para lanzamiento publico

---

## BLOQUEANTES (sin esto NO se puede lanzar)

| # | Area | Problema | Esfuerzo |
|---|------|----------|----------|
| 1 | **Auth** | No hay pagina de REGISTRO/SIGNUP. Solo login. Nuevos clientes no pueden crear cuenta | 1-2 dias |
| 2 | **Auth** | No hay RESET PASSWORD. Usuarios olvidados quedan bloqueados | 1 dia |
| 3 | **Email** | SMTP no configurado (SMTP_USER/SMTP_PASS vacios). Ni bienvenida, ni reset, ni confirmacion de pago | 1-2 dias |
| 4 | **Legal** | Sin Politica de Privacidad, Terminos de Servicio, banner de Cookies (GDPR obligatorio para UE) | 1-2 dias |
| 5 | **Stripe** | Modo TEST (`sk_test_`). Pagos reales imposibles hasta cambiar a `sk_live_` | 30 min |
| 6 | **AEAT** | `AEAT_SIMULATE=true` en produccion. Declaraciones NO se envian realmente a la AEAT | Config only |
| 7 | **Multi-tenant** | Datos NO aislados por tenant. Expediciones se crean sin `tenantId`. Un admin podria ver datos de otro | 2-3 dias |

---

## CRITICOS (se puede lanzar sin ellos pero hay riesgo)

| # | Area | Problema | Esfuerzo |
|---|------|----------|----------|
| 8 | **Backend** | Sin `process.on('uncaughtException')` ni graceful shutdown. Server puede crashear sin recovery | 2 horas |
| 9 | **Backend** | JWT_SECRET hardcodeado (`luci-customs-agent-jwt-secret-key-2025`). Rotar secretos | 1 hora |
| 10 | **Frontend** | 126 `console.error()` en produccion - leak de info interna + performance | 2-3 horas |
| 11 | **Frontend** | Sin Error Boundary global. Un error JS crashea toda la app | 1 hora |
| 12 | **Frontend** | Sin pagina 404. Rutas invalidas redirigen silenciosamente al home | 30 min |
| 13 | **Infra** | PM2 sin cluster mode ni `ecosystem.config.js`. Un solo proceso, sin auto-restart configurado | 1 hora |
| 14 | **Infra** | Sin CI/CD. Deploy es manual por SSH + rsync | 2-4 horas |
| 15 | **AEAT** | EORI `ESB22477020` no registrado en AEAT PRE. Hay que enviar email a `atenusu@correo.aeat.es` | Externo |

---

## IMPORTANTES (para despues del lanzamiento inicial)

| # | Area | Problema |
|---|------|----------|
| 16 | **AEAT** | Falta cancelacion/anulacion de declaraciones (endpoint existe pero no esta expuesto) |
| 17 | **AEAT** | Falta NCTS arrival (CC007) y unloading (CC044) para ciclo T1/T2 |
| 18 | **AEAT** | Falta ENS amendments (IE313V5) |
| 19 | **AEAT** | Valores hardcodeados de STRIX AI (NIF, EORI, aduana) no son multi-tenant |
| 20 | **Frontend** | Sin token refresh - sesion expira y el usuario pierde todo sin aviso |
| 21 | **Frontend** | Accessibility (WCAG) muy pobre - 1 solo aria-label en toda la app |
| 22 | **Frontend** | SEO basico - sin meta description, OpenGraph, sitemap.xml |
| 23 | **Frontend** | Landing page: formulario de contacto no envia realmente |
| 24 | **Backend** | Rate limiting por ruta faltante (login deberia tener 5 intentos/15min) |
| 25 | **Backend** | Sin Sentry/error tracking. Errores en produccion no se detectan |
| 26 | **Backend** | Sin monitoring (no Datadog, no CloudWatch, no health check completo) |
| 27 | **IA** | Costo optimizable de 1.46 EUR/user a 0.30 EUR con Haiku + caching |

---

## LO QUE YA ESTA BIEN

- 6/6 XML builders AEAT validados contra entorno PRE
- Stripe: checkout, webhooks, Customer Portal, precios mensuales + anuales
- 67+ componentes frontend completos (~42,500 lineas)
- Landing page profesional con pricing y formulario de contacto
- SSL/TLS, firewall (UFW), MongoDB auth, backups diarios (cron 3AM, 30 dias retencion)
- PDF generation (DUA H1, H7, AES, ENS, NCTS, PUE SOIVRE/ROHS)
- Public API v1 con API keys y rate limiting
- Portal de clientes con chat IA, documentos, pagos, firmados
- Certificado FNMT real configurado en AWS (valido hasta Oct 2027)
- Nginx con headers de seguridad, Fail2ban, SSH solo por key
- Diseno responsive (Tailwind, mobile-first)
- Sistema de workflows con 15 action handlers
- Clasificacion TARIC con IA + cache progresivo + historial
- 195 paises ISO, aranceles estacionales, regimenes especiales

---

## PLAN DE LANZAMIENTO SUGERIDO

### Semana 1 - Bloqueantes (#1-7)

| Dia | Tarea |
|-----|-------|
| Lun-Mar | Pagina de Registro + confirmacion email + reset password (backend + frontend) |
| Mie | Configurar email transaccional (AWS SES o SendGrid) |
| Jue | Paginas legales: Privacidad, Terminos, Cookies (GDPR) |
| Vie | Aislamiento multi-tenant (tenantId en todas las queries) |
| Vie | Stripe live mode (cambiar keys en AWS) |

### Semana 2 - Criticos (#8-15)

| Dia | Tarea |
|-----|-------|
| Lun | Error handling backend (uncaughtException, graceful shutdown, rotar JWT_SECRET) |
| Mar | Error handling frontend (Error Boundary, pagina 404, limpiar console.logs) |
| Mie | PM2 ecosystem.config.js + cluster mode |
| Jue | GitHub Actions basico (test + deploy) |
| Vie | Email a AEAT para registro EORI en PRE |

### Post-lanzamiento - Items #16-27

- Sprint 1: AEAT cancelaciones + NCTS lifecycle
- Sprint 2: Token refresh + SEO + accessibility
- Sprint 3: Monitoring (Sentry + CloudWatch) + rate limiting por ruta
- Sprint 4: Optimizacion costos IA (Haiku + caching)

---

## DETALLE POR AREA

### Backend (Score: 70/100)

**Seguridad:**
- Helmet.js habilitado pero sin CSP configurado
- Rate limiting global (500 req/15min) pero sin limite por endpoint
- CORS incluye URLs de localhost en produccion
- Webhook de Stripe tiene fallback a plaintext sin firma
- API key rate limiting usa Map en memoria (no persiste entre reinicios)
- Falta `express-mongo-sanitize` (prevencion NoSQL injection)
- Falta `hpp` (HTTP parameter pollution)

**Multi-tenancy:**
- Expediciones se crean sin `tenantId`
- `User.find()` no filtra por tenant (admin ve todos los usuarios)
- Public API no scopes por organizacion
- Portal token no valida ownership del tenant

**Email:**
- `emailService.js` existe pero SMTP_USER/SMTP_PASS vacios
- `EMAIL_FROM` apunta a `noreply@luci-customs.com` (deberia ser `@strixai.es`)
- Sin email de bienvenida al registrarse
- Sin templates con variables (nombre empresa hardcodeado)

**Base de datos:**
- Faltan indices compuestos (status, tenantId+status, organizationId+createdAt)
- Sin connection pool configurado
- Sin soporte de transacciones

### Frontend (Score: 70-75/100)

**Auth:**
- Login funcional con token JWT
- Sin pagina de registro/signup
- Sin reset password
- Sin token refresh (sesion expira sin aviso)
- Sin confirmacion de email

**Componentes:**
- 67 componentes, ~42,500 lineas
- Componentes grandes sin refactorizar (ClassificationTool 1,623 lineas, GuaranteeManager 1,590)
- 126 `console.error()` en produccion
- Sin Error Boundary global

**UX:**
- Responsive excelente (Tailwind mobile-first)
- Sidebar con 7 grupos colapsables
- Sin breadcrumbs
- Sin pagina 404
- Sin boton "volver" en la mayoria de paginas

**SEO:**
- Solo titulo basico y viewport
- Sin meta description, OpenGraph, Twitter Cards
- Sin sitemap.xml ni robots.txt
- Sin titulos por pagina

**Accesibilidad:**
- 1 solo aria-label en toda la app
- Sin roles ARIA en componentes custom
- Sin focus management en modales
- Indicadores solo por color (no accesible para daltonicos)

### Infraestructura (Score: 73/100)

**AWS:**
- EC2 con Nginx reverse proxy correctamente configurado
- SSL/TLS con Let's Encrypt (valido hasta Abr 2026)
- UFW firewall + Fail2ban configurados
- MongoDB 7.0 con auth habilitado, bind solo localhost
- Backups diarios cron 3AM, retencion 30 dias

**Faltante:**
- Sin ecosystem.config.js para PM2
- Sin CI/CD (deploy manual)
- Sin monitoring/alerting
- Sin staging environment
- Sin DDoS/WAF protection

### AEAT (Score: 75-80/100)

**Completado:**
- 6/6 XML builders validados (H1, H7, AES, NCTS, ENS, PUE)
- Certificado FNMT real en AWS
- SSL mutual auth funcionando
- Parsing de respuestas AEAT (MRN, canal, CSV)
- Entornos PRE/PROD configurados

**Faltante:**
- EORI no registrado en AEAT PRE (bloqueante para testing real)
- Cancelacion de declaraciones (codigo existe, no expuesto)
- NCTS arrival (CC007) y unloading (CC044)
- ENS amendments (IE313V5)
- Valores hardcodeados de STRIX AI no son multi-tenant
- `AEAT_SIMULATE=true` en produccion

---

## RESUMEN EJECUTIVO

LUCI Customs Agent es una plataforma completa de gestion aduanera con IA que esta al **75% de estar lista para produccion**. Las funcionalidades core estan implementadas y validadas, pero hay **7 items bloqueantes** que deben resolverse antes del lanzamiento publico, principalmente:

1. **Onboarding de usuarios** (registro, email, reset password)
2. **Compliance legal** (GDPR, privacidad, cookies)
3. **Aislamiento de datos** (multi-tenancy)
4. **Activar pagos reales** (Stripe live mode)

Con 2 semanas de trabajo enfocado, la plataforma estara lista para los primeros clientes.

---

*Documento generado el 12/Feb/2026 por analisis automatizado del codebase.*
