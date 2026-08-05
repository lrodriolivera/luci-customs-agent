# Auditoría de autenticación, aislamiento por tenant y control de rol

**Fecha:** 3 de agosto de 2026
**Alcance:** los 42 routers del backend — 704 rutas
**Ejes auditados:** (1) rutas sin autenticación, (2) consultas sin filtro de tenant, (3) operaciones administrativas sin control de rol

---

## Resumen

| | |
|---|---|
| Routers revisados | **42** |
| Rutas inventariadas | **704** |
| Rutas con autenticación | **650** (92%) |
| Rutas públicas por diseño | **54** (8%) — catálogos de referencia, ver abajo |
| Hallazgos corregidos | **8**, un commit cada uno |
| Pendientes cerrados después | **3** — ver la sección al final |
| Tests al cerrar | **1797** en verde (90 suites) |

Ningún hallazgo de esta tanda era una fuga de datos de cliente explotable hoy: los cinco anteriores (`b40a1ea`, `140b743`, `6612892`, `ef596b4`, `94f8bbc`) ya habían cerrado esa clase de problema. Lo que queda son **puertas de autorización que faltaban** y **funciones rotas en silencio**, incluida una regresión introducida por el propio barrido anterior.

---

## Método

Un barrido estático por expresiones regulares no basta: falla por los nombres del middleware, por las declaraciones multilínea y por los filtros construidos lejos de la consulta. Lo que funcionó:

1. **Extraer las rutas reales** parseando `router.<verbo>('<ruta>'` de cada fichero, cruzándolo con el prefijo de montaje de `app.js`.
2. **Sondear cada SUBruta contra producción sin token.** Probar `/api/<router>` —la raíz— devuelve 404 y da el router por protegido. Así se escapó el panel de administración del barrido anterior. Resultado: **154 de 177 rutas GET devuelven 401**.
3. **Seguir el origen de la variable de filtro** hacia atrás hasta el inicio de la función. Un `Model.find(query)` no dice nada por sí solo; hay que ver cómo se construyó `query` cuarenta líneas antes.
4. **Verificar cada fix por sabotaje**: romper deliberadamente la protección y comprobar que el test falla. Un test que no detecta nada también está en verde.

---

## Hallazgos corregidos

### 1. `583d9fa` — Rutas inalcanzables por quedar tapadas por un comodín

Express resuelve por orden de declaración. Una ruta con parámetro captura cualquier valor en esa posición, incluido un segmento literal declarado después.

- `GET /api/portal/api-keys`, con JWT de admin válido, devolvía `{"field":"token","message":"Token invalido"}` — el validador del portal rechazando la cadena `"api-keys"`. **No había forma de listar las API keys emitidas, pero el `POST` que las crea sí funcionaba**: se podían emitir credenciales sin poder auditarlas.
- `POST /api/chat/ask-luci` caía en `POST /:expeditionId` y devolvía "Error al enviar mensaje".
- `ens.js` y `transit.js` declaraban dos veces la misma ruta al mismo handler.

Ninguno era un agujero — los tres fallaban cerrado — pero eran funciones rotas de forma silenciosa.
**Guardia:** `tests/routes/routeShadowing.test.js`, sobre los 42 routers, con 6 casos que comprueban que la detección funciona.

### 2. `9d82fcb` — Plazos e inspecciones sin filtro de tenant

`deadlineController.list` e `inspectionController.list` construían el filtro campo a campo desde `req.query` sin añadir nunca `tenantId`, y los services hacen `find({ active: true, ...filters })`.

No observable en producción: los 30 plazos y las 20 inspecciones pertenecen al mismo tenant. **Se habría manifestado al dar de alta el segundo cliente**, que es el peor momento para descubrirlo. Es el mismo sexto punto ciego de `6612892` —listados, no accesos por id— en dos controllers que se escaparon.

### 3. `10aab0d` — Aprobar la certificación OEA no exigía rol

`POST /api/oea/:id/approve|suspend|revoke` solo pasaba por `auth`. El controller lee `req.user?.id` para el registro pero no comprueba el rol, y el service solo verifica **propiedad**.

Esa combinación es el problema: un usuario podía aprobar **su propia** certificación OEA. Y `oeaService.approve` genera el número oficial, fija 5 años de vigencia, activa todos los beneficios y fija `guaranteeReduction`, que según el tipo llega al **100%**. Un `viewer` podía auto-otorgarse la reducción de la garantía aduanera que debe constituir ante Aduanas. En la realidad la certificación la concede la AEAT tras una auditoría.

Se deja sin rol, deliberadamente: `POST /:id/submit` — presentar la solicitud a revisión sí corresponde al operador.

### 4. `a5ce297` — El certificado de firma se podía borrar o sustituir sin rol

`/api/certificates` gestiona el `.p12`/`.pfx` con el que el tenant **firma sus declaraciones ante la AEAT**. Cualquier usuario del tenant podía:

- `DELETE /:country` — borrarlo y hacer `$unset` de `certificatePath` y `certificatePassword`. Sin certificado no se puede presentar ninguna declaración: denegación de servicio sobre la operativa aduanera del cliente.
- `POST /upload` — **sustituirlo por otro**. Más grave que borrarlo: las declaraciones se seguirían firmando, con un certificado que el operador no eligió.

Las lecturas siguen abiertas: un agente necesita comprobar la vigencia antes de presentar.

### 5. `7e3a435` — Ocho comprobaciones de propiedad usaban un `userId` inexistente

**Regresión introducida por el propio barrido de propiedad (`d63a068`).** Aquel commit insertó llamadas a `_loadOwned*(id, userId)` sin añadir `userId` a la firma:

```js
async delete(id) {                        // <- sin userId
  const deadline = await _loadOwnedDeadline(id, userId);
```

`ReferenceError: userId is not defined` nada más entrar. Verificado en producción: `DELETE /api/deadlines/<id>` devolvía literalmente `{"error":"userId is not defined"}`. Ocho funciones inutilizadas (`deadlineService.delete`, `inspectionService.add*`, `inspectorCommunicationService.addArgument`).

**La lección:** los tests de propiedad de entonces **mockeaban el helper**, así que nunca ejecutaron la línea real. El test nuevo hace las dos cosas — analiza el código fuente *y además invoca* las ocho funciones.

### 6. `8f7f210` — Informes de analytics accesibles entre clientes

`reportsService` guarda los informes en un `new Map()` global compartido por todos los tenants. `listReports` **sí** filtraba por `generatedBy`, pero `getReport`, `downloadReport` y `deleteReport` accedían por id sin comprobar nada.

Asimetría clásica: el listado acotado, los accesos directos abiertos. Conociendo el id —secuencial con marca de tiempo, no un secreto— se podía leer, descargar o **borrar** el informe de cualquier otro. Cuando se escribió esto, los informes se alimentaban de métricas simuladas; **desde `40b168b` llevan datos reales**, así que el aislamiento que corrige este commit pasó a proteger operativa de verdad.

`getReport` devuelve el **mismo** error para "no existe" y "no es tuyo": distinguirlos permitiría confirmar por sondeo que un id ajeno existe.

### 7. `f07691d` — Jobs sobre todos los tenants sin control de rol

`POST /api/deadlines/process-alerts` recorre `Deadline.findDueForAlerts()` —los plazos vencidos de **todos los clientes**— y por cada uno hace `addAlert()` y `save()`. No filtra datos hacia fuera, pero cualquier usuario autenticado podía provocar escrituras masivas en la base de datos de todos los tenants. Junto con `POST /sync`.

El propio comentario del service dice *"en producción se ejecutaría como job programado"*. Mismo patrón que `POST /api/classification/seed`, cerrado en `94f8bbc`.

**Guardia:** el test barre todos los routers buscando `POST` cuyo nombre denote mantenimiento global (`sync`, `seed`, `migrate`, `reindex`, `purge`…).

### 8. `8d7313f` — `POST /api/v1/keys` documentaba `(admin)` sin implementarlo

La cabecera decía `@access JWT Authenticated (admin)`; el código solo aplicaba `jwtAuth`. **La restricción estaba escrita, no implementada.**

Cualquier usuario —incluido un `viewer`— podía emitirse una credencial de acceso programático con permisos de escritura por defecto (`classification:write` entre ellos), 5000 req/día, eligiendo además sus propios `permissions` en el body. **Una API key no caduca con la sesión**: sobrevive al cambio de contraseña y a la baja del empleado.

El otro router que emite el mismo recurso (`portal.js`) sí exigía `requireRole('admin')`. El test fija la **coherencia** entre ambos: dos puertas al mismo sitio no pueden tener distinta altura.

---

## Inventario por router

`auth` = rutas que exigen autenticación · `rol` = rutas que además exigen rol o permiso

| Router | Rutas | auth | rol |
|---|---:|---|---:|
| `admin.js` | 12 | todas | — |
| `aeatReal.js` | 28 | todas | 12 |
| `analytics.js` | 40 | todas | 4 |
| `audit.js` | 1 | todas | 1 |
| `auth.js` | 16 | todas | 9 |
| `calculation.js` | 7 | 6/7 | — |
| `certificates.js` | 4 | todas | 2 |
| `channels.js` | 7 | todas | 3 |
| `chat.js` | 5 | todas | — |
| `classification.js` | 22 | 18/22 | 5 |
| `communications.js` | 26 | todas | — |
| `dashboard.js` | 2 | todas | — |
| `deadlines.js` | 19 | todas | 2 |
| `declarations.js` | 33 | todas | 13 |
| `documents.js` | 6 | todas | — |
| `email.js` | 3 | 0/3 | — |
| `ens.js` | 21 | todas | — |
| `exciseDuties.js` | 9 | 0/9 | — |
| `expeditions.js` | 16 | todas | 5 |
| `gdpr.js` | 2 | todas | — |
| `guarantees.js` | 26 | todas | — |
| `h7.js` | 15 | todas | — |
| `inspections.js` | 27 | todas | — |
| `integrations.js` | 30 | todas | — |
| `manifest.js` | 3 | todas | — |
| `ml.js` | 22 | todas | — |
| `oea.js` | 25 | todas | 3 |
| `paraduanero.js` | 12 | todas | 9 |
| `payments.js` | 9 | todas | 5 |
| `portal.js` | 28 | todas | 3 |
| `preferences.js` | 8 | 0/8 | — |
| `publicApi.js` | 18 | todas | 16 |
| `pue.js` | 40 | todas | — |
| `queries.js` | 11 | todas | — |
| `quotas.js` | 9 | 0/9 | — |
| `regulations.js` | 10 | 0/10 | — |
| `requirements.js` | 18 | todas | 15 |
| `rulesEngine.js` | 10 | 0/10 | — |
| `specialRegimes.js` | 16 | todas | — |
| `tenant.js` | 47 | todas | 37 |
| `transit.js` | 24 | todas | — |
| `workflows.js` | 17 | todas | 8 |

### Estado por router

| Router | Estado | Commit |
|---|---|---|
| `certificates.js` | corregido — subir/borrar el certificado de firma sin rol | `a5ce297` |
| `chat.js` | corregido — `/ask-luci` inalcanzable | `583d9fa` |
| `deadlines.js` | corregido — sin filtro de tenant; jobs globales sin rol; `userId` inexistente | `9d82fcb` `f07691d` `7e3a435` |
| `ens.js` | corregido — ruta duplicada | `583d9fa` |
| `inspections.js` | corregido — sin filtro de tenant; `userId` inexistente | `9d82fcb` `7e3a435` |
| `oea.js` | corregido — conceder la certificación sin rol | `10aab0d` |
| `portal.js` | corregido — `/api-keys` inalcanzable | `583d9fa` |
| `publicApi.js` | corregido — emitir API key sin rol | `8d7313f` |
| `analytics.js` | corregido — informes accesibles entre clientes | `8f7f210` |
| `transit.js` | corregido — ruta duplicada | `583d9fa` |
| **Los 32 restantes** | **ok** — sin hallazgos en esta pasada | — |

---

## Rutas públicas por diseño

54 rutas responden sin token. Todas devuelven **información de referencia**, no datos de cliente, y ninguna toca la base de datos operativa:

| Router | Qué expone | Por qué es correcto |
|---|---|---|
| `classification.js` (4) | Catálogo TARIC de la UE | Marcadas `security: []` en OpenAPI. Es el arancel oficial, información pública |
| `exciseDuties.js` (9) | Tipos de impuestos especiales | Catálogo normativo en memoria |
| `quotas.js` (9) | Contingentes arancelarios | Volúmenes publicados por la Comisión |
| `regulations.js` (10) | Búsqueda en BOE y EUR-Lex | Normativa pública |
| `rulesEngine.js` (10) | Cálculo de aranceles y restricciones | Sin persistencia; entrada del propio solicitante |
| `preferences.js` (8) | Acuerdos preferenciales y reglas de origen | Catálogo de tratados |
| `calculation.js` (1) | Tipo de cambio oficial | Dato público |
| `email.js` (3) | Baja de suscripción y feedback SES | Necesariamente públicas: se acceden desde un enlace de correo, con token propio |

`POST /api/quotas/reserve` acepta peticiones sin token, pero `quotaService.reserveQuota` **no persiste nada** — devuelve un objeto en memoria. Sin efecto sobre el estado.

---

## Guardias automáticas en el repositorio

Estos tests fallan si el patrón reaparece, incluso en un router que se añada después:

| Test | Qué impide |
|---|---|
| `tests/security/ownershipGuard.test.js` | Accesos por id sin comprobar propiedad en controllers y services |
| `tests/routes/inlineRouteGuards.test.js` | Lo mismo en rutas declaradas inline |
| `tests/routes/authRequired.test.js` | Que un router con datos de cliente deje de montar `auth` |
| `tests/routes/routeShadowing.test.js` | Rutas inalcanzables por un comodín anterior |
| `tests/routes/globalJobsRole.test.js` | `POST` de mantenimiento global sin rol |
| `tests/routes/apiKeyIssuanceRole.test.js` | Divergencia entre los dos routers que emiten API keys |
| `tests/services/ownershipParamWired.test.js` | Comprobaciones de propiedad que usan un `userId` fuera de ámbito |
| `tests/services/reportOwnership.test.js` | Acceso a informes ajenos |
| `tests/security/superAdminRole.test.js` | Que reaparezca una cuarta variante del rol de super admin |
| `tests/security/adminIsTenantRole.test.js` | Rutas admin de alcance global sin revisar |
| `tests/services/realMetrics.test.js` | Que el `tenantId` llegue como cadena a una agregación |
| `tests/controllers/analyticsNotSimulated.test.js` | Que analytics vuelva a devolver datos inventados |

275 tests de guardia en total (15 suites).

---

## Los tres pendientes: CERRADOS

Los tres puntos que quedaron abiertos al cerrar la auditoría se resolvieron el mismo día.

### 1. El rol `super_admin` usaba tres cadenas distintas — `e29b130`

`tenantGuard` comprobaba `'superadmin'` (sin guion), `tenantMiddleware` exigía `'super_admin'`, y el enum de `User.role` no admitía ninguna de las dos. `/api/tenants` —crear, suspender y borrar organizaciones— era **inalcanzable**.

> **Corrección:** este informe decía antes `/api/v1/tenants`. La ruta real es **`/api/tenants`**: `tenant.js` se monta en `/api`, mientras que `/api/v1` es `publicApi.js`, que espera una API key y responde `INVALID_API_KEY` a un JWT.

**Había una segunda causa**, encontrada al verificar el fix contra producción — `dfb4a96`. `tenant.js` montaba `extractTenant` y `attachTenantContext` pero **no `auth`**, de modo que `req.user` nunca se rellenaba. `superAdminOnly` comprueba `if (!req.user) return 401` *antes* de mirar el rol, así que las 9 rutas devolvían `AUTH_REQUIRED` incluso con un token válido. El `require` de `auth` estaba en la línea 282, después de esas rutas, y solo se aplicaba a `/tenant/me`.

Unificar el rol no bastaba: hacían falta las dos cosas. `auth` se aplica **por ruta** y no como `router.use` porque más abajo en el mismo fichero hay catálogos deliberadamente públicos (`/tenant/plans`, `/tenant/permissions/info`, `/tenant/roles/builtin`) que un `router.use` habría cerrado sin querer.

Fallaba cerrado, así que nunca fue un agujero. El peligro estaba en la dirección contraria: bastaba que alguien "arreglase" una de las tres para que las otras dos concedieran acceso sin querer.

`src/constants/roles.js` es ahora la fuente única. **Nadie tiene el rol asignado**, por decisión explícita: el sistema queda coherente y el endpoint devuelve **403** —ya no 401— hasta que se conceda a mano.

```js
db.users.updateOne({ email: '...' }, { $set: { role: 'super_admin' } })
```

### 2. Analytics devolvía `Math.random()` — `40b168b`

171 usos de `_generateMetricValue(min, max)` construían el cuadro de mando; la UI los presentaba como analítica real. `realMetricsService` los sustituye por agregaciones **acotadas por tenant**.

Cifras reales que devuelve hoy: 50 declaraciones (35 H7 + 15 NCTS), canales 2/3/3, 515,76 € de IVA liquidado, 323,9 h de despacho medio sobre muestra de 8.

Lo que **no** se puede calcular responde **HTTP 501** con un motivo legible, en vez de un 200 con ceros:

| Endpoint | Motivo |
|---|---|
| `GET /analytics/financial` | 0 pagos registrados: no hay recaudación cobrada |
| `POST /predictions/volume` | Era `baseVolume * (0.9 + Math.random()*0.2)` |
| `POST /predictions/processing-time` | Ídem, con la *confianza* también aleatoria |

El tiempo real de despacho no se pierde: está en `dashboard → tiempos.mediaHoras`, medido de `submittedAt` a `releasedAt`. Las comprobaciones son en tiempo de ejecución: en cuanto se registre el primer pago, la recaudación se calcula sola.

**Trampa encontrada:** `aggregate()` **no** castea el `tenantId` — `countDocuments()` y `find()` sí lo hacen usando el esquema, pero el `$match` va contra el documento crudo. Medido: `countDocuments` → 35, `aggregate` → 0 sobre los mismos datos. En un panel, ese cero se lee como "no hay actividad", no como un error.

### 3. `requireRole('admin')` es rol de tenant, no de plataforma — `2d61f3a`

Un `admin` administra **su organización**, no el sistema. La consecuencia práctica se pasa por alto con facilidad: `requireRole('admin')` **no acota la ruta a ningún tenant**, solo dice "quien llame ha de ser admin de alguno". Si el handler opera sobre todos, sigue haciéndolo — con la falsa sensación de estar protegido.

Al proteger una ruta hay que decidir dos cosas por separado:

1. **Quién** puede llamarla → `requireRole`
2. **Sobre qué datos** actúa → filtrar por `req.user.tenantId` en el handler

Auditados los **30 usos**. De los 17 sin identificador de recurso, 13 acotan correctamente dentro del handler (`audit`, `auth/users`, `payments`, `portal/api-keys`, `publicApi/keys`, `certificates/upload`, `requirements`, `workflows`). Los **4 de alcance global** quedan justificados uno a uno:

| Ruta | Por qué se acepta |
|---|---|
| `POST /deadlines/process-alerts` | Escribe alertas en plazos de todos los tenants, pero el llamante no llega a verlos |
| `POST /deadlines/sync` | Hoy es un stub |
| `DELETE /classification/cache/clean` | La caché de clasificaciones IA no tiene `tenantId`: cachea el catálogo TARIC, común a todos. Borrarla solo obliga a recalcular |
| `POST /classification/seed` | Recarga el catálogo TARIC oficial de la UE, común a todos |

Ninguna expone datos de un cliente a otro. Cuando haya varios clientes en producción conviene moverlas a `super_admin` o a un job programado.

La distinción queda documentada en `src/middleware/auth.js` (donde la ve quien usa el middleware) y en `src/constants/roles.js`. `tests/security/adminIsTenantRole.test.js` falla si aparece una ruta admin de alcance global sin revisar.

---

## Nota de método

Durante la auditoría probé `POST /api/portal/api-keys` **contra producción** para confirmar que la ruta era alcanzable, y con ello creé una API key real (`lca_729ad42e`). La revoqué diez segundos después, con cero usos, y la dejé en la colección `clientapikeys` con estado `revoked` como registro de auditoría en lugar de borrarla.

El impacto fue nulo, pero el método era incorrecto: **las pruebas de escritura van contra un entorno local**, no contra producción. Queda anotado.

---

## Anexo — hallazgos de la campaña de cobertura (4 de agosto de 2026)

Al subir la cobertura de tests contra una BD en memoria (no producción) salieron bugs reales. Se corrigen y se anotan aquí porque tocan dinero o aislamiento.

### `bfacd22` — `Payment.paymentMethod` era un String: ningún cobro manual podía guardarse

El esquema declaraba:

```js
paymentMethod: { type: String, brand: String, last4: String, ... }
```

Mongoose interpreta ese `type: String` como el **SchemaType del bloque entero**, no como un subcampo llamado `type`. Consecuencia: `brand`/`last4` se descartan en silencio y, sobre todo, `createManualPayment` —que asigna `{ type: 'bank_transfer' }`— revienta con `ValidationError: Cast to string failed for value "{ type: 'bank_transfer' }"`. **Ningún pago manual por transferencia podía guardarse.** El alta por Stripe (`handleCheckoutComplete`) sufría lo mismo al asignar el objeto de método de pago.

Fix: la forma anidada `type: { type: String }` fuerza a Mongoose a tratarlo como subdocumento.

Se escapó de la auditoría anterior porque los tests de `paymentService` mockeaban el modelo `Payment`: el mock aceptaba el objeto sin validar el esquema, así que el test pasaba sin ejercitar el save real. Salió al **no mockear la dependencia inmediata** y guardar contra Mongo de verdad. Cubierto con regresión en `tests/services/paymentService.db.test.js` (`a1ee5b1`).

El guard de organización de `confirmManualPayment`/`refundPayment` (ver hallazgo `ef596b4` arriba) queda además fijado con test: un admin de otra organización recibe el mismo "not found" que si el pago no existiera.

### `rulesEngine.getApplicableAgreements` llamaba a un método inexistente: 500 en `GET /api/rules/agreements/:pais`

`getApplicableAgreements(countryCode)` (motor de reglas) construía cada acuerdo con `certificate: this.getCertificateType(agreement.type)`, pero `getCertificateType` **no estaba definido** en la clase `RulesEngine` ni se heredaba de ninguna parte. Consecuencia: para **cualquier país con un acuerdo comercial** (JP, CA, TR, GB, VN… es decir, el caso útil), el método lanzaba `TypeError: this.getCertificateType is not a function` y el endpoint `GET /api/rules/agreements/:countryCode` (`rulesEngineController.js:107`) respondía **500**. Solo funcionaba, por casualidad, con países sin ningún acuerdo (array vacío → nunca se entraba al `.push`).

Fix: se implementa `getCertificateType(type)`, que mapea el tipo de acuerdo a su certificado de origen característico de forma coherente con los `proofImport` ya presentes en `FTA_AGREEMENTS` (bilateral→EUR.1, fta→DeclaracionOrigen, gsp/gsp_plus/eba→REX, customs_union→ATR; por defecto EUR.1). No se inventa dato nuevo: es el mismo criterio que ya aplica `checkPreferences`.

Salió al escribir tests de `rulesEngine` (0% de cobertura): la función pura nunca se había ejecutado en ninguna prueba. Cubierto con regresión en `tests/services/rulesEngine.test.js`.

### El enum de `subscription.plan` no incluía `free`/`starter`: el plan gratuito no podía activarse

`Tenant.SubscriptionSchema.plan` tenía `enum: Object.values(PLAN_TYPES)` con `PLAN_TYPES = { PROFESSIONAL, BUSINESS, ENTERPRISE }` — sin `free` ni `starter`. Pero el código de negocio usa ambos: `paymentService.createSubscriptionCheckout(user, 'free')` asigna `tenant.subscription.plan = 'starter'` y guarda, y el propio `default` del schema apuntaba a `PLAN_TYPES.FREE` (que era `undefined`). Consecuencia: activar el plan gratuito de onboarding reventaba con `ValidationError: 'starter' is not a valid enum value` y **el tenant nunca quedaba en plan gratuito**.

Fix: añadir `FREE: 'free'` y `STARTER: 'starter'` a `PLAN_TYPES`, con lo que el enum los admite y `default: PLAN_TYPES.FREE` deja de ser `undefined`. Salió al cubrir `paymentService` contra Mongo real (el enum del modelo es la fuente de verdad); con el modelo mockeado el `save` no validaba el enum. Cubierto en `tests/services/paymentService.extra.db.test.js`.

### `Expedition.calculations` descartaba el estado de cobro (`paid`/`paidAt`/`paymentId`)

`paymentService.updateExpeditionAfterPayment` marca la expedición como pagada escribiendo `expedition.calculations.paid = true`, `.paidAt` y `.paymentId` al confirmar un cobro. Pero `CalculationsSchema` (subdocumento con `_id: false`, modo estricto) **no declaraba esos tres campos**, así que Mongoose los descartaba en silencio: el `timeline` anotaba el pago pero `calculations.paid` nunca persistía. La expedición seguía figurando como no pagada tras confirmar el cobro.

Fix: declarar `paid: Boolean`, `paidAt: Date`, `paymentId: String` en `CalculationsSchema`. Salió al no mockear el modelo `Expedition` y comprobar el estado persistido tras `confirmManualPayment`. Cubierto en `tests/services/paymentService.extra.db.test.js`.

### `DeclarationSchema` descartaba `h7Data`/`vatCalculation`: estadísticas H7 basura y canal mal asignado

Mismo patrón de subdocumento estricto, esta vez en la declaración aduanera H7. `generateH7` guarda en la declaración `h7Data` (datos IOSS, valor intrínseco del envío) y `vatCalculation` (IVA a pagar); `submitH7` los lee para decidir el canal, y escribe `levanteNumber`. Pero `DeclarationSchema` (`_id: false`, estricto) **no declaraba `h7Data`, `vatCalculation`, `levanteNumber`, `h1Data` ni `aeatResponse`**, así que Mongoose los descartaba al guardar. Consecuencias reales, todas en el flujo H7 (paquetería e-commerce de bajo valor, el caso de uso más frecuente):

- **`getH7Stats`** lee `declaration.h7Data.iossData` y `.shipment.intrinsicValue`: al no persistir, devolvía siempre `withIOSS: 0` y `totalValue: 0` — las estadísticas H7 eran basura.
- **`submitH7`** decide el canal con `declaration.vatCalculation?.totalToPay`: como siempre valía 0, **toda H7 sin IOSS obtenía canal verde (despacho inmediato) aunque hubiera IVA pendiente de cobro**, saltándose la retención hasta liquidación.
- **`aeatResponse`** (código, CSV, canal de la respuesta AEAT) no quedaba guardado en ningún envío, H1 ni H7.

Fix: declarar esos campos como `Mixed`/`String`/`Date` en `DeclarationSchema`.

### El canal `yellow` del H7 no estaba en el enum: HTTP 500 al enviar una H7 con IVA pendiente

Defecto latente que afloró al arreglar el anterior. Con `vatCalculation` ya persistido, la rama de canal amarillo de `submitH7` pasó a ser alcanzable: asigna `declaration.channel = 'yellow'` y `expedition.status = 'yellow_channel'`. Pero el enum de `DeclarationSchema.channel` era `['green','orange','red']` y el de `ExpeditionSchema.status` no incluía `yellow_channel`. Resultado: `save()` lanzaba `ValidationError` → **HTTP 500, y la H7 con IVA pendiente nunca quedaba registrada como enviada**. Es decir, el H7 reventaba precisamente cuando había IVA que cobrar.

Fix: añadir `'yellow'` al enum de `channel` y `'yellow_channel'` al enum de `status`.

### El análisis IA de la declaración no persistía (`aiAnalysis.channelPrediction`/`declarationAnalysis`)

`aiPredictChannel` y `aiFullDeclarationAnalysis` guardan su resultado en `expedition.aiAnalysis.channelPrediction` y `.declarationAnalysis`. El objeto `aiAnalysis` del `ExpeditionSchema` es estricto y **no declaraba esos dos campos**, así que se descartaban: `getAiDeclarationAnalysis` devolvía siempre `hasAnalysis: false` aunque el análisis ya se hubiera ejecutado (y facturado a Bedrock). Fix: declararlos como `Mixed`. Los cuatro hallazgos anteriores salieron al cubrir `declarationController` sin mockear el modelo `Expedition` y comprobar el estado persistido; cubiertos en `tests/controllers/declarationController.extra.db.test.js`.

### `TaricCode.supplementaryUnit` colapsaba a String requerido: el catálogo no podía guardar unidades suplementarias

Mismo patrón de clave reservada de Mongoose que `Payment.paymentMethod` (`bfacd22`). El subdocumento se declaró así:

```js
supplementaryUnit: {
  required: { type: Boolean, default: false },
  type: String,          // <-- `type` es palabra reservada
  description: String
}
```

Con `type: String`, Mongoose interpreta el subobjeto completo **no como un subdocumento sino como un `SchemaString`**, y la clave `required: {...}` (truthy) lo marca como **requerido**. Consecuencias reales:

- Guardar `supplementaryUnit: { required, type, description }` — que es exactamente lo que produce `taricService` (los defaults del catálogo TARIC: `8471*` p/st, calzado `pa`, litros `l`, etc.) — reventaba con `ValidationError: Cast to string failed for value "{ required: ..., type: 'p/st', ... }"`.
- Guardar un TaricCode **sin** `supplementaryUnit` fallaba con `Path 'supplementaryUnit' is required`.

Es decir: **ningún código TARIC podía persistirse con su información de unidades suplementarias**. AEAT exige `supplementaryUnits` para varios códigos (error 2149, p.ej. portátiles 8471*), así que el catálogo perdía ese dato y las declaraciones de esos códigos quedaban expuestas al rechazo.

Fix: envolver la clave reservada en `type: { type: String }` para que sea un campo del subdocumento y no el SchemaType. Salió al cubrir `classificationController` contra Mongo real (creando fichas TARIC de verdad); con el modelo mockeado el `save` nunca validaba. Cubierto con regresión en `tests/controllers/classificationController.extra.db.test.js`.

### `updateRequirement`: el evento de timeline por cambio de estado no se disparaba nunca (traza perdida)

`updateRequirement` (requirements de AEAT: canal naranja/rojo, inspecciones, resoluciones) comparaba el estado tras haberlo mutado:

```js
Object.assign(requirement, updates);
if (updates.status && updates.status !== requirement.status) { // <-- ya mutado
  requirement.timeline.push({ action: 'status_changed', ... });
}
```

Como `Object.assign` ya había escrito `updates.status` sobre `requirement.status`, la comparación `updates.status !== requirement.status` era **siempre falsa**. Resultado: al cambiar el estado de un requerimiento por PUT (p.ej. `pending → in_progress`), **el evento `status_changed` nunca se añadía al timeline**. Se perdía la traza de auditoría de qué operador cambió el estado y cuándo — justo la información que hay que poder acreditar ante AEAT en un requerimiento. Fix: capturar `const estadoAnterior = requirement.status;` antes del `Object.assign` y comparar contra esa copia. Salió al cubrir `updateRequirement` contra Mongo real y comprobar el `timeline` persistido.

### `Requirement.getStats`: `mongoose.Types.ObjectId(userId)` sin `new` → HTTP 500 en las estadísticas por usuario

El static `getStats(userId)` construía el `$match` así:

```js
const match = userId ? { assignedTo: mongoose.Types.ObjectId(userId) } : {};
```

En Mongoose 7 / driver actual, `mongoose.Types.ObjectId` es una clase ES6 y **no se puede invocar sin `new`**: lanza `TypeError: Class constructor ObjectId cannot be invoked without 'new'`. El endpoint `GET /api/requirements/stats?userId=...` (dashboard de requerimientos filtrado por operador) **devolvía HTTP 500** siempre que se pasaba `userId`. Sin `userId` funcionaba (rama `{}`), por eso pasaba desapercibido. Fix: `new mongoose.Types.ObjectId(userId)`. Salió al cubrir `getStats` con un `userId` real contra Mongo en memoria.

### Portal cliente: `taxId`/`eoriNumber` descartados y `createdBy` string → el alta self-service nunca guardaba NIF/EORI (y fallaba)

`createExpeditionFromPortal` (alta de expediente por el propio cliente desde el portal) mapeaba los datos del cliente a campos que **no existen** en el `ClientSchema` del `Expedition`:

```js
client: {
  companyName: clientData.companyName,
  taxId: clientData.taxId,          // <-- el schema declara `nif` (REQUERIDO), no taxId
  eoriNumber: clientData.eoriNumber // <-- el schema declara `eori`, no eoriNumber
},
createdBy: 'portal_self_service'    // <-- createdBy es ObjectId ref User: cast fail
```

El subdocumento `client` es estricto, así que Mongoose descartaba `taxId`/`eoriNumber` en silencio. Como `nif` es **requerido**, el `save` fallaba con `ValidationError`. Además `createdBy` es un `ObjectId` (ref `User`) y asignarle el string `'portal_self_service'` daba `CastError`. Consecuencia: **el alta de expedientes self-service nunca funcionó** — o reventaba, o (si el NIF llegaba por otra vía) guardaba el expediente sin NIF ni EORI, datos obligatorios para la declaración aduanera. Fix: mapear a `nif: clientData.taxId || clientData.nif`, `eori: clientData.eoriNumber || clientData.eori`, y eliminar el `createdBy` con string. Salió al cubrir el servicio contra Mongo real (con el modelo mockeado el `save` no validaba). Cubierto en `tests/services/clientPortalService.db.test.js`.

### Portal cliente: `calculations.dutyTotal`/`vatTotal` no existen → importes siempre 0 (pagos, levante, estadísticas)

Varias funciones del portal leían los importes del expediente con nombres de campo **inexistentes** en el `CalculationsSchema` (que declara `totalDuties`/`totalVat`/`totalSpecialTaxes`, no `dutyTotal`/`vatTotal`/`specialTaxTotal`):

- `getPendingPayments` → `breakdown.duties`/`vat` leían `dutyTotal`/`vatTotal` → el desglose del pago pendiente mostraba **0 EUR de aranceles e IVA** al cliente aunque hubiera importe que cobrar.
- `calculateClientStats` → totales financieros del cliente siempre **0**.
- `generateLevanteDocument` → el documento de levante descargable salía con importes **0**.

Además el `CalculationsSchema` (`_id: false`, estricto) **no declaraba `totalToPay`**, que `calculationController.calculateTotal` calcula y asigna: se descartaba al guardar, así que `getPendingPayments` nunca veía un `total` a cobrar. Fix: añadir `totalToPay: Number` al `CalculationsSchema`, persistirlo en `calculationController`, y corregir las lecturas del servicio a `totalDuties`/`totalVat`/`totalSpecialTaxes`. Salió al cubrir el servicio contra Mongo real. Cubierto en `tests/services/clientPortalService.db.test.js`.

### 🚨 Portal cliente: `organizationId` no existe en el `Expedition` (usa `tenantId`) → fuga de datos entre organizaciones y historial vacío

`clientPortalService` escribía y consultaba los expedientes por `organizationId`, pero el `ExpeditionSchema` **no tiene ese campo**: el aislamiento multi-tenant del expediente va por `tenantId` (ref `Tenant`). Tres consecuencias, la primera de aislamiento:

1. **`createExpeditionFromPortal`** escribía `organizationId` → Mongoose (estricto) lo descartaba → el expediente self-service quedaba **sin `tenantId`** (huérfano, fuera del aislamiento multi-tenant).
2. **`getClientStats`** filtraba `{ 'client.contact.email': email, organizationId: expedition.organizationId }`. Como `expedition.organizationId` es `undefined` (nunca se guardó), el filtro quedaba en `{ organizationId: undefined }`, que Mongo trata como "campo ausente" y **no filtra** → agregaba las estadísticas de **todos los expedientes con ese email de CUALQUIER tenant**. Un cliente con el mismo email de contacto en dos organizaciones veía mezclados los importes, canales y volúmenes de ambas: **fuga de datos entre organizaciones**.
3. **`getClientHistory`** filtraba por `organizationId` (un `ObjectId`) sobre un campo inexistente → `countDocuments`/`find` devolvían **0 siempre** → el historial del cliente en el portal salía **permanentemente vacío**. El controller además pasaba `expedition.organizationId` (undefined), reforzando el 0.

Fix: usar `tenantId` en los tres puntos del servicio (`createExpeditionFromPortal`, `getClientStats`, `getClientHistory`) y pasar `expedition.tenantId` desde `clientPortalController.getClientHistory`. Salió al cubrir el servicio contra Mongo real y comprobar el conteo por organización (un expediente del mismo email en otro tenant se colaba en las estadísticas). Cubierto con regresión de aislamiento en `tests/services/clientPortalService.db.test.js`.

### `expeditionController`: los análisis IA (facturados a Bedrock) se descartaban al guardar → nunca eran recuperables

`aiSuggestDocuments`, `aiAnalyzeRisk` y `aiDetectInconsistencies` guardan su resultado en `expedition.aiAnalysis.documentSuggestions`/`riskAnalysis`/`inconsistencies` (más `fullAnalysis` desde `aiFullAnalysis`). El objeto `aiAnalysis` del `ExpeditionSchema` es estricto y **no declaraba esos cuatro campos**, así que Mongoose los descartaba en silencio al guardar. Consecuencia: cada análisis IA (que **se factura a Bedrock**) se ejecutaba, se devolvía una vez al cliente y **se perdía**; `getAiAnalysis` nunca podía recuperarlo (`hasAnalysis: false` siempre, aunque el análisis ya se hubiera pagado). Fix: declarar `documentSuggestions`/`riskAnalysis`/`inconsistencies`/`fullAnalysis` como `Mixed` y `lastAnalysisAt: Date` en el subobjeto `aiAnalysis`; y añadir `expedition.aiAnalysis.lastAnalysisAt = new Date()` en los tres handlers que faltaba (sin él, `getAiAnalysis.hasAnalysis` seguía siendo `false`). Salió al cubrir el controller contra Mongo real y comprobar el estado persistido. Cubierto con regresión en `tests/controllers/expeditionController.extra.db.test.js`.

### `expeditionController.aiAnalyzeRisk`: `aiAnalysis.riskFlags` con clave reservada `type` → CastError → HTTP 500

`aiAnalyzeRisk` mapea los `criticalIssues` del análisis a `aiAnalysis.riskFlags` como objetos `{ type, severity, description }`. En el schema `riskFlags` estaba declarado como `[{ type: String, severity, description }]`: al ser `type` una **clave reservada** de Mongoose, colapsaba el elemento del array a un `SchemaString` (`[String]`), y guardar un objeto `{type,severity,description}` reventaba con `CastError: Cast to [string] failed`. Resultado: **`POST .../ai/analyze-risk` devolvía HTTP 500** en cuanto el análisis detectaba un `criticalIssue` (justo el caso que importa: expediciones de riesgo alto). Mismo patrón de clave reservada que `Payment.paymentMethod`, `TaricCode.supplementaryUnit` y el canal H7. Fix: `type: { type: String }`. Salió al cubrir `aiAnalyzeRisk` con un `criticalIssue` real contra Mongo. Cubierto en `tests/controllers/expeditionController.extra.db.test.js`.

### 🚨 `expeditionController.getAiAnalysis`: el `.select()` omitía `tenantId` → fuga del análisis IA entre organizaciones

`getAiAnalysis` cargaba el expediente con `.select('expeditionId aiAnalysis')` — **sin `tenantId`** — y luego llamaba a `ensureSameTenant(expedition, ...)`. Como el guard lee `doc.tenantId`, al no venir en la proyección lo veía `undefined` y tomaba la rama de "documento legacy sin tenant → permitir": **cualquier usuario autenticado de cualquier organización podía leer el análisis IA (clasificaciones sugeridas, banderas de riesgo, inconsistencias) de un expediente de otro tenant** vía `GET .../ai/analysis`. Mismo tipo de fallo que un `.select()` que deja fuera el campo de aislamiento y abre la vía de fuga por la rama legacy del guard. Fix: incluir `tenantId` en el `.select('expeditionId aiAnalysis tenantId')`. Salió al comprobar que un expediente de otro tenant devolvía 200 (debía ser 404). Cubierto con regresión de aislamiento en `tests/controllers/expeditionController.extra.db.test.js`.

### `expeditionController.regenerateChecklist`: el spread de un subdocumento Mongoose perdía `received:true` → se re-pedían documentos ya subidos

`regenerateChecklist` regenera el checklist documental preservando el estado de los documentos que el cliente ya subió: guarda los recibidos en `existingDocs[type] = item` y los reaplica con `{ ...item, ...existingDocs[type] }`. Pero `item` es un **subdocumento Mongoose**, y hacer spread de un subdocumento (`{ ...subdoc }`) **no expone sus paths** (`received`, `validated`, `documentId`) como propiedades enumerables — el merge quedaba con el `received: false` del checklist recién generado. Consecuencia: **cada regeneración del checklist marcaba como NO recibido un documento que el cliente ya había aportado**, obligándole a resubirlo (y falseando el porcentaje de completitud documental del expediente). Fix: serializar el subdocumento con `item.toObject()` antes de guardarlo en `existingDocs`, para que sus campos sean propiedades planas y el spread los conserve. Salió al comprobar contra Mongo real que un `commercial_invoice` con `received:true` se conservaba tras regenerar. Cubierto en `tests/controllers/expeditionController.extra.db.test.js`.

### 🚨 `pueController.getById`: `findById` plano sin guard de tenant → fuga de solicitudes PUE entre organizaciones

`GET /api/pue/:id` (`getById`) delegaba en `pueService.getById(id)` — un `findById(id).populate(...)` sin acotar por tenant — y devolvía el resultado a **cualquier usuario autenticado** con un simple `if (!request) 404`. Los handlers hermanos del mismo controller (`linkToDeclaration`, `queryStatus`, `getXML`, y los endpoints IA) sí llaman a `ensureSameTenant`; `getById` era el único read por id **sin guard**. Consecuencia: conociendo el id de una solicitud PUE de otra organización, cualquier usuario podía leerla completa — **NIF/EORI del operador (RGPD), mercancía, tasas, historial de estados, resultado de inspección**. Misma familia que la fuga de `getAiAnalysis` del `expedienteController`. Fix: añadir `if (!ensureSameTenant(request, req, res, { resource: 'Solicitud' })) return;` (que además cubre el 404 cuando no existe y deja pasar al super admin). Salió al cubrir `getById` contra Mongo real y comprobar que una solicitud de otro tenant devolvía 200 con datos (debía ser 404). Cubierto con regresión de aislamiento en `tests/controllers/pueController.db.test.js`.

### 🚨 `h7Controller.getStats` + `H7Declaration.getStats`: estadísticas H7 agregadas entre organizaciones → fuga cross-tenant

`GET /api/h7/stats` acotaba mal en **dos capas**. En el controller, para `role === 'admin'` construía `{ ...req.query }` **sin `tenantId`** (para no-admin sí ponía `createdBy`); y el static `H7DeclarationSchema.statics.getStats` **ni siquiera leía `filters.tenantId`** (solo `startDate/endDate/carrier/createdBy`). Como `admin` es rol de **tenant**, no de plataforma (ver `[[project_luci_requirerole_admin_es_de_tenant]]`), el resultado era que un administrador de la organización A veía los **agregados H7 de TODAS las organizaciones**: número de declaraciones por estado, **valor total en aduana**, **aranceles totales** y desglose por transportista de tenants ajenos. Misma familia que la fuga de `getStats`/analytics sin acotar por tenant. Fix en ambas capas: (1) el controller inyecta **siempre** `queryParams.tenantId = req.user.tenantId` y añade `createdBy` solo para no-admin; (2) el static aplica `match.tenantId = new mongoose.Types.ObjectId(filters.tenantId)` — con casteo explícito a ObjectId porque `aggregate()` **no castea** el `tenantId` (mismo problema ya documentado en analytics: `countDocuments` casteaba y `aggregate` daba 0). Salió al cubrir `getStats` contra Mongo real y comprobar que un admin veía las declaraciones de otro tenant en sus estadísticas. Cubierto con regresión de aislamiento en `tests/controllers/h7Controller.db.test.js`.

### 🚨 `transitController.notifyArrival` / `notifyUnloading`: guard de tenant inefectivo → cualquier usuario notifica CC007/CC044 sobre un tránsito ajeno

Las dos notificaciones NCTS de destino (`POST /api/transit/:id/arrival` → CC007, `POST /api/transit/:id/unloading` → CC044) cargaban el tránsito con `Transit.findById(req.params.id)` **sin acotar por propietario** y lo protegían con `ensureSameTenant(transit, ...)`. Pero los tránsitos se aíslan por **`owner`**, no por `tenantId`: `transitService.create` nunca setea `tenantId`, de modo que `ensureSameTenant` (que lee `doc.tenantId`) siempre caía en la rama legacy "documento sin tenant → permitir" y **hacía de no-op**. Consecuencia: conociendo el id de un tránsito de otro operador, **cualquier usuario autenticado podía disparar a la AEAT una notificación de llegada o de descarga (CC007/CC044) sobre esa operación ajena**, cambiándole el estado (`arrived`/`unloaded`) y enviando datos a NCTS en su nombre. Todos los demás handlers del módulo (getById/update/submit/AI) sí acotan con `findOne({_id, owner: req.user._id})`; solo estos dos usaban el patrón erróneo. Fix: cargar con `findOne({_id, owner: req.user._id})` y responder 404 si no existe, igual que el resto del módulo. Salió al comprobar que un tránsito de otro owner devolvía 200 (debía ser 404). Cubierto con regresión de aislamiento en `tests/controllers/transitController.db.test.js`.

### `transitController.notifyUnloading`: el estado `'unloaded'` no existía en el enum → CC044 rompía siempre con HTTP 500

`notifyUnloading` tras enviar el CC044 hacía `transit.status = 'unloaded'` y `transit.save()`. Pero `'unloaded'` **no estaba en el enum `status`** del modelo `Transit` (sí `'arrived'`, no su sucesor lógico `'unloaded'`). Resultado: **toda notificación de descarga terminaba en `ValidationError` → HTTP 500**, aunque el envío a NCTS hubiera ido bien; la funcionalidad CC044 estaba completamente inoperativa. Misma familia que los enums incompletos ya vistos (canal H7 `'yellow'`, plan de billing). Fix: añadir `'unloaded'` al enum de estados (estado NCTS legítimo, posterior a `'arrived'`). Salió al ejercitar `notifyUnloading` con un MRN válido contra Mongo real. Cubierto en `tests/controllers/transitController.db.test.js`.
