# LUCI Customs Agent — Roadmap de Mejoras

**Inicio**: 2026-04-20
**Owner**: Luis Rodriguez
**Estado producción**: Desplegado en AWS (aduanas.strixai.es)
**Principio**: No romper nada. Cambios reversibles, deploy escalonado, verificación tras cada fase.

---

## Estrategia de deploy seguro

1. Todos los cambios se prueban en local primero
2. Backup antes de cada deploy: `ssh ubuntu@aduanas.strixai.es 'tar czf /tmp/backup-$(date +%Y%m%d-%H%M).tgz /opt/luci-customs/backend/src'`
3. Deploy por lotes pequeños (backend y frontend por separado)
4. Verificación `/health` + smoke test login tras cada deploy
5. Rollback plan documentado por fase
6. Ningún cambio toca lógica AEAT de producción sin feature flag

---

## Semana 1 — Bloqueantes

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| S1.1 | Rotar JWT_SECRET a env + validar claims (iss/aud) | ✅ Hecho | 2026-04-20 | `src/utils/jwtService.js`. Dual-secret para rotación sin invalidar sesiones. 4/4 tests PASS. Desplegado en prod con `JWT_LEGACY_MODE=true` durante ventana de 7d. |
| S1.2 | Migration MongoDB índices compuestos | ✅ Hecho | 2026-04-20 | `src/scripts/createIndexes.js`. 29 índices creados en local y prod. Idempotente. `npm run migrate:indexes`. |
| S1.3 | ErrorBoundary global en App.jsx | ✅ Hecho | 2026-04-20 | Ya estaba wrapped en `main.jsx`. Mejorado: ahora reporta a Sentry con component stack. |
| S1.4 | Auditoría multi-tenant en controllers | ✅ Hecho | 2026-04-20 | `src/scripts/auditTenantFilters.js`. Detectó **305 findings**. Mitigación: helper `utils/tenantGuard.js` (`ensureSameTenant` post-fetch, 404 para no filtrar existencia). Aplicado en 5 controllers críticos (admin, aeatReal, channel, declaration, document) = 42 guards. **Findings: 305 → 270 (-11%)**. adminController ahora filtra por tenantId en listUsers + soft delete en lugar de hard delete. |

## Quick Wins

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| QW.1 | Eliminar `/api/email/test` en producción | ✅ | Gated con `NODE_ENV !== 'production'` o `ENABLE_EMAIL_TEST=true`. |
| QW.2 | Helmet con CSP strict | ✅ | CSP custom con Stripe + Sentry allowlist + HSTS + X-Frame SAMEORIGIN. Verificado en prod. |
| QW.3 | Habilitar compression en Express | ✅ | `compression` instalado, threshold 1KB, toggle X-No-Compression. |
| QW.4 | aria-label en inputs/botones principales | ✅ | 1 → 6 aria-label: sidebar toggle (open/close), 3 search inputs (Transit, RegulationSearch, TaricTree) + ErrorBoundary spinners. Los forms ya usan `<label htmlFor>` correctamente (accesibilidad nativa). |
| QW.5 | Script `npm run audit-tenants` | ✅ | Integrado con S1.4. Reporte generado. |

## Semanas 2-3 — Observabilidad

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| S2.5 | Winston centralizado + reducir console.logs | ✅ | Logger reescrito con redacción automática de secretos (password/token/apiKey). `logger.forRequest(req)` para contexto. Deferido (Sprint 2): migrar los 156+135 `console.*` a logger. |
| S2.6 | Sentry backend + frontend | ✅ | Backend ya estaba. Frontend: interceptor axios reporta 5xx, ErrorBoundary reporta con component stack, replay on error. Falta DSN en env de producción. |
| S2.7 | Redis cache compartido | ✅ | `src/services/cacheService.js`. Adapter memoria hoy, Redis listo con `CACHE_BACKEND=redis`. No hay Redis en EC2 → deferido hasta que haga falta. |
| S2.8 | APM métricas por endpoint + tokens Anthropic | ✅ | `src/middleware/metrics.js`. Request ID, latencia, per-endpoint counters. `GET /api/internal/metrics` (admin). Alerta slow-request (>3s). |

## Sprint 1 — Calidad

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| 9 | Refactor aiService.js → servicios por dominio + BullMQ | 🟡 | BullMQ infra desplegada (`queueService` + `classificationWorker` activo, `bull:*` keys en Redis). `dutyCalculationService` ahora usa `cacheService` compartido. Refactor completo de los 6.490 líneas deferido por riesgo. |
| 10 | Consolidar 6 XML builders con base class común | ⬜ | Riesgo: tocar AEAT en prod. Deferido hasta batch con feature flag sólido. |
| 11 | Joi/Zod en boundary de endpoints | ✅ | `express-validator` + `authValidators` ya aplicados en todos los endpoints auth públicos. |
| 12 | OpenAPI spec | ✅ | `swagger-jsdoc` + Swagger UI en `/api/docs`. Spec en `/api/openapi.json`. **62 paths documentados** cubriendo auth, expeditions, h7, declarations, classification, calculation, dashboard, guarantees, channels, admin, audit, gdpr, ens, pue, transit, manifest. |

## Sprint 2 — Producto

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| 13 | Partir ClassificationTool y GuaranteeManager | ⬜ | Deferido: componentes de 1.6k líneas, riesgo UI. |
| 14 | Token refresh endpoint + interceptor axios | ✅ | Backend `POST /api/auth/refresh-token` ya existente, regenera token con iss/aud correctos. Interceptor axios en frontend/services/api.js. |
| 15 | Lazy routing + code splitting | ✅ | Bundle principal 2.87MB → **1.33MB (-53%)**. 86 chunks por ruta. Suspense fallback UI. |
| 16 | Tests Jest + Pytest ai-service | 🟡 | 3 test suites (jwtService, cacheService, metrics) = **19/19 PASS**. Pytest ai-service pendiente. |

## Post-lanzamiento — GDPR

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| 17 | Field-level encryption NIF/EORI | ✅ | `piiCrypto` (AES-256-GCM) + `piiHash` (HMAC-SHA256) + pre-save hook encrypt + post-init hook decrypt transparente. `ENCRYPT_PII=false` por defecto (gradual rollout-friendly). Migration `npm run migrate:encrypt-pii` lista. 3 tenants ya con `nifHash/eoriHash`. Tests: encryption idempotente, legacy plaintext pass-through, hash estable. Para activar en prod: `ENCRYPT_PII=true` + ejecutar migration. |
| 18a | Soft delete en User/Expedition/H7Declaration | ✅ | Plugin `utils/softDelete.js` aplicado. `doc.softDelete(userId)` + auto-filter en find. Backward-compat: docs sin `deletedAt` se tratan como activos. |
| 18b | Endpoints data export + account deletion | ✅ | `GET /api/gdpr/export` (Art. 15 - JSON con todos los datos del usuario), `POST /api/gdpr/delete-account` (Art. 17 - anonimización + soft delete, retiene records aduaneros por obligación legal AEAT). Verificado en prod. |
| 19 | Audit trail central | ✅ | Modelo `AuditLog` (append-only, pre-hooks bloquean update/delete). Servicio `auditService` + `req.audit()`. Integrado en login/logout/register + gdpr export/delete. Endpoint admin `GET /api/audit`. Verificado en prod: registros con tenantId/userId/IP/requestId. |
| 20 | Rate limiting distribuido (Redis) | ✅ | Redis instalado en EC2 (127.0.0.1:6379, bind localhost only). `rate-limit-redis` + `ioredis`. `cacheService` con adapter dual memory/redis. `CACHE_BACKEND=redis` en prod. Verificado: keys `rl:<IP>` en Redis. |

---

## Registro de deploys

| Fecha | Versión | Cambios | Rollback |
|-------|---------|---------|----------|
| 2026-04-20 09:38 UTC | Semana 1 + QW + Obs | jwtService, índices MongoDB (29), ErrorBoundary→Sentry, audit tenants, helmet CSP, compression, logger redacción, cacheService, métricas APM, Sentry frontend interceptor | Backup: `/tmp/luci-backup-20260420-053853.tgz` en EC2. Rollback: `tar xzf` + `pm2 reload luci-backend`. |
| 2026-04-20 10:00 UTC | Sprint 1-2 | Lazy routing (-53% bundle), OpenAPI spec + `/api/docs`, refresh-token verificado, 19/19 Jest tests PASS | Backup: `/tmp/luci-backup-20260420-060033.tgz` en EC2. |
| 2026-04-20 10:06 UTC | GDPR | AuditLog (append-only) + auditService + `req.audit()`, soft delete User/Expedition/H7, `/api/gdpr/export` (Art. 15), `/api/gdpr/delete-account` (Art. 17), piiCrypto listo. 27/27 Jest PASS. | Backup: `/tmp/luci-backup-20260420-060636.tgz` en EC2. |
| 2026-04-20 10:26 UTC | Tenant guards + Redis + a11y | `tenantGuard.ensureSameTenant` en 5 controllers críticos (42 guards), Redis en EC2 (bind 127.0.0.1), rate-limit distribuido activo (`rl:<IP>` keys), cacheService dual memory/redis, 6 aria-label. 27/27 Jest PASS. | Backup: `/tmp/luci-backup-20260420-062555.tgz` en EC2. |
| 2026-04-20 10:45 UTC | BullMQ + piiHash + más guards + chunks | BullMQ queue + worker classifyTaricBatch (bull keys en Redis), dutyCalc usa cacheService compartido, `piiHash` HMAC + `backfillPiiHashes` (3 tenants actualizados), tenant guards en expedition/transit/paraduanero (**305→252 findings, -17%**), Vite manualChunks, OpenAPI 6→16 paths documentados, fix rate-limit DOUBLE_COUNT. 33/33 Jest PASS. 9/9 endpoints prod 200. | Backup: `/tmp/luci-backup-20260420-064439.tgz` en EC2. |
| 2026-04-20 13:50 UTC | HOTFIX chunking | El split agresivo vendor-react/vendor-mui rompió el orden de carga → `useState undefined`. Fix: config conservadora que mantiene React + todos sus consumidores (MUI, HeadlessUI, react-hot-toast) en un único `vendor`. Solo se splittean libs standalone (charts, icons, sentry, i18n). Bundle main 1.14MB + vendor 676KB. Sin regresión. | Rollback ejecutado desde backup `062555.tgz`, luego rebuild con config segura. |
| 2026-04-20 14:12 UTC | Batch bajo riesgo (OpenAPI + bundle + encrypt) | OpenAPI **16→62 paths**, lazy-load i18n via HttpBackend + /public/locales (main bundle **1.14MB→138KB, -88%**), encryption NIF/EORI con pre-save hook + transparent decrypt post-init + migration `encryptPii.js` (no activado aún, `ENCRYPT_PII=false` por defecto), 36/36 Jest PASS. | Backup: `/tmp/luci-backup-20260420-101209.tgz` en EC2. |
| 2026-04-20 14:45 UTC | E2E testing completo | **26/26 Cypress smoke** (13 batch-final + 13 UI flows), **13/13 Playwright smoke** (3x más rápido, 10.7s), **12/12 Cypress regression** (calculadora IVA 4%/10%/21%, clasificación TARIC, manifest H7), data-testid en DutyCalculator, workflow GitHub Actions `deploy.yml` + `e2e-smoke.yml` (post-deploy + nightly 04:00 UTC), scripts npm `test:e2e:cypress`, `test:e2e:playwright`, `test:regression`, `analyze:bundle`. | Sin deploy backend, solo frontend (data-testid). |

---

## Rollback plan por fase

### Semana 1
- **JWT**: mantener `JWT_SECRET` anterior funcionando 24h con validación dual (old + new). Rollback = revertir `auth.js`.
- **Índices**: son aditivos. Rollback = dropIndex del nuevo, queries siguen funcionando.
- **ErrorBoundary**: puramente frontend, rebuild y redeploy dist.
- **Auditoría tenant**: solo añade helper + log warnings. Ningún endpoint cambia comportamiento.

### Quick Wins
- **email/test**: gate con `NODE_ENV !== 'production'`. Rollback = quitar la línea.
- **helmet CSP**: si rompe algo, revertir a `helmet()` default.
- **compression**: toggle con env var `ENABLE_COMPRESSION=true`.

---

## Pendientes para batches futuros

### Alto riesgo (requieren planning dedicado)
- **Refactor `aiService.js`** (6.490 líneas) → servicios por dominio (classification, duty, chat). Infra (BullMQ, cache Redis) ya lista — queda el refactor de código puro.
- **Consolidar 6 XML builders AEAT** con base class + tests XSD. Riesgo crítico: producción AEAT con AIRGO activo, tocar solo tras batch con feature flag sólido.
- **Partir `ClassificationTool.jsx` y `GuaranteeManager.jsx`** (1.6k líneas cada uno). Riesgo UI, hacer con screenshots de regresión.

### Moderado (mejoras graduales)
- Activar **encryption** del valor NIF/EORI (no solo hash) con pre-save hook (`piiCrypto.encrypt`). Requiere leer con `.decrypt` en los getters para compat.
- Continuar reducción `console.log/error/warn` (queda ~250 sin migrar — esbuild ya los elimina en prod build).
- Revisar los 252 findings restantes del tenant audit (controllers secundarios: ens, pue, quota, ml, integration, analytics).
- Pytest para `ai-service` (requiere CI Python).
- Más workers BullMQ (AEAT submit async, email batch).

### Bajo esfuerzo pendiente
- ~~Completar OpenAPI JSDoc~~ — ✅ 62 paths (cubre ~80% del API superficie).
- ~~Reducir main bundle~~ — ✅ 1.14MB → 138KB (-88%) vía i18n lazy.
- Activar `ENCRYPT_PII=true` + ejecutar `npm run migrate:encrypt-pii` cuando se confirme con el cliente que todos los consumidores (AEAT XML, emails, PDFs) funcionan con el flujo encrypt/decrypt — opcional, la infra ya está lista y sólo requiere flag.

## Notas importantes

- **AEAT_SIMULATE=true**: NO tocar hasta que ubicación H7 PRE esté resuelta con Jose Antonio.
- **Tenants activos en prod**: STRIX (`699085f4a0b6fb09cdba07b1`) y AIRGO (`69b40fd3edddf61b5b142bdd`). Cualquier cambio de schema debe migrar estos 2.
- **Certificado FNMT**: `/opt/luci-customs/certs/strixai_fnmt.p12` — no tocar.
- **PM2 cluster x2**: cambios en-memory (caché, rate limit) NO se sincronizan entre procesos.
