/**
 * Descripcion oficial de un codigo TARIC en un idioma, por el servicio web SOAP
 * de la Comision Europea (DDS2, operacion `goodsDescrForWs`).
 *
 * Se usa solo para los codigos que la nomenclatura en español de CIRCABC
 * todavia no trae (sale en enero y julio; un codigo nacido en septiembre no
 * esta). Limite publicado por la Comision: 100 peticiones por segundo.
 */
const axios = require('axios');

const URL_SOAP = 'https://ec.europa.eu/taxation_customs/dds2/taric/services/goods';
const TIMEOUT_MS = 20000;

const peticion = (codigo, idioma, fecha) => `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://goodsNomenclatureForWS.ws.taric.dds.s/">
  <soap:Body>
    <tns:goodsDescrForWs>
      <tns:goodsCode>${codigo}</tns:goodsCode>
      <tns:languageCode>${idioma}</tns:languageCode>
      <tns:referenceDate>${fecha}</tns:referenceDate>
    </tns:goodsDescrForWs>
  </soap:Body>
</soap:Envelope>`;

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const desescapar = (t) => t.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTIDADES[e]);

/**
 * Descripcion de la respuesta SOAP, o null si no la trae o viene en otro idioma.
 * Cuando no existe traduccion, el servicio devuelve el texto ingles con el
 * prefijo «[EN]»: eso NO es una descripcion en el idioma pedido.
 */
function descripcionDeRespuesta(xml, idioma) {
  const m = /<(?:\w+:)?description[^>]*>([\s\S]*?)<\/(?:\w+:)?description>/.exec(String(xml || ''));
  if (!m) return null;
  const texto = desescapar(m[1]).trim();
  if (!texto) return null;
  const prefijo = /^\[([A-Z]{2})\]\s*/.exec(texto);
  if (prefijo && prefijo[1].toLowerCase() !== String(idioma).toLowerCase()) return null;
  return prefijo ? texto.slice(prefijo[0].length).trim() : texto;
}

/**
 * @param {string} codigo 10 digitos
 * @param {{ idioma?: string, fecha?: Date, cliente?: object }} [opciones]
 * @returns {Promise<string|null>} null si el servicio no da descripcion en ese idioma
 */
async function descripcionOficial(codigo, { idioma = 'es', fecha = new Date(), cliente = axios } = {}) {
  if (!/^\d{10}$/.test(String(codigo))) throw new Error(`Codigo TARIC invalido: ${codigo}`);
  const { data } = await cliente.post(URL_SOAP, peticion(codigo, idioma, fecha.toISOString().slice(0, 10)), {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' }, timeout: TIMEOUT_MS, responseType: 'text'
  });
  return descripcionDeRespuesta(data, idioma);
}

module.exports = { descripcionOficial, descripcionDeRespuesta, URL_SOAP };
