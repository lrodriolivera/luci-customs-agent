/**
 * summaryQueryService — consultas ADDS-JDIT de AEAT (QIntNuCono/Cont/Ubic/
 * DocAsoc/MRN/EORI) + historial y estadísticas.
 *
 * Estas consultas NO estan conectadas con la AEAT. Hasta el 10/Nov/2026 el
 * servicio fabricaba entre 1 y 5 resultados al azar (MRN, canal, levante,
 * declarante «LUCI Demo Company SL») y los devolvia como respuesta de la AEAT.
 * Ahora cada consulta falla con `AEAT_QUERY_NOT_CONNECTED` y no devuelve nada
 * que no se haya obtenido.
 *
 * Modelo `SummaryQuery` real, con Mongo en memoria.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const svc = require('../../src/services/summaryQueryService');
const { SummaryQuery } = require('../../src/models');

usarBaseDeDatosEnMemoria({ limpiarEntreTests: true });

const USER = new mongoose.Types.ObjectId().toString();

const CONSULTAS = [
  ['queryByBillOfLading', 'BL-123', 'QIntNuCono'],
  ['queryByAWB', 'AWB-999', 'QIntNuCono'],
  ['queryByContainer', 'MSKU1234567', 'QIntCont'],
  ['queryByLocation', 'ES002801', 'QIntUbic'],
  ['queryAssociatedDocuments', 'DOC-1', 'QIntDocAsoc'],
  ['queryByMRN', '26ES00280180000014', 'QIntMRN'],
  ['queryByEORI', 'ES12345678A', 'QIntEORI']
];

describe('ninguna consulta inventa resultados', () => {
  test.each(CONSULTAS)('%s falla diciendo que no esta conectada con la AEAT', async (metodo, referencia) => {
    await expect(svc[metodo](referencia, USER)).rejects.toMatchObject({
      code: 'AEAT_QUERY_NOT_CONNECTED',
      message: expect.stringMatching(/no está conectada con la AEAT/)
    });
  });

  test.each(CONSULTAS)('%s deja la consulta registrada como fallida y sin resultados', async (metodo, referencia, tipo) => {
    await svc[metodo](referencia, USER).catch(() => {});

    const doc = await SummaryQuery.findOne({ executedBy: USER });
    expect(doc.queryType).toBe(tipo);
    expect(doc.queryStatus).toBe('failed');
    expect(doc.error.code).toBe('AEAT_QUERY_NOT_CONNECTED');
    expect(doc.results || []).toHaveLength(0);
    expect(doc.resultsCount || 0).toBe(0);
  });

  test('no queda rastro del generador de datos de ejemplo', () => {
    expect(svc._simulateAEATQuery).toBeUndefined();
    expect(svc._generateMRN).toBeUndefined();
  });
});

describe('parámetros que se registran', () => {
  test('el AWB se registra como conocimiento de una ENS', async () => {
    await svc.queryByAWB('AWB-999', USER).catch(() => {});
    const doc = await SummaryQuery.findOne({ executedBy: USER });
    expect(doc.searchParams.billOfLading).toBe('AWB-999');
    expect(doc.searchParams.declarationType).toBe('ENS');
  });

  test('el contenedor se normaliza a mayúsculas', async () => {
    await svc.queryByContainer('msku1234567', USER).catch(() => {});
    const doc = await SummaryQuery.findOne({ executedBy: USER });
    expect(doc.searchParams.containerNumber).toBe('MSKU1234567');
  });
});

describe('validación previa (sin tocar la BD)', () => {
  test('rechaza un contenedor que no cumple ISO 6346', async () => {
    const r = await svc.queryByContainer('MAL', USER);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/ISO 6346/);
    expect(await SummaryQuery.countDocuments()).toBe(0);
  });

  test('rechaza un EORI inválido', async () => {
    const r = await svc.queryByEORI('12', USER);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/EORI/);
    expect(await SummaryQuery.countDocuments()).toBe(0);
  });
});

describe('manejo de error', () => {
  test('si no se puede registrar la consulta, propaga ese error', async () => {
    const spy = jest.spyOn(SummaryQuery.prototype, 'save').mockRejectedValue(new Error('save down'));
    try {
      await expect(svc.queryByMRN('26ES00280180000014', USER)).rejects.toThrow('save down');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('historial y estadísticas', () => {
  test('getQueryHistory devuelve las consultas del usuario paginadas', async () => {
    await svc.queryByMRN('25ESA', USER).catch(() => {});
    await svc.queryByMRN('25ESB', USER).catch(() => {});
    const hist = await svc.getQueryHistory(USER, { limit: 10 });
    expect(hist.queries).toHaveLength(2);
    expect(hist.pagination.total).toBe(2);
  });

  test('getQueryById encuentra la consulta propia y no la de otro usuario', async () => {
    await svc.queryByMRN('25ESC', USER).catch(() => {});
    const { queryId } = await SummaryQuery.findOne({ executedBy: USER });

    expect((await svc.getQueryById(queryId, USER)).data.queryId).toBe(queryId);
    const ajena = await svc.getQueryById(queryId, new mongoose.Types.ObjectId().toString());
    expect(ajena.success).toBe(false);
    expect(ajena.error).toMatch(/no encontrada/);
  });

  test('getQueryStats devuelve agregaciones', async () => {
    await svc.queryByMRN('25ESE', USER).catch(() => {});
    expect(await svc.getQueryStats(USER)).toEqual(expect.any(Object));
  });

  test('getAvailableServices lista los 6 servicios y dice que no están conectados', () => {
    const list = svc.getAvailableServices();
    expect(list).toHaveLength(6);
    expect(list.map(s => s.code)).toEqual(
      expect.arrayContaining(['QIntNuCono', 'QIntCont', 'QIntUbic', 'QIntDocAsoc', 'QIntMRN', 'QIntEORI'])
    );
    list.forEach(s => {
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.available).toBe(false);
    });
  });
});

describe('helpers privados', () => {
  test('_validateContainerNumber acepta formato válido y rechaza cortos', () => {
    expect(svc._validateContainerNumber('MSKU1234567')).toBe(true);
    expect(svc._validateContainerNumber('CORTO')).toBe(false);
    expect(svc._validateContainerNumber('')).toBe(false);
    expect(svc._validateContainerNumber(null)).toBe(false);
  });

  test('_getDateDaysAgo devuelve ISO en el pasado', () => {
    expect(new Date(svc._getDateDaysAgo(7)).getTime()).toBeLessThan(Date.now());
  });
});
