/**
 * Propiedad en el resto de services.
 *
 * Cierra el patron ya aplicado en guarantee, oea y pue: las escrituras pasaban
 * el id directo al servicio, que hacia findById sin mirar de quien era el
 * documento. Con el id de un regimen especial, una comunicacion con el
 * inspector, una ENS, un H7 o un control paraduanero ajeno se podia operar
 * sobre el (enviarlo a AEAT, cancelarlo, archivarlo...).
 */

const mockRegime = { findById: jest.fn() };
const mockComm = { findById: jest.fn() };
const mockENS = { findById: jest.fn() };
const mockControl = { findById: jest.fn() };

// Sin { virtual: true }: esos modulos SI existen, y con esa opcion jest no
// sustituia el real. En CI el mock no se aplicaba y las llamadas llegaban a
// Mongoose, que esperaba los 5s de bufferTimeoutMS y fallaba con otro error.
jest.mock('../../src/models/SpecialRegime', () => mockRegime);
jest.mock('../../src/models/InspectorCommunication', () => mockComm);
jest.mock('../../src/models/ENSDeclaration', () => mockENS);
jest.mock('../../src/models/ParaduaneroControl', () => mockControl);
jest.mock('../../src/models', () => ({
  SpecialRegime: mockRegime,
  InspectorCommunication: mockComm,
  ENSDeclaration: mockENS,
  ParaduaneroControl: mockControl,
  Expedition: { findById: jest.fn() },
  Guarantee: { findById: jest.fn() },
  OEA: { findById: jest.fn() }
}));

const ID_VALIDO = '6a5769e0b11d798e7e783602';
const DUEÑO = '6a5769e0b11d798e7e783607';
const OTRO = '6a5769e0b11d798e7e783699';

/** Documento base con el campo de propiedad indicado. */
function doc(campo, valor = DUEÑO, extra = {}) {
  return {
    _id: ID_VALIDO,
    [campo]: valor,
    status: 'draft',
    statusHistory: [],
    timeline: [],
    messages: [],
    addTimelineEvent: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
    ...extra
  };
}

describe('specialRegimeService', () => {
  const svc = require('../../src/services/specialRegimeService');
  beforeEach(() => jest.clearAllMocks());

  test('un tercero no puede activar un regimen ajeno', async () => {
    const d = doc('owner', DUEÑO, { status: 'authorized' });
    mockRegime.findById.mockResolvedValue(d);

    await expect(svc.activate(ID_VALIDO, {}, OTRO)).rejects.toThrow('Regimen no encontrado');
    expect(d.save).not.toHaveBeenCalled();
  });

  test('el error no distingue ajeno de inexistente', async () => {
    mockRegime.findById.mockResolvedValue(doc('owner'));
    const ajeno = svc.activate(ID_VALIDO, {}, OTRO);

    mockRegime.findById.mockResolvedValue(null);
    const inexistente = svc.activate('6a5769e0b11d798e7e7836aa', {}, DUEÑO);

    await expect(ajeno).rejects.toThrow('Regimen no encontrado');
    await expect(inexistente).rejects.toThrow('Regimen no encontrado');
  });
});

describe('inspectorCommunicationService', () => {
  const svc = require('../../src/services/inspectorCommunicationService');
  beforeEach(() => jest.clearAllMocks());

  test('un tercero no puede anadir mensajes a una comunicacion ajena', async () => {
    // Las comunicaciones con el inspector son parte del expediente aduanero.
    const d = doc('createdBy');
    mockComm.findById.mockResolvedValue(d);

    await expect(svc.addMessage(ID_VALIDO, { text: 'x' }, OTRO))
      .rejects.toThrow('Comunicación no encontrada');
    expect(d.save).not.toHaveBeenCalled();
  });
});

describe('ensService', () => {
  const svc = require('../../src/services/ensService');
  beforeEach(() => jest.clearAllMocks());

  test('un tercero no puede enviar a AEAT una ENS ajena', async () => {
    const d = doc('createdBy', DUEÑO, { status: 'draft' });
    mockENS.findById.mockResolvedValue(d);

    await expect(svc.submitToAEAT(ID_VALIDO, OTRO)).rejects.toThrow('Declaracion no encontrada');
    expect(d.save).not.toHaveBeenCalled();
  });

  test('un tercero no puede cancelarla', async () => {
    const d = doc('createdBy', DUEÑO, { status: 'submitted' });
    mockENS.findById.mockResolvedValue(d);

    await expect(svc.cancelDeclaration(ID_VALIDO, 'motivo', OTRO))
      .rejects.toThrow('Declaracion no encontrada');
    expect(d.save).not.toHaveBeenCalled();
  });
});

describe('paraduaneroService', () => {
  const svc = require('../../src/services/paraduaneroService');
  beforeEach(() => jest.clearAllMocks());

  test('un tercero no puede emitir el certificado de un control ajeno', async () => {
    const d = doc('createdBy');
    mockControl.findById.mockResolvedValue(d);

    await expect(svc.issueCertificate(ID_VALIDO, {}, OTRO)).rejects.toThrow('Control no encontrado');
    expect(d.save).not.toHaveBeenCalled();
  });

  test('sin userId (job interno) no se comprueba la propiedad', async () => {
    // Los procesos automaticos no actuan en nombre de nadie.
    // status 'approved': emitir certificado exige control aprobado.
    const d = doc('createdBy', DUEÑO, { status: 'approved' });
    mockControl.findById.mockResolvedValue(d);

    await expect(svc.issueCertificate(ID_VALIDO, {}, undefined)).resolves.toBeDefined();
  });

  test('un control legacy sin createdBy sigue accesible', async () => {
    const d = doc('createdBy', DUEÑO, { status: 'approved' });
    delete d.createdBy;   // legacy: el campo no existe
    mockControl.findById.mockResolvedValue(d);

    await expect(svc.issueCertificate(ID_VALIDO, {}, OTRO)).resolves.toBeDefined();
  });
});
