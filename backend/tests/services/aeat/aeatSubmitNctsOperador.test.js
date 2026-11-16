/**
 * Envío de CC013C / CC014C / CC170C desde aeatSubmitService y predeclaración
 * (CC015C con D). Solo se simula aeatTransport (la red con mTLS); builders e
 * intérprete corren de verdad.
 */
jest.mock('../../../src/services/aeat/aeatTransport');

const fs = require('fs');
const path = require('path');
const aeatTransport = require('../../../src/services/aeat/aeatTransport');
const submit = require('../../../src/services/aeat/aeatSubmitService');

const FIX = path.join(__dirname, '../../fixtures/aeat-consultas/ncts');
const leer = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
const MRN = '26ES002801501441J7';

const AGENTE = {
  name: 'STRIX AI SL',
  businessInfo: { type: 'customs_agent', eori: 'ESB22477020' },
  customsConfig: { eoriNumbers: { ES: 'ESB22477020' } }
};
const ctx = { tenant: AGENTE };

function transito(extra = {}) {
  return {
    lrn: 'LRNMWIXGE5GQA',
    mrn: MRN,
    transitType: 'T1',
    additionalDeclarationType: 'D',
    principal: { name: 'STRIX AI SL', eori: 'ESB22477020', address: { city: 'Madrid', country: 'ES' } },
    departureOffice: { code: 'ES002801' },
    destinationOffice: { code: 'ES002901' },
    guarantee: { type: '1', grn: '26ES0002800000010', accessCode: '0000' },
    authorisationNumber: 'ESACR02026000002',
    locationAuthorisationNumber: '2801AAAAAA',
    goodsItems: [{
      description: 'Ropa de cama', taricCode: '6302100000', grossWeight: 25, netWeight: 20,
      packages: { count: 2, packageType: 'CT' },
      previousDocuments: [{ type: 'N337', reference: '28016000001', goodsItemNumber: '1' }]
    }],
    ...extra
  };
}

const enviado = () => aeatTransport.sendSoap.mock.calls[0][0];
const endpoint = () => aeatTransport.sendSoap.mock.calls[0][1];
const responder = (xml) => aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: xml });

beforeEach(() => {
  delete process.env.AEAT_ENVIRONMENT;
});

describe('submitNCTS: predeclaración', () => {
  test('manda D cuando el tránsito es predeclaración y devuelve el estado NCTS (PA)', async () => {
    responder(leer('respuesta-cc013-ok.xml').replace(/CC013CV1Sal/g, 'CC015CV1Sal').replace('<codigoRespuesta>M</codigoRespuesta>', '<codigoRespuesta>P</codigoRespuesta>'));
    const r = await submit.submitNCTS(transito(), ctx);
    expect(enviado()).toContain('<ent:additionalDeclarationType>D</ent:additionalDeclarationType>');
    expect(r).toMatchObject({ success: true, mrn: MRN, estadoNcts: 'PA' });
  });

  test('sin marca de predeclaración sigue siendo A', async () => {
    responder('<r><tipoRespuesta>OK</tipoRespuesta><MRN>X</MRN></r>');
    const r = await submit.submitNCTS(transito({ additionalDeclarationType: undefined }), ctx);
    expect(enviado()).toContain('<ent:additionalDeclarationType>A</ent:additionalDeclarationType>');
    expect(r.estadoNcts).toBeNull();
  });
});

describe('submitNCTSAmendment (CC013C)', () => {
  test('postea a CC013CV1 con remitente NIF del firmante y la declaración entera', async () => {
    responder(leer('respuesta-cc013-ok.xml'));
    const r = await submit.submitNCTSAmendment(transito({ goodsItems: [{ ...transito().goodsItems[0], description: 'Ropa de cama modificada' }] }), ctx);
    expect(endpoint()).toBe('/wlpl/ADTR-JDIT/ws/ncts5/CC013CV1SOAP');
    expect(enviado()).toContain('<ent:messageSender>B22477020</ent:messageSender>');
    expect(enviado()).toContain(`<ent:MRN>${MRN}</ent:MRN>`);
    expect(enviado()).toContain('Ropa de cama modificada');
    expect(enviado()).toContain('<ent:additionalDeclarationType>D</ent:additionalDeclarationType>');
    expect(r).toMatchObject({ success: true, estado: 'PA', codigoRespuesta: 'M' });
    expect(r.requestXML).toBe(enviado());
  });

  test('sin MRN no sale nada', async () => {
    await expect(submit.submitNCTSAmendment(transito({ mrn: undefined }), ctx)).rejects.toThrow('MRN');
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
  });

  test('sin EORI del tenant firmante: 422 y no sale nada', async () => {
    await expect(submit.submitNCTSAmendment(transito(), { tenant: { name: 'X', businessInfo: { type: 'customs_agent' } } }))
      .rejects.toThrow(/Falta el EORI del representante/);
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
  });
});

describe('submitNCTSInvalidation (CC014C)', () => {
  test('postea a CC014CV1 con motivo, aduana y titular del CC015C', async () => {
    responder(leer('respuesta-cc014-ok.xml'));
    const r = await submit.submitNCTSInvalidation(transito(), { motivo: 'Error en la declaración' }, ctx);
    expect(endpoint()).toBe('/wlpl/ADTR-JDIT/ws/ncts5/CC014CV1SOAP');
    expect(enviado()).toContain('<ent:justification>Error en la declaración</ent:justification>');
    expect(enviado()).toContain('<ent:referenceNumber>ES002801</ent:referenceNumber>');
    expect(enviado()).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    expect(r).toMatchObject({ success: true, estado: 'CA', fechas: { invalidacion: '2026-11-16' } });
  });

  test('rechazo EF: success false con el error de la AEAT', async () => {
    responder(leer('respuesta-cc014-ef.xml'));
    const r = await submit.submitNCTSInvalidation(transito(), { motivo: 'X' }, ctx);
    expect(r).toMatchObject({ success: false, tipo: 'error_funcional' });
    expect(r.error).toContain('Estado del tránsito incorrecto');
  });

  test('sin motivo no sale nada', async () => {
    await expect(submit.submitNCTSInvalidation(transito(), { motivo: '' }, ctx)).rejects.toThrow(/motivo/);
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
  });
});

describe('submitNCTSPresentation (CC170C)', () => {
  test('postea a CC170CV1 con LRN, titular y la ubicación del tránsito', async () => {
    responder(leer('respuesta-cc170-ok.xml'));
    const r = await submit.submitNCTSPresentation(transito(), {}, ctx);
    expect(endpoint()).toBe('/wlpl/ADTR-JDIT/ws/ncts5/CC170CV1SOAP');
    expect(enviado()).toContain('<ent:LRN>LRNMWIXGE5GQA</ent:LRN>');
    expect(enviado()).toContain('<ent:authorisationNumber>2801AAAAAA</ent:authorisationNumber>');
    expect(r).toMatchObject({ success: true, estado: 'PD', channel: 'orange' });
  });

  test('la ubicación indicada al presentar prevalece sobre la del tránsito', async () => {
    responder(leer('respuesta-cc170-ok.xml'));
    await submit.submitNCTSPresentation(transito(), { locationAuthorisationNumber: '2801AAAAAC' }, ctx);
    expect(enviado()).toContain('<ent:authorisationNumber>2801AAAAAC</ent:authorisationNumber>');
  });

  test('en producción no se inventa la ubicación de PRE', async () => {
    process.env.AEAT_ENVIRONMENT = 'production';
    await expect(submit.submitNCTSPresentation(transito({ locationAuthorisationNumber: '' }), {}, ctx)).rejects.toThrow(/ubicación/);
    expect(aeatTransport.sendSoap).not.toHaveBeenCalled();
  });
});
