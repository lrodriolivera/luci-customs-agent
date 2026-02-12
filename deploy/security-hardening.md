# LUCI Customs Agent - Security Hardening
**Fecha**: 12 de Febrero 2026
**Servidor**: aduanas.strixai.es (EC2 Ubuntu 22.04)

---

## 1. FIREWALL (UFW)

**Estado**: Activo, solo puertos necesarios abiertos.

```
sudo ufw status verbose
```

| Puerto | Protocolo | Uso |
|--------|-----------|-----|
| 22/tcp | SSH | Acceso administracion |
| 80/tcp | HTTP | Redirige a HTTPS |
| 443/tcp | HTTPS | Trafico web |

Puertos internos bloqueados desde exterior:
- 5001 (Node backend) - solo accesible via Nginx proxy
- 8003 (AI service) - solo accesible via Nginx proxy
- 27017 (MongoDB) - solo bindIp 127.0.0.1

**Configuracion**:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 2. NODE_ENV=production

**Archivo**: `/opt/luci-customs/backend/.env`

Cambiado de `development` a `production`. Efectos:
- Express no expone stack traces en errores
- Logging reducido a nivel produccion
- Mejor rendimiento (view caching, menos debug overhead)

---

## 3. MONGODB AUTENTICACION

**Archivo**: `/etc/mongod.conf`

```yaml
security:
  authorization: enabled
```

**Usuarios creados**:
| Usuario | Rol | Base de datos |
|---------|-----|---------------|
| `luciAdmin` | userAdminAnyDatabase | admin |
| `luciApp` | readWrite | luci-customs |

**Connection string** en `.env`:
```
MONGODB_URI=mongodb://luciApp:<password>@localhost:27017/luci-customs?authSource=luci-customs
```

**Verificacion**: Acceso sin credenciales devuelve `MongoServerError: Command dbStats requires authentication`

**Backup script** (`/opt/luci-customs/backup-mongodb.sh`) actualizado con URI autenticada y permisos `700`.

---

## 4. FAIL2BAN

**Archivo**: `/etc/fail2ban/jail.local`

| Jail | maxretry | bantime | Protege |
|------|----------|---------|---------|
| sshd | 3 intentos | 1 hora | Brute-force SSH |
| nginx-http-auth | 5 intentos | 30 min | Auth HTTP fallidos |

**Comandos utiles**:
```bash
sudo fail2ban-client status sshd          # Ver IPs baneadas
sudo fail2ban-client set sshd unbanip IP  # Desbanear IP
```

---

## 5. NGINX SECURITY HEADERS

**Archivo**: `/etc/nginx/sites-enabled/luci-customs` + `/etc/nginx/conf.d/security.conf`

| Header | Valor | Protege contra |
|--------|-------|----------------|
| `X-Frame-Options` | SAMEORIGIN | Clickjacking |
| `X-Content-Type-Options` | nosniff | MIME sniffing |
| `X-XSS-Protection` | 1; mode=block | XSS reflexivo |
| `Referrer-Policy` | strict-origin-when-cross-origin | Filtrado URLs a terceros |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=() | Acceso a dispositivos |
| `Content-Security-Policy` | Ver detalle abajo | XSS, inyeccion scripts |

**CSP detallado**:
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https://api.stripe.com;
frame-src https://js.stripe.com;
object-src 'none';
base-uri 'self';
```

**Nginx version oculta**: `server_tokens off` en `/etc/nginx/conf.d/security.conf`

---

## 6. SSL/TLS

- Certificado: Let's Encrypt, valido hasta 22/Abr/2026
- Protocolos: Solo TLSv1.2 + TLSv1.3
- Ciphers: ECDHE-ECDSA/RSA con AES-GCM y CHACHA20-POLY1305
- HTTP a HTTPS: Redireccion automatica (301)
- Configuracion: `/etc/letsencrypt/options-ssl-nginx.conf`

---

## 7. PERMISOS DE ARCHIVOS SENSIBLES

| Archivo | Permisos | Owner |
|---------|----------|-------|
| `/opt/luci-customs/backend/.env` | 600 | ubuntu |
| `/opt/luci-customs/certs/strixai_fnmt.p12` | 600 | ubuntu |
| `/opt/luci-customs/certs/certificado.p12` | 600 | ubuntu |
| `/opt/luci-customs/backup-mongodb.sh` | 700 | ubuntu |

---

## 8. SSH

- Autenticacion: Solo por clave publica (`PasswordAuthentication no`)
- Root login: Deshabilitado por defecto
- Clave: `~/.ssh/aws-keys/luci-customs-key.pem`

---

## 9. PAQUETES Y UPDATES

- **Unattended upgrades**: Activo (parches de seguridad automaticos)
- MongoDB actualizado a 7.0.30 (12/Feb/2026)
- libldap actualizado (12/Feb/2026)

---

## 10. BACKUPS

- **Frecuencia**: Diario a las 3:00 AM UTC
- **Crontab** (usuario ubuntu): `0 3 * * * /opt/luci-customs/backup-mongodb.sh`
- **Retencion**: 30 dias
- **Ubicacion**: `/opt/luci-customs/backups/`
- **Autenticacion**: URI con credenciales en el script

---

## CHECKLIST VERIFICACION

```bash
# Firewall
sudo ufw status verbose

# Fail2ban
sudo fail2ban-client status sshd

# MongoDB auth
mongosh --quiet 'mongodb://localhost:27017/luci-customs' --eval 'db.stats()'
# Debe devolver: MongoServerError: requires authentication

# Headers
curl -sI https://aduanas.strixai.es | grep -iE 'server|security|referrer|x-frame|x-content|permissions'

# SSL
curl -sI https://aduanas.strixai.es | head -3

# Puerto 5001 bloqueado
curl -s --max-time 3 http://46.137.105.47:5001/health
# Debe fallar (timeout)

# Backend health
curl -s https://aduanas.strixai.es/health

# Backup manual
/opt/luci-customs/backup-mongodb.sh
```
