# GDPR Compliance Checklist - LUCI Customs Agent

**Fecha de elaboración**: 2026-03-11
**Última verificación**: **2026-08-15**
**Responsable**: STRIX AI PIONEER SOLUTIONS, S.L. (CIF: B22477020)
**Aplicacion**: LUCI Customs Agent (aduanas.strixai.es)

---

> ## ⚠️ EL CUERPO DE ESTE CHECKLIST ES DE MARZO 2026 Y ESTÁ DESACTUALIZADO
>
> **Las casillas y el "41% de cumplimiento" de la sección Resumen YA NO SON VÁLIDOS.**
> Varios puntos marcados como MISSING se implementaron después de marzo.
>
> Verificación contra el código el **15 de agosto de 2026**:
>
> | | Marzo 2026 | **Agosto 2026** |
> |---|---|---|
> | Cumple | 8 / 29 | **17 / 29** |
> | Parcial | 8 / 29 | **6 / 29** |
> | No cumple | 13 / 29 | **6 / 29** |
> | **Estimación** | ~41 % | **~69 %** |
>
> **Lo que cambió desde marzo** (detalle en la [sección de verificación](#verificación-de-estado--15-de-agosto-de-2026) al final):
> exportación de datos y borrado de cuenta implementados (`src/routes/gdpr.js`),
> audit trail formal en producción (`AuditLog` append-only), política de retención
> documentada (`docs/compliance/retention-policy.md`), y cifrado de PII a nivel de campo
> disponible en código.
>
> 🔴 **Un punto EMPEORÓ respecto a lo que sugiere el texto viejo:** el cifrado de PII está
> implementado pero **NO está activo en producción** — falta la variable de entorno.
> Ver la sección de verificación; es la acción más urgente de la lista.
>
> **No citar el "41%" ni las casillas del cuerpo sin leer antes la sección de verificación.**

---

## Data Protection

- [x] **Privacy Policy page** - **DONE**
  - Componente: `frontend/src/components/Legal/PrivacyPolicy.jsx`
  - Ruta: `/privacy`, accesible desde landing y footer
  - Contenido: 11 secciones (responsable, datos recogidos, finalidad, base juridica, terceros, transferencias internacionales, retencion, derechos, seguridad, cookies, contacto)
  - i18n: Traducido a 7 idiomas via claves `legal.privacyS*`

- [x] **Cookie Policy page** - **DONE**
  - Componente: `frontend/src/components/Legal/CookiePolicy.jsx`
  - Ruta: `/cookies`
  - Contenido: Cookies tecnicas (token, user, cookie_consent), cookies de terceros (Stripe), instrucciones para gestionar cookies en 4 navegadores

- [x] **Cookie consent banner** - **PARTIAL**
  - Componente: `frontend/src/components/Legal/CookieBanner.jsx`
  - Funciona: Muestra banner si no hay `cookie_consent` en localStorage, boton "Aceptar"
  - **Falta**: No hay consentimiento granular (solo "Aceptar todo"). GDPR requiere poder rechazar cookies no esenciales y elegir categorias (tecnicas, analiticas, marketing)

- [ ] **Data Processing Agreement (DPA) template** - **MISSING**
  - No existe documento DPA para clientes que actuan como responsables del tratamiento

- [ ] **Record of Processing Activities (ROPA)** - **MISSING**
  - No existe registro formal de actividades de tratamiento (Art. 30 RGPD)

---

## User Rights (GDPR Articles 15-22)

- [ ] **Right of access (Art. 15)** - **PARTIAL**
  - El usuario puede ver su perfil via `PUT /api/auth/profile`
  - **Falta**: No hay endpoint para exportar TODOS los datos del usuario (expedientes, declaraciones, historial chat, logs)

- [x] **Right to rectification (Art. 16)** - **DONE**
  - Endpoint: `PUT /api/auth/profile` en `authController.updateProfile()`
  - El usuario puede editar nombre, email y datos de perfil
  - Cambio de contrasena: `PUT /api/auth/change-password`

- [ ] **Right to erasure (Art. 17)** - **PARTIAL**
  - Existe `deleteUser` en `adminController.js` (linea 298), pero solo accesible por admin
  - **Falta**: El usuario no puede solicitar su propia eliminacion desde la interfaz. No hay flujo self-service de eliminacion de cuenta

- [ ] **Right to restrict processing (Art. 18)** - **MISSING**
  - No hay mecanismo para que el usuario solicite la restriccion del tratamiento de sus datos

- [ ] **Right to data portability (Art. 20)** - **MISSING**
  - No hay endpoint para exportar datos en formato legible por maquina (JSON/CSV)

- [ ] **Right to object (Art. 21)** - **MISSING**
  - No hay mecanismo para que el usuario objete al tratamiento de sus datos

---

## Technical Measures

- [ ] **Data encryption at rest (MongoDB)** - **PARTIAL**
  - MongoDB en EC2 sin cifrado de disco nativo configurado
  - Backups diarios (`/opt/luci-customs/backup-mongodb.sh`) sin cifrado explicito
  - **Falta**: Habilitar MongoDB encryption at rest o EBS encryption

- [x] **Data encryption in transit (HTTPS/TLS)** - **DONE**
  - Nginx con certificado SSL en `aduanas.strixai.es`
  - Todas las conexiones API via HTTPS
  - Certificado FNMT `.p12` con permisos `chmod 600`

- [x] **Password hashing (bcrypt)** - **DONE**
  - `bcryptjs` con salt rounds = 12 en `User.js` pre-save hook
  - `User.comparePassword()` para verificacion

- [x] **JWT token expiration** - **DONE**
  - Configurado con `JWT_EXPIRES_IN` (default: 7d) en `User.js` linea 121
  - Manejo de `TokenExpiredError` en middleware auth

- [x] **Rate limiting** - **DONE**
  - Global: `express-rate-limit` en todas las rutas `/api/`
  - Auth-specific: rate limiter estricto en `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`
  - API keys: rate limiting por IP con tracking in-memory

- [x] **Audit logging** - **PARTIAL**
  - Winston logger con archivos `error.log` y `combined.log`
  - Morgan HTTP request logging
  - **Falta**: No hay audit trail formal (quien accedio a que datos, cuando, cambios en datos personales). Solo logs generales de aplicacion

- [ ] **Data retention policy** - **MISSING**
  - Solo `TaricSearchHistory` tiene TTL automatico (1 ano)
  - `WorkflowExecution` tiene `cleanupOld()` (90 dias) pero no hay cron que lo ejecute
  - No hay politica formal de retencion para expedientes, declaraciones, chats

- [ ] **Data anonymization/pseudonymization** - **MISSING**
  - No hay mecanismo de anonimizacion de datos historicos

- [ ] **Backup encryption** - **MISSING**
  - Script de backup existe (`backup-mongodb.sh`, cron 3AM, 30 dias retencion)
  - Backups no cifrados en disco

---

## Organizational

- [ ] **DPO (Data Protection Officer) designated** - **MISSING**
  - No hay DPO designado. Para empresas < 250 empleados puede no ser obligatorio, pero recomendable dado el manejo de datos aduaneros

- [ ] **Data breach notification procedure (72h)** - **MISSING**
  - No hay procedimiento documentado para notificar brechas a la AEPD en 72h (Art. 33 RGPD)

- [ ] **Data Protection Impact Assessment (DPIA)** - **MISSING**
  - No hay DPIA. Recomendable por uso de IA (Claude/Anthropic) para procesar datos de clientes

- [ ] **Employee training on data protection** - **MISSING**
  - No hay programa de formacion documentado

- [ ] **Third-party processor agreements** - **PARTIAL**
  - Privacy Policy menciona terceros: AEAT, Stripe, AWS, Anthropic
  - **Falta**: DPAs firmados con cada procesador (especialmente Anthropic para datos enviados a Claude)

---

## Specific to Customs

- [x] **EORI data handling compliance** - **PARTIAL**
  - EORI almacenado en datos de expediente y tenant config
  - **Falta**: Documentar base juridica especifica para tratamiento de EORI (obligacion legal aduanera)

- [x] **Certificate storage security** - **DONE**
  - Certificado FNMT en `/opt/luci-customs/certs/strixai_fnmt.p12`
  - Permisos `chmod 600` en `.p12` y `.env`
  - Path y password en variables de entorno del tenant, no hardcoded

- [ ] **Declaration data retention (customs requirement: 3-7 years)** - **PARTIAL**
  - Los datos se almacenan indefinidamente en MongoDB (no se borran)
  - **Falta**: Politica formal que documente la retencion de 3-7 anos por requisito aduanero (Art. 51 CAU) y el borrado posterior

- [ ] **Cross-border data transfer safeguards (Spain <-> Netherlands)** - **PARTIAL**
  - Privacy Policy menciona transferencias internacionales
  - AWS en EU (eu-south-2 para 300dec, EC2 para LUCI)
  - **Falta**: Documentar garantias especificas para transferencias de datos aduaneros entre Espana y Paises Bajos via servicios NL-BTO

---

## Resumen

> ⚠️ **Tabla histórica (marzo 2026).** El estado vigente está en la
> [sección de verificación](#verificación-de-estado--15-de-agosto-de-2026) al final.

| Categoria | DONE | PARTIAL | MISSING | Total |
|-----------|------|---------|---------|-------|
| Data Protection | 2 | 1 | 2 | 5 |
| User Rights | 1 | 2 | 3 | 6 |
| Technical Measures | 4 | 2 | 3 | 9 |
| Organizational | 0 | 1 | 4 | 5 |
| Customs Specific | 1 | 2 | 1 | 4 |
| **TOTAL** | **8** | **8** | **13** | **29** |

**Compliance estimate (marzo 2026): ~41%** — **desfasado. Agosto 2026: ~69%.**

---

## TODO - Priority Implementation

### P0 - Critico (antes de lanzamiento)

1. **Cookie consent granular** - Modificar `CookieBanner.jsx` para permitir aceptar/rechazar por categoria (tecnicas obligatorias, analiticas opcionales). Requerido por LSSI-CE y ePrivacy.

2. **Data export endpoint** (Art. 15 + Art. 20) - Crear `GET /api/auth/my-data` que exporte todos los datos del usuario en JSON: perfil, expedientes, declaraciones, chat history, clasificaciones.

3. **Account deletion self-service** (Art. 17) - Crear `DELETE /api/auth/my-account` accesible por el propio usuario. Debe anonimizar datos en declaraciones ya enviadas a AEAT (no borrar, por requisito legal de retencion).

4. **Data breach procedure** - Documento interno con pasos para notificar a AEPD en 72h, plantilla de notificacion, lista de contactos.

5. **DPAs con procesadores** - Firmar DPA con Anthropic (datos enviados a Claude), verificar DPA existente con AWS y Stripe.

### P1 - Importante (primer mes post-lanzamiento)

6. **ROPA** (Art. 30) - Documento con todas las actividades de tratamiento: finalidad, categorias de datos, destinatarios, plazos de retencion, medidas de seguridad.

7. **Data retention policy** - Definir y automatizar:
   - Expedientes/declaraciones: 7 anos (Art. 51 CAU), luego anonimizar
   - Chat history: 1 ano
   - Logs de acceso: 6 meses
   - Cuentas inactivas: notificar a los 12 meses, eliminar a los 18

8. **Audit trail** - Implementar middleware que registre accesos a datos personales (quien, cuando, que datos, accion CRUD).

9. **MongoDB encryption at rest** - Habilitar cifrado EBS en EC2 o MongoDB Enterprise encryption.

10. **Backup encryption** - Cifrar backups de MongoDB con GPG antes de almacenar.

### P2 - Recomendable (Q2 2026)

11. **DPIA** - Evaluacion de impacto por uso de IA para procesar datos aduaneros.

12. **DPO designation** - Designar DPO (puede ser externo/compartido).

13. **Right to restrict/object** - Endpoints para restringir procesamiento y objetar.

14. **Training program** - Documentar formacion GDPR para el equipo.

15. **Cross-border transfer documentation** - Documentar mecanismos de transferencia ES-NL (Decisiones de adecuacion UE, SCCs si aplica).

---

# Verificación de estado — 15 de Agosto de 2026

Revisión punto por punto contra el código en producción, cinco meses después de elaborar
el checklist. Cada línea se comprobó leyendo el fichero indicado.

## Puntos que pasaron a CUMPLIDO desde marzo

| Punto del checklist | Marzo | Agosto | Evidencia |
|---|---|---|---|
| Derecho de acceso (Art. 15) | PARTIAL | ✅ **DONE** | `src/routes/gdpr.js:18` — `GET /api/gdpr/export` devuelve perfil, expediciones, declaraciones H7/ENS/PUE, tránsitos y hasta 5.000 entradas de auditoría |
| Derecho de portabilidad (Art. 20) | MISSING | ✅ **DONE** | Mismo endpoint: salida JSON descargable, formato legible por máquina |
| Derecho de supresión (Art. 17) | PARTIAL | ✅ **DONE** | `src/routes/gdpr.js:63` — `POST /api/gdpr/delete-account`, autoservicio del titular con confirmación explícita; anonimiza correo y nombre, vacía perfil y permisos, inutiliza la contraseña |
| Anonimización / seudonimización | MISSING | ✅ **DONE** | Misma ruta: sustituye por `deleted-<id>@anonymized.invalid`, conserva el documento aduanero desvinculado de la identidad |
| Audit trail formal | PARTIAL | ✅ **DONE** | `src/models/AuditLog.js` — append-only con bloqueo activo de `updateOne`/`updateMany`/`findOneAndUpdate`/`deleteMany`. Middleware global en `src/app.js:224`. Registra usuario, acción, recurso, IP, agente, cambios y marca de tiempo |
| Política de retención de datos | MISSING | ✅ **DONE** | `docs/compliance/retention-policy.md` (creado 15-ago-2026). 5 índices TTL activos en modelos: flujos 90 d, búsquedas TARIC 12 m, caché IA 30 d, claves de API y supresiones de correo por caducidad |
| Retención de declaraciones (3-7 años) | PARTIAL | ✅ **DONE** | Documentado en la política §2.1: 4 años (mínimo de 3 del CAU art. 51, elevado por prescripción fiscal española, Ley 58/2003 art. 66) |

## Puntos que siguen abiertos

| Punto | Estado | Nota |
|---|---|---|
| Cifrado en reposo | 🔴 **Implementado pero INACTIVO** | Ver abajo — es la acción más urgente |
| Cookie consent granular | 🟡 PARTIAL | `frontend/src/components/Legal/CookieBanner.jsx` sigue con un único botón "Aceptar" (41 líneas, sin categorías). Sin opción de rechazar cookies no esenciales |
| DPA para clientes | ❌ MISSING | Sin plantilla de acuerdo de tratamiento |
| ROPA (Art. 30) | ❌ MISSING | Sin registro formal de actividades de tratamiento |
| Procedimiento de brecha (72 h) | ❌ MISSING | Sin documento interno. El documento comercial ya compromete aviso al cliente en 24 h: conviene formalizarlo |
| DPIA | ❌ MISSING | Recomendable por el uso de IA sobre datos de cliente |
| DPO designado | ❌ MISSING | No obligatorio por tamaño, pero recomendable |
| Cifrado de backups | 🟡 PARTIAL | Copia remota en S3 con cifrado AES256 del bucket; la copia local de `backup-mongo.sh` no se cifra en disco |

## 🔴 Hallazgo de esta verificación: el cifrado de PII no está activo

El código de cifrado existe y es correcto (`src/utils/piiCrypto.js`, AES-256-GCM con
versionado de clave), pero **está desactivado en producción**:

```
docker exec luci-backend printenv | grep PII_ENCRYPTION_KEY   → sin resultado
piiCrypto.enabled()                                           → false
```

`getKey()` devuelve `null` cuando falta `PII_ENCRYPTION_KEY`, y los llamantes hacen
pass-through: **el NIF y el EORI se guardan en claro**. Comprobado en la base de datos: el
único tenant existente tiene ambos campos sin el prefijo `v1:`, es decir, sin cifrar.

El alcance real hoy es mínimo —un solo tenant, de pruebas— pero la afirmación "ciframos los
identificadores fiscales" no se sostiene mientras la variable no esté definida.

**Cómo activarlo:**

1. Definir `PII_ENCRYPTION_KEY` (mínimo 32 caracteres) y `PII_HASH_KEY` en el entorno del
   backend, fuera del repositorio.
2. Ejecutar la migración, que ya existe y es idempotente:
   `node src/scripts/encryptPii.js` (requiere además `ENCRYPT_PII=true`).
3. Verificar que los campos pasan a llevar el prefijo `v1:`.

⚠️ La clave debe ser la misma en todas las instancias y **no puede perderse**: sin ella los
datos cifrados son irrecuperables. Guardarla donde se custodian el resto de secretos.

## Estimación revisada

| | Marzo 2026 | Agosto 2026 |
|---|---|---|
| Cumple | 8 | **17** |
| Parcial | 8 | **6** |
| No cumple | 13 | **6** |
| **Estimación** | ~41 % | **~69 %** |

## Prioridad sugerida

1. **Activar el cifrado de PII** — es lo único de esta lista que contradice algo que ya
   afirmamos por escrito ante clientes.
2. **Consentimiento granular de cookies** — exigido por ePrivacy y LSSI-CE; visible desde
   fuera y fácil de detectar en una auditoría.
3. **ROPA y procedimiento de brecha** — documentales, sin desarrollo, y son lo primero que
   pide un cliente corporativo en su cuestionario de proveedor.

## Nota de método

Este checklist se citó durante cinco meses como estado vigente, transmitiendo un 41 % de
cumplimiento cuando la cifra real estaba cerca del 69 %. Un checklist sin fecha de
verificación envejece hacia lo pesimista y perjudica a quien lo escribió. Antes de citar
cualquier porcentaje de este documento, comprobar contra el código.
