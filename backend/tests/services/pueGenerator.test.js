/**
 * pueGenerator: solicitudes de control paraduanero (PUE).
 *
 * Estaba al 0% de lineas, con 282 ramas sin cubrir. El PUE es la ventanilla
 * unica por la que se piden los controles que otros organismos -- no Aduanas --
 * tienen que autorizar antes del despacho:
 *
 *   ROHS  aparatos electricos, sustancias peligrosas
 *   COM   SOIVRE, calidad comercial y seguridad de producto
 *   ECO   productos agroalimentarios
 *   CAL   calidad comercial de textiles
 *
 * Si la solicitud sale mal formada, la mercancia se queda retenida en frontera
 * hasta que se corrija: el coste es almacenaje y demoras del transportista.
 *
 * Se ejercita el generador real. Nada mockeado: el XML que se comprueba es el
 * que se enviaria a la AEAT.
 */

const pue = require('../../src/services/forms/pueGenerator');

/** Solicitud PUE completa; el tipo se pasa aparte. */
function solicitud(pueType, extra = {}) {
  return {
    pueType,
    reference: 'PUE-CAL-2026-000123',
    expeditionId: 'EXP-2026-0100',
    operator: { name: 'Textiles del Sur SL', nif: 'B12345678', eori: 'ESB12345678' },
    goods: [
      { taricCode: '6109100010', description: 'Camisetas de algodon', quantity: 500, netWeight: 120 }
    ],
    customsOffice: 'ES002801',
    ...extra
  };
}

describe('generate: los cuatro tipos de control', () => {
  test.each(['ROHS', 'COM', 'ECO', 'CAL'])('genera una solicitud %s', (tipo) => {
    const xml = pue.generate(solicitud(tipo));

    expect(typeof xml).toBe('string');
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toMatch(/<pue:PUERequest/);
  });

  test.each(['ROHS', 'COM', 'ECO', 'CAL'])('el XML de %s lleva su bloque especifico', (tipo) => {
    // Cada organismo espera su propia estructura: enviar la de otro control
    // hace que la solicitud se rechace sin llegar a tramitarse.
    expect(pue.generate(solicitud(tipo))).toMatch(new RegExp(`<pue:${tipo}`));
  });

  test('un tipo de control inexistente se rechaza en el acto', () => {
    // Mejor fallar aqui que enviar a la AEAT un XML sin cuerpo.
    expect(() => pue.generate(solicitud('INVENTADO')))
      .toThrow(/no soportado/i);
  });

  test('sin tipo de control tampoco genera nada', () => {
    expect(() => pue.generate(solicitud(undefined))).toThrow(/no soportado/i);
  });
});

describe('cabecera del mensaje', () => {
  const xml = pue.generate(solicitud('CAL'));

  test('declara los espacios de nombres de la AEAT', () => {
    expect(xml).toMatch(/xmlns:pue="urn:aeat:adua:pue:v1"/);
    expect(xml).toMatch(/xmlns:common="urn:aeat:adua:common:v1"/);
  });

  test('lleva identificador de mensaje', () => {
    expect(xml).toMatch(/<pue:MessageId>PUE[0-9A-F]+<\/pue:MessageId>/);
  });

  test('dos solicitudes no comparten identificador', () => {
    // Repetirlo haria que la AEAT tomase la segunda por un duplicado.
    const a = pue.generate(solicitud('CAL')).match(/<pue:MessageId>([^<]+)/)[1];
    const b = pue.generate(solicitud('CAL')).match(/<pue:MessageId>([^<]+)/)[1];

    expect(a).not.toBe(b);
  });

  test('incluye la referencia local de la solicitud', () => {
    // Es lo que permite al operador cruzar la respuesta de la AEAT con su
    // propio expediente.
    expect(xml).toMatch(/<pue:LocalReference>PUE-CAL-2026-000123<\/pue:LocalReference>/);
  });
});

describe('datos del operador', () => {
  const xml = pue.generate(solicitud('CAL'));

  test('incluye razon social, NIF y EORI', () => {
    // El EORI es lo que identifica al operador ante toda la aduana de la UE.
    expect(xml).toMatch(/Textiles del Sur SL/);
    expect(xml).toMatch(/B12345678/);
    expect(xml).toMatch(/ESB12345678/);
  });

  test('_buildOperator devuelve un bloque XML', () => {
    const bloque = pue._buildOperator({ name: 'X SL', nif: 'B1', eori: 'ESB1' });

    expect(typeof bloque).toBe('string');
    expect(bloque).toMatch(/X SL/);
  });

  test('_buildAddress tolera una direccion incompleta', () => {
    // Llega asi de altas rapidas de cliente.
    expect(() => pue._buildAddress({})).not.toThrow();
    expect(() => pue._buildAddress(undefined)).not.toThrow();
  });

  test('_buildParty tolera una parte sin datos', () => {
    expect(() => pue._buildParty({}, 'Consignee')).not.toThrow();
  });
});

describe('mercancias declaradas', () => {
  test('incluye el codigo TARIC', () => {
    // Es lo que determina que control aplica.
    expect(pue.generate(solicitud('CAL'))).toMatch(/6109100010/);
  });

  test('incluye la descripcion de la mercancia', () => {
    expect(pue.generate(solicitud('CAL'))).toMatch(/Camisetas de algodon/);
  });

  test('varias mercancias generan varias lineas', () => {
    const xml = pue.generate(solicitud('CAL', {
      goods: [
        { taricCode: '6109100010', description: 'Camisetas', quantity: 100, netWeight: 20 },
        { taricCode: '6203420000', description: 'Pantalones', quantity: 50, netWeight: 30 }
      ]
    }));

    expect(xml).toMatch(/6109100010/);
    expect(xml).toMatch(/6203420000/);
  });

  test('una solicitud sin mercancias no revienta', () => {
    expect(() => pue.generate(solicitud('CAL', { goods: [] }))).not.toThrow();
  });
});

describe('aduana de presentacion', () => {
  test('_buildCustomsOffice recibe la solicitud completa', () => {
    const bloque = pue._buildCustomsOffice(solicitud('CAL'));

    expect(typeof bloque).toBe('string');
  });

  test('tolera una solicitud sin aduana informada', () => {
    expect(() => pue._buildCustomsOffice({})).not.toThrow();
  });
});

describe('consulta de estado', () => {
  test('genera un XML de consulta', () => {
    // Recibe la referencia como cadena, no como objeto.
    const xml = pue.generateStatusQuery('PUE-CAL-2026-000123');

    expect(xml).toMatch(/<pue:PUEStatusQuery/);
    expect(xml).toMatch(/<pue:PUEReference>PUE-CAL-2026-000123<\/pue:PUEReference>/);
  });

  test('la consulta lleva su propio identificador de mensaje', () => {
    expect(pue.generateStatusQuery('PUE-1')).toMatch(/<pue:MessageId>/);
  });
});

describe('anulacion', () => {
  test('genera un XML de anulacion con el motivo', () => {
    // El motivo es obligatorio: la AEAT lo registra en el expediente.
    const xml = pue.generateCancellation('PUE-CAL-2026-000123', 'Mercancia no embarcada en origen');

    expect(xml).toMatch(/<pue:PUECancellation/);
    expect(xml).toMatch(/Mercancia no embarcada en origen/);
  });

  test('la anulacion referencia la solicitud original', () => {
    const xml = pue.generateCancellation('PUE-CAL-2026-000123', 'motivo');

    expect(xml).toMatch(/<pue:PUEReference>PUE-CAL-2026-000123<\/pue:PUEReference>/);
  });
});

describe('datos complementarios', () => {
  test('genera el XML de aportacion de datos', () => {
    // Es la respuesta a un requerimiento del organismo de control.
    const xml = pue.generateComplementaryData(
      'PUE-CAL-2026-000123',
      { documents: [{ type: 'certificate', reference: 'CERT-001' }] }
    );

    expect(typeof xml).toBe('string');
    expect(xml).toMatch(/PUE-CAL-2026-000123/);
  });

  test('tolera que no haya documentos que aportar', () => {
    expect(() => pue.generateComplementaryData('PUE-1', {}))
      .not.toThrow();
  });
});

describe('el XML no se rompe con caracteres especiales', () => {
  test('una razon social con ampersand no invalida el mensaje', () => {
    // "Garcia & Hijos" es un nombre de empresa perfectamente normal, y un &
    // sin escapar hace que la AEAT devuelva error de formato.
    const xml = pue.generate(solicitud('CAL', {
      operator: { name: 'Garcia & Hijos SL', nif: 'B1', eori: 'ESB1' }
    }));

    expect(xml).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#);)/);
  });
});
