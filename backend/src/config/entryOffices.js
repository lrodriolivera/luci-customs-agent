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
 * Se toma como base el catalogo de services/aeat/aeatConfig.js porque es el que
 * ya alimenta los builders H1/H7/AES/NCTS, es decir el que ya ha pasado por
 * AEAT. Los `modes` se derivan del tipo de aduana.
 *
 * PENDIENTE: cotejar los codigos contra el censo oficial de aduanas de AEAT.
 * Aqui no se inventa ninguno; el unico con respaldo empirico directo es
 * ES009999 (las 8 ENS con MRN real de PRE se presentaron con ella).
 */

// Modos de transporte por tipo de aduana. Una aduana maritima o aerea admite
// tambien ROAD porque la mercancia puede llegar por carretera al recinto.
const MODOS_POR_TIPO = {
  maritime: ['SEA', 'ROAD'],
  air: ['AIR', 'ROAD'],
  land: ['ROAD', 'RAIL'],
  inland: ['ROAD', 'RAIL']
};

// [codigo, nombre, tipo] tal y como figuran en aeatConfig.CUSTOMS_OFFICES.
const CATALOGO = [
  // Puertos
  ['ES002801', 'Barcelona - Puerto', 'maritime'],
  ['ES004601', 'Valencia - Puerto', 'maritime'],
  ['ES003001', 'Algeciras - Puerto', 'maritime'],
  ['ES004801', 'Bilbao - Puerto', 'maritime'],
  ['ES003501', 'Las Palmas', 'maritime'],
  ['ES003801', 'Tenerife', 'maritime'],
  ['ES000401', 'Alicante - Puerto', 'maritime'],
  ['ES004101', 'Sevilla - Puerto', 'maritime'],
  ['ES001501', 'Cadiz - Puerto', 'maritime'],
  ['ES004301', 'Tarragona - Puerto', 'maritime'],

  // Aeropuertos
  ['ES002805', 'Barcelona - Aeropuerto', 'air'],
  ['ES002101', 'Madrid - Barajas', 'air'],
  ['ES004605', 'Valencia - Aeropuerto', 'air'],
  ['ES002901', 'Malaga - Aeropuerto', 'air'],
  ['ES004105', 'Sevilla - Aeropuerto', 'air'],
  ['ES004805', 'Bilbao - Aeropuerto', 'air'],

  // Fronteras terrestres (las unicas con trafico ferroviario real)
  ['ES001701', 'La Junquera', 'land'],
  ['ES002001', 'Irun', 'land'],
  ['ES000101', 'Fuentes de Onoro', 'land'],

  // Aduanas interiores
  ['ES002105', 'Madrid - Coslada', 'inland'],
  ['ES002809', 'Barcelona - ZAL', 'inland']
];

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
