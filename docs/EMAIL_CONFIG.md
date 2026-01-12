# Configuración de Email Automático - LUCI Customs Agent

## Estado Actual
El sistema actualmente usa el **método manual** para compartir el link del portal:
- Al hacer clic en "Enviar Portal", aparece un modal con el link
- El usuario puede copiar el link y enviarlo por WhatsApp, email propio, etc.

## Configuración para Email Automático (Futuro)

### 1. Variables de Entorno Requeridas

Editar el archivo `backend/.env`:

```env
# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
EMAIL_FROM=LUCI Aduanas <tu-email@gmail.com>
```

### 2. Opciones de Proveedores SMTP

#### Gmail (Recomendado para desarrollo)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-cuenta@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx  # App Password, NO tu contraseña normal
```

**Para obtener App Password de Gmail:**
1. Ir a https://myaccount.google.com/security
2. Activar "Verificación en 2 pasos" si no está activa
3. Ir a "Contraseñas de aplicaciones"
4. Crear nueva contraseña para "Correo" en "Otro dispositivo"
5. Usar esa contraseña de 16 caracteres en SMTP_PASS

#### SendGrid (Recomendado para producción)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx  # Tu API Key de SendGrid
EMAIL_FROM=LUCI Aduanas <noreply@tudominio.com>
```

#### Amazon SES
```env
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=AKIAXXXXXXXX
SMTP_PASS=xxxxxxxxxxxxxxxx
EMAIL_FROM=LUCI Aduanas <noreply@tudominio.com>
```

#### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@tudominio.mailgun.org
SMTP_PASS=xxxxxxxxxxxxxxxx
EMAIL_FROM=LUCI Aduanas <noreply@tudominio.com>
```

### 3. Verificar Configuración

Una vez configurado, reiniciar el backend:
```bash
cd backend
# Matar proceso anterior
lsof -ti :5001 | xargs kill -9
# Iniciar de nuevo
node src/app.js
```

En los logs verás:
- ✅ `Email service inicializado correctamente` - Configuración OK
- ⚠️ `Email service no configurado` - Faltan variables

### 4. Comportamiento del Sistema

Cuando el email está configurado:
1. Usuario hace clic en "Enviar Portal"
2. El sistema envía automáticamente un email al cliente con:
   - Link del portal
   - Número de expediente
   - Tipo de operación (importación/exportación)
   - Instrucciones para subir documentos
3. El modal sigue apareciendo para que el usuario también pueda copiar el link

Cuando el email NO está configurado:
1. Usuario hace clic en "Enviar Portal"
2. Solo aparece el modal con el link para copiar manualmente
3. En logs aparece: `Email no enviado (no configurado)`

### 5. Plantillas de Email Disponibles

El servicio de email (`backend/src/services/emailService.js`) incluye estas plantillas:

| Método | Descripción | Uso |
|--------|-------------|-----|
| `sendPortalLink()` | Link del portal al cliente | Al crear/enviar portal |
| `sendDocumentReceivedNotification()` | Notifica al agente cuando cliente sube documento | Automático |
| `sendDeclarationReadyNotification()` | Declaración lista para revisión | Automático |
| `sendChannelNotification()` | Notifica canal naranja/rojo | Tras respuesta AEAT |

### 6. Personalizar Plantillas

Las plantillas HTML están en `backend/src/services/emailService.js`.

Para modificar el diseño:
1. Buscar el método correspondiente (ej: `sendPortalLink`)
2. Modificar el HTML en la constante `html`
3. Reiniciar el backend

### 7. Logs y Debugging

Para ver logs de email:
```bash
tail -f backend/logs/combined.log | grep -i email
```

Logs típicos:
```
info: Email service inicializado correctamente
info: Email enviado: cliente@empresa.com - [EXP-2025-0001] Documentacion requerida
warn: Email no enviado (no configurado): cliente@empresa.com - Portal link
error: Error enviando email a cliente@empresa.com: Connection timeout
```

### 8. Consideraciones de Producción

1. **Dominio propio**: Usar email con dominio propio (no @gmail.com) para mejor entregabilidad
2. **SPF/DKIM**: Configurar registros DNS para evitar que emails vayan a spam
3. **Rate limiting**: SendGrid/SES tienen límites, monitorear uso
4. **Bounce handling**: Implementar manejo de emails rebotados
5. **Unsubscribe**: Añadir link de baja (requerido por ley)

### 9. Ejemplo de Email que Recibe el Cliente

```
Asunto: [EXP-2025-0001] Documentación requerida para importación

Estimado/a Empresa Cliente S.L.,

Le informamos que hemos iniciado el trámite de importación
para su expediente EXP-2025-0001.

Para completar el despacho aduanero, necesitamos que nos
facilite la documentación requerida.

[BOTÓN: Acceder al Portal de Documentación]

Link de acceso: http://tudominio.com/portal/uuid-token

Este enlace es único para su operación y puede compartirlo
con las personas de su organización que necesiten subir documentos.

Saludos cordiales,
Equipo de Aduanas - Stock Logistic
```

---

## Archivos Relacionados

- `backend/.env` - Configuración SMTP
- `backend/src/services/emailService.js` - Servicio y plantillas
- `backend/src/controllers/expeditionController.js` - Llamada a sendPortalLink
- `frontend/src/components/Expeditions/ExpeditionDetail.jsx` - Modal del portal

## Contacto

Para dudas sobre la implementación, consultar la documentación de Nodemailer:
https://nodemailer.com/
