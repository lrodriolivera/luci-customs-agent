/**
 * aesGenerator: declaracion de EXPORTACION (AES / CC515C de salida).
 *
 * Estaba al 6,6% de lineas. La exportacion tiene un riesgo propio que no tiene
 * la importacion: los controles de DOBLE USO. Exportar sin la licencia de
 * MINECO un producto sujeto a control no es una incidencia administrativa,
 * es un delito. El validador es lo que evita que eso salga.
 *
 * Se ejercita el generador real con la fixture de expedientes, marcada como
 * exportacion. Nada mockeado.
 */

const aes = require('../../src/services/forms/aesGenerator');
const { createElectronicsExpedition, createTextileExpedition } = require('../fixtures/h1TestData');

/** Exportacion completa y valida: destinatario con pais de destino. */
function exportacion(base = createElectronicsExpedition(), extra = {}) {
  return {
    ...base,
    operationType: 'export',
    goodsSummary: { totalItems: 3, totalValue: 45000, totalPackages: 10, totalGrossWeight: 500 },
    consignee: {
      name: 'Global Trade Inc',
      address: { country: 'US', city: 'Miami', streetAndNumber: '1 Ocean Drive' }
    },
    ...extra
  };
}

describe('validateForAES: lo que impide presentar', () => {
  test('una exportacion completa es valida', () => {
    const v = aes.validateForAES(exportacion());

    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
  });

  test('sin pais de destino NO es valida', () => {
    // Casilla 17 del DUA de exportacion. Sin ella la AEAT no puede determinar
    // el regimen de salida ni los controles aplicables.
    const sinDestino = exportacion(createElectronicsExpedition(), { consignee: { name: 'X' } });

    const v = aes.validateForAES(sinDestino);

    expect(v.valid).toBe(false);
    expect(v.errors.map(e => e.code)).toContain('MISSING_DESTINATION');
  });

  test('el error dice el campo exacto que falta', () => {
    // Quien rellena el formulario tiene que saber donde ir.
    const v = aes.validateForAES(exportacion(createElectronicsExpedition(), { consignee: {} }));

    expect(v.errors[0].field).toBeTruthy();
    expect(v.errors[0].message).toBeTruthy();
  });

  test('devuelve errores y avisos por separado', () => {
    // Un error bloquea la presentacion; un aviso solo informa. Mezclarlos haria
    // que se ignorasen los dos.
    const v = aes.validateForAES(exportacion());

    expect(Array.isArray(v.errors)).toBe(true);
    expect(Array.isArray(v.warnings)).toBe(true);
  });
});

describe('control de doble uso', () => {
  test('avisa de que los ordenadores exigen licencia de MINECO', () => {
    // 8471: material informatico, sujeto al Reglamento (UE) 2021/821 de doble
    // uso. Exportarlo sin licencia a determinados destinos es delito.
    const v = aes.validateForAES(exportacion());

    const licencias = v.warnings.filter(w => w.code === 'LICENSE_REQUIRED');
    expect(licencias.length).toBeGreaterThan(0);
    expect(licencias[0].authority).toBe('MINECO');
    expect(licencias[0].control).toBe('dual_use');
  });

  test('el aviso identifica la mercancia concreta', () => {
    // Con varias lineas hay que saber cual exige la licencia.
    const v = aes.validateForAES(exportacion());
    const aviso = v.warnings.find(w => w.code === 'LICENSE_REQUIRED');

    expect(aviso.field).toMatch(/goods\[\d+\]/);
    expect(aviso.message).toMatch(/\d{8}/);
  });

  test('un textil no dispara el control de doble uso', () => {
    // Contraste: si avisara de todo, el aviso no significaria nada.
    const v = aes.validateForAES(exportacion(createTextileExpedition()));

    const licencias = (v.warnings || []).filter(w => w.control === 'dual_use');
    expect(licencias.length).toBe(0);
  });

  test('el doble uso NO bloquea: avisa', () => {
    // Es una advertencia, no un error: la licencia puede existir y aportarse.
    const v = aes.validateForAES(exportacion());

    expect(v.valid).toBe(true);
  });
});

describe('generate: estructura del mensaje de salida', () => {
  const r = aes.generate(exportacion(), {});

  test('devuelve LRN, datos, XML y resumen', () => {
    expect(r).toHaveProperty('lrn');
    expect(r).toHaveProperty('data');
    expect(r).toHaveProperty('xml');
    expect(r).toHaveProperty('summary');
  });

  test('el XML lleva el espacio de nombres del CAU', () => {
    expect(r.xml).toMatch(/urn:wco:datamodel:WCO:DEC-DMS:2/);
  });

  test('el LRN de exportacion se distingue del de importacion', () => {
    // Lleva el marcador EX: 26ESEX...  frente al 26ES... del H1. Permite saber
    // de un vistazo si una referencia es de entrada o de salida.
    expect(r.lrn).toMatch(/^\d{2}ESEX[0-9A-F]+$/);
  });

  test('dos LRN consecutivos no coinciden', () => {
    expect(aes.generateLRN()).not.toBe(aes.generateLRN());
  });

  test('el resumen recoge los codigos TARIC exportados', () => {
    expect(r.summary.taricCodes?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('aduana de exportacion', () => {
  test('determina una aduana con formato AEAT', () => {
    const oficina = aes.determineExportOffice(exportacion());

    expect(String(oficina)).toMatch(/^ES\d{6}$/);
  });
});

describe('documentos exigidos', () => {
  test('separa los obligatorios de los que anade un control', () => {
    // Recibe (expedicion, controles): los obligatorios salen del tipo de
    // exportacion, los adicionales de los controles que apliquen.
    const docs = aes._getRequiredDocuments(exportacion(), []);

    expect(Array.isArray(docs.mandatory)).toBe(true);
    expect(docs.additional).toEqual([]);
  });

  test('un control con licencia obligatoria anade su documento', () => {
    const docs = aes._getRequiredDocuments(exportacion(), [
      { control: 'dual_use', license: 'required', authority: 'MINECO', description: 'doble uso' }
    ]);

    expect(docs.additional.length).toBe(1);
    expect(docs.additional[0].authority).toBe('MINECO');
    expect(docs.additional[0].mandatory).toBe(true);
  });

  test('un control sin licencia obligatoria no anade nada', () => {
    const docs = aes._getRequiredDocuments(exportacion(), [
      { control: 'dual_use', license: 'not_required' }
    ]);

    expect(docs.additional).toEqual([]);
  });

  test.each([
    ['dual_use', 'export_license_dual_use'],
    ['chemical', 'chemical_export_license'],
    ['weapons', 'weapons_export_license'],
    ['cultural', 'cultural_export_permit']
  ])('el control %s exige el documento %s', (control, esperado) => {
    expect(aes._getControlDocumentType(control)).toBe(esperado);
  });

  test('un control desconocido cae en la licencia generica', () => {
    // Mejor pedir una licencia de mas que no pedir ninguna.
    expect(aes._getControlDocumentType('inventado')).toBe('export_license');
  });
});

describe('robustez', () => {
  test('una exportacion sin mercancias no revienta', () => {
    expect(() => aes.generate(exportacion(createElectronicsExpedition(), { goods: [] }), {}))
      .not.toThrow();
  });

  test('validar un expediente vacio no revienta', () => {
    // Llega asi desde un borrador recien creado.
    expect(() => aes.validateForAES({})).not.toThrow();
  });

  test('validar sin mercancias devuelve estructura completa', () => {
    const v = aes.validateForAES({ operationType: 'export', goods: [] });

    expect(v).toHaveProperty('valid');
    expect(v).toHaveProperty('errors');
    expect(v).toHaveProperty('warnings');
  });
});
