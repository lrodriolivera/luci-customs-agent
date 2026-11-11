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

const SYSTEM_PROMPT = `Eres un lector de documentos de comercio exterior (facturas comerciales, packing lists, conocimientos de embarque, cartas de porte aereo, CMR, certificados).

Tu unica tarea es TRANSCRIBIR los datos que figuran en el documento adjunto. Reglas:
- Escribe solo lo que se lee con certeza en el documento. Si un dato no esta, o no se lee bien, usa null. Nunca deduzcas, completes ni corrijas un valor.
- Los importes y pesos van como numeros (punto decimal, sin separador de millares). Los pesos en kilogramos.
- Los paises van con su codigo ISO de dos letras SOLO si el documento lo permite saber sin duda (nombre del pais o codigo); si no, null.
- "ciudad" es solo el nombre de la localidad (y la provincia, si figura). El codigo postal va aparte, en "codigoPostal", tal como aparece; nunca dentro de "ciudad" ni de "direccion".
- "codigoMercancia" es el codigo arancelario tal como aparece (HS, NC o TARIC), solo digitos.
- "tipoCarga": "FCL" SOLO si el documento lleva escrito FCL, FCL/FCL o CY/CY; "LCL" SOLO si lleva escrito LCL, LCL/LCL, CFS/CFS, groupage, grupaje o consolidated. Si no aparece ninguna de esas expresiones literales, null. Esta PROHIBIDO deducirlo del numero o del tipo de contenedores, del peso o de cualquier otro dato: un contenedor de 40 pies puede ir en grupaje.
- "medio" es el NOMBRE del medio de transporte: nombre del buque, numero de vuelo o matricula del camion. El modo (maritimo, aereo, carretera) NO es un medio: en ese caso, null.
- "confianza" es un entero de 0 a 100: cuanto de completo y legible esta el documento.
- "legible": false si el documento esta en blanco, es ilegible o no es un documento de comercio exterior. En ese caso explica el motivo en "notas".
- "cantidad" es el numero de unidades de la linea (columnas Qty, Quantity, Cantidad, Uds, Pcs). "unidad" es la unidad que figura junto a ella (PCE, PCS, KG...); si la columna no lleva unidad, null.
- "telefono" y "email" de cada parte, tal como aparecen; si no figuran, null.
- "notas": incidencias que el agente de aduanas deba conocer (dato dudoso, totales que no cuadran dentro del propio documento, paginas que faltan). Frases cortas. NO es una incidencia que falte un dato opcional: no anotes que el incoterm no lleva lugar, que no hay peso neto, peso o bultos por linea, ni que falta el telefono o el correo. Tampoco es una incidencia la forma normal de un documento: que un packing list totalice los bultos sin detallarlos uno a uno (una linea y un total de 12 bultos NO es una discrepancia), ni que una descripcion aparezca abreviada o cortada. Solo es incidencia de totales cuando dos cifras del propio documento se contradicen. Si no hay incidencias, [].

Responde UNICAMENTE con un JSON con esta forma exacta:
{
  "legible": true,
  "tipoDetectado": "commercial_invoice | proforma_invoice | packing_list | bill_of_lading | air_waybill | cmr | certificate_origin | other",
  "confianza": 0,
  "notas": [],
  "exportador": { "nombre": null, "direccion": null, "ciudad": null, "codigoPostal": null, "pais": null, "telefono": null, "email": null },
  "importador": { "nombre": null, "identificacionFiscal": null, "direccion": null, "ciudad": null, "codigoPostal": null, "pais": null, "telefono": null, "email": null },
  "factura": { "numero": null, "fecha": null, "moneda": null, "importeTotal": null, "incoterm": null, "lugarIncoterm": null },
  "transporte": { "numeroDocumento": null, "medio": null, "puertoCarga": null, "puertoDescarga": null, "contenedores": [], "tipoCarga": null },
  "partidas": [ { "descripcion": null, "codigoMercancia": null, "paisOrigen": null, "cantidad": null, "unidad": null, "bultos": null, "tipoBulto": null, "pesoBrutoKg": null, "pesoNetoKg": null, "importe": null } ],
  "totales": { "bultos": null, "pesoBrutoKg": null, "pesoNetoKg": null }
}`;

const construirPrompt = (document) =>
  `Lee el documento adjunto. El agente lo ha clasificado como "${document.type}"; ` +
  'si ves que es de otro tipo, indicalo en "tipoDetectado". Responde solo con el JSON pedido.';

// ---- Normalizacion ------------------------------------------------------------

const TIPOS_DOCUMENTO = [
  'commercial_invoice', 'proforma_invoice', 'packing_list', 'bill_of_lading',
  'air_waybill', 'cmr', 'certificate_origin', 'other'
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
const MAX_CONTENEDORES = 99;

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

// Matricula de contenedor ISO 6346: cuatro letras y siete cifras. Si el texto
// la contiene, se devuelve sola («TGHU8842217 (40HC)» -> «TGHU8842217»). Si
// no, se devuelve la matricula tal como se leyo, sin lo que la acompaña
// («MSCU1150584400 (40HC, precinto SL26)» -> «MSCU1150584400»): el agente ve
// el numero del documento y no el tipo de contenedor ni el precinto.
const numeroContenedor = (valor) => {
  const t = texto(valor);
  if (!t) return null;
  const mayusculas = t.toUpperCase();
  const iso = /[A-Z]{4}\d{7}(?!\d)/.exec(mayusculas.replace(/[\s-]/g, ''));
  if (iso) return iso[0];
  const matricula = /^[A-Z]{3,4}[\s-]?\d[\d\s-]*\d/.exec(mayusculas.trim());
  return matricula ? matricula[0].replace(/[\s-]/g, '') : mayusculas.replace(/[\s-]/g, '');
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

const objeto = (valor) => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});
const lista = (valor) => (Array.isArray(valor) ? valor : []);

/**
 * Deja la respuesta de la IA en el esquema fijo: tipos comprobados, textos
 * recortados y null en todo lo que no llegue bien formado.
 *
 * @param {object} bruto JSON devuelto por el modelo
 * @returns {object} extraccion normalizada
 */
function normalizarExtraccion(bruto) {
  const r = objeto(bruto);
  const exp = objeto(r.exportador);
  const imp = objeto(r.importador);
  const fac = objeto(r.factura);
  const tra = objeto(r.transporte);
  const tot = objeto(r.totales);
  const incoterm = texto(fac.incoterm);
  const tipoCarga = texto(tra.tipoCarga);

  return {
    legible: r.legible !== false,
    tipoDetectado: TIPOS_DOCUMENTO.includes(r.tipoDetectado) ? r.tipoDetectado : null,
    confianza: escalaConfianza(r.confianza),
    notas: lista(r.notas).map(texto).filter(Boolean).slice(0, MAX_NOTAS),
    exportador: {
      nombre: texto(exp.nombre), direccion: texto(exp.direccion), ...localidad(exp.ciudad, exp.codigoPostal), pais: pais(exp.pais),
      telefono: telefono(exp.telefono), email: correo(exp.email)
    },
    importador: {
      nombre: texto(imp.nombre), identificacionFiscal: texto(imp.identificacionFiscal),
      direccion: texto(imp.direccion), ...localidad(imp.ciudad, imp.codigoPostal), pais: pais(imp.pais),
      telefono: telefono(imp.telefono), email: correo(imp.email)
    },
    factura: {
      numero: texto(fac.numero), fecha: texto(fac.fecha), moneda: moneda(fac.moneda), importeTotal: numero(fac.importeTotal),
      incoterm: incoterm && /^[A-Za-z]{3}$/.test(incoterm) ? incoterm.toUpperCase() : null,
      lugarIncoterm: texto(fac.lugarIncoterm)
    },
    transporte: {
      numeroDocumento: texto(tra.numeroDocumento), medio: medioDeTransporte(tra.medio),
      puertoCarga: texto(tra.puertoCarga), puertoDescarga: texto(tra.puertoDescarga),
      contenedores: lista(tra.contenedores).map(numeroContenedor).filter(Boolean).slice(0, MAX_CONTENEDORES),
      tipoCarga: tipoCarga && ['FCL', 'LCL'].includes(tipoCarga.toUpperCase()) ? tipoCarga.toUpperCase() : null
    },
    partidas: lista(r.partidas).slice(0, MAX_PARTIDAS).map(objeto).map(p => ({
      descripcion: texto(p.descripcion),
      codigoMercancia: (texto(p.codigoMercancia) || '').replace(/\D/g, '') || null,
      paisOrigen: pais(p.paisOrigen),
      cantidad: numero(p.cantidad), unidad: texto(p.unidad),
      bultos: numero(p.bultos), tipoBulto: tipoBulto(p.tipoBulto),
      pesoBrutoKg: numero(p.pesoBrutoKg), pesoNetoKg: numero(p.pesoNetoKg), importe: numero(p.importe)
    })),
    totales: { bultos: numero(tot.bultos), pesoBrutoKg: numero(tot.pesoBrutoKg), pesoNetoKg: numero(tot.pesoNetoKg) }
  };
}

// ---- Propuesta de cambios -----------------------------------------------------

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const TIPO_TRANSPORTE = { bill_of_lading: 'BL', air_waybill: 'AWB', cmr: 'CMR' };
const MODOS_MARITIMOS = ['sea', 'maritime'];

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
  });

  const transport = expedition.transport || {};
  const esDocTransporte = Boolean(TIPO_TRANSPORTE[tipoDocumento]);
  if (esDocTransporte) {
    proponer('transport.documentType', 'transporte', 'documentType', transport.documentType, TIPO_TRANSPORTE[tipoDocumento]);
    proponer('transport.documentNumber', 'transporte', 'documentNumber', transport.documentNumber, datos.transporte.numeroDocumento);
  }
  proponer('transport.vehicleId', 'transporte', 'vehicleId', transport.vehicleId, datos.transporte.medio);
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

  const exporter = expedition.exporter || {};
  proponer('exporter.companyName', 'exportador', 'exporterName', exporter.companyName, datos.exportador.nombre);
  proponer('exporter.country', 'exportador', 'exporterCountry', exporter.country, datos.exportador.pais);
  // En el expediente el exportador guarda la ciudad en `city` (su `address` es
  // un texto, no un objeto como en el importador).
  proponer('exporter.city', 'exportador', 'exporterCity', exporter.city, datos.exportador.ciudad);

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

module.exports = {
  SYSTEM_PROMPT,
  construirPrompt,
  normalizarExtraccion,
  proponerCambios,
  aplicarCambios
};
