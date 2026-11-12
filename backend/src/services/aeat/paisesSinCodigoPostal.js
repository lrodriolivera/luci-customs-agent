/**
 * Lista CL505 de la UE («CountryWithoutZip»): países en los que el código
 * postal de una dirección es opcional (regla C0505 del H1 CAU).
 *
 * Fuente: datos de referencia CS/RD2 de la Comisión, vista NCTS-P5,
 * https://ec.europa.eu/taxation_customs/dds2/rd/compressed_file/data_download/RD_NCTS-P5_CountryWithoutZip.zip
 * (extracción del 12/11/2026, 54 países, todos «valid»).
 *
 * Ojo: al exportador sin identificador la AEAT le exige además la «dirección
 * completa» (error 50908), y en la preproducción eso incluye el código postal
 * también para estos países (comprobado con HK y KR el 12/11/2026). Por eso
 * LUCI no deja de pedirlo: solo lo explica.
 */
const PAISES_SIN_CODIGO_POSTAL = new Set([
  'AE', 'AG', 'AO', 'AQ', 'AW', 'BF', 'BI', 'BJ', 'BO', 'BQ', 'BS', 'BV', 'BW', 'BZ', 'CF', 'CG', 'CI', 'CK',
  'CM', 'CW', 'DM', 'ER', 'FJ', 'GA', 'GD', 'GM', 'GQ', 'HK', 'IR', 'JM', 'KM', 'KR', 'LY', 'ML', 'MR', 'QA',
  'RW', 'SB', 'SC', 'SL', 'SO', 'SR', 'SS', 'ST', 'SX', 'SY', 'TD', 'TG', 'TK', 'TO', 'TV', 'VU', 'YE', 'ZW'
]);

/** Si el país está en la CL505. */
const sinCodigoPostal = (pais) => PAISES_SIN_CODIGO_POSTAL.has(String(pais || '').trim().toUpperCase());

module.exports = { PAISES_SIN_CODIGO_POSTAL, sinCodigoPostal };
