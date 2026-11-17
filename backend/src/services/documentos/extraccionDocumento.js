/**
 * Lectura de un documento del expediente (factura, packing list, BL, AWB, CMR…)
 * y propuesta de cambios sobre el expediente.
 *
 * Tres piezas, todas puras salvo la llamada a la IA (que vive en aiService):
 *
 *  - PROMPT + `normalizarExtraccion`: la IA devuelve un JSON con un esquema
 *    fijo. Lo que no se lee con certeza llega como null: aqui no se rellena
 *    ni se deduce nada.
 *  - `proponerCambios`: compara lo leido con el expediente y lista los campos
 *    en los que el documento aporta un dato distinto del que hay.
 *  - `aplicarCambios`: escribe en el expediente SOLO las claves que el agente
 *    ha marcado, y solo si siguen en la propuesta. Nunca se aplica nada solo.
 *
 * Origen: UAT del 10/Nov/2026. El agente rellenaba el expediente a mano con el
 * documento delante; al subirlo, LUCI lo dejaba en «Pendiente» y no leia nada.
 */

const logger = require('../../config/logger');
const {
  separarContenedoresYPrecintos, deducirTipoCarga, ciudadSinEstado, vueloPrincipal, nacionalidadDelMedio, numeroImo, mrnLeido
} = require('./datosTransporte');

const SYSTEM_PROMPT = `Eres un lector de documentos de comercio exterior (facturas comerciales, packing lists, conocimientos de embarque, cartas de porte aereo, CMR, documentos de acompañamiento de transito T1/T2, certificados).

Tu unica tarea es TRANSCRIBIR los datos que figuran en el documento adjunto. Reglas:
- Escribe solo lo que se lee con certeza en el documento. Si un dato no esta, o no se lee bien, usa null. Nunca deduzcas, completes ni corrijas un valor.
- Los importes y pesos van como numeros (punto decimal, sin separador de millares). Los pesos en kilogramos.
- Los paises van con su codigo ISO de dos letras SOLO si el documento lo permite saber sin duda (nombre del pais o codigo); si no, null.
- "ciudad" es solo el nombre de la localidad (y la provincia, si figura). El codigo postal va aparte, en "codigoPostal", tal como aparece; nunca dentro de "ciudad" ni de "direccion". En las direcciones de EE. UU., Mexico o Canada la ciudad va seguida del codigo del estado («SOLON OH 44139», «MADERO CMX 07918»): ese codigo del estado NO es la ciudad ni forma parte de ella («SOLON», «MADERO»).
- "codigoMercancia" es el codigo arancelario tal como aparece (HS, NC o TARIC), solo digitos.
- "tipoCarga": "FCL" o "LCL" SOLO si el documento lleva escrita literalmente una de esas siglas (o FCL/FCL, LCL/LCL, CY/CY, CFS/CFS); si no, null. No lo deduzcas tu.
- "indicacionesCarga": transcribe tal cual las expresiones del documento que indiquen como va la carga: terminos de servicio (CY/CY, CFS/CFS, FCL/FCL, LCL), clausulas («SHIPPER'S LOAD, COUNT AND SEAL», «SLAC», «CONSOLIDATED», «GROUPAGE», «PART OF CONTAINER») y el tipo y tamaño de cada contenedor (20GP, 40HC, 45G1). Si no hay ninguna, [].
- "medio" es el NOMBRE del medio de transporte: nombre del buque, numero de vuelo o matricula del camion. El modo (maritimo, aereo, carretera) NO es un medio: en ese caso, null. En una carta de porte aereo (AWB) el medio es el numero del PRIMER vuelo (casillas Flight/Date, «5X 1441/23» -> "5X 1441", sin el dia); si hay mas vuelos, anotalos en "notas".
- "numeroDocumento" es el numero del documento de transporte principal (BL o AWB master, MAWB). "documentoHijo" es el del documento hijo si figura: HAWB («HAWB No», «House AWB») en un AWB o HBL en un BL; si no hay hijo, null.
- "contenedores" son SOLO matriculas de contenedor ISO 6346: cuatro letras (la cuarta U, J o Z) y siete cifras («MAGU5599236»), sin el tipo (40HQ, 20GP). Los numeros de precinto (Seal No., precinto, sello) van en "precintos", nunca en "contenedores": en la casilla «Container No. / Seal No.» de un BL suelen ir alternados.
- "confianza" es un entero de 0 a 100: cuanto de completo y legible esta el documento.
- "legible": false si el documento esta en blanco, es ilegible o no es un documento de comercio exterior. En ese caso explica el motivo en "notas".
- "cantidad" es el numero de unidades de la linea (columnas Qty, Quantity, Cantidad, Uds, Pcs). "unidad" es la unidad que figura junto a ella (PCE, PCS, KG...); si la columna no lleva unidad, null. El numero de bultos (packages, cartons, pallets: «54 PACKAGES») va en "bultos" y "tipoBulto"; los bultos NUNCA son la "cantidad": si el documento no da unidades de mercancia, "cantidad" y "unidad" son null.
- "nacionalidadMedio" es el pais de la bandera o de matriculacion del medio de transporte, SOLO si el documento lo escribe: casillas «Flag», «Vessel flag», «Bandera», «Nationality», «Nacionalidad»; en un CMR, el pais o el signo distintivo que acompaña a la matricula de la tractora («E», «D», «PL», «TR»). Codigo ISO de dos letras o el signo distintivo tal cual figura. NUNCA la deduzcas del nombre del buque, de la naviera, del numero IMO, del puerto ni de la matricula sin signo: si no esta escrita, null.
- "imo" es el numero IMO del buque (siete cifras, «IMO 9839284») si figura; si no, null.
- En un CMR (convenio CMR): "numeroDocumento" es el numero del CMR; "exportador" es el remitente (casilla 1) e "importador" el destinatario (casilla 2); "puertoCarga" es el lugar de carga (casilla 4) y "puertoDescarga" el lugar de entrega (casilla 3); "medio" es la matricula de la tractora o camion (casilla del transportista, 16, o «Matricula»/«Kennzeichen»/«Registration»); "remolque" es la matricula del remolque o semirremolque si figura aparte; las partidas salen de las casillas 6 a 11 (marcas, bultos, embalaje, naturaleza, numero estadistico y peso bruto).
- Un documento de acompañamiento de transito (DAT/TAD, T1, T2, NCTS) es "transit_document". En el: "transito.mrn" es el MRN del transito (18 caracteres); "transito.oficinaPartida" y "transito.oficinaDestino" son los codigos de las aduanas de partida y de destino (dos letras y seis caracteres, «ES004611»); "transito.garantia" es el numero de referencia de la garantia (GRN); "medio" es la identificacion del medio de transporte a la partida (matricula); "nacionalidadMedio" es SOLO la nacionalidad del medio de transporte ACTIVO en la frontera si figura (no la del medio a la partida); "numeroDocumento" es null. En cualquier otro documento "transito" va con todo a null.
- "factura" es solo para facturas. Un documento de transporte (BL, AWB, CMR) o de transito (T1) no es una factura: no rellenes con el numero, la fecha ni el importe de "factura" (la fecha de emision del BL o del AWB no es la de una factura); la moneda y el incoterm que figuren si pueden ir.
- "telefono" y "email" de cada parte, tal como aparecen; si no figuran, null.
- "notas": incidencias que el agente de aduanas deba conocer (dato dudoso, totales que no cuadran dentro del propio documento, paginas que faltan). Frases cortas. NO es una incidencia que falte un dato opcional: no anotes que el incoterm no lleva lugar, que no hay peso neto, peso o bultos por linea, ni que falta el telefono o el correo. Tampoco es una incidencia la forma normal de un documento: que un packing list totalice los bultos sin detallarlos uno a uno (una linea y un total de 12 bultos NO es una discrepancia), ni que una descripcion aparezca abreviada o cortada. Solo es incidencia de totales cuando dos cifras del propio documento se contradicen. Si no hay incidencias, [].

Responde UNICAMENTE con un JSON con esta forma exacta:
{
  "legible": true,
  "tipoDetectado": "commercial_invoice | proforma_invoice | packing_list | bill_of_lading | air_waybill | cmr | transit_document | certificate_origin | other",
  "confianza": 0,
  "notas": [],
  "exportador": { "nombre": null, "direccion": null, "ciudad": null, "codigoPostal": null, "pais": null, "telefono": null, "email": null },
  "importador": { "nombre": null, "identificacionFiscal": null, "direccion": null, "ciudad": null, "codigoPostal": null, "pais": null, "telefono": null, "email": null },
  "factura": { "numero": null, "fecha": null, "moneda": null, "importeTotal": null, "incoterm": null, "lugarIncoterm": null },
  "transporte": { "numeroDocumento": null, "medio": null, "puertoCarga": null, "puertoDescarga": null, "contenedores": [], "precintos": [], "documentoHijo": null, "tipoCarga": null, "indicacionesCarga": [], "nacionalidadMedio": null, "imo": null, "remolque": null },
  "transito": { "mrn": null, "oficinaPartida": null, "oficinaDestino": null, "garantia": null },
  "partidas": [ { "descripcion": null, "codigoMercancia": null, "paisOrigen": null, "cantidad": null, "unidad": null, "bultos": null, "tipoBulto": null, "pesoBrutoKg": null, "pesoNetoKg": null, "importe": null } ],
  "totales": { "bultos": null, "pesoBrutoKg": null, "pesoNetoKg": null }
}`;

const construirPrompt = (document) =>
  `Lee el documento adjunto. El agente lo ha clasificado como "${document.type}"; ` +
  'si ves que es de otro tipo, indicalo en "tipoDetectado". Responde solo con el JSON pedido.';

// ---- Normalizacion ------------------------------------------------------------

const TIPOS_DOCUMENTO = [
  'commercial_invoice', 'proforma_invoice', 'packing_list', 'bill_of_lading',
  'air_waybill', 'cmr', 'transit_document', 'certificate_origin', 'other'
];
// Tipos de bulto UN/ECE Rec. 21 que ofrece la aplicacion.
const TIPOS_BULTO = ['CT', 'PX', 'BX', 'PK', 'BG', 'DR', 'CR', 'NE'];
const TIPOS_BULTO_POR_TEXTO = {
  CTN: 'CT', CTNS: 'CT', CARTON: 'CT', CARTONS: 'CT', CAJA: 'BX', CAJAS: 'BX', BOX: 'BX', BOXES: 'BX',
  PLT: 'PX', PLTS: 'PX', PALLET: 'PX', PALLETS: 'PX', PALE: 'PX', PALES: 'PX', PALET: 'PX', PALETS: 'PX',
  PKG: 'PK', PKGS: 'PK', PACKAGE: 'PK', PACKAGES: 'PK', BULTO: 'PK', BULTOS: 'PK',
  BAG: 'BG', BAGS: 'BG', SACO: 'BG', SACOS: 'BG', DRUM: 'DR', DRUMS: 'DR', BIDON: 'DR', BIDONES: 'DR',
  CRATE: 'CR', CRATES: 'CR', JAULA: 'CR', JAULAS: 'CR'
};
const MAX_TEXTO = 500;
const MAX_PARTIDAS = 200;
const MAX_NOTAS = 20;
// Documentos de transporte y de transito: no rellenan los datos de la
// factura y son los unicos que aportan el medio y su nacionalidad.
const TIPOS_TRANSPORTE = ['bill_of_lading', 'air_waybill', 'cmr', 'transit_document'];

const texto = (valor) => {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'object') return null;
  const limpio = String(valor).trim().slice(0, MAX_TEXTO);
  return limpio === '' || /^(null|n\/a|none|-)$/i.test(limpio) ? null : limpio;
};

// Un telefono es una cadena corta de digitos con, como mucho, +, espacios,
// parentesis, puntos y guiones; cualquier otra cosa no se da por telefono.
const telefono = (valor) => {
  const t = texto(valor);
  if (!t || t.length > 30 || !/^[+\d\s().-]+$/.test(t)) return null;
  return t.replace(/\D/g, '').length >= 6 ? t : null;
};

const correo = (valor) => {
  const t = texto(valor);
  return t && t.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t.toLowerCase() : null;
};

const numero = (valor) => {
  if (valor === null || valor === undefined || valor === '' || typeof valor === 'boolean') return null;
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(/\s/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const pais = (valor) => {
  const t = texto(valor);
  return t && /^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : null;
};

const moneda = (valor) => {
  const t = texto(valor);
  return t && /^[A-Za-z]{3}$/.test(t) ? t.toUpperCase() : null;
};

const tipoBulto = (valor) => {
  const t = texto(valor);
  if (!t) return null;
  const clave = t.toUpperCase().replace(/[^A-Z]/g, '');
  if (TIPOS_BULTO.includes(clave)) return clave;
  return TIPOS_BULTO_POR_TEXTO[clave] || null;
};

// El modelo a veces expresa la confianza como fraccion (0,92) y a veces como
// porcentaje (92). Un valor entre 0 y 1 con decimales es una fraccion; un 1
// exacto es ambiguo y se toma como 100 %, que es lo que quiere decir.
const escalaConfianza = (valor) => {
  const n = numero(valor);
  if (n === null) return 0;
  const porcentaje = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(porcentaje)));
};

// Modos de transporte que el modelo puede devolver en lugar del nombre del medio.
const MODOS_NO_SON_MEDIO = /^(mar[ií]timo|maritime|sea|a[eé]reo|air|carretera|road|terrestre|ferrocarril|rail|multimodal)$/i;
const medioDeTransporte = (valor) => {
  const t = texto(valor);
  return t && !MODOS_NO_SON_MEDIO.test(t) ? t : null;
};

// Localidad y codigo postal. El codigo postal va en su campo; si el modelo lo
// deja pegado a la ciudad («46988, Paterna» / «Shanghai 200120»), se separa:
// en el expediente son dos datos distintos.
const CP_AL_PRINCIPIO = /^(\d{4,6})[\s,;.-]+(?=\D)/;
const CP_AL_FINAL = /[\s,;.-]+(\d{4,6})$/;
const localidad = (ciudadBruta, codigoPostalBruto) => {
  const ciudad = texto(ciudadBruta);
  const codigoPostal = texto(codigoPostalBruto);
  if (!ciudad) return { ciudad: null, codigoPostal };
  const hallado = CP_AL_PRINCIPIO.exec(ciudad) || CP_AL_FINAL.exec(ciudad);
  if (!hallado) return { ciudad, codigoPostal };
  const sinCodigo = ciudad.replace(hallado[0], '').trim();
  return { ciudad: sinCodigo || ciudad, codigoPostal: sinCodigo ? (codigoPostal || hallado[1]) : codigoPostal };
};

// Ciudad sin el codigo postal ni el del estado («SOLON OH 44139» -> «SOLON»).
const ubicacion = (parte) => {
  const codigoPais = pais(parte.pais);
  const { ciudad, codigoPostal } = localidad(parte.ciudad, parte.codigoPostal);
  return { ciudad: ciudadSinEstado(ciudad, codigoPais), codigoPostal, pais: codigoPais };
};

// Los bultos no son la cantidad de mercancia: si la unidad leida es un tipo
// de bulto («54 PACKAGES»), la cantidad se quita y, si no habia bultos,
// pasa a ellos (prueba en produccion de un BL, 13/Nov/2026).
const unidadDeBulto = (unidad) => {
  const clave = (texto(unidad) || '').toUpperCase().replace(/[^A-Z]/g, '');
  return TIPOS_BULTO_POR_TEXTO[clave] || null;
};

const partidaNormalizada = (p, esTransporte) => {
  const cantidad = numero(p.cantidad);
  const bultoComoUnidad = unidadDeBulto(p.unidad);
  const bultos = numero(p.bultos);
  return {
    descripcion: texto(p.descripcion),
    codigoMercancia: (texto(p.codigoMercancia) || '').replace(/\D/g, '') || null,
    paisOrigen: pais(p.paisOrigen),
    cantidad: bultoComoUnidad ? null : cantidad,
    unidad: bultoComoUnidad ? null : texto(p.unidad),
    bultos: bultos ?? (bultoComoUnidad ? cantidad : null),
    tipoBulto: tipoBulto(p.tipoBulto) || (bultoComoUnidad && (bultos ?? cantidad) !== null ? bultoComoUnidad : null),
    pesoBrutoKg: numero(p.pesoBrutoKg), pesoNetoKg: numero(p.pesoNetoKg),
    // El valor que pueda figurar en un documento de transporte no es el de la factura.
    importe: esTransporte ? null : numero(p.importe)
  };
};

const NOMBRE_HIJO = { air_waybill: 'AWB hija (HAWB)', bill_of_lading: 'BL hijo (HBL)' };

// Avisos que se añaden a las notas del modelo: lo que la lectura ha separado
// o no tiene sitio en el expediente, para que el agente lo vea.
const notaCifrasDeMas = ({ leido, numero, digitoCorrecto }) =>
  `El documento trae el contenedor ${leido} con cifras de más: se ha tomado ${numero} (4 letras y 7 cifras, ISO 6346); ` +
  (digitoCorrecto ? 'su dígito de control cuadra.' : 'su dígito de control no cuadra: compruébalo con el documento.');

const notasDelMedio = ({ nacionalidad, imo, remolque, mrn, transito }) => [
  ...(nacionalidad.signo ? [`Nacionalidad del medio leída del signo distintivo «${nacionalidad.signo}» de la matrícula: ${nacionalidad.pais}.`] : []),
  ...(imo ? [imo.digitoCorrecto
    ? `Buque con número IMO ${imo.numero}.`
    : `Comprueba el número IMO ${imo.numero}: su dígito de control no cuadra.`] : []),
  ...(remolque ? [`Remolque o semirremolque: ${remolque}.`] : []),
  ...(mrn ? [`MRN del tránsito (T1): ${mrn.numero}` +
    (transito.oficinaPartida || transito.oficinaDestino ? `, de ${transito.oficinaPartida || '?'} a ${transito.oficinaDestino || '?'}` : '') +
    (mrn.digitoCorrecto ? '.' : '. Su dígito de control no cuadra: compruébalo con el documento.')] : [])
];

// Codigo de una aduana (lista de oficinas de la UE): pais y seis caracteres.
const oficinaAduana = (valor) => {
  const t = (texto(valor) || '').toUpperCase().replace(/\s/g, '');
  return /^[A-Z]{2}[A-Z0-9]{6}$/.test(t) ? t : null;
};

const notasDeTransporte = ({ precintos, digitoIncorrecto, cifrasDeMas, documentoHijo, otrosVuelos, tipo, notaTipoCarga }) => [
  ...(precintos.length > 0 ? [`Precintos (no son contenedores): ${precintos.join(', ')}.`] : []),
  ...cifrasDeMas.map(notaCifrasDeMas),
  ...digitoIncorrecto.map(c => `Comprueba el contenedor ${c}: su dígito de control no cuadra (ISO 6346).`),
  ...(notaTipoCarga ? [notaTipoCarga] : []),
  ...(documentoHijo ? [`${NOMBRE_HIJO[tipo] || 'Documento hijo'}: ${documentoHijo}.`] : []),
  ...(otrosVuelos.length > 0 ? [`Otros vuelos: ${otrosVuelos.join(', ')}.`] : [])
];

const objeto = (valor) => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});
const lista = (valor) => (Array.isArray(valor) ? valor : []);

/**
 * Deja la respuesta de la IA en el esquema fijo: tipos comprobados, textos
 * recortados y null en todo lo que no llegue bien formado.
 *
 * Ademas corrige en codigo lo que el modelo puede mezclar en un documento de
 * transporte: los precintos salen de los contenedores, la factura queda sin
 * numero, fecha ni importe, la ciudad sin el codigo de estado y, en un AWB,
 * el medio es el primer vuelo sin el dia.
 *
 * @param {object} bruto JSON devuelto por el modelo
 * @param {{ tipoDeclarado?: string }} [opciones] tipo con el que se subio el
 *   documento; vale si el modelo no reconoce el tipo
 * @returns {object} extraccion normalizada
 */
function normalizarExtraccion(bruto, { tipoDeclarado } = {}) {
  const r = objeto(bruto);
  const exp = objeto(r.exportador);
  const imp = objeto(r.importador);
  const fac = objeto(r.factura);
  const tra = objeto(r.transporte);
  const tot = objeto(r.totales);
  const tran = objeto(r.transito);
  const incoterm = texto(fac.incoterm);
  const tipoDetectado = TIPOS_DOCUMENTO.includes(r.tipoDetectado) ? r.tipoDetectado : null;
  const tipo = tipoDetectado && tipoDetectado !== 'other' ? tipoDetectado : tipoDeclarado;
  const esTransporte = TIPOS_TRANSPORTE.includes(tipo);
  const { contenedores, precintos, digitoIncorrecto, cifrasDeMas } = separarContenedoresYPrecintos(tra.contenedores, tra.precintos);
  const { tipoCarga, nota: notaTipoCarga } = deducirTipoCarga({
    literal: texto(tra.tipoCarga),
    indicaciones: tra.indicacionesCarga,
    leidosContenedor: [...lista(tra.contenedores), ...lista(tra.precintos)],
    contenedores,
    tipo,
    embalajes: lista(r.partidas).map((p) => p && p.tipoBulto)
  });
  const medio = medioDeTransporte(tra.medio);
  const { vuelo, otros: otrosVuelos } = tipo === 'air_waybill' ? vueloPrincipal(medio) : { vuelo: medio, otros: [] };
  const numeroDocumento = texto(tra.numeroDocumento);
  const hijo = texto(tra.documentoHijo);
  const documentoHijo = hijo && hijo !== numeroDocumento ? hijo : null;
  const nacionalidad = nacionalidadDelMedio(tra.nacionalidadMedio);
  const imo = numeroImo(tra.imo);
  const remolque = texto(tra.remolque);
  const mrn = mrnLeido(tran.mrn);
  const transito = {
    mrn: mrn ? mrn.numero : null,
    oficinaPartida: oficinaAduana(tran.oficinaPartida),
    oficinaDestino: oficinaAduana(tran.oficinaDestino),
    garantia: texto(tran.garantia)
  };
  const notasModelo = lista(r.notas).map(texto).filter(Boolean).slice(0, MAX_NOTAS);
  const notasNuevas = [
    ...notasDeTransporte({ precintos, digitoIncorrecto, cifrasDeMas, documentoHijo, otrosVuelos, tipo, notaTipoCarga }),
    ...notasDelMedio({ nacionalidad, imo, remolque, mrn, transito })
  ].filter(n => !notasModelo.includes(n));

  return {
    legible: r.legible !== false,
    tipoDetectado,
    confianza: escalaConfianza(r.confianza),
    notas: [...notasModelo, ...notasNuevas],
    exportador: {
      nombre: texto(exp.nombre), direccion: texto(exp.direccion), ...ubicacion(exp),
      telefono: telefono(exp.telefono), email: correo(exp.email)
    },
    importador: {
      nombre: texto(imp.nombre), identificacionFiscal: texto(imp.identificacionFiscal),
      direccion: texto(imp.direccion), ...ubicacion(imp),
      telefono: telefono(imp.telefono), email: correo(imp.email)
    },
    // Un documento de transporte no es una factura: su fecha es la de
    // emision del BL o del AWB. Moneda e incoterm si sirven.
    factura: {
      numero: esTransporte ? null : texto(fac.numero),
      fecha: esTransporte ? null : texto(fac.fecha),
      moneda: moneda(fac.moneda),
      importeTotal: esTransporte ? null : numero(fac.importeTotal),
      incoterm: incoterm && /^[A-Za-z]{3}$/.test(incoterm) ? incoterm.toUpperCase() : null,
      lugarIncoterm: texto(fac.lugarIncoterm)
    },
    transporte: {
      numeroDocumento, documentoHijo, medio: vuelo,
      puertoCarga: texto(tra.puertoCarga), puertoDescarga: texto(tra.puertoDescarga),
      contenedores, precintos, tipoCarga,
      nacionalidadMedio: nacionalidad.pais, imo: imo ? imo.numero : null, remolque
    },
    transito,
    partidas: lista(r.partidas).slice(0, MAX_PARTIDAS).map(objeto).map(p => partidaNormalizada(p, esTransporte)),
    totales: { bultos: numero(tot.bultos), pesoBrutoKg: numero(tot.pesoBrutoKg), pesoNetoKg: numero(tot.pesoNetoKg) }
  };
}

// ---- Propuesta de cambios -----------------------------------------------------

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const TIPO_TRANSPORTE = { bill_of_lading: 'BL', air_waybill: 'AWB', cmr: 'CMR' };
const MODOS_MARITIMOS = ['sea', 'maritime'];

// Unidad de la cantidad con los mismos codigos que el alta (PCS, KG, MTR, LTR):
// PCE/PCS/«pieces» son piezas; KG/KGM/KGS, kilos. Otra unidad se deja tal cual.
const UNIDADES_EXPEDIENTE = {
  PCE: 'PCS', PCS: 'PCS', PC: 'PCS', PCES: 'PCS', PIECE: 'PCS', PIECES: 'PCS', UNIT: 'PCS', UNITS: 'PCS', UN: 'PCS', U: 'PCS',
  UD: 'PCS', UDS: 'PCS', UNIDAD: 'PCS', UNIDADES: 'PCS', PIEZA: 'PCS', PIEZAS: 'PCS', NAR: 'PCS',
  KG: 'KG', KGM: 'KG', KGS: 'KG', KILO: 'KG', KILOS: 'KG',
  M: 'MTR', MTR: 'MTR', L: 'LTR', LTR: 'LTR'
};
const unidadDelExpediente = (unidad) => {
  const clave = (texto(unidad) || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!clave) return null;
  return UNIDADES_EXPEDIENTE[clave] || clave;
};

const iguales = (a, b) => {
  if (a === null || a === undefined || a === '') return b === null || b === undefined || b === '';
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a).trim().toUpperCase() === String(b ?? '').trim().toUpperCase();
};

/**
 * Campos del expediente en los que el documento aporta un dato distinto.
 *
 * Las partidas se emparejan por posicion. Si el expediente tiene una sola
 * partida y el documento no desglosa mas de una, los totales del documento
 * (bultos y pesos) son los de esa partida.
 *
 * @param {object} expedition
 * @param {object} datos extraccion normalizada
 * @param {string} tipoDocumento tipo con el que se subio el documento
 * @returns {Array<{ clave: string, grupo: string, partida?: number, campo: string, actual: *, nuevo: * }>}
 */
function proponerCambios(expedition, datos, tipoDocumento) {
  if (!datos || datos.legible === false) return [];
  const cambios = [];
  const proponer = (clave, grupo, campo, actual, nuevo, partida) => {
    if (nuevo === null || nuevo === undefined || nuevo === '') return;
    if (iguales(actual, nuevo)) return;
    // Un campo vacio se informa como null: la pantalla distingue «rellenar» de «cambiar».
    const vacio = actual === undefined || actual === null || actual === '';
    cambios.push({ clave, grupo, campo, actual: vacio ? null : actual, nuevo, ...(partida ? { partida } : {}) });
  };

  const goods = expedition.goods || [];
  const partidas = datos.partidas || [];
  goods.forEach((good, i) => {
    const p = partidas[i];
    // Con una sola partida en el expediente y, como mucho, una en el documento,
    // los totales del documento son los de esa partida y mandan sobre el
    // detalle de linea (un packing list detalla un bulto y totaliza doce).
    const partidaUnica = goods.length === 1 && partidas.length <= 1;
    const totales = partidaUnica ? datos.totales : {};
    if (!p && !partidaUnica) return;
    const fuente = {
      ...(p || {}),
      bultos: totales.bultos ?? p?.bultos ?? null,
      pesoBrutoKg: totales.pesoBrutoKg ?? p?.pesoBrutoKg ?? null,
      pesoNetoKg: totales.pesoNetoKg ?? p?.pesoNetoKg ?? null
    };
    const n = i + 1;
    // Un TARIC solo se propone si el documento trae los 10 digitos y la partida no tiene codigo.
    if (!good.taricCode && /^\d{10}$/.test(fuente.codigoMercancia || '')) {
      proponer(`goods.${i}.taricCode`, 'partida', 'taricCode', good.taricCode, fuente.codigoMercancia, n);
    }
    proponer(`goods.${i}.originCountry`, 'partida', 'originCountry', good.originCountry, fuente.paisOrigen, n);
    proponer(`goods.${i}.packages.quantity`, 'partida', 'packagesQuantity', good.packages?.quantity, fuente.bultos, n);
    if (fuente.bultos) proponer(`goods.${i}.packages.type`, 'partida', 'packagesType', good.packages?.type, fuente.tipoBulto, n);
    proponer(`goods.${i}.grossWeight`, 'partida', 'grossWeight', good.grossWeight, fuente.pesoBrutoKg, n);
    proponer(`goods.${i}.netWeight`, 'partida', 'netWeight', good.netWeight, fuente.pesoNetoKg, n);
    proponer(`goods.${i}.invoiceValue`, 'partida', 'invoiceValue', good.invoiceValue, fuente.importe, n);
    if (fuente.importe) proponer(`goods.${i}.currency`, 'partida', 'currency', good.currency, datos.factura.moneda, n);
    // Cantidad y su unidad (PCE, PCS, KG...): solo cuando el documento da unidades
    // de mercancia; si no, la partida se quedaba en «KG» por defecto (UAT 16/Nov).
    if (fuente.cantidad !== null && fuente.cantidad !== undefined) {
      proponer(`goods.${i}.quantity`, 'partida', 'quantity', good.quantity, fuente.cantidad, n);
      proponer(`goods.${i}.unit`, 'partida', 'unit', good.unit, unidadDelExpediente(fuente.unidad), n);
    }
  });

  const transport = expedition.transport || {};
  const esDocTransporte = Boolean(TIPO_TRANSPORTE[tipoDocumento]);
  if (esDocTransporte) {
    proponer('transport.documentType', 'transporte', 'documentType', transport.documentType, TIPO_TRANSPORTE[tipoDocumento]);
    proponer('transport.documentNumber', 'transporte', 'documentNumber', transport.documentNumber, datos.transporte.numeroDocumento);
  }
  proponer('transport.vehicleId', 'transporte', 'vehicleId', transport.vehicleId, datos.transporte.medio);
  // Nacionalidad del medio activo en frontera (H1 CAU, ActiveBorderTransportMeans):
  // solo de un documento de transporte o de transito que la escribe (UAT 17/Nov/2026).
  if (TIPOS_TRANSPORTE.includes(tipoDocumento)) {
    proponer('transport.vehicleNationality', 'transporte', 'vehicleNationality', transport.vehicleNationality, datos.transporte.nacionalidadMedio);
  }
  proponer('transport.departurePort', 'transporte', 'departurePort', transport.departurePort, datos.transporte.puertoCarga);
  proponer('transport.arrivalPort', 'transporte', 'arrivalPort', transport.arrivalPort, datos.transporte.puertoDescarga);
  if (MODOS_MARITIMOS.includes(String(expedition.transportMode || '').toLowerCase())) {
    proponer('transport.loadType', 'transporte', 'loadType', transport.loadType, datos.transporte.tipoCarga);
  }
  const contenedoresActuales = (transport.containers || []).map(c => c.number).filter(Boolean);
  const contenedoresNuevos = datos.transporte.contenedores || [];
  if (contenedoresNuevos.length > 0 && contenedoresNuevos.join(',') !== contenedoresActuales.join(',')) {
    cambios.push({
      clave: 'transport.containers', grupo: 'transporte', campo: 'containers',
      actual: contenedoresActuales.join(', ') || null, nuevo: contenedoresNuevos.join(', ')
    });
  }

  const incoterm = expedition.incoterm || {};
  if (INCOTERMS.includes(datos.factura.incoterm)) {
    proponer('incoterm.code', 'condiciones', 'incotermCode', incoterm.code, datos.factura.incoterm);
  }
  proponer('incoterm.place', 'condiciones', 'incotermPlace', incoterm.place, datos.factura.lugarIncoterm);
  // Numero de factura: lo pide la tarjeta «Datos del H1» (casilla N380 del H1 CAU).
  proponer('invoiceNumber', 'condiciones', 'invoiceNumber', expedition.invoiceNumber, datos.factura.numero);

  const exporter = expedition.exporter || {};
  proponer('exporter.companyName', 'exportador', 'exporterName', exporter.companyName, datos.exportador.nombre);
  proponer('exporter.country', 'exportador', 'exporterCountry', exporter.country, datos.exportador.pais);
  // En el expediente el exportador guarda la ciudad en `city` (su `address` es
  // un texto, no un objeto como en el importador).
  proponer('exporter.city', 'exportador', 'exporterCity', exporter.city, datos.exportador.ciudad);
  // CP y direccion: el H1 exige el CP del exportador en los paises de la CL505
  // (tarjeta «Datos del H1»); se leian pero no se proponian (UAT 16/Nov).
  proponer('exporter.postalCode', 'exportador', 'exporterPostalCode', exporter.postalCode, datos.exportador.codigoPostal);
  proponer('exporter.address', 'exportador', 'exporterAddress', exporter.address, datos.exportador.direccion);

  return cambios;
}

/**
 * Escribe en el expediente las claves elegidas. Solo se aplican las que siguen
 * en la propuesta calculada ahora: una clave arbitraria del cliente no escribe
 * nada.
 *
 * @param {object} expedition documento Mongoose del expediente
 * @param {object} datos extraccion normalizada guardada en el documento
 * @param {string} tipoDocumento
 * @param {string[]} claves claves que el agente ha marcado
 * @returns {Array<object>} cambios aplicados
 */
function aplicarCambios(expedition, datos, tipoDocumento, claves) {
  const pedidas = new Set(Array.isArray(claves) ? claves.map(String) : []);
  const aplicables = proponerCambios(expedition, datos, tipoDocumento).filter(c => pedidas.has(c.clave));

  for (const cambio of aplicables) {
    if (cambio.clave === 'transport.containers') {
      const actuales = expedition.transport?.containers || [];
      expedition.set('transport.containers', datos.transporte.contenedores.map(
        numeroContenedor => actuales.find(c => c.number === numeroContenedor) || { number: numeroContenedor }
      ));
    } else {
      expedition.set(cambio.clave, cambio.nuevo);
    }
  }

  // Mongoose descarta en silencio un `set` sobre una ruta que no existe en el
  // esquema. Solo se da por aplicado lo que ha quedado escrito de verdad: asi
  // un campo mal mapeado no se anuncia como aplicado (paso con la ciudad del
  // exportador en la primera prueba en produccion).
  if (typeof expedition.get !== 'function') return aplicables;
  return aplicables.filter((cambio) => {
    if (cambio.clave === 'transport.containers') return true;
    const escrito = iguales(expedition.get(cambio.clave), cambio.nuevo);
    if (!escrito) logger.warn(`Lectura de documentos: «${cambio.clave}» no existe en el expediente y no se ha aplicado`);
    return escrito;
  });
}

// Campos que alimentan «Datos para presentar el H1». Al leer un documento
// subido en el detalle del expediente se rellenan solos si estan vacios; el
// resto de la propuesta sigue esperando a que el agente la aplique. El tipo de
// carga y los contenedores, solo desde un documento de transporte.
// Origen: UAT 16/Nov/2026, EXP-2026-74AEEBBC (documentos subidos despues del alta).
const CLAVES_H1 = ['invoiceNumber', 'exporter.postalCode', 'exporter.address', 'exporter.city', 'exporter.country'];
const CLAVES_H1_TRANSPORTE = ['transport.loadType', 'transport.containers'];

// La nacionalidad del medio solo se rellena sola si el documento es del modo
// del expediente: un CMR del tramo interior de una importacion maritima trae
// la matricula del camion, no la bandera del buque que cruzo la frontera
// (H1: nacionalidad del medio de transporte ACTIVO en frontera). En ese caso
// queda como propuesta. El T1 la da expresamente para el medio en frontera.
const MODOS_DEL_DOCUMENTO = { bill_of_lading: ['maritime', 'sea'], air_waybill: ['air'], cmr: ['road'] };
const nacionalidadDelModo = (expedition, tipoDocumento) => {
  if (tipoDocumento === 'transit_document') return true;
  return (MODOS_DEL_DOCUMENTO[tipoDocumento] || []).includes(String(expedition.transportMode || '').toLowerCase());
};

/**
 * Rellena con lo leido los campos VACIOS del expediente que pide el H1. Nunca
 * cambia un dato ya escrito: solo se aplican cambios de la propuesta cuyo
 * valor actual es null.
 *
 * @param {object} expedition documento Mongoose del expediente
 * @param {object} datos extraccion normalizada
 * @param {string} tipoDocumento tipo con el que se subio el documento
 * @returns {Array<object>} cambios aplicados
 */
function rellenarHuecosH1(expedition, datos, tipoDocumento) {
  const permitidas = [
    ...CLAVES_H1,
    ...(TIPOS_TRANSPORTE.includes(tipoDocumento) ? CLAVES_H1_TRANSPORTE : []),
    ...(nacionalidadDelModo(expedition, tipoDocumento) ? ['transport.vehicleNationality'] : [])
  ];
  const claves = proponerCambios(expedition, datos, tipoDocumento)
    .filter(c => c.actual === null && permitidas.includes(c.clave))
    .map(c => c.clave);
  return claves.length > 0 ? aplicarCambios(expedition, datos, tipoDocumento, claves) : [];
}

module.exports = {
  SYSTEM_PROMPT,
  construirPrompt,
  normalizarExtraccion,
  proponerCambios,
  aplicarCambios,
  rellenarHuecosH1
};
