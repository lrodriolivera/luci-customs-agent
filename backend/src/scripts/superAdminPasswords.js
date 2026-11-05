/**
 * Resolución de contraseñas para createSuperAdmin.js.
 *
 * Sin contraseñas por defecto en el código: cada cuenta toma la suya de
 * SUPERADMIN_<CLAVE>_PASSWORD o, si no existe, la común SUPERADMIN_PASSWORD.
 * Si a alguna cuenta no le llega ninguna, se lanza un error (el script aborta
 * antes de conectar a la BD). El error nombra cuentas y variables, nunca valores.
 */

const SHARED_VAR = 'SUPERADMIN_PASSWORD';
// Valor de plantilla de backend/.env.example: copiar el ejemplo sin editarlo no vale.
const PLACEHOLDER = 'change-me';

const isUsable = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed !== '' && trimmed !== PLACEHOLDER;
};

/**
 * @param {Array<{ email: string, passwordEnvKey: string }>} accounts
 * @param {Record<string, string | undefined>} [env]
 * @returns {Array<object>} cuentas con `password`, sin `passwordEnvKey`
 */
function resolveAdminPasswords(accounts, env = process.env) {
  const missing = [];

  const resolved = accounts.map(({ passwordEnvKey, ...account }) => {
    const ownVar = `SUPERADMIN_${passwordEnvKey}_PASSWORD`;
    const password = [env[ownVar], env[SHARED_VAR]].find(isUsable);
    if (password === undefined) {
      missing.push({ email: account.email, ownVar });
    }
    return { ...account, password };
  });

  if (missing.length > 0) {
    const detail = missing
      .map(({ email, ownVar }) => `  - ${email}: define ${ownVar} (o ${SHARED_VAR} para todas)`)
      .join('\n');
    throw new Error(
      `Faltan contraseñas para crear los super admins (vacías o con el valor de plantilla "${PLACEHOLDER}"):\n${detail}`
    );
  }

  return resolved;
}

module.exports = { resolveAdminPasswords };
