/**
 * Listas oficiales de mercancias sujetas a control del servicio de inspeccion
 * SOIVRE, por codigo TARIC:
 *
 *  - Seguridad de productos (anexo del RD 330/2008): lista de TARIC de 10
 *    digitos, con su grupo de producto.
 *  - RoHS / RAEE: lista de prefijos TARIC (6, 8 o 10 digitos) con indicacion
 *    de si procede cada control y, en su caso, la nota que lo acota.
 *
 * Sustituyen a las reglas por capitulo, que declaraban "control SOIVRE" para
 * capitulos enteros (todo el 84 y el 85, todo el textil): unos portatiles de la
 * 8471 30 salian con un control de seguridad que no les corresponde y sin el
 * RoHS/RAEE que si llevan (UAT 10/Nov/2026).
 *
 * Los datos se generan con data/paraduanero/generar_listas.py a partir de los
 * Excel publicados por la Secretaria de Estado de Comercio. La unica version
 * valida es la de su sede: las listas deben refrescarse cuando cambien.
 */
const rohsRaee = require('../../data/paraduanero/rohsRaee.json');
const soivreSeguridad = require('../../data/paraduanero/soivreSeguridad.json');

const LONGITUDES_PREFIJO = [10, 8, 6];

const rohsRaeePorPrefijo = new Map(rohsRaee.entradas.map(e => [e.prefijo, e]));
const soivrePorTaric = new Map(soivreSeguridad.entradas.map(e => [e.taric, e]));

/** Deja el codigo en 10 digitos, o null si no es un TARIC utilizable. */
const normalizarTaric = (taricCode) => {
  const digitos = String(taricCode || '').replace(/\D/g, '');
  if (digitos.length < 8 || digitos.length > 10) return null;
  return digitos.padEnd(10, '0');
};

/**
 * Entrada de la lista RoHS/RAEE que cubre el codigo, o null. Gana el prefijo
 * mas largo: una subdivision de 10 digitos manda sobre su partida de 8.
 */
const buscarRohsRaee = (taricCode) => {
  const codigo = normalizarTaric(taricCode);
  if (!codigo) return null;
  for (const longitud of LONGITUDES_PREFIJO) {
    const entrada = rohsRaeePorPrefijo.get(codigo.slice(0, longitud));
    if (entrada) return entrada;
  }
  return null;
};

/** Entrada de la lista SOIVRE de seguridad para ese TARIC de 10 digitos, o null. */
const buscarSoivreSeguridad = (taricCode) => {
  const codigo = normalizarTaric(taricCode);
  return codigo ? (soivrePorTaric.get(codigo) || null) : null;
};

const VERSIONES = Object.freeze({
  rohsRaee: rohsRaee.version,
  soivreSeguridad: soivreSeguridad.version
});

module.exports = { buscarRohsRaee, buscarSoivreSeguridad, normalizarTaric, VERSIONES };
