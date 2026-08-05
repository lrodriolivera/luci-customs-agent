/**
 * Tests del modelo User que ejercitan la verificacion de credenciales REAL.
 *
 * Motivo: authController.login delega en User.findByCredentials, que a su vez
 * usa comparePassword (bcrypt real) y el filtro isActive. En el resto de la
 * bateria esos metodos solo aparecen MOCKEADOS (authController.test.js), por lo
 * que la logica de credenciales del sistema no se ejecutaba de verdad en ningun
 * test. Aqui se cubre con bcrypt real y Mongo en memoria: es el corazon del
 * login y una rama de seguridad (cuentas desactivadas no pueden autenticarse).
 *
 * No se mockea nada del codigo bajo prueba: el pre-save hook hashea de verdad,
 * comparePassword corre bcrypt.compare de verdad y generateAuthToken firma un
 * JWT real via jwtService.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const User = require('../../src/models/User');

describe('User - verificacion de credenciales (bcrypt/JWT reales)', () => {
  usarBaseDeDatosEnMemoria();

  const datosBase = () => ({
    email: 'usuario@empresa.es',
    password: 'Password123!',
    name: 'Usuario Test',
    tenantId: new mongoose.Types.ObjectId()
  });

  describe('pre-save hook: hashing', () => {
    test('hashea la password en el alta (no se guarda en claro)', async () => {
      const user = await User.create(datosBase());
      const guardado = await User.findById(user._id).select('+password');

      expect(guardado.password).not.toBe('Password123!');
      expect(guardado.password).toMatch(/^\$2[aby]\$/); // formato bcrypt
    });

    test('NO re-hashea si la password no se modifica en un update', async () => {
      const user = await User.create(datosBase());
      const conHash = await User.findById(user._id).select('+password');
      const hashOriginal = conHash.password;

      conHash.name = 'Nombre Cambiado';
      await conHash.save();

      const trasUpdate = await User.findById(user._id).select('+password');
      expect(trasUpdate.password).toBe(hashOriginal); // mismo hash, no re-hasheado
      expect(trasUpdate.name).toBe('Nombre Cambiado');
    });

    test('re-hashea cuando SI se cambia la password', async () => {
      const user = await User.create(datosBase());
      const conHash = await User.findById(user._id).select('+password');
      const hashOriginal = conHash.password;

      conHash.password = 'OtraPassword456!';
      await conHash.save();

      const trasUpdate = await User.findById(user._id).select('+password');
      expect(trasUpdate.password).not.toBe(hashOriginal);
      expect(await trasUpdate.comparePassword('OtraPassword456!')).toBe(true);
    });
  });

  describe('comparePassword', () => {
    test('devuelve true con la password correcta', async () => {
      await User.create(datosBase());
      const user = await User.findOne({ email: datosBase().email }).select('+password');
      expect(await user.comparePassword('Password123!')).toBe(true);
    });

    test('devuelve false con la password incorrecta', async () => {
      await User.create(datosBase());
      const user = await User.findOne({ email: datosBase().email }).select('+password');
      expect(await user.comparePassword('passwordEquivocada')).toBe(false);
    });
  });

  describe('findByCredentials', () => {
    test('devuelve el usuario con email + password correctos', async () => {
      const creado = await User.create(datosBase());
      const user = await User.findByCredentials('usuario@empresa.es', 'Password123!');
      expect(user).not.toBeNull();
      expect(String(user._id)).toBe(String(creado._id));
    });

    test('devuelve null si el email no existe', async () => {
      await User.create(datosBase());
      const user = await User.findByCredentials('noexiste@empresa.es', 'Password123!');
      expect(user).toBeNull();
    });

    test('devuelve null si la password es incorrecta (bcrypt real)', async () => {
      await User.create(datosBase());
      const user = await User.findByCredentials('usuario@empresa.es', 'malaClave');
      expect(user).toBeNull();
    });

    test('devuelve null para una cuenta desactivada AUNQUE la password sea correcta', async () => {
      await User.create({ ...datosBase(), isActive: false });
      const user = await User.findByCredentials('usuario@empresa.es', 'Password123!');
      // rama de seguridad: el filtro { isActive: true } del query la excluye
      expect(user).toBeNull();
    });
  });

  describe('generateAuthToken / toPublicJSON', () => {
    test('generateAuthToken produce un JWT verificable con el payload esperado', async () => {
      const user = await User.create({ ...datosBase(), role: 'admin' });
      const token = user.generateAuthToken();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // header.payload.signature

      const jwtService = require('../../src/utils/jwtService');
      const decoded = jwtService.verify(token);
      expect(decoded.email).toBe('usuario@empresa.es');
      expect(decoded.role).toBe('admin');
      expect(decoded.tenantId).toBe(String(user.tenantId));
    });

    test('toPublicJSON no expone la password ni el hash', async () => {
      const user = await User.create(datosBase());
      const publico = user.toPublicJSON();
      expect(publico.password).toBeUndefined();
      expect(JSON.stringify(publico)).not.toMatch(/\$2[aby]\$/);
      expect(publico.email).toBe('usuario@empresa.es');
    });
  });
});
