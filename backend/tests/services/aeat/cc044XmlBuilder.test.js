/**
 * cc044XmlBuilder: XML de observaciones de descarga NCTS (mensaje CC044C) para
 * la AEAT. Se envia tras descargar la mercancia en destino para confirmar el
 * estado de los precintos y de las mercancias frente a la declaracion de
 * transito.
 *
 * Generador PURO —sin BD ni red—: genera su propio transactionId con Date y
 * Math.random, pero no hace I/O. Las ramas relevantes deciden si la descarga es
 * conforme o arrastra discrepancias (una UnloadingRemark por discrepancia, con
 * conform=0), y el estado de precintos. Un error aqui confirma como conforme
 * una descarga con faltas o exceso de mercancia. No se asertan valores exactos
 * de fecha ni el id (dependen del reloj y del azar), solo su forma y las ramas.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const { buildCC044UnloadingXML } = require('../../../src/services/aeat/cc044XmlBuilder');

describe('buildCC044UnloadingXML: envelope y cabecera', () => {
  test('envuelve en un envelope SOAP con el mensaje CC044C qualified', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ES00085123456789' });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<ent:CC044CV1Ent');
    expect(xml).toContain('<ent:messageType>CC044C</ent:messageType>');
    expect(xml).toContain('<ent:messageRecipient>NETA.ES</ent:messageRecipient>');
  });

  test('vuelca MRN, aduana de destino real y EORI del destinatario', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX', officeOfDestination: 'ES000851', traderEORI: 'ESB22477020' });

    expect(xml).toContain('<ent:MRN>26ESX</ent:MRN>');
    expect(xml).toContain('<ent:referenceNumber>ES000851</ent:referenceNumber>');
    expect(xml).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    // El messageSender tambien es el EORI del destinatario.
    expect(xml).toContain('<ent:messageSender>ESB22477020</ent:messageSender>');
  });

  test('la fecha de preparacion cae a hoy (AAAAMMDD, 8 digitos) si no se da', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX' });
    expect(xml).toMatch(/<ent:preparationDateAndTime>\d{8}<\/ent:preparationDateAndTime>/);
  });

  test('respeta la fecha de descarga explicita', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX', unloadingDate: '20260804' });
    expect(xml).toContain('<ent:preparationDateAndTime>20260804</ent:preparationDateAndTime>');
    expect(xml).toContain('<ent:unloadingDate>20260804</ent:unloadingDate>');
  });
});

describe('descarga conforme (sin discrepancias)', () => {
  test('emite una unica UnloadingRemark con conform=1 cuando la mercancia es conforme', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX', goodsConform: true });

    expect((xml.match(/<ent:UnloadingRemark>/g) || []).length).toBe(1);
    expect(xml).toContain('<ent:conform>1</ent:conform>');
  });

  test('conform=0 si la mercancia no es conforme aunque no haya discrepancias detalladas', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX', goodsConform: false });
    expect(xml).toContain('<ent:conform>0</ent:conform>');
  });

  test('el estado de precintos refleja sealsOk (1 intactos, 0 rotos)', () => {
    const ok = buildCC044UnloadingXML({ mrn: '26ESX', sealsOk: true });
    const roto = buildCC044UnloadingXML({ mrn: '26ESX', sealsOk: false });

    expect(ok).toContain('<ent:stateOfSeals>1</ent:stateOfSeals>');
    expect(roto).toContain('<ent:stateOfSeals>0</ent:stateOfSeals>');
  });
});

describe('descarga con discrepancias', () => {
  test('emite una UnloadingRemark por discrepancia, todas con conform=0', () => {
    const xml = buildCC044UnloadingXML({
      mrn: '26ESX',
      goodsDiscrepancies: [
        { itemNumber: 1, description: 'Faltan 5 cajas', shortageOrExcess: 'S', quantity: 5 },
        { itemNumber: 2, description: 'Exceso de 2 palets', shortageOrExcess: 'E', quantity: 2 }
      ]
    });

    expect((xml.match(/<ent:UnloadingRemark>/g) || []).length).toBe(2);
    expect((xml.match(/<ent:conform>0<\/ent:conform>/g) || []).length).toBe(2);
    expect(xml).toContain('<ent:description>Faltan 5 cajas</ent:description>');
    expect(xml).toContain('<ent:controlIndicator>S</ent:controlIndicator>');
    expect(xml).toContain('<ent:controlIndicator>E</ent:controlIndicator>');
  });

  test('el indicador de control cae a A si la discrepancia no lo especifica', () => {
    const xml = buildCC044UnloadingXML({
      mrn: '26ESX',
      goodsDiscrepancies: [{ description: 'Discrepancia generica' }]
    });

    expect(xml).toContain('<ent:controlIndicator>A</ent:controlIndicator>');
    // Una descripcion ausente no rompe: sale vacia.
    expect(xml).toContain('<ent:ResultsOfControl>');
  });

  test('las discrepancias tambien reflejan el estado de precintos', () => {
    const xml = buildCC044UnloadingXML({
      mrn: '26ESX', sealsOk: false,
      goodsDiscrepancies: [{ description: 'x' }]
    });
    expect(xml).toContain('<ent:stateOfSeals>0</ent:stateOfSeals>');
  });
});
