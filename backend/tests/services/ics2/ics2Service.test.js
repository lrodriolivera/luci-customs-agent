/**
 * ICS2 service: enrutamiento por modo y bloqueo mientras la integración no esté habilitada.
 */
const ics2 = require('../../../src/services/ics2/ics2Service');

describe('ics2Service.requiereICS2', () => {
  test('SEA, AIR y ROAD requieren ICS2', () => {
    expect(ics2.requiereICS2('SEA')).toBe(true);
    expect(ics2.requiereICS2('AIR')).toBe(true);
    expect(ics2.requiereICS2('ROAD')).toBe(true);
  });
  test('RAIL NO requiere ICS2 (va por el canal legacy AEAT)', () => {
    expect(ics2.requiereICS2('RAIL')).toBe(false);
  });
  test('es insensible a mayúsculas y tolera vacío', () => {
    expect(ics2.requiereICS2('sea')).toBe(true);
    expect(ics2.requiereICS2(undefined)).toBe(false);
  });
});

describe('ics2Service.submitENSviaICS2 (deshabilitado por defecto)', () => {
  test('devuelve success:false con motivo ICS2, sin fingir envío', async () => {
    const res = await ics2.submitENSviaICS2({ transportMode: 'SEA', reference: 'ENS-1' });
    expect(res.success).toBe(false);
    expect(res.code).toBe('ICS2_NOT_ENABLED');
    expect(res.error).toMatch(/ICS2/i);
  });
});

describe('ics2Service.getBaseUrl', () => {
  test('por defecto apunta al entorno de conformance de la UE', () => {
    expect(ics2.getBaseUrl()).toMatch(/conformance\.customs\.ec\.europa\.eu/);
  });
});
