/**
 * Plantilla de email de bienvenida con credenciales de acceso.
 * Colores de marca LUCI (tailwind.config.js): primary-600 #0284c7, primary-700 #0369a1,
 * primary-50 #f0f9ff, primary-100 #e0f2fe. Fuente Inter con fallback system-ui.
 * HTML de email: tablas + estilos inline (los clientes no soportan CSS externo).
 */

const LUCI = {
  primary: '#0284c7',
  primaryDark: '#0369a1',
  light: '#e0f2fe',
  bg: '#f0f9ff',
  text: '#0f172a',
  muted: '#475569',
  border: '#bae6fd',
};

/**
 * @param {object} p
 * @param {string} p.name      Nombre del destinatario
 * @param {string} p.email     Email (usuario de acceso)
 * @param {string} p.password  Contraseña temporal
 * @param {string} p.appUrl    URL de la app (login)
 */
function buildWelcomeCredentialsHtml({ name, email, password, appUrl }) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${LUCI.bg};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:${LUCI.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LUCI.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(2,132,199,0.10);">

        <!-- Cabecera -->
        <tr><td style="background:linear-gradient(135deg,${LUCI.primary} 0%,${LUCI.primaryDark} 100%);padding:36px 40px;">
          <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">LUCI</div>
          <div style="font-size:13px;color:${LUCI.light};margin-top:2px;font-weight:500;">Customs Agent · STRIX AI</div>
        </td></tr>

        <!-- Cuerpo -->
        <tr><td style="padding:40px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${LUCI.text};">Hola ${name},</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${LUCI.muted};">
            Se ha creado tu cuenta en <strong>LUCI Customs Agent</strong>. Estas son tus credenciales de acceso:
          </p>

          <!-- Caja de credenciales -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LUCI.bg};border:1px solid ${LUCI.border};border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:${LUCI.primary};font-weight:700;margin-bottom:4px;">Usuario</div>
              <div style="font-size:15px;color:${LUCI.text};font-weight:600;margin-bottom:16px;font-family:'Courier New',monospace;">${email}</div>
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:${LUCI.primary};font-weight:700;margin-bottom:4px;">Contraseña temporal</div>
              <div style="font-size:16px;color:${LUCI.text};font-weight:700;font-family:'Courier New',monospace;letter-spacing:0.5px;">${password}</div>
            </td></tr>
          </table>

          <!-- Botón -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="border-radius:10px;background:${LUCI.primary};">
              <a href="${appUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Acceder a LUCI →</a>
            </td></tr>
          </table>

          <!-- Aviso de seguridad -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LUCI.light};border-radius:10px;">
            <tr><td style="padding:14px 18px;font-size:13px;line-height:1.5;color:${LUCI.primaryDark};">
              <strong>Por seguridad</strong>, cambia esta contraseña temporal la primera vez que entres, desde tu perfil o mediante el enlace «¿Olvidaste tu contraseña?» de la pantalla de acceso.
            </td></tr>
          </table>
        </td></tr>

        <!-- Pie -->
        <tr><td style="padding:24px 40px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
            Este correo se ha enviado desde LUCI Customs Agent. Si no esperabas este mensaje, ignóralo.<br>
            STRIX AI Pioneer Solutions SL · ${appUrl.replace(/^https?:\/\//, '')}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

module.exports = { buildWelcomeCredentialsHtml };
