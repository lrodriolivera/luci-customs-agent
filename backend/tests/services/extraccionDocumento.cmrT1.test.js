/**
 * Lectura de un CMR, de un documento de acompañamiento de tránsito (T1) y de
 * la bandera de un BL, con salidas de la IA SIMULADAS (no se llama a la IA).
 *
 * Los datos son los de los ejemplos sintéticos de
 * tests/fixtures/documentos/ (EJEMPLO / SPECIMEN, ficticios): un camión turco
 * que entra en la UE por Bulgaria al amparo de un T1 con destino Madrid.
 *
 * Origen: UAT 17/Nov/2026. La agente escribía a mano la nacionalidad del
 * medio de transporte del H1 y pidió probar con CMR y T1.
 */
const {
  normalizarExtraccion, proponerCambios, rellenarHuecosH1, SYSTEM_PROMPT
} = require('../../src/services/documentos/extraccionDocumento');

const LECTURA_CMR = {
  legible: true, tipoDetectado: 'cmr', confianza: 90, notas: [],
  exportador: { nombre: 'EJEMPLO TEKSTIL SANAYI A.S. (SPECIMEN)', direccion: 'Organize Sanayi Bolgesi 12. Cadde No 4', ciudad: 'Istanbul', codigoPostal: '34555', pais: 'TR' },
  importador: { nombre: 'DISTRIBUCIONES EJEMPLO SL (SPECIMEN)', direccion: 'Calle Ficticia 1', ciudad: 'Madrid', codigoPostal: '28001', pais: 'ES' },
  factura: { numero: 'INV-EJ-2026-118', fecha: '10/11/2026', moneda: null, importeTotal: 18450, incoterm: 'DAP', lugarIncoterm: 'Madrid' },
  transporte: {
    numeroDocumento: 'EJ-CMR-000118', medio: '34 ABC 123', remolque: '34 XYZ 98', nacionalidadMedio: 'TR',
    puertoCarga: 'Istanbul (TR), 10/11/2026', puertoDescarga: 'Madrid (ES)', contenedores: [], precintos: []
  },
  partidas: [{ descripcion: 'Camisetas de algodon de punto', codigoMercancia: '610910', bultos: 22, tipoBulto: 'PALLETS', pesoBrutoKg: 4380 }],
  totales: { bultos: 22, pesoBrutoKg: 4380 }
};

const LECTURA_T1 = {
  legible: true, tipoDetectado: 'transit_document', confianza: 88, notas: [],
  exportador: { nombre: 'EJEMPLO TEKSTIL SANAYI A.S. (SPECIMEN)', ciudad: 'Istanbul', pais: 'TR' },
  importador: { nombre: 'DISTRIBUCIONES EJEMPLO SL (SPECIMEN)', ciudad: 'Madrid', pais: 'ES' },
  factura: { numero: 'INV-EJ-2026-118', importeTotal: 18450 },
  transporte: {
    numeroDocumento: null, medio: '34ABC123', nacionalidadMedio: 'TR',
    contenedores: [], precintos: ['EJ0001', 'EJ0002']
  },
  transito: { mrn: '26BG009999000001J8', oficinaPartida: 'bg009999', oficinaDestino: 'ES009999', garantia: '26BG0000000000EJ1' },
  partidas: [{ descripcion: 'Camisetas de algodon de punto', codigoMercancia: '6109.10', bultos: 22, tipoBulto: 'PX', pesoBrutoKg: 4380, pesoNetoKg: 4100 }],
  totales: { bultos: 22, pesoBrutoKg: 4380, pesoNetoKg: 4100 }
};

const LECTURA_BL_CON_BANDERA = {
  legible: true, tipoDetectado: 'bill_of_lading', confianza: 90, notas: [],
  transporte: { numeroDocumento: 'EJBL0001', medio: 'CMA CGM EJEMPLO', nacionalidadMedio: 'pa', imo: 'IMO 9839284', contenedores: [] },
  partidas: [], totales: {}
};

const expediente = (extra = {}) => ({
  transportMode: 'road',
  goods: [{ description: 'Camisetas', taricCode: '6109100010', packages: {} }],
  transport: {}, incoterm: {}, exporter: {},
  ...extra
});

// Imita lo que usa del documento Mongoose: set y get por ruta con puntos.
const conSet = (exp) => Object.assign(exp, {
  set(ruta, valor) {
    const partes = ruta.split('.');
    let nodo = this;
    partes.slice(0, -1).forEach((p) => { if (nodo[p] === undefined || nodo[p] === null) nodo[p] = {}; nodo = nodo[p]; });
    nodo[partes[partes.length - 1]] = valor;
  },
  get(ruta) { return ruta.split('.').reduce((nodo, p) => (nodo == null ? undefined : nodo[p]), this); }
});
const claves = (cambios) => cambios.map(c => c.clave);

describe('lectura de un CMR', () => {
  test('el medio es la matricula de la tractora, la nacionalidad la de su matricula y el remolque va a las notas', () => {
    const d = normalizarExtraccion(LECTURA_CMR);

    expect(d.transporte).toMatchObject({ numeroDocumento: 'EJ-CMR-000118', medio: '34 ABC 123', nacionalidadMedio: 'TR', remolque: '34 XYZ 98' });
    expect(d.notas).toContain('Remolque o semirremolque: 34 XYZ 98.');
  });

  test('un CMR no es una factura: ni numero, ni fecha ni importe de factura', () => {
    const d = normalizarExtraccion(LECTURA_CMR);

    expect(d.factura).toMatchObject({ numero: null, fecha: null, importeTotal: null, incoterm: 'DAP' });
    expect(d.partidas[0]).toMatchObject({ codigoMercancia: '610910', bultos: 22, tipoBulto: 'PX', pesoBrutoKg: 4380, importe: null });
  });

  test('el signo distintivo de la matricula se pasa a ISO y se avisa de la conversion', () => {
    const nacionalidad = (valor) => normalizarExtraccion({ tipoDetectado: 'cmr', transporte: { nacionalidadMedio: valor } });

    expect(nacionalidad('E').transporte.nacionalidadMedio).toBe('ES');
    expect(nacionalidad('UK').transporte.nacionalidadMedio).toBe('GB');
    expect(nacionalidad('D').transporte.nacionalidadMedio).toBe('DE');
    expect(nacionalidad('SLO').transporte.nacionalidadMedio).toBe('SI');
    expect(nacionalidad('pl').transporte.nacionalidadMedio).toBe('PL');
    expect(nacionalidad('E').notas.some(n => n.includes('«E»') && n.includes('ES'))).toBe(true);
    // Lo que no es ni un codigo ISO ni un signo conocido no se convierte.
    expect(nacionalidad('XYZ').transporte.nacionalidadMedio).toBeNull();
    expect(nacionalidad('Turquia').transporte.nacionalidadMedio).toBeNull();
  });

  test('propone la nacionalidad y, en un expediente por carretera, rellena el hueco del H1', () => {
    const exp = conSet(expediente());
    const datos = normalizarExtraccion(LECTURA_CMR);

    expect(proponerCambios(exp, datos, 'cmr').find(c => c.clave === 'transport.vehicleNationality'))
      .toMatchObject({ actual: null, nuevo: 'TR', grupo: 'transporte', campo: 'vehicleNationality' });
    const rellenados = rellenarHuecosH1(exp, datos, 'cmr');

    expect(claves(rellenados)).toContain('transport.vehicleNationality');
    expect(exp.transport.vehicleNationality).toBe('TR');
  });

  test('un CMR de un tramo interior (expediente maritimo) no rellena la nacionalidad: solo la propone', () => {
    const exp = conSet(expediente({ transportMode: 'maritime' }));
    const datos = normalizarExtraccion(LECTURA_CMR);

    expect(claves(proponerCambios(exp, datos, 'cmr'))).toContain('transport.vehicleNationality');
    rellenarHuecosH1(exp, datos, 'cmr');
    expect(exp.transport.vehicleNationality).toBeUndefined();
  });

  test('no pisa la nacionalidad que ya escribio la agente', () => {
    const exp = conSet(expediente({ transport: { vehicleNationality: 'BG' } }));

    rellenarHuecosH1(exp, normalizarExtraccion(LECTURA_CMR), 'cmr');
    expect(exp.transport.vehicleNationality).toBe('BG');
  });
});

describe('lectura de un T1 (documento de acompañamiento de transito)', () => {
  test('reconoce el tipo y lee MRN, oficinas y garantia', () => {
    const d = normalizarExtraccion(LECTURA_T1);

    expect(d.tipoDetectado).toBe('transit_document');
    expect(d.transito).toEqual({ mrn: '26BG009999000001J8', oficinaPartida: 'BG009999', oficinaDestino: 'ES009999', garantia: '26BG0000000000EJ1' });
    expect(d.notas.some(n => n.includes('26BG009999000001J8') && /tr[aá]nsito/i.test(n))).toBe(true);
  });

  test('vale el tipo declarado si el modelo no lo reconoce', () => {
    expect(normalizarExtraccion({ ...LECTURA_T1, tipoDetectado: 'other' }, { tipoDeclarado: 'transit_document' }).factura.numero).toBeNull();
  });

  test('un T1 no es una factura y sus partidas no traen importe', () => {
    const d = normalizarExtraccion(LECTURA_T1);

    expect(d.factura).toMatchObject({ numero: null, importeTotal: null });
    expect(d.partidas[0]).toMatchObject({ codigoMercancia: '610910', bultos: 22, pesoBrutoKg: 4380, pesoNetoKg: 4100, importe: null });
  });

  test('avisa si el digito de control del MRN no cuadra y descarta lo que no tiene forma de MRN', () => {
    const conMrn = (mrn) => normalizarExtraccion({ tipoDetectado: 'transit_document', transito: { mrn } });

    const malDigito = conMrn('26BG009999000001J7');
    expect(malDigito.transito.mrn).toBe('26BG009999000001J7');
    expect(malDigito.notas.some(n => n.includes('26BG009999000001J7') && /d[ií]gito de control/i.test(n))).toBe(true);
    expect(conMrn('26 bg 0099 9900 0001 J8').transito.mrn).toBe('26BG009999000001J8');
    expect(conMrn('2026BG123').transito.mrn).toBeNull();
    // Una oficina que no tiene forma de codigo de aduana (2 letras + 6) no se guarda.
    expect(normalizarExtraccion({ transito: { oficinaPartida: 'Kapitan Andreevo' } }).transito.oficinaPartida).toBeNull();
  });

  test('propone medio y nacionalidad (rellena el hueco en cualquier modo) pero no el tipo ni el numero de documento de transporte', () => {
    const exp = conSet(expediente({ transportMode: 'maritime' }));
    const datos = normalizarExtraccion(LECTURA_T1);

    const propuestas = claves(proponerCambios(exp, datos, 'transit_document'));
    expect(propuestas).toEqual(expect.arrayContaining(['transport.vehicleId', 'transport.vehicleNationality']));
    expect(propuestas).not.toContain('transport.documentType');
    expect(propuestas).not.toContain('transport.documentNumber');
    rellenarHuecosH1(exp, datos, 'transit_document');
    expect(exp.transport.vehicleNationality).toBe('TR');
  });
});

describe('bandera e IMO del buque en un BL', () => {
  test('lee la bandera y el numero IMO; el IMO va a las notas', () => {
    const d = normalizarExtraccion(LECTURA_BL_CON_BANDERA);

    expect(d.transporte).toMatchObject({ medio: 'CMA CGM EJEMPLO', nacionalidadMedio: 'PA', imo: '9839284' });
    expect(d.notas).toContain('Buque con número IMO 9839284.');
  });

  test('un IMO cuyo digito de control no cuadra se guarda con aviso; lo que no tiene 7 cifras se descarta', () => {
    const imo = (valor) => normalizarExtraccion({ transporte: { imo: valor } });

    expect(imo('9839285').transporte.imo).toBe('9839285');
    expect(imo('9839285').notas.some(n => n.includes('9839285') && /d[ií]gito de control/i.test(n))).toBe(true);
    expect(imo('12345').transporte.imo).toBeNull();
  });

  test('en un expediente maritimo rellena la nacionalidad vacia del H1; en uno aereo solo la propone', () => {
    const maritimo = conSet(expediente({ transportMode: 'maritime' }));
    const aereo = conSet(expediente({ transportMode: 'air' }));
    const datos = normalizarExtraccion(LECTURA_BL_CON_BANDERA);

    rellenarHuecosH1(maritimo, datos, 'bill_of_lading');
    rellenarHuecosH1(aereo, datos, 'bill_of_lading');
    expect(maritimo.transport.vehicleNationality).toBe('PA');
    expect(aereo.transport.vehicleNationality).toBeUndefined();
  });

  test('sin bandera escrita no hay nacionalidad: no se deduce del nombre del buque', () => {
    const d = normalizarExtraccion({ tipoDetectado: 'bill_of_lading', transporte: { medio: 'CMA VOY. 88201400E' } });

    expect(d.transporte.nacionalidadMedio).toBeNull();
    expect(claves(proponerCambios(expediente({ transportMode: 'maritime' }), d, 'bill_of_lading'))).not.toContain('transport.vehicleNationality');
  });

  test('una factura no propone nacionalidad del medio aunque el modelo la devuelva', () => {
    const d = normalizarExtraccion({ tipoDetectado: 'commercial_invoice', transporte: { nacionalidadMedio: 'PA' } });

    expect(claves(proponerCambios(expediente(), d, 'commercial_invoice'))).not.toContain('transport.vehicleNationality');
  });
});

describe('prompt de lectura', () => {
  test('pide la bandera y la nacionalidad solo si estan escritas, y prohibe deducirlas', () => {
    expect(SYSTEM_PROMPT).toContain('"nacionalidadMedio": null');
    expect(SYSTEM_PROMPT).toContain('"imo": null');
    expect(SYSTEM_PROMPT).toContain('NUNCA la deduzcas del nombre del buque');
    expect(SYSTEM_PROMPT).toContain('transit_document');
    expect(SYSTEM_PROMPT).toContain('"transito": { "mrn": null');
    expect(SYSTEM_PROMPT).toContain('medio de transporte ACTIVO en la frontera');
  });
});

describe('el T1 es un tipo de documento del expediente', () => {
  test('lo admiten el modelo y el validador de subida', () => {
    const Expedition = require('../../src/models/Expedition');
    const { DOCUMENT_TYPES } = require('../../src/middleware/validators');

    expect(Expedition.schema.path('documents').schema.path('type').enumValues).toContain('transit_document');
    expect(DOCUMENT_TYPES).toContain('transit_document');
  });
});
