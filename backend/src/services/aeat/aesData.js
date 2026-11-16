/**
 * Del expediente de LUCI a los datos de la declaracion de exportacion AES
 * (mensaje CC515C, servicio CC515CV1). El XML lo monta `aesXmlBuilder.js`.
 *
 * Fuente: «Guía de Servicios Web de Exportación (Nuevo Sistema AES)» de la
 * AEAT, V1.25 (17/06/2026), apartado 8.4 (mensaje CC515CVxEnt).
 *
 * No se inventa ningun dato: si falta algo obligatorio se devuelve un unico
 * error 422 con la lista completa de lo que hay que completar y donde. Antes
 * se enviaban valores fijos (destino «US», matricula «TRANSPORT-AES», factura
 * «INV-AES-001», documento de transporte «TD-<fecha>», provincia «28», lugar
 * de entrega «Valencia», origen «ES», aduana de salida = aduana de
 * exportacion, codigo postal «00000») que la AEAT de produccion no debe
 * recibir. El unico valor por defecto que queda es la ubicacion de pruebas
 * «2801AAAAAC» que la AEAT asigno para preproducción, y solo en PRE.
 *
 * Exportador, declarante y representante (guia, p. 46 y 76-79):
 *  - autodespacho (forma 1): EXPORTER = DECLARANT, sin REPRESENTATIVE;
 *    DECLARANT/CONTACT PERSON obligatorio.
 *  - representacion directa (forma 2): EXPORTER = DECLARANT y REPRESENTATIVE
 *    con el agente, `status` «siempre 2» y su CONTACT PERSON; el DECLARANT
 *    no lleva CONTACT PERSON.
 *  - representacion indirecta (forma 3): DECLARANT = agente (distinto del
 *    exportador), sin REPRESENTATIVE; DECLARANT/CONTACT PERSON obligatorio.
 * MESSAGE/Message sender: «NIF del firmante», igual al representante o
 * declarante o su apoderado. El firmante es el titular del certificado con
 * el que LUCI presenta: el tenant.
 */
const {
  ErrorValidacion, eoriDe, exigirEori, declarantePara, representanteDelTenant, formaRepresentacionDe
} = require('../forms/identificadorAduanero');
const { sinCodigoPostal } = require('./paisesSinCodigoPostal');

// Ubicacion «verde» de la AEAT de preproducción para Madrid (aduana ES002801).
const UBICACION_PRE = '2801AAAAAC';
const ADUANA_UBICACION_PRE = 'ES002801';
// Status del grupo REPRESENTATIVE en el CC515C: «Debe venir relleno siempre con un 2».
const STATUS_REPRESENTANTE = '2';
// Modo de transporte (lista CSRDA018) a partir del modo del expediente.
const MODO = { sea: '1', maritime: '1', rail: '2', road: '3', air: '4', postal: '5' };
// Tipo de identificacion del medio (CSRDA219/CSRDA750): su primer digito es el modo.
const TIPO_MEDIO = { 1: '11', 2: '21', 3: '30', 4: '40' };
// Documento de transporte (CSRDA754) por tipo declarado o por modo.
const DOCUMENTO_TRANSPORTE = { BL: 'N705', AWB: 'N740', CMR: 'N730', CIM: 'N720' };
const DOCUMENTO_POR_MODO = { 1: 'N705', 2: 'N720', 3: 'N730', 4: 'N740' };
// Medio en frontera opcional con ferrocarril, correo e instalaciones fijas.
const MODOS_SIN_MEDIO_ACTIVO = new Set(['2', '5', '7']);
// Incoterms cuyo lugar convenido esta en destino.
const INCOTERMS_EN_DESTINO = new Set(['CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']);
// Bultos (CSRDA017, dos caracteres): equivalencias de los codigos de tres letras del alta.
const BULTOS_TRES_LETRAS = { CTN: 'CT', PLT: 'PX', PAL: 'PX', BOX: 'BX', PKG: 'PK', BAG: 'BG' };

const DONDE = {
  cliente: 'ficha del cliente',
  destinatario: 'expediente › destinatario',
  declaracion: 'expediente › declaración AES',
  transporte: 'expediente › transporte',
  incoterm: 'expediente › incoterm',
  factura: 'expediente › número de factura',
  mercancias: 'expediente › mercancías',
  contacto: 'Ajustes › Empresa (persona de contacto)'
};

const texto = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null));
const falta = (dato, donde) => `${dato} (${donde})`;

/** «002801» o «ES002801» -> «ES002801»; otro formato -> null. */
function aduana(valor) {
  const limpio = String(valor || '').toUpperCase().replace(/\s/g, '');
  if (/^[A-Z]{2}\d{6}$/.test(limpio)) return limpio;
  return /^\d{6}$/.test(limpio) ? `ES${limpio}` : null;
}

/** Identificador con prefijo de pais («B22477020» -> «ESB22477020»). */
function conPais(id) {
  const limpio = String(id || '').toUpperCase().replace(/[\s.-]/g, '');
  if (!limpio) return null;
  return /^[A-Z]{2}[A-Z0-9]/.test(limpio) && !/^[A-Z]\d{7}[A-Z0-9]$/.test(limpio) ? limpio : `ES${limpio}`;
}

/** NIF del firmante (sin «ES») si es un NIF español de 9 caracteres; si no, null. */
function nifDelFirmante(id) {
  const limpio = conPais(id);
  if (!limpio || !limpio.startsWith('ES')) return null;
  const nif = limpio.slice(2);
  return /^[A-Z0-9]{9}$/.test(nif) ? nif : null;
}

/** Ubicacion con calificador Y: «RRRRAAAAAA» (10 caracteres) o «ES00» + esos 10. */
function ubicacion(valor) {
  const limpio = String(valor || '').toUpperCase().replace(/\s/g, '');
  if (/^[A-Z0-9]{10}$/.test(limpio)) return limpio;
  return /^ES00[A-Z0-9]{10}$/.test(limpio) ? limpio.slice(4) : null;
}

/** Provincia (TPROVINC, dos cifras) de la direccion del exportador. */
function provinciaDe(direccion) {
  const provincia = texto(direccion?.province);
  if (provincia && /^\d{2}$/.test(provincia)) return provincia;
  const cp = String(direccion?.postalCode || '').trim();
  return /^\d{5}$/.test(cp) && (direccion?.country || 'ES') === 'ES' ? cp.slice(0, 2) : null;
}

function contactoDe(contacto, faltan, quien) {
  const c = { name: texto(contacto?.name), phone: texto(contacto?.phone), email: texto(contacto?.email) };
  if (!c.name) faltan.push(falta(`nombre de la persona de contacto ${quien}`, DONDE.contacto));
  if (!c.phone) faltan.push(falta(`teléfono de la persona de contacto ${quien}`, DONDE.contacto));
  if (!c.email) faltan.push(falta(`correo de la persona de contacto ${quien}`, DONDE.contacto));
  return c;
}

/**
 * Exportador, declarante, representante y remitente del mensaje.
 * @returns {{ forma: '1'|'2'|'3', exportador: string, declarante: { id, contacto }, representante: { id, status, contacto }|null, remitente: string }}
 */
function partes(expedition, tenant, faltan) {
  const client = expedition.client || {};
  const tenantEsExportador = !!tenant && (tenant.businessInfo?.type || 'customs_agent') !== 'customs_agent';
  const delTenant = representanteDelTenant(tenant);
  // El exportador es el cliente; el tenant solo cuando el tenant ES el exportador.
  const exportador = conPais(exigirEori(eoriDe(client) || (tenantEsExportador ? delTenant.eori : null), 'cliente'));
  const agente = declarantePara(expedition, tenant);
  const idAgente = conPais(agente.eori);
  // Sin contacto propio en el expediente, el de la agencia.
  const contacto = {
    name: agente.contact?.name || delTenant.contact.name,
    phone: agente.contact?.phone || delTenant.contact.phone,
    email: agente.contact?.email || delTenant.contact.email
  };
  const forma = formaRepresentacionDe({ ...agente, eori: idAgente }, { eori: exportador });

  const remitente = nifDelFirmante(delTenant.eori || idAgente);
  if (!remitente) {
    faltan.push(falta('NIF español del firmante (titular del certificado con el que se presenta)', 'Ajustes › Aduanas'));
  }

  if (forma === '2') {
    return {
      forma,
      exportador,
      declarante: { id: exportador, contacto: null },
      representante: { id: idAgente, status: STATUS_REPRESENTANTE, contacto: contactoDe(contacto, faltan, 'del representante') },
      remitente
    };
  }
  return {
    forma,
    exportador,
    declarante: { id: forma === '1' ? exportador : idAgente, contacto: contactoDe(contacto, faltan, 'del declarante') },
    representante: null,
    remitente
  };
}

function destinatarioDe(expedition, faltan) {
  const c = expedition.consignee || {};
  const dir = c.address || {};
  const pais = texto(dir.country) || texto(c.country);
  const paisMayus = pais ? pais.toUpperCase() : null;
  // Identificador: EORI, o NIF español con «ES» delante (guia, CONSIGNEE).
  const id = texto(c.eori) ? conPais(c.eori) : (texto(c.nif) && paisMayus === 'ES' ? conPais(c.nif) : null);
  if (id) return { id, pais: paisMayus };
  const datos = { id: null, nombre: texto(c.companyName), calle: texto(dir.street), cp: texto(dir.postalCode), ciudad: texto(dir.city), pais: paisMayus };
  if (!datos.nombre) faltan.push(falta('nombre del destinatario (o su EORI)', DONDE.destinatario));
  if (!datos.calle) faltan.push(falta('dirección del destinatario', DONDE.destinatario));
  if (!datos.ciudad) faltan.push(falta('ciudad del destinatario', DONDE.destinatario));
  if (!datos.cp && !sinCodigoPostal(paisMayus)) faltan.push(falta('código postal del destinatario', DONDE.destinatario));
  return datos;
}

function entregaDe(expedition, destino, faltan) {
  const decl = expedition.declaration || {};
  const inc = typeof expedition.incoterm === 'object' && expedition.incoterm ? expedition.incoterm : { code: expedition.incoterm };
  const codigo = texto(inc.code) || texto(decl.incoterm);
  if (!codigo) faltan.push(falta('incoterm', DONDE.incoterm));
  const lugar = texto(inc.place) || texto(decl.incotermLocation);
  if (!lugar) faltan.push(falta('lugar convenido del incoterm', DONDE.incoterm));
  const enDestino = codigo ? INCOTERMS_EN_DESTINO.has(codigo.toUpperCase()) : false;
  // Pais del lugar convenido: el de destino o España (pais de exportacion), segun el incoterm.
  const pais = texto(inc.country) || texto(decl.incotermCountry) || (enDestino ? destino : 'ES');
  return { codigo: codigo ? codigo.toUpperCase() : null, lugar: lugar ? lugar.slice(0, 35) : null, pais };
}

function transporteDe(expedition, directa, faltan) {
  const t = expedition.transport || {};
  const decl = expedition.declaration || {};
  const modoExpediente = MODO[String(expedition.transportMode || '').toLowerCase()] || (/^\d$/.test(String(t.mode || '')) ? String(t.mode) : null);
  const modoFrontera = texto(t.borderTransportMode) || modoExpediente;
  const modoInterior = texto(t.inlandTransportMode) || modoExpediente;
  if (!modoFrontera) faltan.push(falta('modo de transporte', DONDE.transporte));

  const medio = texto(t.vehicleId) || texto(t.plateNumber);
  const nacionalidad = texto(t.vehicleNationality) || texto(t.country);
  const conMedioActivo = modoFrontera && !MODOS_SIN_MEDIO_ACTIVO.has(modoFrontera);
  // El medio de salida (interior) solo existe con salida indirecta.
  const pideMedio = conMedioActivo || !directa;
  if (pideMedio && !medio) faltan.push(falta('identificación del medio de transporte (matrícula, buque o vuelo)', DONDE.transporte));
  if (pideMedio && !nacionalidad) faltan.push(falta('nacionalidad del medio de transporte', DONDE.transporte));

  const tipoDoc = DOCUMENTO_TRANSPORTE[String(t.documentType || '').toUpperCase()] || texto(decl.transportDocType) || DOCUMENTO_POR_MODO[modoFrontera];
  const numeroDoc = texto(t.documentNumber) || texto(decl.transportDocRef);
  if (!tipoDoc || !numeroDoc) faltan.push(falta('documento de transporte (tipo y número)', DONDE.transporte));

  return {
    modoFrontera,
    modoInterior: directa ? null : modoInterior,
    medioActivo: conMedioActivo || medio ? { tipo: TIPO_MEDIO[modoFrontera] || '30', id: medio ? medio.toUpperCase() : null, pais: nacionalidad ? nacionalidad.toUpperCase() : null } : null,
    medioSalida: directa ? null : { tipo: TIPO_MEDIO[modoInterior] || TIPO_MEDIO[modoFrontera] || '30', id: medio ? medio.toUpperCase() : null, pais: nacionalidad ? nacionalidad.toUpperCase() : null },
    documento: { tipo: tipoDoc || null, referencia: numeroDoc }
  };
}

function bultosDe(g, unaPartida, expedition) {
  const cantidad = numero(g.packages?.quantity) ?? numero(g.numberOfPackages) ?? (unaPartida ? numero(expedition.goodsSummary?.totalPackages) : null);
  const tipo = texto(g.packages?.type) || texto(g.packageType);
  const tipoMayus = tipo ? tipo.toUpperCase() : null;
  return {
    cantidad: cantidad !== null && cantidad > 0 ? Math.round(cantidad) : null,
    // «PK» (paquete) cuando el alta no dice el tipo: es un codigo generico valido de la CSRDA017.
    tipo: tipoMayus ? (BULTOS_TRES_LETRAS[tipoMayus] || tipoMayus) : 'PK',
    // «N/M» (sin marcas) es la convencion cuando los bultos no van marcados.
    marcas: texto(g.packages?.marks) || 'N/M'
  };
}

function partidaDe(expedition, g, i, contexto, faltan) {
  const n = i + 1;
  const donde = `${DONDE.mercancias}, partida ${n}`;
  const taric = String(g.taricCode || '').replace(/\D/g, '');
  if (!texto(g.description)) faltan.push(falta('descripción de la mercancía', donde));
  if (taric.length < 8) faltan.push(falta('código TARIC (al menos 8 cifras)', donde));
  const bruto = numero(g.grossWeight);
  const neto = numero(g.netWeight);
  if (!(bruto > 0)) faltan.push(falta('peso bruto', donde));
  if (!(neto > 0)) faltan.push(falta('peso neto', donde));
  const valor = numero(g.statisticalValue) ?? numero(g.invoiceValue) ?? numero(g.value);
  if (!(valor > 0)) faltan.push(falta('valor de la mercancía', donde));
  const bultos = bultosDe(g, contexto.unaPartida, expedition);
  if (!bultos.cantidad) faltan.push(falta('número de bultos', donde));
  if (!/^[A-Z0-9]{2}$/.test(bultos.tipo)) faltan.push(falta(`tipo de bulto «${bultos.tipo}»: debe ser un código de dos caracteres`, donde));
  const region = texto(g.regionOfDispatch) || contexto.region;
  const origen = texto(g.originCountry) || texto(g.countryOfOrigin);
  return {
    description: texto(g.description),
    taricCode: taric,
    grossWeight: bruto || 0,
    netWeight: neto || 0,
    value: valor || 0,
    statisticalValue: valor || 0,
    packages: bultos.cantidad,
    packageType: bultos.tipo,
    shippingMarks: bultos.marcas,
    countryOfOrigin: origen ? origen.toUpperCase() : null,
    regionOfDispatch: region,
    invoiceRef: contexto.factura,
    // AEAT error 2149: el TARIC exige unidades suplementarias para algunos codigos.
    supplementaryUnits: g.supplementaryUnits != null ? g.supplementaryUnits : (g.quantity > 0 ? Number(g.quantity) : undefined)
  };
}

/**
 * Datos de `buildAESExportXML` a partir del expediente.
 *
 * @param {object} expedition
 * @param {{ tenant?: object, isPRE?: boolean }} opciones
 * @throws ErrorValidacion 422: EORI del exportador o del representante
 *   (`EORI_FALTANTE`) o lista de datos que faltan (`DATOS_AES_FALTANTES`, `faltan`).
 */
function expeditionToAesData(expedition, { tenant, isPRE = true } = {}) {
  const exp = expedition || {};
  const decl = exp.declaration || {};
  const client = exp.client || {};
  const faltan = [];

  const personas = partes(exp, tenant, faltan);

  const oficinaExportacion = aduana(decl.customsOffice);
  if (!oficinaExportacion) faltan.push(falta('aduana de exportación', DONDE.declaracion));
  const oficinaSalida = aduana(decl.officeOfExit);
  if (!oficinaSalida) faltan.push(falta('aduana de salida', DONDE.declaracion));
  // Salida directa: la mercancia sale de la UE por la propia aduana de exportacion.
  const directa = decl.directExport !== undefined && decl.directExport !== null
    ? Boolean(decl.directExport)
    : (!!oficinaSalida && oficinaSalida === oficinaExportacion);

  // Ubicacion (calificador Y): sus 4 primeros caracteres son los 4 ultimos de la aduana de exportacion.
  let ubic = ubicacion(decl.goodsLocation || decl.locationAuthorisationNumber);
  if (!ubic && isPRE && oficinaExportacion === ADUANA_UBICACION_PRE) ubic = UBICACION_PRE;
  if (!ubic) {
    faltan.push(falta('ubicación de las mercancías (código de 10 caracteres de la AEAT)', DONDE.declaracion));
  } else if (oficinaExportacion && ubic.slice(0, 4) !== oficinaExportacion.slice(-4)) {
    faltan.push(falta(`ubicación ${ubic}: no pertenece a la aduana de exportación ${oficinaExportacion}`, DONDE.declaracion));
  }

  const destinatario = destinatarioDe(exp, faltan);
  const destino = destinatario.pais;
  if (!destino) faltan.push(falta('país de destino', DONDE.destinatario));

  const entrega = entregaDe(exp, destino, faltan);
  const transporte = transporteDe(exp, directa, faltan);

  const factura = texto(exp.invoiceNumber) || texto(decl.invoiceRef);
  if (!factura) faltan.push(falta('número de la factura comercial', DONDE.factura));

  const region = provinciaDe(client.address);
  const goods = exp.goods || [];
  if (goods.length === 0) faltan.push(falta('al menos una partida de mercancía', DONDE.mercancias));
  const partidas = goods.map((g, i) => partidaDe(exp, g, i, { unaPartida: goods.length === 1, region, factura }, faltan));
  if (partidas.some((p) => !p.regionOfDispatch)) {
    faltan.push(falta('provincia de expedición: código postal español del exportador', DONDE.cliente));
  }

  if (faltan.length > 0) {
    const unicos = [...new Set(faltan)];
    const error = new ErrorValidacion(`Faltan datos para presentar el AES: ${unicos.join('; ')}`, { code: 'DATOS_AES_FALTANTES' });
    error.faltan = unicos;
    throw error;
  }

  const { declarante, representante } = personas;
  return {
    test: isPRE,
    // PhaseID solo existe en pruebas (guia §25.5): «AES1.1» = periodo definitivo.
    phaseId: isPRE ? 'AES1.1' : null,
    messageSender: personas.remitente,
    formaRepresentacion: personas.forma,
    lrn: texto(decl.lrn) || '',
    directExport: directa,
    customsOfficeExport: oficinaExportacion,
    customsOfficeExit: oficinaSalida,
    exporterEORI: personas.exportador,
    declarantEORI: declarante.id,
    declarantContact: declarante.contacto,
    representative: representante ? { id: representante.id, status: representante.status, contact: representante.contacto } : null,
    consigneeEORI: destinatario.id || '',
    consigneeName: destinatario.nombre || '',
    consigneeStreet: destinatario.calle || '',
    consigneeCity: destinatario.ciudad || '',
    consigneePostcode: destinatario.cp || '',
    consigneeCountry: destino,
    destinationCountry: destino,
    incotermCode: entrega.codigo,
    incotermLocation: entrega.lugar,
    incotermCountry: entrega.pais,
    modeOfTransportAtBorder: transporte.modoFrontera,
    inlandModeOfTransport: transporte.modoInterior,
    activeBorderTransport: transporte.medioActivo,
    departureTransport: transporte.medioSalida,
    transportDocType: transporte.documento.tipo,
    transportDocRef: transporte.documento.referencia,
    locationAuthorisationNumber: ubic,
    goodsItems: partidas
  };
}

module.exports = { expeditionToAesData, aduana, ubicacion, nifDelFirmante, STATUS_REPRESENTANTE, UBICACION_PRE };
