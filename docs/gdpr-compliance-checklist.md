# GDPR Compliance Checklist - LUCI Customs Agent

**Fecha**: 2026-03-11
**Responsable**: STRIX AI SL (NIF: B22477020)
**Aplicacion**: LUCI Customs Agent (aduanas.strixai.es)

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

| Categoria | DONE | PARTIAL | MISSING | Total |
|-----------|------|---------|---------|-------|
| Data Protection | 2 | 1 | 2 | 5 |
| User Rights | 1 | 2 | 3 | 6 |
| Technical Measures | 4 | 2 | 3 | 9 |
| Organizational | 0 | 1 | 4 | 5 |
| Customs Specific | 1 | 2 | 1 | 4 |
| **TOTAL** | **8** | **8** | **13** | **29** |

**Compliance estimate: ~41% (8/29 fully compliant, 8/29 partially)**

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
