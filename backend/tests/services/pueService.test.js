/**
 * pueService: gestion de controles PUE (ROHS/COM/ECO/CAL) ante SOIVRE.
 *
 * El servicio mezcla logica pura (validaciones, tablas TARIC->control, catalogos
 * SOIVRE) con escrituras a Mongo y envios a AEAT. Aqui se prueba SOLO la parte
 * pura y las simulaciones deterministas: son las tablas que deciden que control
 * exige una mercancia, que documentos pide y a que oficina va. Un error aqui
 * clasifica mal un textil o un aparato electrico y bloquea (o cuela) la
 * importacion en el Punto Unico de Entrada.
 *
 * NO se mockea el servicio bajo prueba. El require('../models') de la cabecera
 * se mockea solo para que el modulo cargue sin conexion a Mongo; ninguna de las
 * funciones probadas toca el modelo.
 */

jest.mock('../../src/models', () => ({ PUERequest: {} }));

const pueService = require('../../src/services/pueService');

describe('preValidate', () => {
  const base = {
    pueType: 'ROHS',
    operator: { name: 'Importadora SL' },
    goods: [{ taricCode: '85171200' }]
  };

  test('una solicitud minima bien formada es valida y sin errores', async () => {
    const r = await pueService.preValidate(base);

    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  test('un tipo PUE inexistente es un error de campo pueType', async () => {
    const r = await pueService.preValidate({ ...base, pueType: 'XXX' });

    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.field === 'pueType' && e.code === 'PUE_INVALID_TYPE')).toBe(true);
  });

  test('falta el nombre del operador -> error obligatorio', async () => {
    const r = await pueService.preValidate({ ...base, operator: {} });

    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.code === 'PUE_OPERATOR_NAME_REQUIRED')).toBe(true);
  });

  test('sin mercancias -> error PUE_GOODS_REQUIRED', async () => {
    const r = await pueService.preValidate({ ...base, goods: [] });

    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.code === 'PUE_GOODS_REQUIRED')).toBe(true);
  });

  test('un TARIC atipico para el tipo genera warning, no error (sigue siendo valida)', async () => {
    // 0901 (cafe) no esta en la lista ROHS.
    const r = await pueService.preValidate({ ...base, goods: [{ taricCode: '09012100' }] });

    expect(r.valid).toBe(true);
    expect(r.warnings.some(w => w.code === 'PUE_TARIC_NOT_TYPICAL')).toBe(true);
  });

  test('un TARIC tipico del tipo no genera warning', async () => {
    // 8517 esta en la lista ROHS.
    const r = await pueService.preValidate({ ...base, goods: [{ taricCode: '85171200' }] });

    expect(r.warnings).toHaveLength(0);
  });

  test('acumula varios errores a la vez', async () => {
    const r = await pueService.preValidate({});

    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('getRequiredPUE', () => {
  test('un aparato electrico (cap. 85) exige control ROHS del SOIVRE', () => {
    const r = pueService.getRequiredPUE([{ taricCode: '85171200' }]);

    expect(r.count).toBe(1);
    expect(r.types).toContain('ROHS');
    expect(r.required[0].authority).toBe('SOIVRE');
  });

  test('sin coincidencia TARIC no exige ningun control', () => {
    const r = pueService.getRequiredPUE([{ taricCode: '99999999' }]);

    expect(r.count).toBe(0);
    expect(r.required).toHaveLength(0);
  });

  test('dos mercancias del mismo tipo agrupan sus TARIC bajo un unico control', () => {
    const r = pueService.getRequiredPUE([{ taricCode: '85171200' }, { taricCode: '85285200' }]);

    const rohs = r.required.find(x => x.type === 'ROHS');
    expect(r.count).toBe(1);
    expect(rohs.taricCodes).toEqual(expect.arrayContaining(['85171200', '85285200']));
  });

  test('un textil (cap. 62) cae en ECO y CAL a la vez (solape de catalogo)', () => {
    // Decision de negocio ya fijada: capitulos textiles estan en dos listas.
    const r = pueService.getRequiredPUE([{ taricCode: '62011100' }]);

    expect(r.types).toEqual(expect.arrayContaining(['ECO', 'CAL']));
  });

  test('una mercancia sin taricCode no rompe', () => {
    const r = pueService.getRequiredPUE([{}]);
    expect(r.count).toBe(0);
  });
});

describe('checkTaricCodes', () => {
  test('marca requiresPUE true y lista los controles de un TARIC controlado', () => {
    const [res] = pueService.checkTaricCodes(['85171200']);

    expect(res.requiresPUE).toBe(true);
    expect(res.controls.some(c => c.type === 'ROHS')).toBe(true);
  });

  test('un TARIC sin control marca requiresPUE false', () => {
    const [res] = pueService.checkTaricCodes(['99999999']);

    expect(res.requiresPUE).toBe(false);
    expect(res.controls).toHaveLength(0);
  });

  test('procesa varios codigos y devuelve uno por entrada', () => {
    const res = pueService.checkTaricCodes(['85171200', '99999999']);
    expect(res).toHaveLength(2);
  });
});

describe('getSoivreOffices', () => {
  test('sin provincia devuelve todas las oficinas', () => {
    const all = pueService.getSoivreOffices();
    expect(all.length).toBeGreaterThan(20);
    expect(all[0]).toHaveProperty('code');
  });

  test('filtra por provincia (insensible a mayusculas)', () => {
    const madrid = pueService.getSoivreOffices('madrid');

    expect(madrid).toHaveLength(1);
    expect(madrid[0].province).toBe('Madrid');
  });

  test('una provincia inexistente devuelve lista vacia', () => {
    expect(pueService.getSoivreOffices('Narnia')).toEqual([]);
  });
});

describe('getTypes / getRequiredDocuments / getInfo', () => {
  test('getTypes devuelve los 4 tipos PUE con su codigo', () => {
    const types = pueService.getTypes();

    expect(types).toHaveLength(4);
    expect(types.map(t => t.code)).toEqual(expect.arrayContaining(['ROHS', 'COM', 'ECO', 'CAL']));
  });

  test('getRequiredDocuments devuelve la lista del tipo pedido', () => {
    const docs = pueService.getRequiredDocuments('ROHS');

    expect(docs.some(d => d.code === 'CERT_ROHS' && d.required === true)).toBe(true);
  });

  test('getRequiredDocuments de un tipo inexistente devuelve lista vacia', () => {
    expect(pueService.getRequiredDocuments('XXX')).toEqual([]);
  });

  test('getInfo describe el servicio en modo simulacion con los 4 tipos', () => {
    const info = pueService.getInfo();

    expect(info.simulationMode).toBe(true); // PUE_ENVIRONMENT no es production en test
    expect(info.types).toEqual(expect.arrayContaining(['ROHS', 'COM', 'ECO', 'CAL']));
    expect(info.offices).toBeGreaterThan(20);
  });
});

describe('catalogos SOIVRE', () => {
  test('getAllCatalogs agrupa todos los catalogos de carga inicial', () => {
    const c = pueService.getAllCatalogs();

    expect(c).toHaveProperty('soivreSpecificities');
    expect(c).toHaveProperty('certificateTypes');
    expect(c).toHaveProperty('inspectionPoints');
    expect(Array.isArray(c.merchandiseUnits)).toBe(true);
  });

  test('getSpecificities devuelve la lista SOIVRE o ROHS_RAEE segun el flujo', () => {
    expect(pueService.getSpecificities('SOIVRE').length).toBeGreaterThan(0);
    expect(pueService.getSpecificities('ROHS_RAEE').length).toBeGreaterThan(0);
  });

  test('getSpecificities de un flujo desconocido devuelve lista vacia', () => {
    expect(pueService.getSpecificities('OTRO')).toEqual([]);
  });

  test('getInspectionPoints devuelve los puntos de un centro conocido', () => {
    const pts = pueService.getInspectionPoints('11');
    expect(Array.isArray(pts)).toBe(true);
  });

  test('getInspectionPoints de un centro inexistente devuelve lista vacia', () => {
    expect(pueService.getInspectionPoints('9999')).toEqual([]);
  });

  test('getCertificateTypes, getMerchandiseUnits y getSoivreCenters devuelven catalogos', () => {
    expect(pueService.getCertificateTypes()).toBeDefined();
    expect(pueService.getMerchandiseUnits()).toBeDefined();
    expect(pueService.getSoivreCenters()).toBeDefined();
  });
});

describe('_simulateRIIValidation (determinista por NIF)', () => {
  test('un NIF cuyo hash no es multiplo de 3 aparece registrado con ambos RII', () => {
    const r = pueService._simulateRIIValidation('A00000000');

    expect(r.found).toBe(true);
    expect(r.status).toBe('ACTIVO');
    expect(r.riiRaee).toMatch(/^RAEE-/);
    expect(r.riiPya).toMatch(/^PYA-/);
  });

  test('un NIF cuyo hash es multiplo de 3 no esta registrado', () => {
    const r = pueService._simulateRIIValidation('B22477020');

    expect(r.found).toBe(false);
    expect(r.status).toBe('NO_REGISTRADO');
    expect(r.riiRaee).toBeNull();
  });
});

describe('_simulateStatusQuery', () => {
  test('avanza el estado al siguiente de la maquina de estados', () => {
    const r = pueService._simulateStatusQuery({
      reference: 'PUE-1', pueReference: 'PUE2026ROHSAB', status: 'registered', deadline: null
    });

    expect(r.currentStatus).toBe('registered');
    expect(r.nextStatus).toBe('pending_documents');
  });

  test('en el ultimo estado (approved) no avanza mas', () => {
    const r = pueService._simulateStatusQuery({
      reference: 'PUE-2', pueReference: 'X', status: 'approved', deadline: null
    });

    expect(r.nextStatus).toBe('approved');
  });

  test('un estado fuera de la maquina cae al primer estado conocido', () => {
    // indexOf -> -1, min(-1+1, ...) = 0 -> 'registered'
    const r = pueService._simulateStatusQuery({
      reference: 'PUE-3', pueReference: 'X', status: 'draft', deadline: null
    });

    expect(r.nextStatus).toBe('registered');
  });
});

describe('_simulateAEATSubmission', () => {
  test('devuelve siempre una referencia PUE y un codigo de admision valido', () => {
    const r = pueService._simulateAEATSubmission({ pueType: 'ROHS' });

    expect(r.success).toBe(true);
    expect(r.pueReference).toMatch(/^PUE\d{4}ROHS/);
    expect(['PUE_INSPECTION_REQUIRED', 'PUE_ACCEPTED']).toContain(r.code);
    expect(typeof r.correlationId).toBe('string');
  });
});
