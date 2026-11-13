/**
 * Arreglo 3 de la revision de seguridad del 4.2 (invitar usuarios), parte 1:
 *
 * Si un usuario invitado (mustChangePassword activo, quiza ya caducado)
 * restablece su contrasena por el enlace de correo (forgot/reset-password,
 * independiente de la invitacion), eso tiene que levantar el bloqueo: antes
 * se quedaba con mustChangePassword=true para siempre porque resetPassword no
 * tocaba esos campos, y el usuario jamas podia volver a entrar (el login
 * seguia rechazando por TEMP_PASSWORD_EXPIRED aunque la contrasena ya fuera
 * la nueva).
 */

const crypto = require('crypto');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const User = require('../../src/models/User');
const ctrl = require('../../src/controllers/authController');

usarBaseDeDatosEnMemoria();

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

test('resetPassword (enlace de correo) limpia mustChangePassword y tempPasswordExpires', async () => {
  const user = await User.create({
    email: 'pendiente@t-a.es', password: 'TemporalVieja1', name: 'Pendiente', role: 'agent',
    mustChangePassword: true,
    tempPasswordExpires: new Date(Date.now() - 1000) // ya caducada
  });

  const token = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
  user.resetPasswordExpires = Date.now() + 3600000;
  await user.save({ validateBeforeSave: false });

  const req = { params: { token }, body: { password: 'ContrasenaDefinitiva1' }, audit: jest.fn() };
  const res = crearRes();

  await ctrl.resetPassword(req, res);

  expect(res.statusCode).toBe(200);
  const actualizado = await User.findById(user._id);
  expect(actualizado.mustChangePassword).toBe(false);
  expect(actualizado.tempPasswordExpires).toBeUndefined();

  // Ya puede iniciar sesion con la nueva, sin que TEMP_PASSWORD_EXPIRED lo rechace.
  const login = await User.findByCredentials('pendiente@t-a.es', 'ContrasenaDefinitiva1');
  expect(login).not.toBeNull();
});
