/**
 * cc007XmlBuilder: XML de notificacion de llegada NCTS (mensaje CC007C) para la
 * AEAT. Se envia cuando la mercancia llega a la aduana de destino en una
 * operacion de transito.
 *
 * Generador PURO —sin BD ni red—: genera su propio transactionId con Date y
 * Math.random, pero no hace I/O. Es un mensaje casi plano; la unica rama es la
 * fecha de llegada (explicita vs hoy). No se asertan fecha ni id exactos, solo
 * su forma y el volcado de campos.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const { buildCC007ArrivalXML } = require('../../../src/services/aeat/cc007XmlBuilder');

describe('buildCC007ArrivalXML', () => {
  test('envuelve en un envelope SOAP con el mensaje CC007C qualified', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ES00085123456789' });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<ent:CC007CV1Ent');
    expect(xml).toContain('<ent:messageType>CC007C</ent:messageType>');
    expect(xml).toContain('<ent:messageRecipient>NETA.ES</ent:messageRecipient>');
  });

  test('vuelca MRN, aduana de destino y EORI del destinatario', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX', officeOfDestination: 'ES000851', traderEORI: 'ESB22477020' });

    expect(xml).toContain('<ent:MRN>26ESX</ent:MRN>');
    expect(xml).toContain('<ent:referenceNumber>ES000851</ent:referenceNumber>');
    expect(xml).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    expect(xml).toContain('<ent:messageSender>ESB22477020</ent:messageSender>');
    // El idioma de comunicacion en destino es siempre ES.
    expect(xml).toContain('<ent:communicationLanguageAtDestination>ES</ent:communicationLanguageAtDestination>');
  });

  test('el procedimiento simplificado cae a 0 (normal) por defecto', () => {
    expect(buildCC007ArrivalXML({ mrn: '26ESX' })).toContain('<ent:simplifiedProcedure>0</ent:simplifiedProcedure>');
    expect(buildCC007ArrivalXML({ mrn: '26ESX', simplifiedProcedure: '1' })).toContain('<ent:simplifiedProcedure>1</ent:simplifiedProcedure>');
  });

  test('la fecha de llegada cae a hoy (AAAAMMDD, 8 digitos) si no se da', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX' });
    expect(xml).toMatch(/<ent:preparationDateAndTime>\d{8}<\/ent:preparationDateAndTime>/);
    expect(xml).toMatch(/<ent:arrivalNotificationDateAndTime>\d{8}<\/ent:arrivalNotificationDateAndTime>/);
  });

  test('respeta la fecha de llegada explicita', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX', arrivalDate: '20260804' });
    expect(xml).toContain('<ent:preparationDateAndTime>20260804</ent:preparationDateAndTime>');
    expect(xml).toContain('<ent:arrivalNotificationDateAndTime>20260804</ent:arrivalNotificationDateAndTime>');
  });
});
