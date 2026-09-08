# Correcciones pendientes — LUCI Customs Agent

**Generado:** 2026-07-07  
**Proyecto:** `/home/rypcloud/Documentos/Logistic/POC/luci-customs-agent`  /
**Contexto:** Auditoría automatizada (build frontend + `npm test` backend + revisión de código).

**Estado actual:**
- Frontend: `npm run build` → OK
- Backend: `npm test` → **8 suites fallidas, 14 tests fallidos** (42/50 suites OK)
- ESLint backend: falla por falta de `.eslintrc`

**Instrucciones para Claude Code:**
1. Corregir primero los bugs de **producción** (sección 1).
2. Luego alinear **tests** con la API actual (sección 2).
3. Verificar con los comandos de la sección 4 antes de dar por cerrado.
4. Cambios mínimos y quirúrgicos — no refactorizar fuera de alcance.
5. No tocar lógica AEAT de producción sin tests que lo cubran.

---

## 1. Bugs de producción (PRIORIDAD ALTA)

### 1.1 H7 — Tasas de gestión con valor 0 se sustituyen por OTHER

**Archivo:** `backend/src/services/h7Service.js`  
**Líneas:** ~278-279

**Problema:**  
`H7_CONFIG.handlingFees` define `DHL: 0`, `UPS: 0`, etc. El código usa:

```javascript
const handlingFee = H7_CONFIG.handlingFees[carrierCode] || H7_CONFIG.handlingFees.OTHER;
```

En JavaScript, `0` es falsy → DHL/UPS/FEDEX/TNT/AMAZON cobran 2€ (`OTHER`) en lugar de 0€.

**Test que falla:** `tests/services/h7Service.test.js` → `should apply correct handling fees by carrier`  
- Esperado DHL: `0`, recibido: `2`

**Fix:**
```javascript
const handlingFee = H7_CONFIG.handlingFees[carrierCode] ?? H7_CONFIG.handlingFees.OTHER;
```

**Verificar:** El test de handling fees debe pasar sin cambiar expectativas.

---

### 1.2 `listCertificates()` llamado sin `await`

**Problema:** `certificateService.listCertificates()` es `async` y devuelve `{ success, certificates, summary }`, no un array.

#### Ubicación A — `backend/src/services/aeat/aeatSubmitService.js` (~línea 24)

```javascript
// ACTUAL (roto)
const certs = certificateService.listCertificates();
if (certs.length > 0) return certs[0];
```

**Fix:**
```javascript
const result = await certificateService.listCertificates();
const certs = result.certificates || [];
if (certs.length > 0) return certs[0];
```

Asegurar que `_getCertificate()` sigue siendo `async` (ya lo es).

#### Ubicación B — `backend/src/controllers/requirementController.js` (~línea 398)

```javascript
// ACTUAL (roto)
const certs = certificateService.listCertificates();
const certAlias = certs.length > 0 ? certs[0].alias : null;
```

**Fix:**
```javascript
const result = await certificateService.listCertificates();
const certs = result.certificates || [];
const certAlias = certs.length > 0 ? (certs[0].metadata?.alias || certs[0].id) : null;
```

---

### 1.3 `getCertificateInfo` — respuesta mal interpretada

**Archivo:** `backend/src/controllers/aeatRealController.js` (~líneas 143-144)

```javascript
// ACTUAL (roto)
const certificates = await certificateService.listCertificates();
const certificate = certificates.find(c => c.alias === alias);
```

**Fix:**
```javascript
const result = await certificateService.listCertificates();
const certificates = result.certificates || [];
const certificate = certificates.find(
  c => (c.metadata?.alias || c.id) === alias
);
```

**Nota:** `listCertificates` en el mismo controller (línea ~97) ya usa `result.certificates` correctamente — seguir ese patrón.

---

### 1.4 `aeatStatusMonitorService` — `declarations.sort is not a function`

**Archivo:** `backend/src/services/aeat/aeatStatusMonitorService.js`  
**Método:** `listTrackedDeclarations` (~línea 242)

**Problema:** Tras migración a `RedisBackedMap`, `values()` devuelve array cuando se hace `await`. Pero si `trackedDeclarations` es un `Map` nativo (tests o fallback), `await map.values()` devuelve un **iterador**, no array → crash en `.sort()`.

**Fix defensivo** en `listTrackedDeclarations` (y revisar otros usos de `.values()` en el mismo archivo: ~841, ~912):

```javascript
let declarations = await this.trackedDeclarations.values();
if (!Array.isArray(declarations)) {
  declarations = Array.from(declarations);
}
```

Alternativa: añadir método `toArray()` en `RedisBackedMap` y usarlo siempre.

**Impacto runtime:** El endpoint `GET /api/aeat-real/monitoring/tracked` puede fallar en ciertos escenarios.

---

### 1.5 H7 `submitToAEAT` — tests con timeout (posible hang en prod sin cert)

**Archivo:** `backend/src/services/h7Service.js` → `submitToAEAT` (~412+)  
**Tests:** `tests/services/h7Service.test.js` → 3 tests con timeout 10s

**Problema en tests:** No mockean `aeatSubmitService.submitH7`, `Tenant.findById`, ni `CustomsServiceFactory`. La llamada real cuelga.

**Fix en tests** (no cambiar lógica de prod salvo que haya bug real):

```javascript
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitH7: jest.fn().mockResolvedValue({
    success: true,
    mrn: '26ES12345678901234H7',
    channel: 'green',
    code: '0'
  })
}));

jest.mock('../../src/models/Tenant', () => ({
  findById: jest.fn().mockResolvedValue({ customsConfig: { country: 'ES' } })
}));
```

Añadir `tenantId` al `mockDeclaration` si `submitToAEAT` lo requiere.

---

## 2. Tests desactualizados (PRIORIDAD MEDIA)

### 2.1 `billingService.test.js`

**Archivo:** `backend/tests/services/tenant/billingService.test.js`

| Test | Espera (viejo) | Realidad (código actual) |
|------|----------------|--------------------------|
| `PLAN_PRICING.free` | plan `free` | plan `starter` (0€) |
| yearly `starter` price | `490` | `0` (starter es gratuito) |

**Fix tests:** Actualizar a la estructura en `backend/src/services/tenant/billingService.js`:

```javascript
PLAN_PRICING = {
  starter: { monthly: 0, yearly: 0, ... },
  professional: { monthly: 149, yearly: 1490, ... },
  business: { monthly: 349, yearly: 3490, ... },
  enterprise: { monthly: 799, yearly: 7990, ... }
}
```

Ejemplo test yearly:
```javascript
const result = billingService.createSubscription('yearly-tenant', 'professional', 'yearly');
expect(result.subscription.price).toBe(1490);
```

---

### 2.2 `certificateService.test.js`

**Archivo:** `backend/tests/services/aeat/certificateService.test.js`

**Problema:** Tests esperan que `listCertificates()` y `getRenewalAlerts()` devuelvan arrays directamente.

**API actual:**
- `listCertificates()` → `{ success, certificates, summary }`
- `getRenewalAlerts()` → `{ success, alerts, luciAnalysis }`

**Fix tests:**
```javascript
const result = await certificateService.listCertificates();
expect(Array.isArray(result.certificates)).toBe(true);

const alertsResult = await certificateService.getRenewalAlerts();
expect(Array.isArray(alertsResult.alerts)).toBe(true);
```

---

### 2.3 `aeatRealService.test.js`

**Archivo:** `backend/tests/services/aeat/aeatRealService.test.js`  
**Test:** `should pass validation for valid XML with required fields`

**Problema:** El XML de prueba usa tags genéricos (`CC515C`, `Declarant`, `GoodsShipment`).  
`_getCriticalFields('H1_SUBMIT')` exige tags AEAT reales:

- `ImportacionCompletaV1Ent`
- `C14Declarante`
- `Partida`
- `C42ValorFactura`
- `C3312CodigoPosicionTaric`

**Fix test:** Usar XML mínimo con esos tags, o mockear `_getCriticalFields`.

---

### 2.4 `netherlandsCustoms.test.js`

**Archivo:** `backend/tests/services/netherlandsCustoms.test.js`  
**Tests:** `_buildDECOXml`

**Problema:** Tests esperan formato antiguo:
- `<TypeCode>IM</TypeCode>`
- `<AdditionalDeclarationTypeCode>C</AdditionalDeclarationTypeCode>`
- `<AdditionalFiscalReference>` para IOSS

**Implementación actual** (`netherlandsCustomsService.js`) genera DECO 2.0:
- `<TypeCode>154</TypeCode>`
- Sin los tags antiguos

**Fix:** Actualizar expectativas del test al XML DECO 2.0 real, o documentar si la implementación debe volver al formato anterior (preferir actualizar tests).

---

### 2.5 `paraduaneroService.test.js`

**Archivo:** `backend/tests/services/paraduaneroService.test.js`

**Problema:** Mock de `ParaduaneroControl` no incluye constructor.  
`paraduaneroService.createControlsForExpedition` hace `new ParaduaneroControl({...})` → `ParaduaneroControl is not a constructor`.

**Fix mock:**
```javascript
ParaduaneroControl: jest.fn().mockImplementation(function (data) {
  return {
    ...data,
    save: jest.fn().mockResolvedValue(this)
  };
}),
```

Añadir también `findOne`, `find`, etc. al mock según necesite el test.

---

### 2.6 `specialRegimeService.test.js`

**Archivo:** `backend/tests/services/specialRegimeService.test.js`  
**Test:** `should calculate partial duties for temporary admission (regime 53)`

**Problema:** `startDate: 2024-01-01` pero `discharge()` asigna `regime.dischargeDate = new Date()` (2026-07-07) → `getMonthsInRegime` devuelve **30** meses, no 6.

**Opciones de fix (elegir una):**
- **A)** Actualizar test: `startDate` a ~6 meses antes de hoy.
- **B)** Mockear `Date` en el test.
- **C)** Permitir `dischargeData.dischargeDate` en `specialRegimeService.discharge()` y usarlo en `getMonthsInRegime`.

---

### 2.7 `aeatStatusMonitorService.test.js`

**Archivo:** `backend/tests/services/aeat/aeatStatusMonitorService.test.js`

**Problemas múltiples:**
1. Métodos ahora son `async` — falta `await` en `trackDeclaration`, `listTrackedDeclarations`, etc.
2. `beforeEach` asigna `trackedDeclarations = new Map()` — incompatible con `RedisBackedMap`.
3. `listTrackedDeclarations()` devuelve objeto `{ total, declarations, summary, luciAnalysis }`, no array.

**Fix tests:**
```javascript
beforeEach(() => {
  aeatStatusMonitorService.trackedDeclarations.clear?.();
  // O reiniciar RedisBackedMap, NO reemplazar por Map nativo
});

test('should list tracked declarations', async () => {
  await aeatStatusMonitorService.trackDeclaration('MRN1', 'H1', {});
  const result = await aeatStatusMonitorService.listTrackedDeclarations();
  expect(result.declarations.length).toBeGreaterThanOrEqual(1);
});
```

---

## 3. Mejoras opcionales (PRIORIDAD BAJA)

### 3.1 ESLint backend sin configuración

`npm run lint` falla: no existe `.eslintrc` en `backend/`.

**Opciones:**
- Crear `.eslintrc.js` mínimo (env node, es2021, recommended).
- O quitar script `lint` del `package.json` hasta tener config.

### 3.2 Warning frontend build

Añadir `"type": "module"` en `frontend/package.json` para eliminar warning de `postcss.config.js`.

### 3.3 Jest teardown warning

`tests/auditService.test.js` — `ReferenceError: import after Jest environment torn down` (Mongoose).  
Revisar si hace falta `await mongoose.disconnect()` en `afterAll`.

### 3.4 Multi-tenant (fuera de alcance inmediato)

`npm run audit:tenants` reporta **270 findings** de queries sin `tenantId`.  
Documentado en `AUDIT_TENANTS_REPORT.md`. No bloquear este sprint salvo que se pida explícitamente.

### 3.5 Aranceles TARIC

**Ya corregido en producción** (marzo 2026). No reabrir salvo regresión.  
Evidencia: `observaciones_test/EVIDENCIA_CORRECCION_ARANCELES/RESUMEN_TEST.md`

---

## 4. Verificación obligatoria

Ejecutar tras los cambios:

```bash
# Backend — objetivo: 0 suites fallidas
cd backend && npm test

# Tests específicos de áreas tocadas
cd backend && npx jest tests/services/h7Service.test.js --no-cache
cd backend && npx jest tests/services/aeat/aeatStatusMonitorService.test.js --no-cache
cd backend && npx jest tests/services/aeat/certificateService.test.js --no-cache
cd backend && npx jest tests/services/tenant/billingService.test.js --no-cache
cd backend && npx jest tests/services/paraduaneroService.test.js --no-cache
cd backend && npx jest tests/services/specialRegimeService.test.js --no-cache
cd backend && npx jest tests/services/netherlandsCustoms.test.js --no-cache
cd backend && npx jest tests/services/aeat/aeatRealService.test.js --no-cache

# Frontend — debe seguir compilando
cd frontend && npm run build
```

---

## 5. Criterios de aceptación

- [ ] `npm test` en backend: **50/50 suites PASS**, 0 tests fallidos
- [ ] `npm run build` en frontend: OK sin errores
- [ ] DHL/UPS con handling fee **0€** en `h7Service.calculateValues`
- [ ] `_getCertificate()` y envío de requerimientos AEAT obtienen certificados correctamente
- [ ] `GET /api/aeat-real/certificates/:alias` encuentra certificado por alias
- [ ] `listTrackedDeclarations` no lanza `sort is not a function`
- [ ] Sin cambios no solicitados en lógica de aranceles TARIC ni deploy AEAT prod

---

## 6. Orden de implementación sugerido

```
1. h7Service.js          → fix ?? handling fee          (~2 líneas)
2. aeatSubmitService.js  → await listCertificates       (~3 líneas)
3. requirementController → await listCertificates       (~3 líneas)
4. aeatRealController.js → fix getCertificateInfo        (~3 líneas)
5. aeatStatusMonitorService.js → Array.isArray guard     (~3 líneas)
6. Actualizar 8 archivos de tests
7. npm test → verde
```

**Estimación:** 1-2 horas de trabajo enfocado.

---

## 7. Archivos a tocar (checklist)

| Archivo | Tipo cambio |
|---------|-------------|
| `backend/src/services/h7Service.js` | Bug fix |
| `backend/src/services/aeat/aeatSubmitService.js` | Bug fix |
| `backend/src/controllers/requirementController.js` | Bug fix |
| `backend/src/controllers/aeatRealController.js` | Bug fix |
| `backend/src/services/aeat/aeatStatusMonitorService.js` | Bug fix |
| `backend/tests/services/h7Service.test.js` | Tests |
| `backend/tests/services/aeat/aeatStatusMonitorService.test.js` | Tests |
| `backend/tests/services/aeat/certificateService.test.js` | Tests |
| `backend/tests/services/tenant/billingService.test.js` | Tests |
| `backend/tests/services/aeat/aeatRealService.test.js` | Tests |
| `backend/tests/services/netherlandsCustoms.test.js` | Tests |
| `backend/tests/services/paraduaneroService.test.js` | Tests |
| `backend/tests/services/specialRegimeService.test.js` | Tests |