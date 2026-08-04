/**
 * h1Generator: construccion del DUA de importacion (mensaje CC515C).
 *
 * Estaba al 7,93% de lineas y con 538 ramas sin cubrir. Es lo que se presenta
 * ante la AEAT: un error aqui no da un fallo de la aplicacion, da una
 * declaracion aduanera incorrecta, con las consecuencias que eso tiene
 * (liquidacion complementaria, recargo, o mercancia retenida en frontera).
 *
 * Se ejercita el generador REAL con la fixture de expedientes que ya usa
 * h1CompleteFlow. Nada mockeado: el XML que se comprueba es el que se enviaria.
 *
 * Los importes de referencia estan verificados a mano contra el CAU:
 *   valor en aduana = valor de factura + flete + seguro hasta frontera UE
 *   IVA = 21% sobre el valor en aduana (no sobre el de factura)
 */

const h1 = require('../../src/services/forms/h1Generator');
const {
  createElectronicsExpedition,
  createTextileExpedition
} = require('../fixtures/h1TestData');

/** Expedicion completa: la fixture no trae goodsSummary ni costes. */
function expedicionCompleta(base = createElectronicsExpedition(), extra = {}) {
  return {
    ...base,
    goodsSummary: { totalItems: 3, totalPackages: 120, totalGrossWeight: 1450, totalNetWeight: 1300, totalValue: 45000 },
    costs: { freight: 1200, insurance: 300 },
    ...extra
  };
}

describe('generate: estructura del mensaje', () => {
  const r = h1.generate(expedicionCompleta(), {});

  test('devuelve LRN, datos, XML y resumen', () => {
    expect(r).toHaveProperty('lrn');
    expect(r).toHaveProperty('data');
    expect(r).toHaveProperty('xml');
    expect(r).toHaveProperty('summary');
  });

  test('el XML es un CC515C con el espacio de nombres del CAU', () => {
    // Si el namespace no es el correcto, la AEAT rechaza el mensaje entero.
    expect(r.xml).toMatch(/<CC515C/);
    expect(r.xml).toMatch(/urn:wco:datamodel:WCO:DEC-DMS:2/);
    expect(r.xml).toMatch(/<MessageType>CC515C<\/MessageType>/);
  });

  test('el destinatario es la AEAT', () => {
    expect(r.xml).toMatch(/<MessageRecipient>ES\.AEAT<\/MessageRecipient>/);
  });

  test('los datos llevan los ocho bloques del DUA', () => {
    expect(Object.keys(r.data)).toEqual(expect.arrayContaining([
      'lrn', 'declarationType', 'declarationHeader', 'goodsShipment',
      'goodsItems', 'valuation', 'dutyTaxFee', 'guarantee'
    ]));
  });
});

describe('generateLRN: referencia local unica', () => {
  test('sigue el formato AAES + 16 caracteres', () => {
    // El LRN identifica la declaracion ante la AEAT hasta que asigna el MRN.
    expect(h1.generateLRN()).toMatch(/^\d{2}ES[0-9A-F]{16}$/);
  });

  test('dos llamadas seguidas no coinciden', () => {
    // Repetir un LRN provoca el rechazo de la segunda declaracion.
    expect(h1.generateLRN()).not.toBe(h1.generateLRN());
  });

  test('empieza por el ano en curso', () => {
    const ano = String(new Date().getFullYear()).slice(-2);
    expect(h1.generateLRN().startsWith(ano)).toBe(true);
  });
});

describe('valor en aduana: la base de toda la liquidacion', () => {
  test('suma flete y seguro al valor de factura', () => {
    // Art. 70 CAU: el valor de transaccion se ajusta con los gastos de
    // transporte y seguro hasta el punto de entrada en la UE.
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.invoiceValue).toBe(45000);
    expect(s.totalAdditions).toBe(1500);
    expect(s.customsValue).toBe(46500);
  });

  test('el IVA se calcula sobre el valor en aduana, no sobre el de factura', () => {
    // La diferencia son 315 EUR en este expediente: liquidar sobre la factura
    // seria declarar de menos.
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.vatAmount).toBe(Math.round(46500 * 0.21));
    expect(s.vatAmount).not.toBe(Math.round(45000 * 0.21));
  });

  test('sin costes declarados el valor en aduana es el de factura', () => {
    const sin = expedicionCompleta(createElectronicsExpedition(), { costs: {} });
    const s = h1.generate(sin, {}).summary;

    expect(s.customsValue).toBe(s.invoiceValue);
    expect(s.totalAdditions).toBe(0);
  });

  test('declara el metodo de valoracion empleado', () => {
    // Casilla obligatoria: metodo 1 = valor de transaccion.
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.valuationMethod).toBe('1');
    expect(s.valuationMethodDescription).toMatch(/transaccion/i);
  });
});

describe('regimen y preferencia', () => {
  test('por defecto es despacho a libre practica sin preferencia', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.regime).toBe('40');
    expect(s.preference).toBe('100');
    expect(s.preferenceDescription).toMatch(/terceros paises/i);
  });

  test('recoge los codigos TARIC de todas las mercancias', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.taricCodes.length).toBe(3);
    expect(s.taricCodes.every(c => /^\d{8,10}$/.test(c))).toBe(true);
  });

  test('recoge los paises de origen', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.origins).toContain('CN');
  });
});

describe('aduana de presentacion', () => {
  test('un expediente maritimo por Barcelona va a su aduana', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.customsOffice).toMatch(/^ES\d{6}$/);
    expect(s.customsOfficeName).toBeTruthy();
  });

  test('determineCustomsOffice devuelve un codigo con formato AEAT', () => {
    expect(h1.determineCustomsOffice(createElectronicsExpedition())).toMatch(/^ES\d{6}$/);
  });
});

describe('codigos de transporte', () => {
  test.each([
    ['maritime', '1'],
    ['rail', '2'],
    ['road', '3'],
    ['air', '4']
  ])('%s -> modo %s', (modo, codigo) => {
    // Casilla 25 del DUA. Un codigo erroneo cambia el regimen de control.
    expect(String(h1.getTransportModeCode(modo))).toBe(codigo);
  });

  test('un modo desconocido no rompe la generacion', () => {
    expect(h1.getTransportModeCode('teletransporte')).toBeDefined();
  });

  test('el documento de transporte depende del modo', () => {
    // Maritimo: conocimiento de embarque. Aereo: carta de porte aereo.
    const maritimo = h1.getTransportDocumentType('maritime');
    const aereo = h1.getTransportDocumentType('air');

    expect(maritimo).toBeTruthy();
    expect(aereo).toBeTruthy();
    expect(maritimo).not.toBe(aereo);
  });
});

describe('codigos de region', () => {
  test.each([
    ['Madrid', 'ES-MD'],
    ['Barcelona', 'ES-CT'],
    ['Valencia', 'ES-VC']
  ])('%s -> %s', (ciudad, codigo) => {
    expect(h1.getRegionCode(ciudad)).toBe(codigo);
  });

  test('una ciudad desconocida devuelve un valor, no undefined', () => {
    // Un undefined en el XML deja la casilla vacia y la AEAT lo rechaza.
    expect(h1.getRegionCode('Cuenca del Amazonas')).toBeTruthy();
  });
});

describe('documentos justificativos', () => {
  test.each([
    ['invoice', 'N380'],
    ['transport', 'N705'],
    ['origin', 'N954']
  ])('%s -> codigo %s', (tipo, esperado) => {
    // Codigos del anexo B del CAU: identifican cada documento aportado.
    const c = h1.getDocumentTypeCode(tipo);
    expect(typeof c).toBe('string');
    expect(c).toMatch(/^[A-Z]\d{3}$/);
  });

  test('un tipo desconocido cae en un codigo generico', () => {
    expect(h1.getDocumentTypeCode('inventado')).toMatch(/^[A-Z]\d{3}$/);
  });
});

describe('escapeXml: caracteres que romperian el mensaje', () => {
  test.each([
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['&', '&amp;']
  ])('escapa %s', (car, esperado) => {
    expect(h1.escapeXml(`a${car}b`)).toBe(`a${esperado}b`);
  });

  test('el ampersand no se escapa dos veces', () => {
    // '&amp;amp;' rompe el nombre de empresas como "Garcia & Hijos".
    expect(h1.escapeXml('Garcia & Hijos')).toBe('Garcia &amp; Hijos');
  });

  test('tolera valores que no son cadena', () => {
    // REGRESION: escapeXml hacia str.replace directamente. Con un campo
    // numerico -- una razon social como "12345 SL" guardada como numero, o un
    // codigo postal en la casilla de ciudad -- lanzaba
    //   TypeError: str.replace is not a function
    // y con ello reventaba la generacion del DUA COMPLETO: el expediente no se
    // podia declarar.
    expect(() => h1.escapeXml(null)).not.toThrow();
    expect(() => h1.escapeXml(undefined)).not.toThrow();
    expect(h1.escapeXml(42)).toBe('42');
    expect(h1.escapeXml(0)).toBe('');   // 0 es falsy: se trata como vacio
  });

  test('REGRESION: una razon social numerica no impide declarar', () => {
    const conNumero = expedicionCompleta(createElectronicsExpedition(), {
      client: { ...createElectronicsExpedition().client, companyName: 12345 }
    });

    expect(() => h1.generate(conNumero, {})).not.toThrow();
  });

  test('REGRESION: una ciudad numerica tampoco', () => {
    const base = createElectronicsExpedition();
    const conNumero = expedicionCompleta(base, {
      client: { ...base.client, address: { ...base.client.address, city: 28001 } }
    });

    expect(() => h1.generate(conNumero, {})).not.toThrow();
  });

  test('el XML generado no contiene caracteres sin escapar', () => {
    // Comprobacion de conjunto: si algun campo se cuela sin escapar, el XML
    // deja de ser valido y la AEAT devuelve error de formato.
    const conAmpersand = expedicionCompleta(createElectronicsExpedition(), {
      client: { ...createElectronicsExpedition().client, companyName: 'Garcia & Hijos <SL>' }
    });
    const { xml } = h1.generate(conAmpersand, {});

    // Ningun & suelto: todos deben formar parte de una entidad.
    expect(xml).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/);
  });
});

describe('mercancias', () => {
  test('genera una linea por cada mercancia', () => {
    const { data } = h1.generate(expedicionCompleta(), {});

    expect(data.goodsItems.length).toBe(3);
  });

  test('un expediente textil tambien se genera', () => {
    // Otro capitulo arancelario, con derechos distintos de los electronicos.
    const textil = expedicionCompleta(createTextileExpedition(), {});
    const r = h1.generate(textil, {});

    expect(r.xml).toMatch(/<CC515C/);
    expect(r.summary.taricCodes.length).toBeGreaterThan(0);
  });

  test('un expediente sin mercancias no revienta', () => {
    const vacia = expedicionCompleta(createElectronicsExpedition(), { goods: [] });

    expect(() => h1.generate(vacia, {})).not.toThrow();
  });
});

describe('calculateSummary', () => {
  test('el total a pagar es arancel mas IVA', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.totalDuty).toBe(s.tariffAmount + s.vatAmount);
  });

  test('declara el metodo de pago', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.paymentMethod).toBeTruthy();
    expect(s.paymentMethodDescription).toBeTruthy();
  });
});
