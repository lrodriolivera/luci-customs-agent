/**
 * Aduanas espanolas: lista OFICIAL (fuente unica de codigos y nombres).
 *
 * Procede de la lista "Aduanas mas utilizadas" (partes 1 y 2) que nos paso una
 * agente de aduanas en la UAT de noviembre de 2026. El codigo es ES00 + recinto
 * de 4 cifras, y el recinto es provincia (2 cifras) + oficina (2 cifras):
 * 28 01 = Madrid aeropuerto, 08 11 = Barcelona maritima importacion, etc.
 *
 * Antes LUCI tenia un catalogo sin cotejar con codigos equivocados, p. ej.:
 *   ES002801 figuraba como "Barcelona - Puerto"  -> es Madrid aeropuerto
 *   ES004601 figuraba como "Valencia - Puerto"   -> es Valencia aeropuerto
 *   ES003001 figuraba como "Algeciras - Puerto"  -> Algeciras maritima es ES001131
 * La guia tecnica CAU de la AEAT lo confirma: "Si se quiere obtener una
 * declaracion con circuito Naranja/Rojo en PRE, enviar como aduana de
 * numeracion ES001131/ES004611" (Algeciras maritima / Valencia maritima).
 *
 * Regla: aqui NO se inventa ningun codigo. Un recinto que no este en la lista
 * oficial no entra. ES009999/ES009998 (aduanas de pruebas de PRE) viven en
 * config/entryOffices.js, no aqui.
 *
 * Tipos:
 *   air        aeropuerto
 *   maritime   maritima (sentido 'export' si es solo de exportacion)
 *   road       carretera
 *   rail       ferrocarril (FF.CC.)
 *   inland     recinto interior: puerto seco, zona franca, ZAL, ZAISA
 *   admin      administracion u oficina provincial (no es recinto de paso)
 *   postal     postales, courier, paquete express
 *   deposit    deposito franco
 *   central    despacho centralizado
 *   domicile   domiciliacion
 *   other      resto (etiqueta verde, helipuerto, factorias, etc.)
 */

// Comunidad autonoma por provincia (dos primeras cifras del recinto).
const REGION_POR_PROVINCIA = Object.freeze({
  '01': 'Pais Vasco',
  '08': 'Cataluna',
  '11': 'Andalucia',
  '12': 'Comunidad Valenciana',
  '14': 'Andalucia',
  '20': 'Pais Vasco',
  '27': 'Galicia',
  '28': 'Madrid',
  '29': 'Andalucia',
  '36': 'Galicia',
  '41': 'Andalucia',
  '46': 'Comunidad Valenciana',
  '48': 'Pais Vasco'
});

// [recinto, nombre, tipo, sentido?] tal y como figuran en la lista oficial.
const LISTA = [
  // Madrid (28)
  ['2801', 'Madrid - Aeropuerto', 'air'],
  ['2803', 'Madrid - Barajas Postales', 'postal'],
  ['2804', 'Madrid - Barajas Courier', 'postal'],
  ['2811', 'Madrid - Puerto Seco', 'inland'],
  ['2841', 'Madrid - Carretera', 'road'],
  ['2855', 'Madrid - Despacho Centralizado', 'central'],
  ['2861', 'Madrid - Factorías', 'other'],
  ['2893', 'Madrid - Chamartín', 'other'],

  // Barcelona (08)
  ['0800', 'Barcelona - Adm. Provincial de Aduanas e IE', 'admin'],
  ['0801', 'Barcelona - Aeropuerto', 'air'],
  ['0803', 'Barcelona - Aeropuerto Postales', 'postal'],
  ['0806', 'Barcelona - Aeropuerto Depósito Franco', 'deposit'],
  ['0811', 'Barcelona - Marítima Importación', 'maritime', 'import'],
  ['0812', 'Barcelona - Marítima Exportación', 'maritime', 'export'],
  ['0813', 'Barcelona - Marítima Postales', 'postal'],
  ['0814', 'Barcelona - Marítima Etiqueta Verde', 'other'],
  ['0821', 'Barcelona - Zona Franca', 'inland'],
  ['0841', 'Barcelona - Carretera', 'road'],
  ['0855', 'Barcelona - Despacho Centralizado', 'central'],
  ['0860', 'Barcelona - Domiciliación', 'domicile'],
  // Tal cual en la lista ("FF.Segera"); no se corrige el nombre a ciegas.
  ['0871', 'Barcelona - FF.CC. Segera', 'rail'],
  ['0873', 'Barcelona - Paquete Express', 'postal'],
  ['0881', 'Barcelona - FF.CC. Morrot', 'rail'],

  // Valencia (46)
  ['4600', 'Valencia - Adm. Provincial de Aduanas e IE', 'admin'],
  ['4601', 'Valencia - Aeropuerto', 'air'],
  ['4604', 'Valencia - Aeropuerto Postales', 'postal'],
  ['4610', 'Valencia - Oficina Marítima', 'admin'],
  ['4611', 'Valencia - Marítima', 'maritime'],
  ['4615', 'Valencia - Depósito Franco', 'deposit'],
  ['4621', 'Sagunto - Marítima', 'maritime'],
  ['4631', 'Gandía - Marítima', 'maritime'],
  ['4641', 'Valencia - Carretera', 'road'],
  ['4651', 'Sagunto - Carretera', 'road'],
  ['4655', 'Valencia - Despacho Centralizado', 'central'],
  ['4661', 'Gandía - Carretera', 'road'],
  ['4673', 'Valencia - Postales', 'postal'],

  // Guipuzcoa (20)
  ['2000', 'Irún - Adm. Provincial de Aduanas e IE', 'admin'],
  ['2001', 'Irún - Aeropuerto', 'air'],
  ['2010', 'Pasajes - Adm. de Aduanas e IE', 'admin'],
  ['2011', 'Pasajes - Marítima', 'maritime'],
  ['2021', 'Pasajes - Depósito Franco', 'deposit'],
  ['2045', 'Irún - ZAISA', 'inland'],
  ['2050', 'Irún - Domiciliación', 'domicile'],
  ['2055', 'Guipúzcoa - Despacho Centralizado', 'central'],
  ['2073', 'Irún - Postales', 'postal'],

  // Cadiz (11): Algeciras y Cadiz
  ['1100', 'Cádiz - Adm. Provincial de Aduanas e IE', 'admin'],
  ['1111', 'Cádiz - Marítima', 'maritime'],
  ['1114', 'Cádiz - Etiqueta Verde', 'other'],
  ['1115', 'Cádiz - Zona Franca', 'inland'],
  ['1130', 'Algeciras - Domiciliación', 'domicile'],
  ['1131', 'Algeciras - Marítima (Tránsito)', 'maritime'],
  ['1132', 'Algeciras - Despacho Ceuta', 'other'],
  ['1135', 'Algeciras - Depósito Franco', 'deposit'],
  ['1136', 'Algeciras - Helipuerto', 'other'],
  ['1141', 'Cádiz - Carretera', 'road'],
  ['1155', 'Cádiz - Despacho Centralizado', 'central'],
  ['1171', 'Cádiz - FF.CC.', 'rail'],
  ['1175', 'Algeciras - Despacho Centralizado', 'central'],

  // Bizkaia (48)
  ['4800', 'Bilbao - Adm. Provincial de Aduanas e IE', 'admin'],
  ['4801', 'Bilbao - Aeropuerto', 'air'],
  ['4811', 'Bilbao - Marítima', 'maritime'],
  ['4821', 'Bilbao - Depósito Franco', 'deposit'],
  ['4825', 'Bilbao - ZAL', 'inland'],
  ['4850', 'Bilbao - Domiciliación', 'domicile'],
  ['4855', 'Bilbao - Despacho Centralizado', 'central'],
  ['4874', 'Bilbao - Postales', 'postal'],

  // Pontevedra (36): Vigo
  ['3601', 'Vigo - Aeropuerto', 'air'],
  ['3610', 'Vigo - Adm. Provincial de Aduanas e IE', 'admin'],
  ['3611', 'Vigo - Marítima', 'maritime'],
  ['3613', 'Vigo - Postales', 'postal'],
  ['3641', 'Vigo - Carretera', 'road'],
  ['3675', 'Vigo - Despacho Centralizado', 'central'],
  ['3681', 'Vigo - Zona Franca', 'inland'],
  ['3691', 'Vigo - Domiciliación', 'domicile'],

  // Sevilla (41)
  ['4100', 'Sevilla - Adm. Provincial de Aduanas e IE', 'admin'],
  ['4101', 'Sevilla - Aeropuerto', 'air'],
  ['4111', 'Sevilla - Marítima', 'maritime'],
  ['4114', 'Sevilla - Postales', 'postal'],
  ['4115', 'Sevilla - Zona Franca', 'inland'],
  ['4121', 'Sevilla - Depósito Franco', 'deposit'],
  ['4141', 'Sevilla - Carretera', 'road'],
  ['4155', 'Sevilla - Despacho Centralizado', 'central'],
  ['4171', 'Sevilla - FF.CC.', 'rail'],
  ['4195', 'Sevilla - Paquete Express', 'postal'],

  // Castellon (12)
  ['1200', 'Castellón - Adm. Provincial de Aduanas e IE', 'admin'],
  ['1201', 'Castellón - Aeropuerto', 'air'],
  ['1211', 'Castellón - Marítima', 'maritime'],
  ['1241', 'Castellón - Carretera', 'road'],
  ['1247', 'Castellón - Carretera Fruta', 'road'],
  ['1255', 'Castellón - Despacho Centralizado', 'central'],

  // Alava (01)
  ['0100', 'Álava - Adm. Provincial de Aduanas e IE', 'admin'],
  ['0101', 'Álava - Aeropuerto', 'air'],
  ['0141', 'Álava - Carretera', 'road'],
  ['0155', 'Álava - Despacho Centralizado', 'central'],

  // Cordoba (14). La lista solo dice "Cordoba" para 1441; no se le asigna tipo.
  ['1400', 'Córdoba - Adm. Provincial de Aduanas e IE', 'admin'],
  ['1441', 'Córdoba', 'other'],

  // Malaga (29)
  ['2900', 'Málaga - Adm. Provincial de Aduanas e IE', 'admin'],
  ['2901', 'Málaga - Aeropuerto', 'air'],
  ['2911', 'Málaga - Marítima', 'maritime'],
  ['2914', 'Málaga - Etiqueta Verde', 'other'],
  ['2915', 'Málaga - Domiciliación', 'domicile'],
  ['2941', 'Málaga - Carretera', 'road'],
  ['2955', 'Málaga - Despacho Centralizado', 'central'],
  ['2971', 'Málaga - FF.CC.', 'rail'],

  // Lugo (27)
  ['2700', 'Lugo - Adm. Provincial de Aduanas e IE', 'admin'],
  ['2741', 'Lugo - Depósitos', 'deposit']
];

const ADUANAS_OFICIALES = Object.freeze(LISTA.map(([recinto, name, type, sentido]) => Object.freeze({
  code: `ES00${recinto}`,
  recinto,
  name,
  type,
  region: REGION_POR_PROVINCIA[recinto.slice(0, 2)],
  ...(sentido ? { sentido } : {})
})));

const POR_CODIGO = new Map(ADUANAS_OFICIALES.map(a => [a.code, a]));

/** @returns {object|undefined} La aduana oficial con ese codigo ES00xxxx. */
function getAduanaOficial(code) {
  if (typeof code !== 'string') return undefined;
  return POR_CODIGO.get(code.trim().toUpperCase());
}

/** Mapa codigo -> nombre, para los generadores que solo muestran el nombre. */
function nombresPorCodigo() {
  return Object.fromEntries(ADUANAS_OFICIALES.map(a => [a.code, a.name]));
}

// ---------------------------------------------------------------------------
// Lugar (puerto / aeropuerto / ciudad) -> aduana
// ---------------------------------------------------------------------------

// Plazas con mas de un recinto. El orden importa: los nombres concretos
// (Algeciras, Sagunto, Gandia, Pasajes) van antes que la provincia que los
// contiene, para que "Puerto de Algeciras (Cadiz)" no acabe en Cadiz.
// `claves` son palabras completas; los codigos IATA/LOCODE tambien casan con
// prefijo ES (ESBCN, ESVLC...).
const PLAZAS = [
  { claves: ['ALGECIRAS', 'ALG', 'ESALG'], maritime: '1131' },
  { claves: ['SAGUNTO', 'SAG'], maritime: '4621', road: '4651' },
  { claves: ['GANDIA'], maritime: '4631', road: '4661' },
  { claves: ['PASAJES', 'PASAIA', 'PAS'], maritime: '2011' },
  { claves: ['BARCELONA', 'BCN', 'PRAT'], air: '0801', maritime: '0811', maritimeExport: '0812', road: '0841', rail: '0881' },
  { claves: ['MADRID', 'BARAJAS', 'MAD'], air: '2801', road: '2841' },
  { claves: ['VALENCIA', 'VLC', 'MANISES'], air: '4601', maritime: '4611', road: '4641' },
  { claves: ['BILBAO', 'BIO'], air: '4801', maritime: '4811' },
  { claves: ['VIGO', 'VGO'], air: '3601', maritime: '3611', road: '3641' },
  { claves: ['SEVILLA', 'SVQ'], air: '4101', maritime: '4111', road: '4141', rail: '4171' },
  { claves: ['MALAGA', 'AGP'], air: '2901', maritime: '2911', road: '2941', rail: '2971' },
  { claves: ['CASTELLON', 'CDT'], air: '1201', maritime: '1211', road: '1241' },
  { claves: ['CADIZ'], maritime: '1111', road: '1141', rail: '1171' },
  { claves: ['IRUN'], air: '2001' },
  { claves: ['VITORIA', 'ALAVA', 'VIT'], air: '0101', road: '0141' }
];

// Modo de transporte -> tipo de recinto. Acepta los modos de ENS (SEA/AIR/...)
// y los del expediente (maritime/air/...).
const TIPO_POR_MODO = {
  SEA: 'maritime', MARITIME: 'maritime', '1': 'maritime',
  AIR: 'air', '4': 'air',
  ROAD: 'road', '3': 'road',
  RAIL: 'rail', '2': 'rail'
};

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function tipoPorTexto(texto) {
  // AEROPUERTO contiene PUERTO: el aereo se mira primero.
  if (/AEROPUERTO|AIRPORT|\bAEREO\b|\bAIR\b|BARAJAS|\bPRAT\b|MANISES/.test(texto)) return 'air';
  if (/PUERTO|\bPORT\b|MARITIM|\bSEA\b/.test(texto)) return 'maritime';
  if (/CARRETERA|\bROAD\b/.test(texto)) return 'road';
  if (/FERROCARRIL|\bRAIL\b|FF\.?\s?CC/.test(texto)) return 'rail';
  return null;
}

// Compara palabra a palabra (sin expresiones regulares construidas a partir de
// datos): "PUERTO DE ALGECIRAS" -> [PUERTO, DE, ALGECIRAS].
function casaPlaza(palabras, plaza) {
  return plaza.claves.some(c => palabras.includes(c) || palabras.includes(`ES${c}`));
}

/**
 * Deduce la aduana a partir de un lugar libre ("Puerto de Algeciras",
 * "BCN", "ESVLC", "Aeropuerto de Barajas"...). Si el texto ya es un codigo de
 * la lista oficial, se devuelve tal cual.
 *
 * @param {string} lugar
 * @param {object} [opciones]
 * @param {string} [opciones.modo] - SEA/AIR/ROAD/RAIL o maritime/air/road/rail.
 * @param {'import'|'export'} [opciones.sentido='import']
 * @returns {string|null} Codigo ES00xxxx o null si no se reconoce la plaza.
 */
function aduanaPorLugar(lugar, { modo, sentido = 'import' } = {}) {
  if (typeof lugar !== 'string' || !lugar.trim()) return null;
  const texto = sinTildes(lugar).toUpperCase().trim();

  if (POR_CODIGO.has(texto)) return texto;

  const palabras = texto.split(/[^A-Z]+/).filter(Boolean);
  const plaza = PLAZAS.find(p => casaPlaza(palabras, p));
  if (!plaza) return null;

  const tipo = tipoPorTexto(texto) || TIPO_POR_MODO[String(modo || '').toUpperCase()] || null;
  const maritima = sentido === 'export' ? (plaza.maritimeExport || plaza.maritime) : plaza.maritime;
  const porTipo = { maritime: maritima, air: plaza.air, road: plaza.road, rail: plaza.rail };

  // Sin pista de modo, o si la plaza no tiene ese tipo de recinto: maritimo
  // primero (es el trafico principal de importacion), luego aereo.
  const recinto = (tipo && porTipo[tipo]) || maritima || plaza.air || plaza.road || plaza.rail;
  return recinto ? `ES00${recinto}` : null;
}

module.exports = {
  ADUANAS_OFICIALES,
  REGION_POR_PROVINCIA,
  getAduanaOficial,
  nombresPorCodigo,
  aduanaPorLugar
};
