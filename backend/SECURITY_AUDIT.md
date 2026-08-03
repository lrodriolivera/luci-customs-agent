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
| Tests al cerrar | **1732** en verde (86 suites) |

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

Asimetría clásica: el listado acotado, los accesos directos abiertos. Conociendo el id —secuencial con marca de tiempo, no un secreto— se podía leer, descargar o **borrar** el informe de cualquier otro. Hoy esos informes se alimentan de métricas simuladas (flag `simulated`, `7a084e4`), así que no exponen operativa real todavía.

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

213 tests de guardia en total (11 suites).

---

## Pendiente, no corregido aquí

Requiere decisión de negocio o queda fuera del alcance de esta auditoría:

- **El rol `super_admin` usa tres cadenas distintas** en el código, de modo que `/api/v1/tenants` es inalcanzable (401). Falla cerrado, no es un agujero, pero la gestión de tenants no funciona por API.
- **Analytics devuelve datos simulados** (`Math.random()`) marcados con el flag `simulated`. Las agregaciones reales están pendientes. Cuando se implementen, los informes de `reportsService` pasarán a llevar operativa real: el aislamiento que corrige `8f7f210` es previo a ese momento, no posterior.
- **`requireRole('admin')` es un rol de tenant, no del sistema.** Un `admin` administra su organización, no la plataforma. Está bien así, pero conviene tenerlo presente al leer los `requireRole('admin')` de este informe: no conceden acceso entre tenants.

---

## Nota de método

Durante la auditoría probé `POST /api/portal/api-keys` **contra producción** para confirmar que la ruta era alcanzable, y con ello creé una API key real (`lca_729ad42e`). La revoqué diez segundos después, con cero usos, y la dejé en la colección `clientapikeys` con estado `revoked` como registro de auditoría en lugar de borrarla.

El impacto fue nulo, pero el método era incorrecto: **las pruebas de escritura van contra un entorno local**, no contra producción. Queda anotado.
