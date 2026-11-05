const { resolveAdminPasswords } = require('../../src/scripts/superAdminPasswords');

const ACCOUNTS = [
  { email: 'a@example.test', passwordEnvKey: 'TESTER' },
  { email: 'b@example.test', passwordEnvKey: 'LUIS' },
  { email: 'c@example.test', passwordEnvKey: 'JENIFER' }
];

describe('resolveAdminPasswords', () => {
  it('usa la variable de cada cuenta cuando está definida', () => {
    const env = {
      SUPERADMIN_TESTER_PASSWORD: 'pw-a',
      SUPERADMIN_LUIS_PASSWORD: 'pw-b',
      SUPERADMIN_JENIFER_PASSWORD: 'pw-c'
    };

    const result = resolveAdminPasswords(ACCOUNTS, env);

    expect(result.map((a) => a.password)).toEqual(['pw-a', 'pw-b', 'pw-c']);
  });

  it('usa SUPERADMIN_PASSWORD como valor común cuando no hay una por cuenta', () => {
    const result = resolveAdminPasswords(ACCOUNTS, { SUPERADMIN_PASSWORD: 'shared-pw' });

    expect(result.map((a) => a.password)).toEqual(['shared-pw', 'shared-pw', 'shared-pw']);
  });

  it('la variable por cuenta tiene prioridad sobre SUPERADMIN_PASSWORD', () => {
    const env = { SUPERADMIN_PASSWORD: 'shared-pw', SUPERADMIN_LUIS_PASSWORD: 'pw-b' };

    const result = resolveAdminPasswords(ACCOUNTS, env);

    expect(result.map((a) => a.password)).toEqual(['shared-pw', 'pw-b', 'shared-pw']);
  });

  it('conserva el resto de campos de cada cuenta y no incluye la clave de entorno', () => {
    const [first] = resolveAdminPasswords(ACCOUNTS, { SUPERADMIN_PASSWORD: 'shared-pw' });

    expect(first).toEqual({ email: 'a@example.test', password: 'shared-pw' });
  });

  it('no muta las cuentas de entrada', () => {
    const accounts = ACCOUNTS.map((a) => ({ ...a }));

    resolveAdminPasswords(accounts, { SUPERADMIN_PASSWORD: 'shared-pw' });

    expect(accounts).toEqual(ACCOUNTS);
  });

  it('lanza un error si no hay ninguna contraseña definida', () => {
    expect(() => resolveAdminPasswords(ACCOUNTS, {})).toThrow(/SUPERADMIN_PASSWORD/);
  });

  it('nombra las cuentas sin contraseña y las variables que las cubrirían', () => {
    const env = { SUPERADMIN_TESTER_PASSWORD: 'pw-a' };

    expect(() => resolveAdminPasswords(ACCOUNTS, env)).toThrow(
      /b@example\.test.*SUPERADMIN_LUIS_PASSWORD[\s\S]*c@example\.test.*SUPERADMIN_JENIFER_PASSWORD/
    );
  });

  it('trata valores vacíos o solo con espacios como ausentes', () => {
    const env = { SUPERADMIN_PASSWORD: '   ', SUPERADMIN_LUIS_PASSWORD: '' };

    expect(() => resolveAdminPasswords(ACCOUNTS, env)).toThrow(/SUPERADMIN_PASSWORD/);
  });

  it('rechaza el valor de plantilla "change-me" de .env.example', () => {
    const env = { SUPERADMIN_PASSWORD: 'change-me' };

    expect(() => resolveAdminPasswords(ACCOUNTS, env)).toThrow(/change-me|plantilla/);
  });

  it('el mensaje de error no incluye ningún valor de contraseña', () => {
    const env = { SUPERADMIN_TESTER_PASSWORD: 'secreto-que-no-debe-salir' };
    let message = '';

    try {
      resolveAdminPasswords(ACCOUNTS, env);
    } catch (err) {
      message = err.message;
    }

    expect(message).not.toContain('secreto-que-no-debe-salir');
  });
});
