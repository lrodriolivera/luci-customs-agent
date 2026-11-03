/**
 * Ningun listado de PUE, plazos, inspecciones, comunicaciones al inspector o
 * chat se ejecuta sin tenantId en el filtro.
 *
 * Los listados y calendarios de esos modelos se construian sin tenant y
 * devolvian los datos de todos los clientes (hallazgos F7, F9-F13 y F15-F17 del
 * escaneo del 3/Nov/2026). El plugin utils/tenantListGuard hace que un find,
 * countDocuments, distinct o aggregate sin tenantId en el filtro FALLE en vez
 * de devolver datos de otros tenants. Los usos legitimos sin tenant (un cron
 * interno, un super_admin) tienen que decirlo explicitamente con la opcion
 * sinTenant y un motivo.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { PUERequest, Deadline, Inspection, InspectorCommunication, ChatMessage } = require('../../src/models');

usarBaseDeDatosEnMemoria();

const MODELOS = [
  ['PUERequest', PUERequest],
  ['Deadline', Deadline],
  ['Inspection', Inspection],
  ['InspectorCommunication', InspectorCommunication],
  ['ChatMessage', ChatMessage]
];

const TENANT = new mongoose.Types.ObjectId();

describe.each(MODELOS)('%s: guard de listados por tenant', (_nombre, Modelo) => {
  test('find sin tenantId falla', async () => {
    await expect(Modelo.find({ active: true })).rejects.toThrow(/tenantId/);
  });

  test('countDocuments sin tenantId falla', async () => {
    await expect(Modelo.countDocuments({})).rejects.toThrow(/tenantId/);
  });

  test('aggregate sin $match de tenantId al principio falla', async () => {
    await expect(Modelo.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }])).rejects.toThrow(/tenantId/);
  });

  test('distinct sin tenantId falla', async () => {
    await expect(Modelo.distinct('status', {})).rejects.toThrow(/tenantId/);
  });

  test('con tenantId en el filtro (directo o en $and) funciona', async () => {
    await expect(Modelo.find({ tenantId: TENANT })).resolves.toEqual([]);
    await expect(Modelo.find({ $and: [{ tenantId: TENANT }, { active: true }] })).resolves.toEqual([]);
    await expect(Modelo.countDocuments({ tenantId: TENANT })).resolves.toBe(0);
    await expect(Modelo.aggregate([{ $match: { tenantId: TENANT } }, { $count: 'n' }])).resolves.toEqual([]);
  });

  test('sinTenant con motivo deja pasar un listado deliberado sin tenant', async () => {
    await expect(Modelo.find({}).setOptions({ sinTenant: 'test: listado global deliberado' })).resolves.toEqual([]);
    await expect(Modelo.aggregate([{ $count: 'n' }]).option({ sinTenant: 'test' })).resolves.toEqual([]);
  });

  test('sinTenant sin motivo (true) no basta', async () => {
    await expect(Modelo.find({}).setOptions({ sinTenant: true })).rejects.toThrow(/tenantId/);
  });

  test('los accesos por id no los bloquea el guard (los cubre ensureSameTenant)', async () => {
    await expect(Modelo.findById(new mongoose.Types.ObjectId())).resolves.toBeNull();
  });
});
