const { medidasDeImpuestoEspecial, impuestoEspecialPara, impuestoEspecialEnH1, ErrorImpuestoEspecial } = require('../../../src/services/aeat/impuestoEspecial');

// Medidas reales de la AEAT para cerveza 2203000100 (Arancel Integrado, 16/11/2026), resumidas.
const nacional = (codigo, derecho, descripcion) => ({ codigo, tipo: 'nacional', areaGeografica: 'TODOS ERGA OMNES', descripcion, derecho, documentos: [] });
const CERVEZA = {
  existe: true, areaGeografica: 'MX',
  medidas: [
    { codigo: '103-APPL', tipo: 'ue', derecho: '0%', documentos: [] },
    nacional('IA3-IC.A3', '7,480 EUR / HL', 'IC.Ep.2. Cerveza grado plato < 11+2,8% Vol.'),
    nacional('IA6-IC.A6', '0,910 EUR / HP', 'IC.Ep.5. Cerveza grado plato > 19.'),
    nacional('IG0-IC.G0', '0%', 'IC.Ep.1.1.Cervezas con un grado alcohólico volumetrico <1,2%.'),
    nacional('VIM-VETIM', undefined, 'Control VETERINARIO de productos a la IMPORTACIÓN'),
    { codigo: 'IVA-IVA', tipo: 'iva', derecho: '21,000%', documentos: [] }
  ]
};

describe('medidasDeImpuestoEspecial', () => {
  test('solo las medidas I.. nacionales, con epígrafe, tipo y unidad', () => {
    expect(medidasDeImpuestoEspecial(CERVEZA)).toEqual([
      { medida: 'IA3', codigoMedida: 'IA3-IC.A3', epigrafe: '0A3', descripcion: 'IC.Ep.2. Cerveza grado plato < 11+2,8% Vol.', tipo: 7.48, unidadAeat: 'HL', unidad: 'HLT' },
      { medida: 'IA6', codigoMedida: 'IA6-IC.A6', epigrafe: '0A6', descripcion: 'IC.Ep.5. Cerveza grado plato > 19.', tipo: 0.91, unidadAeat: 'HP', unidad: null },
      { medida: 'IG0', codigoMedida: 'IG0-IC.G0', epigrafe: '0G0', descripcion: 'IC.Ep.1.1.Cervezas con un grado alcohólico volumetrico <1,2%.', tipo: null, unidadAeat: null, unidad: null }
    ]);
  });
  test('un producto sin impuestos especiales no tiene opciones', () => {
    expect(medidasDeImpuestoEspecial({ medidas: [{ codigo: 'COM-COMER', tipo: 'nacional' }] })).toEqual([]);
  });
});

describe('impuestoEspecialPara', () => {
  test('toma tipo y unidad de la AEAT y calcula la cuota', () => {
    expect(impuestoEspecialPara(CERVEZA, { medida: 'ia3', cantidad: 8 })).toEqual({
      medida: 'IA3', epigrafe: '0A3', clave: '0', descripcion: 'IC.Ep.2. Cerveza grado plato < 11+2,8% Vol.',
      tipo: 7.48, unidad: 'HLT', unidadAeat: 'HL', cantidad: 8, cuota: 59.84
    });
  });
  test.each([
    [{ medida: 'IZ9', cantidad: 1 }, 'MEDIDA_NO_VALIDA'],
    [{ medida: 'IA3', cantidad: 1, clave: 'S' }, 'CLAVE_NO_ADMITIDA'],
    [{ medida: 'IA6', cantidad: 1 }, 'UNIDAD_NO_SOPORTADA'],
    [{ medida: 'IG0', cantidad: 1 }, 'UNIDAD_NO_SOPORTADA'],
    [{ medida: 'IA3', cantidad: 0 }, 'CANTIDAD_NO_VALIDA'],
    [{ medida: 'IA3', cantidad: 'x' }, 'CANTIDAD_NO_VALIDA']
  ])('rechaza %o (%s)', (eleccion, codigo) => {
    expect(() => impuestoEspecialPara(CERVEZA, eleccion)).toThrow(ErrorImpuestoEspecial);
    expect(() => impuestoEspecialPara(CERVEZA, eleccion)).toThrow(expect.objectContaining({ codigo }));
  });
});

describe('impuestoEspecialEnH1', () => {
  const ie = { epigrafe: '0A3', clave: '0', tipo: 7.48, unidad: 'HLT', cantidad: 8 };
  test('clave 0: código 0A30 y tributo 0A3 con su cuota', () => {
    expect(impuestoEspecialEnH1({ impuestoEspecial: ie }, 'A')).toEqual({
      adicionalesNacionales: ['0A30'],
      tributo: { tipo: '0A3', medioDePago: 'A', bases: [{ tipoImpositivo: 7.48, unidad: 'HLT', cantidad: 8, cuota: 59.84 }] },
      cuota: 59.84
    });
  });
  test('otra clave: solo el código, sin tributo', () => {
    expect(impuestoEspecialEnH1({ impuestoEspecial: { ...ie, clave: 'N' } }, 'A')).toEqual({ adicionalesNacionales: ['0A3N'], tributo: null, cuota: 0 });
  });
  test('sin impuesto especial no aporta nada', () => {
    expect(impuestoEspecialEnH1({}, 'A')).toEqual({ adicionalesNacionales: [], tributo: null, cuota: 0 });
  });
});
