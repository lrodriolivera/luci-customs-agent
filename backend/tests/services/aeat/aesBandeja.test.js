/**
 * Bandeja de entrada de la AEAT para los avisos de exportación AES.
 *
 * Peticiones (ListaDecV4Ent, DetalleV5Ent) validadas contra los XSD oficiales
 * de la bandeja. Los avisos (ComunicaXxxV1Sal) son los ejemplos de la guía AES
 * v1.25 §27.23-27.29 con los datos de PRE (B22477020, MRN de hoy), y cada
 * fixture se valida aquí contra su XSD oficial antes de interpretarlo.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildListaBandejaXML, buildDetalleBandejaXML, interpretarLista, interpretarAviso, referenciaAes,
  ENDPOINT_LISTA, ENDPOINT_DETALLE, TIPOS_AVISO_AES
} = require('../../../src/services/aeat/aesBandeja');

const FIX = path.join(__dirname, '../../fixtures/aeat-bandeja');
const XSD_AES = path.join(__dirname, '../../fixtures/aeat-consultas/aes');
const leer = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
const siHayXmllint = spawnSync('xmllint', ['--version']).status === 0 ? test : test.skip;

function validar(sobre, esquema) {
  const cuerpo = /<(?:soapenv|env):Body>\s*([\s\S]*?)\s*<\/(?:soapenv|env):Body>/.exec(sobre)[1];
  const fichero = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bandeja-')), 'mensaje.xml');
  fs.writeFileSync(fichero, `<?xml version="1.0" encoding="UTF-8"?>\n${cuerpo}`);
  execFileSync('xmllint', ['--noout', '--schema', esquema, fichero], { stdio: 'pipe' });
}

describe('petición de la lista de pendientes (ListaDecV4)', () => {
  const xml = buildListaBandejaXML({ nif: 'ESB22477020', nombre: 'STRIX AI & Cía <SL>' });

  test('va al servicio ListaDecV4 de la bandeja', () => {
    expect(ENDPOINT_LISTA).toBe('/wlpl/ADHT-BAND/ws/li/ListaDecV4SOAP');
  });

  test('lleva el NIF sin ES y el nombre escapado, sin firma XAdES', () => {
    expect(xml).toContain('<l:NifDeclarante>B22477020</l:NifDeclarante>');
    expect(xml).toContain('<l:NombreDeclarante>STRIX AI &amp; Cía &lt;SL&gt;</l:NombreDeclarante>');
    expect(xml).not.toContain('Signature');
    expect(xml).not.toContain('tipoRespuesta');
  });

  test('sin nombre usa el NIF (el elemento es obligatorio)', () => {
    expect(buildListaBandejaXML({ nif: 'B22477020' })).toContain('<l:NombreDeclarante>B22477020</l:NombreDeclarante>');
  });

  test('filtro opcional por tipo de respuesta', () => {
    const conFiltro = buildListaBandejaXML({ nif: 'B22477020', tipoRespuesta: 'https://x/ComunicaResulSalidaV1.wsdl' });
    expect(conFiltro).toContain('tipoRespuesta="https://x/ComunicaResulSalidaV1.wsdl"');
  });

  test('rechaza un NIF mal formado o extranjero', () => {
    expect(() => buildListaBandejaXML({ nif: '' })).toThrow('NIF');
    expect(() => buildListaBandejaXML({ nif: 'B2<x>' })).toThrow('NIF');
    expect(() => buildListaBandejaXML({ nif: 'PT123456789' })).toThrow('NIF');
  });

  siHayXmllint('valida contra ListaDecV4Ent.xsd', () => {
    expect(() => validar(xml, path.join(FIX, 'ListaDecV4Ent.xsd'))).not.toThrow();
  });
});

describe('petición del detalle de un aviso (DetalleV5)', () => {
  const xml = buildDetalleBandejaXML({ clave: '20261116120438659005' });

  test('va al servicio DetalleV5 de la bandeja con la clave', () => {
    expect(ENDPOINT_DETALLE).toBe('/wlpl/ADHT-BAND/ws/det/DetalleV5SOAP');
    expect(xml).toContain('<d:clave>20261116120438659005</d:clave>');
  });

  test('rechaza claves vacías o con caracteres raros', () => {
    expect(() => buildDetalleBandejaXML({ clave: '' })).toThrow('clave');
    expect(() => buildDetalleBandejaXML({ clave: '1<2' })).toThrow('clave');
  });

  siHayXmllint('valida contra DetalleV5Ent.xsd', () => {
    expect(() => validar(xml, path.join(FIX, 'DetalleV5Ent.xsd'))).not.toThrow();
  });
});

describe('referencia de un aviso AES', () => {
  test('ADEX + MRN + código + resultado', () => {
    expect(referenciaAes('ADEX26ES002801100319B6CSALIDS')).toEqual({ mrn: '26ES002801100319B6', codigo: 'CSALID', resultado: 'S' });
    expect(referenciaAes('ADEX26ES002801100326B3CDISSAD')).toEqual({ mrn: '26ES002801100326B3', codigo: 'CDISSA', resultado: 'D' });
  });

  test('otra cosa (EMCS, NCTS, código desconocido) no es un aviso AES', () => {
    expect(referenciaAes('26111609000061195ES00028A1034S')).toBeNull();
    expect(referenciaAes('ADEX26ES002801100326B3XXXXXXD')).toBeNull();
    expect(referenciaAes(null)).toBeNull();
  });
});

describe('respuesta de la lista', () => {
  siHayXmllint('la fixture valida contra ListaDecV4Sal.xsd', () => {
    expect(() => validar(leer('lista-respuesta.xml'), path.join(FIX, 'ListaDecV4Sal.xsd'))).not.toThrow();
  });

  test('separa los avisos AES de los de otros servicios', () => {
    const r = interpretarLista(leer('lista-respuesta.xml'));
    expect(r.success).toBe(true);
    expect(r.total).toBe(3);
    expect(r.avisos).toEqual([
      expect.objectContaining({ clave: '20261116120438659005', mrn: '26ES002801100319B6', codigo: 'CSALID', resultado: 'S' }),
      expect.objectContaining({ clave: '20261116122652360089', mrn: '26ES002801100326B3', codigo: 'CDISSA' })
    ]);
  });

  test('lista vacía', () => {
    expect(interpretarLista(leer('lista-vacia.xml'))).toMatchObject({ success: true, total: 0, avisos: [] });
  });

  test('fallo SOAP de cliente (p. ej. sin apoderamiento): no reintentable', () => {
    const r = interpretarLista(leer('fault-client.xml'));
    expect(r).toMatchObject({ success: false, tipo: 'fault', reintentable: false });
    expect(r.error).toContain('apoderado');
  });

  test('cuerpo vacío o que no es XML', () => {
    expect(interpretarLista('')).toMatchObject({ success: false });
    expect(interpretarLista('<html>502')).toMatchObject({ success: false });
    expect(interpretarLista('<a/>').error).toContain('ListaDecV4Sal');
  });
});

describe('avisos de exportación AES', () => {
  const ESQUEMAS = {
    'aviso-clevex.xml': 'ComunicaLevanteExporV1Sal', 'aviso-clevsa.xml': 'ComunicaLevanteSalidaV1Sal',
    'aviso-csalid-sa.xml': 'ComunicaResulSalidaV1Sal', 'aviso-csalid-st.xml': 'ComunicaResulSalidaV1Sal',
    'aviso-cdisex.xml': 'ComunicaDisconformeExporV1Sal', 'aviso-cdissa.xml': 'ComunicaDisconformeSalidaV1Sal',
    'aviso-cinval.xml': 'ComunicaInvalidacionV1Sal', 'aviso-concce.xml': 'ComunicaControlesCCEV1Sal'
  };
  for (const [fichero, esquema] of Object.entries(ESQUEMAS)) {
    siHayXmllint(`${fichero} valida contra ${esquema}.xsd`, () => {
      expect(() => validar(leer(fichero), path.join(XSD_AES, `${esquema}.xsd`))).not.toThrow();
    });
  }

  test('conoce los siete avisos AES de la guía', () => {
    expect(Object.keys(TIPOS_AVISO_AES).sort()).toEqual(['CDISEX', 'CDISSA', 'CINVAL', 'CLEVEX', 'CLEVSA', 'CONCCE', 'CSALID']);
  });

  test('resultado de la salida: salida efectiva (SA) con fecha y resultado A2', () => {
    const r = interpretarAviso(leer('aviso-csalid-sa.xml'), { mrn: '26ES002801100319B6' });
    expect(r).toMatchObject({
      success: true, tipo: 'CSALID', id: '20261116120438659005', mensajeId: '20261116120438659005',
      destinatario: 'B22477020', fechaPreparacion: '2026-11-16T12:04:38', mrn: '26ES002801100319B6',
      estadoAES: 'SA', final: true, estadoTexto: expect.stringContaining('Salida efectiva'),
      datos: { fechaSalidaEfectiva: '2026-11-16', resultadoSalida: 'A2', resultadoSalidaTexto: expect.stringContaining('conforme') }
    });
  });

  test('resultado de la salida: parada (ST) con fecha de parada y B1', () => {
    const r = interpretarAviso(leer('aviso-csalid-st.xml'));
    expect(r).toMatchObject({
      success: true, tipo: 'CSALID', estadoAES: 'ST', final: true,
      datos: { fechaParada: '2026-11-16', resultadoSalida: 'B1', resultadoSalidaTexto: 'Resultado disconforme' }
    });
    expect(r.datos.fechaSalidaEfectiva).toBeUndefined();
  });

  test('levante en la aduana de exportación', () => {
    expect(interpretarAviso(leer('aviso-clevex.xml'))).toMatchObject({
      tipo: 'CLEVEX', estadoAES: 'DS', final: false,
      datos: { fechaLevante: '2026-11-16', csvLevante: '45MQ2EPFLXQEH2MS', salidaDirecta: true }
    });
  });

  test('levante en la aduana de salida', () => {
    expect(interpretarAviso(leer('aviso-clevsa.xml'))).toMatchObject({
      tipo: 'CLEVSA', estadoAES: 'PS', datos: { fechaLevanteSalida: '2026-11-16', csvLevanteSalida: 'DBGZ6TBAS32GJ76E' }
    });
  });

  test('disconformes en exportación y en salida con su motivo', () => {
    expect(interpretarAviso(leer('aviso-cdisex.xml'))).toMatchObject({
      tipo: 'CDISEX', estadoAES: 'NL', final: true, datos: { motivo: 'La mercancía no se corresponde con lo declarado & faltan bultos.' }
    });
    expect(interpretarAviso(leer('aviso-cdissa.xml'))).toMatchObject({
      tipo: 'CDISSA', estadoAES: 'ST', datos: { fechaDisconforme: '2026-11-16', motivo: 'No hay apenas kilos.' }
    });
  });

  test('invalidación y controles de aduana extranjera', () => {
    expect(interpretarAviso(leer('aviso-cinval.xml'))).toMatchObject({
      tipo: 'CINVAL', estadoAES: 'IV', final: true,
      datos: { fechaInvalidacion: '2026-11-16', iniciadaPorAduana: true, justificacion: expect.stringContaining('caducidad') }
    });
    expect(interpretarAviso(leer('aviso-concce.xml'))).toMatchObject({
      tipo: 'CONCCE', estadoAES: 'PL',
      datos: {
        fechaNotificacion: '2026-11-16', tipoNotificacion: '0',
        controles: [{ tipo: '40', texto: 'Mirar todas las cajas por escáner.' }],
        documentos: [{ tipo: 'C055', descripcion: 'Declaración de conformidad' }]
      }
    });
  });

  test('el MRN del aviso tiene que ser el de la referencia', () => {
    const r = interpretarAviso(leer('aviso-csalid-sa.xml'), { mrn: '26ES002801100326B3' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('otro MRN');
  });

  test('un aviso que no es AES, un fault o un XML roto no se interpretan', () => {
    expect(interpretarAviso(leer('lista-respuesta.xml')).success).toBe(false);
    expect(interpretarAviso(leer('fault-client.xml'))).toMatchObject({ success: false, tipo: 'fault' });
    expect(interpretarAviso('no es xml').success).toBe(false);
    const raro = leer('aviso-clevex.xml').replace('<messageType>CLEVEX</messageType>', '<messageType>ZZZZZZ</messageType>');
    expect(interpretarAviso(raro).error).toContain('ZZZZZZ');
    const sinMrn = leer('aviso-clevex.xml').replace('<MRN>26ES002801100319B6</MRN>', '<MRN>123</MRN>');
    expect(interpretarAviso(sinMrn).error).toContain('MRN');
  });
});
