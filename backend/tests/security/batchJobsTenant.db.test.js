/**
 * Ataque (barrido F4/F9): batchProcessor guarda los jobs en un Map global con id
 * predecible por tenant. getJobStatus/getJobDetail/cancelJob buscaban solo por
 * jobId, así que un tenant con el id de otro podía leer su detalle o cancelarlo.
 * Ahora la búsqueda es por jobId Y organizationId; fuera de ámbito = como si no existiera.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const batchProcessor = require('../../src/services/workflow/batchProcessor');
const { workflowEvents } = require('../../src/services/workflow/eventEmitter');

usarBaseDeDatosEnMemoria();

let emitSpy;
beforeEach(() => {
  emitSpy = jest.spyOn(workflowEvents, 'emitWorkflowEvent').mockImplementation(() => {});
});
afterEach(() => emitSpy.mockRestore());

const id = () => new mongoose.Types.ObjectId();
const item = () => ({
  client: { companyName: 'ACME SL', nif: 'B12345678' },
  goods: [{ description: 'Portatil', quantity: 1, taricCode: '84713000' }],
  originCountry: 'CN'
});

describe('batchProcessor: jobs acotados por organización', () => {
  let orgA, orgB, jobA;
  beforeEach(async () => {
    orgA = id();
    orgB = id();
    jobA = await batchProcessor.createBatchJob(orgA, id(), [item()]);
  });

  test('el propietario ve su job (estado y detalle) con organizationId como ObjectId o string', () => {
    expect(batchProcessor.getJobStatus(jobA.id, orgA).id).toBe(jobA.id);
    expect(batchProcessor.getJobStatus(jobA.id, String(orgA)).id).toBe(jobA.id);
    expect(batchProcessor.getJobDetail(jobA.id, orgA)).toBe(jobA);
  });

  test('otro tenant no ve el estado del job', () => {
    expect(batchProcessor.getJobStatus(jobA.id, orgB)).toBeNull();
  });

  test('otro tenant no obtiene el detalle del job', () => {
    expect(batchProcessor.getJobDetail(jobA.id, orgB)).toBeUndefined();
  });

  test('otro tenant no puede cancelar el job y este sigue pendiente', () => {
    expect(() => batchProcessor.cancelJob(jobA.id, orgB)).toThrow(/not found/i);
    expect(jobA.status).toBe('pending');
    expect(jobA.completedAt).toBeFalsy();
  });

  test('sin organizationId no se resuelve ningún job (falla cerrado)', () => {
    expect(batchProcessor.getJobStatus(jobA.id)).toBeNull();
    expect(batchProcessor.getJobDetail(jobA.id, null)).toBeUndefined();
    expect(() => batchProcessor.cancelJob(jobA.id, undefined)).toThrow(/not found/i);
    expect(jobA.status).toBe('pending');
  });

  test('el propietario sí puede cancelar su job', () => {
    expect(batchProcessor.cancelJob(jobA.id, orgA).status).toBe('cancelled');
  });
});
