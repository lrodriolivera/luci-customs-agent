/**
 * Aduanas de entrada: FUENTE UNICA para backend y frontend.
 *
 * Antes habia tres listas y se contradecian en los mismos codigos:
 *
 *   codigo     ensService.ENS_CONFIG   frontend           aeatConfig
 *   ES002801   Algeciras               Algeciras          Barcelona - Puerto
 *   ES003001   Irun                    Vigo               Algeciras - Puerto
 *   ES002101   -                       Bilbao             Madrid - Barajas
 *   ES001501   -                       Madrid-Barajas     Cadiz - Puerto
 *
 * El dano no era cosmetico: el desplegable ofrecia ES009999, que el backend no
 * tenia en su lista, asi que la validacion de coherencia modo/aduana buscaba la
 * aduana, no la encontraba y pasaba de largo sin avisar. Las 8 ENS aceptadas en
 * PRE se presentaron por ese hueco.
 *
 * Desde el 16/11/2026 los codigos salen de config/aduanasOficiales.js, la
 * lista oficial que nos paso una agente de aduanas. El catalogo anterior (el de
 * aeatConfig) tenia codigos equivocados: ES002801 figuraba como "Barcelona -
 * Puerto" y es Madrid aeropuerto; ES004601 como "Valencia - Puerto" y es
 * Valencia aeropuerto; ES003001 como "Algeciras - Puerto" y Algeciras maritima
 * es ES001131. Las plazas que no estan en la lista oficial (Las Palmas,
 * Tenerife, Alicante, Tarragona, La Junquera, Fuentes de Onoro, Coslada) se
 * han quitado: no se adivina ningun codigo.
 *
 * Aqui solo entran los recintos por los que entra mercancia: aeropuertos,
 * maritimas (no la de solo exportacion), carretera, ferrocarril y recintos
 * interiores (puerto seco, zonas francas, ZAL, ZAISA). Administraciones,
 * postales, domiciliaciones, despachos centralizados y depositos francos no.
 */

const { ADUANAS_OFICIALES } = require('./aduanasOficiales');

// Modos de transporte por tipo de aduana. Una aduana maritima o aerea admite
// tambien ROAD porque la mercancia puede llegar por carretera al recinto.
const MODOS_POR_TIPO = {
  maritime: ['SEA', 'ROAD'],
  air: ['AIR', 'ROAD'],
  land: ['ROAD', 'RAIL'],
  inland: ['ROAD', 'RAIL']
};

// Tipo de la lista oficial -> tipo del catalogo de entrada. Carretera y
// ferrocarril se agrupan en 'land' (el tipo que ya usaban backend y frontend).
const TIPO_ENTRADA = { air: 'air', maritime: 'maritime', road: 'land', rail: 'land', inland: 'inland' };

// [codigo, nombre, tipo] derivados de la lista oficial.
const CATALOGO = ADUANAS_OFICIALES
  .filter(a => TIPO_ENTRADA[a.type] && a.sentido !== 'export')
  .map(a => [a.code, a.name, TIPO_ENTRADA[a.type]]);

/**
 * Catalogo de aduanas de entrada. `test: true` marca las de PRE, que no deben
 * usarse en produccion pero SI deben existir: son las unicas con las que AEAT
 * ha aceptado nuestras ENS.
 */
const ENTRY_OFFICES = Object.freeze([
  Object.freeze({
    code: 'ES009999',
    name: 'PRE Pruebas Peninsula',
    type: 'test',
    modes: Object.freeze(['SEA', 'ROAD', 'RAIL', 'AIR']),
    test: true
  }),
  Object.freeze({
    code: 'ES009998',
    name: 'PRE Pruebas Canarias',
    type: 'test',
    modes: Object.freeze(['SEA', 'ROAD', 'RAIL', 'AIR']),
    test: true
  }),
  ...CATALOGO.map(([code, name, type]) => Object.freeze({
    code,
    name,
    type,
    modes: Object.freeze(MODOS_POR_TIPO[type])
  }))
]);

const POR_CODIGO = new Map(ENTRY_OFFICES.map(o => [o.code, o]));

/** Copia superficial mutable, para que quien llame no pueda corromper el catalogo. */
const _copia = (o) => ({ ...o, modes: [...o.modes] });

/** @returns {object|undefined} La aduana, o undefined si el codigo no existe. */
function getEntryOffice(code) {
  if (typeof code !== 'string' || !code) return undefined;
  const o = POR_CODIGO.get(code);
  return o ? _copia(o) : undefined;
}

/**
 * @param {string} [transportMode] - ROAD | RAIL | AIR | SEA. Sin modo, todo el
 *   catalogo. Un modo desconocido devuelve lista vacia: es mas honesto que
 *   ofrecer aduanas que no sirven.
 */
function listEntryOffices(transportMode) {
  const lista = transportMode
    ? ENTRY_OFFICES.filter(o => o.modes.includes(transportMode))
    : ENTRY_OFFICES;
  return lista.map(_copia);
}

function isValidEntryOffice(code) {
  return POR_CODIGO.has(code);
}

module.exports = { ENTRY_OFFICES, getEntryOffice, listEntryOffices, isValidEntryOffice };
