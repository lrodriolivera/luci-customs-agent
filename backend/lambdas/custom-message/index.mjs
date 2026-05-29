const BRAND_COLOR = '#0284c7';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://aduanas.strixai.es';

function wrapHtml(content) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <tr><td style="background:${BRAND_COLOR};padding:28px 32px;text-align:center;">
          <table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:10px;text-align:center;vertical-align:middle;">
            <span style="color:#fff;font-size:28px;font-weight:bold;line-height:48px;">L</span>
          </td></tr></table>
          <h1 style="color:#fff;margin:12px 0 0;font-size:22px;font-weight:700;">LUCI</h1>
          <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;font-weight:400;">Agente de Aduanas Inteligente</p>
        </td></tr>
        <tr><td style="padding:32px 32px 24px;">
          ${content}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#64748b;font-size:12px;">STRIX AI SL &bull; Este email fue enviado automaticamente</p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:11px;">
            <a href="${FRONTEND_URL}" style="color:#94a3b8;text-decoration:none;">${FRONTEND_URL}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function codeBlock(code) {
  return `<div style="text-align:center;margin:24px 0;">
    <div style="display:inline-block;background:#f1f5f9;border:2px dashed ${BRAND_COLOR};border-radius:8px;padding:16px 32px;">
      <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1e293b;">${code}</span>
    </div>
  </div>`;
}

function getUserName(userAttributes) {
  const givenName = userAttributes.given_name || '';
  const familyName = userAttributes.family_name || '';
  if (givenName || familyName) {
    return `${givenName} ${familyName}`.trim();
  }
  return userAttributes.name || userAttributes.email || 'Usuario';
}

export const handler = async (event) => {
  const { triggerSource, request } = event;
  const { userAttributes, codeParameter } = request;
  const name = getUserName(userAttributes);

  switch (triggerSource) {
    case 'CustomMessage_SignUp': {
      event.response.emailSubject = 'Verifica tu cuenta - LUCI';
      event.response.emailMessage = wrapHtml(`
        <h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">Verificacion de cuenta</h2>
        <p style="color:#475569;margin:0 0 8px;font-size:15px;">Hola <strong>${name}</strong>,</p>
        <p style="color:#475569;margin:0 0 20px;font-size:15px;">Gracias por registrarte en LUCI. Para activar tu cuenta, introduce el siguiente codigo de verificacion:</p>
        ${codeBlock(codeParameter)}
        <p style="color:#64748b;font-size:13px;margin:20px 0 0;">Este codigo expira en 24 horas. Si no has solicitado esta cuenta, puedes ignorar este email.</p>
      `);
      break;
    }

    case 'CustomMessage_ResendCode': {
      event.response.emailSubject = 'Tu codigo de verificacion - LUCI';
      event.response.emailMessage = wrapHtml(`
        <h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">Codigo de verificacion</h2>
        <p style="color:#475569;margin:0 0 8px;font-size:15px;">Hola <strong>${name}</strong>,</p>
        <p style="color:#475569;margin:0 0 20px;font-size:15px;">Has solicitado un nuevo codigo de verificacion. Aqui lo tienes:</p>
        ${codeBlock(codeParameter)}
        <p style="color:#64748b;font-size:13px;margin:20px 0 0;">Este codigo expira en 24 horas.</p>
      `);
      break;
    }

    case 'CustomMessage_ForgotPassword': {
      event.response.emailSubject = 'Restablecer contrasena - LUCI';
      event.response.emailMessage = wrapHtml(`
        <h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">Restablecer contrasena</h2>
        <p style="color:#475569;margin:0 0 8px;font-size:15px;">Hola <strong>${name}</strong>,</p>
        <p style="color:#475569;margin:0 0 20px;font-size:15px;">Hemos recibido una solicitud para restablecer tu contrasena. Introduce el siguiente codigo en LUCI:</p>
        ${codeBlock(codeParameter)}
        <p style="color:#64748b;font-size:13px;margin:20px 0 0;">Este codigo expira en 1 hora. Si no has solicitado este cambio, ignora este email y tu contrasena permanecera sin cambios.</p>
      `);
      break;
    }

    case 'CustomMessage_AdminCreateUser': {
      const tempPassword = request.usernameParameter || '';
      event.response.emailSubject = 'Has sido invitado a LUCI';
      event.response.emailMessage = wrapHtml(`
        <h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">Bienvenido a LUCI</h2>
        <p style="color:#475569;margin:0 0 8px;font-size:15px;">Hola <strong>${name}</strong>,</p>
        <p style="color:#475569;margin:0 0 20px;font-size:15px;">Has sido invitado a utilizar LUCI, la plataforma de gestion aduanera inteligente. Tu contrasena temporal es:</p>
        ${codeBlock(codeParameter)}
        <p style="color:#475569;font-size:14px;margin:20px 0 8px;">Tu usuario es: <strong>${userAttributes.email}</strong></p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${FRONTEND_URL}/login" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Acceder a LUCI</a>
        </div>
        <p style="color:#64748b;font-size:13px;margin:20px 0 0;">Deberas cambiar tu contrasena en el primer inicio de sesion.</p>
      `);
      break;
    }

    default:
      break;
  }

  return event;
};
