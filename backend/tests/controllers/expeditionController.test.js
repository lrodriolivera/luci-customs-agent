/**
 * Tests para expeditionController (estaba al 0%).
 *
 * Las expediciones son el objeto central del producto y el listado es donde se
 * decide QUE VE CADA USUARIO. El foco esta en el aislamiento por tenant y por
 * rol: un fallo ahi enseña datos de un cliente a otro.
 */

const request = require('supertest');
const express = require('express');

const mockFind = jest.fn();
const mockCountDocuments = jest.fn().mockResolvedValue(0);

jest.mock('../../src/models', () => ({
  Expedition: {
    find: (...a) => mockFind(...a),
    countDocuments: (...a) => mockCountDocuments(...a),
    findOne: jest.fn()
  },
  ChatMessage: { find: jest.fn() }
}));
jest.mock('../../src/services/emailService', () => ({ sendEmail: jest.fn() }));
jest.mock('../../src/services/aiService', () => ({}));

const expeditionController = require('../../src/controllers/expeditionController');

/** find() devuelve un query encadenable; se captura el filtro que recibe. */
function mockChain(resultado = []) {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resultado)
  };
  mockFind.mockReturnValue(chain);
  return chain;
}

/** Monta la app con el usuario indicado ya inyectado. */
function appConUsuario(user) {
  const app = express();
  app.use(express.json());
  app.get('/api/expeditions', (req, _res, next) => { req.user = user; next(); }, expeditionController.list);
  return app;
}

const ADMIN = { _id: 'admin1', role: 'admin', tenantId: 't1' };
const OPERADOR = { _id: 'user1', role: 'user', tenantId: 't1' };

/** Filtro con el que se llamo a Expedition.find(). */
const filtro = () => mockFind.mock.calls[0][0];

describe('expeditionController.list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountDocuments.mockResolvedValue(0);
    mockChain();
  });

  describe('aislamiento por tenant', () => {
    test('SIEMPRE filtra por el tenant del usuario', async () => {
      await request(appConUsuario(ADMIN)).get('/api/expeditions');
      expect(filtro().tenantId).toBe('t1');
    });

    test('un admin de otro tenant no puede ver el primero', async () => {
      await request(appConUsuario({ ...ADMIN, tenantId: 't2' })).get('/api/expeditions');
      expect(filtro().tenantId).toBe('t2');
    });

    test('el tenantId no se puede sobrescribir por query string', async () => {
      // Un cliente malicioso podria intentar ?tenantId=otro.
      await request(appConUsuario(OPERADOR)).get('/api/expeditions?tenantId=t999');
      expect(filtro().tenantId).toBe('t1');
    });
  });

  describe('visibilidad por rol', () => {
    test('el admin ve todas las del tenant, sin restriccion por usuario', async () => {
      await request(appConUsuario(ADMIN)).get('/api/expeditions');
      expect(filtro().$and).toBeUndefined();
      expect(filtro().$or).toBeUndefined();
    });

    test('un operador solo ve las suyas (asignadas o creadas)', async () => {
      await request(appConUsuario(OPERADOR)).get('/api/expeditions');
      expect(filtro().$and[0].$or).toEqual([
        { assignedTo: 'user1' },
        { createdBy: 'user1' }
      ]);
    });
  });

  describe('filtros', () => {
    test('status admite varios valores separados por coma', async () => {
      await request(appConUsuario(ADMIN)).get('/api/expeditions?status=draft,levante');
      expect(filtro().status).toEqual({ $in: ['draft', 'levante'] });
    });

    test('operationType y transportMode se aplican tal cual', async () => {
      await request(appConUsuario(ADMIN)).get('/api/expeditions?operationType=import&transportMode=air');
      expect(filtro().operationType).toBe('import');
      expect(filtro().transportMode).toBe('air');
    });

    test('search busca por id, empresa, NIF y referencia (admin)', async () => {
      await request(appConUsuario(ADMIN)).get('/api/expeditions?search=ACME');
      const campos = filtro().$and[0].$or.map(c => Object.keys(c)[0]);
      expect(campos).toEqual(['expeditionId', 'client.companyName', 'client.nif', 'clientReference']);
    });

    // Regresion: search y la restriccion por rol usaban ambos query.$or y la
    // segunda pisaba a la primera, asi que para un no-admin el texto buscado
    // se ignoraba y el listado devolvia todas sus expediciones.
    test('un no-admin conserva la busqueda Y la restriccion por rol', async () => {
      await request(appConUsuario(OPERADOR)).get('/api/expeditions?search=ACME');

      const [busqueda, porRol] = filtro().$and;
      // JSON.stringify serializa un RegExp como {}, hay que mirar el source.
      expect(busqueda.$or[0].expeditionId.source).toBe('ACME');
      expect(busqueda.$or).toHaveLength(4);
      expect(porRol.$or).toEqual([{ assignedTo: 'user1' }, { createdBy: 'user1' }]);
      expect(filtro().tenantId).toBe('t1');
    });

    test('sin search, un no-admin solo lleva la condicion de rol', async () => {
      await request(appConUsuario(OPERADOR)).get('/api/expeditions');
      expect(filtro().$and).toHaveLength(1);
      expect(filtro().$and[0].$or[0]).toEqual({ assignedTo: 'user1' });
    });

    test('un admin sin search no genera $and vacio', async () => {
      // Un $and: [] hace que Mongo lance error, asi que solo debe aparecer
      // cuando hay al menos una condicion.
      await request(appConUsuario(ADMIN)).get('/api/expeditions');
      expect(filtro().$and).toBeUndefined();
    });
  });

  describe('paginacion y orden', () => {
    test('por defecto pagina 1 con 20 elementos', async () => {
      const chain = mockChain();
      await request(appConUsuario(ADMIN)).get('/api/expeditions');
      expect(chain.skip).toHaveBeenCalledWith(0);
      expect(chain.limit).toHaveBeenCalledWith(20);
    });

    test('calcula el offset a partir de la pagina', async () => {
      const chain = mockChain();
      await request(appConUsuario(ADMIN)).get('/api/expeditions?page=3&limit=10');
      expect(chain.skip).toHaveBeenCalledWith(20);
      expect(chain.limit).toHaveBeenCalledWith(10);
    });

    test('ordena por createdAt descendente por defecto', async () => {
      const chain = mockChain();
      await request(appConUsuario(ADMIN)).get('/api/expeditions');
      expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    test('respeta sortBy y sortOrder', async () => {
      const chain = mockChain();
      await request(appConUsuario(ADMIN)).get('/api/expeditions?sortBy=status&sortOrder=asc');
      expect(chain.sort).toHaveBeenCalledWith({ status: 1 });
    });
  });

  describe('errores', () => {
    test('responde 500 sin filtrar el detalle interno', async () => {
      mockFind.mockImplementation(() => { throw new Error('ECONNREFUSED mongo:27017'); });

      const res = await request(appConUsuario(ADMIN)).get('/api/expeditions');

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|mongo:/);
    });
  });
});
