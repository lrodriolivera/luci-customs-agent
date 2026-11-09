/**
 * Identificacion aduanera: unica fuente del EORI de las partes de una
 * declaracion.
 *
 * Funciones puras. Criterio: ninguna declaracion, XML ni prompt lleva un
 * identificador inventado ("ESundefined"), vacio o de otra empresa; si falta el
 * EORI, la operacion se rechaza con un mensaje que dice donde completarlo.
 */

const { decrypt, isEncrypted } = require('../../utils/piiCrypto');

class ErrorValidacion extends Error {
  constructor(mensaje, extra = {}) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.status = 422;
    this.code = extra.code || 'EORI_FALTANTE';
    if (extra.quien) this.quien = extra.quien;
  }
}

/** Cadena recortada y en mayusculas, o null si no es una cadena con contenido. */
function _texto(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio.toUpperCase();
}

/**
 * EORI de una parte: `eori` si existe; si no, `ES` + `nif` solo cuando el nif
 * es una cadena no vacia; si no, null.
 */
function eoriDe(parte) {
  if (!parte || typeof parte !== 'object') return null;
  const eori = _texto(parte.eori);
  if (eori) return eori;
  const nif = _texto(parte.nif);
  return nif ? `ES${nif}` : null;
}

/** Valor del tenant ya descifrado; un valor aun cifrado (sin clave) no sirve. */
function _claro(valor) {
  if (typeof valor !== 'string') return null;
  const plano = isEncrypted(valor) ? decrypt(valor) : valor;
  if (isEncrypted(plano)) return null;
  return _texto(plano);
}

/**
 * Representante aduanero a partir del tenant: EORI del pais configurado en
 * Ajustes > Aduanas; para ES, el EORI de la ficha de empresa como respaldo.
 * Nombre y contacto salen del tenant; si no los hay, null (no se inventan).
 */
function representanteDelTenant(tenant, pais = 'ES') {
  const t = tenant || {};
  const porPais = _claro(t.customsConfig?.eoriNumbers?.[pais]);
  const deEmpresa = pais === 'ES' ? _claro(t.businessInfo?.eori) : null;
  const contacto = t.primaryContact || t.contacts?.[0] || {};
  return {
    eori: porPais || deEmpresa || null,
    companyName: _texto(t.companyName) ? t.companyName.trim() : (_texto(t.name) ? t.name.trim() : null),
    contact: {
      name: contacto.name || null,
      email: contacto.email || null,
      phone: contacto.phone || null
    },
    representationType: 'indirect'
  };
}

/** Devuelve el EORI o lanza ErrorValidacion (422) diciendo donde completarlo. */
function exigirEori(valor, quien) {
  if (typeof valor === 'string' && valor.trim() !== '') return valor;
  const donde = quien === 'cliente'
    ? 'complétalo en la ficha del cliente'
    : 'configúralo en Ajustes > Aduanas';
  throw new ErrorValidacion(`Falta el EORI del ${quien}: ${donde}`, { quien });
}

/**
 * Declarante de una declaracion: `expedition.representative` si tiene EORI; si
 * no, el representante del tenant; si tampoco, 422. El nombre sale del
 * representante o del tenant; sin nombre, 422 (no hay nombre por defecto).
 */
function declarantePara(expedition, tenant, pais = 'ES') {
  const rep = expedition?.representative;
  const eoriRep = eoriDe(rep);
  const delTenant = representanteDelTenant(tenant, pais);

  const eori = exigirEori(eoriRep || delTenant.eori, 'representante');
  const origen = eoriRep ? rep : delTenant;
  const nombre = _texto(origen.companyName) ? origen.companyName : delTenant.companyName;
  if (!nombre) {
    throw new ErrorValidacion(
      'Falta el nombre del representante: configúralo en Ajustes > Aduanas',
      { code: 'NOMBRE_FALTANTE', quien: 'representante' }
    );
  }
  const contacto = eoriRep ? (rep.contact || {}) : delTenant.contact;
  return {
    eori,
    companyName: nombre,
    contact: {
      name: contacto.name || null,
      phone: contacto.phone || null,
      email: contacto.email || null
    },
    representationType: origen.representationType || delTenant.representationType
  };
}

/**
 * Comprobacion previa a generar (y antes de gastar una llamada a la IA): el
 * declarante y, salvo `cliente: false`, el cliente tienen EORI.
 */
function exigirIdentificacion(expedition, tenant, { cliente = true, pais = 'ES' } = {}) {
  declarantePara(expedition, tenant, pais);
  if (cliente) exigirEori(eoriDe(expedition?.client), 'cliente');
}

module.exports = {
  eoriDe, representanteDelTenant, exigirEori, declarantePara, exigirIdentificacion, ErrorValidacion
};
