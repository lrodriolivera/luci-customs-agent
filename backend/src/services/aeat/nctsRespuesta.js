/**
 * Lectura de las respuestas sincronas de los servicios NCTS6 del operador en la
 * aduana de partida: CC015CV1Sal (alta), CC013CV1Sal (modificacion),
 * CC014CV1Sal (invalidacion) y CC170CV1Sal (presentacion). Todas comparten
 * ControlRespuesta (tipoRespuesta OK/EF/EX + codigoRespuesta) y una eleccion
 * entre DatosRespuestaCorrecta, FunctionalError y XMLError (XSD v51.8.0).
 *
 * Codigos de respuesta (guia v1.21): CC015/CC170 L levante, B bajo control,
 * G garantia extranjera; CC013 M modificacion admitida; CC014 I invalidada.
 */
const { leerSalida, erroresDe, hijo, texto } = require('./aesNctsConsulta');
const { CIRCUITOS, ESTADOS_NCTS } = require('./aesNctsCodigos');

const BASE = '/wlpl/ADTR-JDIT/ws/ncts5';
const ENDPOINTS_NCTS = Object.freeze({
  CC015C: `${BASE}/CC015CV1SOAP`,
  CC013C: `${BASE}/CC013CV1SOAP`,
  CC014C: `${BASE}/CC014CV1SOAP`,
  CC170C: `${BASE}/CC170CV1SOAP`
});
const SALIDAS = { CC015C: 'CC015CV1Sal', CC013C: 'CC013CV1Sal', CC014C: 'CC014CV1Sal', CC170C: 'CC170CV1Sal' };

/**
 * @param {string} cuerpo  respuesta HTTP
 * @param {{ mensaje: 'CC015C'|'CC013C'|'CC014C'|'CC170C', mrn?: string }} opciones
 * @returns {object} { success, tipo, tipoRespuesta, codigoRespuesta, mrn, lrn, estado,
 *   estadoTexto, circuito, channel, csv, csvDat, fechas, errores?, error, rawResponse }
 */
function interpretarRespuestaNcts(cuerpo, { mensaje, mrn } = {}) {
  const salidaEsperada = SALIDAS[mensaje];
  if (!salidaEsperada) throw new Error(`Mensaje NCTS sin intérprete: ${mensaje}`);
  const crudo = typeof cuerpo === 'string' ? cuerpo : '';
  const base = {
    success: false, tipo: 'desconocida', mensaje, mrn: null, estado: null, csv: null, error: null, rawResponse: crudo
  };
  const { salida, fallo } = leerSalida(crudo, salidaEsperada, base);
  if (fallo) return fallo;

  const tipoRespuesta = texto(salida, 'ControlRespuesta', 'tipoRespuesta');
  const codigoRespuesta = texto(salida, 'ControlRespuesta', 'codigoRespuesta');
  const conError = erroresDe(salida, { ...base, tipoRespuesta, codigoRespuesta });
  if (conError) return conError;

  const datos = hijo(salida, 'DatosRespuestaCorrecta');
  if (tipoRespuesta !== 'OK' || !datos) {
    return { ...base, tipoRespuesta, codigoRespuesta, error: 'La respuesta no trae ni los datos ni errores' };
  }

  const mrnRespuesta = texto(datos, 'MRN');
  const mrnPedido = mrn ? String(mrn).trim().toUpperCase() : null;
  if (mrnPedido && mrnRespuesta !== mrnPedido) {
    return { ...base, tipoRespuesta, codigoRespuesta, mrn: mrnRespuesta, error: `La AEAT respondió con otro MRN (${mrnRespuesta}) para ${mrnPedido}` };
  }

  const estado = texto(datos, 'estado');
  const circuito = texto(datos, 'circuitoExpedicion');
  return {
    ...base,
    success: true,
    tipo: 'aceptada',
    tipoRespuesta,
    codigoRespuesta,
    mrn: mrnRespuesta,
    lrn: texto(datos, 'LRN'),
    estado,
    estadoTexto: ESTADOS_NCTS[estado]?.texto || null,
    circuito,
    channel: CIRCUITOS[circuito] || null,
    csv: texto(datos, 'CSVDeclaracionElectronica'),
    csvDat: texto(datos, 'CSVdeDAT'),
    fechas: {
      alta: texto(datos, 'fechaHoraAlta'),
      admision: texto(datos, 'fechaAdmision'),
      levante: texto(datos, 'fechaLevante'),
      limiteLlegada: texto(datos, 'fechaLimiteLlegada'),
      invalidacion: texto(datos, 'fechaInvalidacion')
    }
  };
}

module.exports = { interpretarRespuestaNcts, ENDPOINTS_NCTS };
