/**
 * Del expediente de LUCI a los datos del H1 CAU (mensaje CC415A).
 *
 * Aqui estan las decisiones de negocio; el XML lo monta `h1CauXmlBuilder.js`.
 * Reglas citadas: guia tecnica de la AEAT v3.20 y «Reglas y condiciones» V4.10.
 *
 * No se inventa ningun dato: si falta algo obligatorio se devuelve un unico
 * error 422 con la lista completa de lo que hay que completar. El DUA antiguo
 * rellenaba huecos con valores fijos (matricula «ABC1234», provincia «28»,
 * un CMR con el numero del expediente) que la AEAT ya no debe recibir.
 */
const { ErrorValidacion, eoriDe, formaRepresentacionDe } = require('../forms/identificadorAduanero');
const { cambioObligatorio, aEuros } = require('../divisas/cambioDelExpediente');

// Medios de pago que obligan a declarar garantia con regimen 40 (regla C0616).
const PAGOS_CON_GARANTIA = new Set(['O', 'R', 'S', 'T', 'U', 'V', 'G']);
// Tipos de garantia que llevan GRN (regla C0648).
const GARANTIAS_CON_GRN = new Set(['0', '1', '2', '4']);
const MODO_FRONTERA = { sea: '1', maritime: '1', rail: '2', road: '3', air: '4' };
// Tipo de identificacion del medio de llegada segun el modo (lista de la UE).
const TIPO_MEDIO_LLEGADA = { sea: '11', maritime: '11', rail: '21', road: '30', air: '40' };
const DOCUMENTO_TRANSPORTE = { BL: 'N705', AWB: 'N740', CMR: 'N730', CIM: 'N720' };
// Incoterms en los que el lugar convenido esta en destino.
const INCOTERMS_EN_DESTINO = new Set(['CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']);
const AMBITOS_AUTORIZACION = { global: null, OCRE: 'OCRE', OSRE: 'OSRE' };

const texto = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const redondear = (n) => Math.round(n * 100) / 100;

/** Identificador con prefijo de pais, como exige el esquema («ESB12345674»). */
function conPais(id, pais = 'ES') {
  const limpio = String(id || '').toUpperCase().replace(/[\s.-]/g, '');
  if (!limpio) return null;
  return /^[A-Z]{2}[A-Z0-9]/.test(limpio) && !/^[A-Z]\d{7}[A-Z0-9]$/.test(limpio) ? limpio : `${pais}${limpio}`;
}

/** «002801» o «ES002801» -> «ES002801». */
function aduana(valor) {
  const limpio = String(valor || '').toUpperCase().replace(/\s/g, '');
  if (/^[A-Z]{2}[A-Z0-9]{6}$/.test(limpio)) return limpio;
  return /^\d{6}$/.test(limpio) ? `ES${limpio}` : null;
}

/** Ubicacion de las mercancias «ES00RRRRAAAAAA» (14 caracteres, regla ESR0394). */
function ubicacionDe(expedition) {
  const declarada = texto(expedition.declaration?.goodsLocation);
  if (declarada && /^ES00[A-Z0-9]{10}$/i.test(declarada)) return declarada.toUpperCase();
  const deSumaria = texto(expedition.transport?.summaryDeclaration?.aeat?.location);
  return deSumaria && /^[A-Z0-9]{10}$/i.test(deSumaria) ? `ES00${deSumaria.toUpperCase()}` : null;
}

/** Codigo de provincia (dos cifras) a partir del codigo postal español. */
function provinciaDe(direccion) {
  const cp = String(direccion?.postalCode || '').trim();
  return /^\d{5}$/.test(cp) && (direccion?.country || 'ES') === 'ES' ? cp.slice(0, 2) : null;
}

function contactoDe(contacto, faltan, quien) {
  const c = { nombre: texto(contacto?.name), telefono: texto(contacto?.phone), email: texto(contacto?.email) };
  if (!c.nombre) faltan.push(`nombre de la persona de contacto ${quien}`);
  if (!c.telefono) faltan.push(`teléfono de la persona de contacto ${quien}`);
  if (!c.email) faltan.push(`correo de la persona de contacto ${quien}`);
  return c;
}

function exportadorDe(exporter, faltan) {
  const id = texto(eoriDe(exporter)) || texto(exporter?.vatNumber);
  if (id && /^[A-Z]{2}/i.test(id)) return { id: conPais(id) };
  // Sin identificador: nombre y direccion (regla ESC0030).
  const datos = {
    nombre: texto(exporter?.companyName),
    direccion: { calle: texto(exporter?.address), cp: texto(exporter?.postalCode), ciudad: texto(exporter?.city), pais: texto(exporter?.country) }
  };
  if (!datos.nombre) faltan.push('nombre del exportador');
  if (!datos.direccion.calle) faltan.push('dirección del exportador');
  if (!datos.direccion.ciudad) faltan.push('ciudad del exportador');
  if (!datos.direccion.pais) faltan.push('país del exportador');
  // La AEAT lo exige salvo en los paises sin codigo postal (error 50325 si falta).
  if (!datos.direccion.cp) faltan.push('código postal del exportador');
  return datos;
}

/**
 * Importador, declarante y representante segun la forma de representacion
 * (reglas ESC0638, R0520, ESC0008 y ESC0011): el grupo Representative solo
 * existe en la representacion directa, y entonces el declarante es el propio
 * importador; el contacto va en quien presenta.
 */
function partes(expedition, declarante, faltan) {
  const cliente = expedition.client || {};
  const idImportador = conPais(eoriDe(cliente) || cliente.taxId || cliente.nif);
  if (!idImportador) faltan.push('EORI o NIF del importador');
  const idAgente = conPais(declarante?.eori);
  if (!idAgente) faltan.push('EORI del representante');
  const forma = formaRepresentacionDe(declarante, cliente);

  if (forma === '2') {
    return {
      forma,
      importador: { id: idImportador },
      declarante: { id: idImportador },
      representante: { id: idAgente, estado: '2', contacto: contactoDe(declarante?.contact, faltan, 'del representante') }
    };
  }
  return {
    forma,
    importador: { id: idImportador },
    declarante: { id: forma === '1' ? idImportador : idAgente, contacto: contactoDe(declarante?.contact, faltan, 'del declarante') },
    representante: null
  };
}

/** Garantia segun el medio de pago: solo es obligatoria con pago aplazado (C0616). */
function garantiasDe(pago, faltan) {
  const { medio, grn, tipoGarantia = '1' } = pago;
  if (!PAGOS_CON_GARANTIA.has(medio) && !grn) return [];
  if (GARANTIAS_CON_GRN.has(String(tipoGarantia)) && !texto(grn)) {
    faltan.push(`número de garantía (GRN): es obligatorio con el medio de pago «${medio}»`);
    return [];
  }
  return [{ tipo: String(tipoGarantia), referencias: [{ grn: texto(grn) }] }];
}

function entregaDe(expedition, paisExpedicion, faltan) {
  const incoterm = typeof expedition.incoterm === 'object' ? expedition.incoterm : { code: expedition.incoterm };
  const codigo = texto(incoterm?.code);
  if (!codigo) { faltan.push('incoterm'); return null; }
  const enDestino = INCOTERMS_EN_DESTINO.has(codigo.toUpperCase());
  const lugar = texto(incoterm.place) || texto(enDestino ? expedition.transport?.arrivalPort : expedition.transport?.departurePort);
  // El pais del lugar convenido: el de destino o el de expedicion, segun el incoterm.
  const pais = texto(incoterm.country) || (enDestino ? 'ES' : paisExpedicion);
  if (!lugar) faltan.push('lugar del incoterm');
  return { incoterm: codigo.toUpperCase(), lugar: lugar ? lugar.slice(0, 35) : null, pais };
}

function expedicionDe(expedition, numerosDePartida, faltan) {
  const transporte = expedition.transport || {};
  const modo = String(expedition.transportMode || '').toLowerCase();
  const contenedores = (transporte.containers || []).map((c) => texto(c?.number)).filter(Boolean);
  const ubicacion = ubicacionDe(expedition);
  if (!ubicacion) faltan.push('ubicación de las mercancías (recinto y almacén)');
  if (!MODO_FRONTERA[modo]) faltan.push('modo de transporte');
  // La nacionalidad del medio activo es obligatoria salvo ferrocarril, postal e instalaciones fijas (ESC0931).
  const nacionalidad = texto(transporte.vehicleNationality);
  if (!nacionalidad && modo !== 'rail') faltan.push('nacionalidad del medio de transporte en frontera');
  const tipoDocumento = DOCUMENTO_TRANSPORTE[String(transporte.documentType || '').toUpperCase()];
  const numeroDocumento = texto(transporte.documentNumber);
  if (!tipoDocumento || !numeroDocumento) faltan.push('documento de transporte (tipo y número)');

  return {
    contenedores: contenedores.length > 0,
    modoFrontera: MODO_FRONTERA[modo],
    masaBruta: (expedition.goods || []).reduce((s, g) => s + (g.grossWeight || 0), 0),
    ucr: texto(expedition.expeditionId),
    // Cada contenedor debe decir que partidas lleva (ESC0907); LUCI no guarda el reparto: todas.
    equipos: contenedores.map((contenedor) => ({ contenedor, partidas: numerosDePartida })),
    ubicacion: ubicacion ? { tipo: 'B', calificador: 'Y', autorizacion: ubicacion } : null,
    medioLlegada: texto(transporte.vehicleId) && TIPO_MEDIO_LLEGADA[modo]
      ? { tipo: TIPO_MEDIO_LLEGADA[modo], id: transporte.vehicleId.trim().slice(0, 35) } : null,
    nacionalidadMedioActivo: nacionalidad ? nacionalidad.toUpperCase() : null,
    documentosTransporte: tipoDocumento && numeroDocumento ? [{ tipo: tipoDocumento, referencia: numeroDocumento }] : []
  };
}

/** Sumaria como documento previo N337: MRN, bultos y kilos de la partida, y partida de la sumaria. */
function documentoPrevio(expedition, good, faltan) {
  const sumaria = expedition.transport?.summaryDeclaration;
  const mrn = texto(sumaria?.aeat?.mrn) || (/^\d{2}[A-Z]{2}[A-Z0-9]{14}$/i.test(String(sumaria?.number || '')) ? sumaria.number : null);
  const partida = Number(sumaria?.item);
  if (!mrn) { faltan.push('MRN de la declaración sumaria'); return []; }
  if (!(partida > 0)) { faltan.push('partida de la declaración sumaria'); return []; }
  return [{
    tipo: 'N337', referencia: mrn.toUpperCase(), tipoBultos: good.packages?.type, bultos: good.packages?.quantity,
    unidad: 'KGMG', cantidad: good.grossWeight, partida
  }];
}

function partidaDe(expedition, good, indice, contexto, faltan) {
  const n = indice + 1;
  const codigo = String(good.taricCode || '').replace(/\D/g, '');
  if (codigo.length !== 10) faltan.push(`código TARIC de 10 dígitos de la partida ${n}`);
  const valor = good.invoiceValue || 0;
  const valorEuros = contexto.cambio.tipo === 1 ? valor : aEuros(valor, contexto.cambio.tipo);
  const tipoArancel = good.dutyRate || 0;
  const tipoIva = good.vatRate ?? 21;
  const arancel = redondear(valorEuros * tipoArancel / 100);
  const tipoBulto = String(good.packages?.type || '').toUpperCase();
  if (!/^[A-Z0-9]{2}$/.test(tipoBulto)) faltan.push(`tipo de bulto (código de dos letras) de la partida ${n}`);
  if (!(good.packages?.quantity > 0)) faltan.push(`número de bultos de la partida ${n}`);
  if (!(good.netWeight > 0)) faltan.push(`masa neta de la partida ${n}`);
  if (!texto(good.originCountry)) faltan.push(`país de origen de la partida ${n}`);
  const adicional = String(expedition.declaration?.additionalProcedure || '');

  return {
    numero: n,
    // El valor estadistico va siempre en euros.
    valorEstadistico: good.statisticalValue && good.statisticalValue !== valor ? good.statisticalValue : valorEuros,
    regimen: {
      solicitado: String(expedition.declaration?.regime || '40'), precedente: '00',
      adicionales: /^[A-Z0-9]{3}$/i.test(adicional) && adicional !== '000' ? [adicional.toUpperCase()] : []
    },
    origen: texto(good.originCountry)?.toUpperCase(),
    descripcion: texto(good.descriptionEs) || texto(good.description),
    codigo: { sa6: codigo.slice(0, 6), nc2: codigo.slice(6, 8), taric2: codigo.slice(8, 10) },
    masaBruta: good.grossWeight, masaNeta: good.netWeight,
    unidadesSuplementarias: good.supplementaryUnits || null,
    // El importe de factura va en la divisa de la factura; las bases, en euros.
    importeFactura: valor,
    preferencia: String(expedition.declaration?.preference || '100'),
    tributos: [
      { tipo: 'A00', medioDePago: contexto.medioDePago, bases: [{ tipoImpositivo: tipoArancel, importe: valorEuros, cuota: arancel }] },
      { tipo: 'B00', medioDePago: contexto.medioDePago, bases: [{ tipoImpositivo: tipoIva, importe: redondear(valorEuros + arancel), cuota: redondear((valorEuros + arancel) * tipoIva / 100) }] }
    ],
    bultos: [{ tipo: tipoBulto, numero: good.packages?.quantity, marcas: texto(good.packages?.marks) || 'S/M' }],
    documentosPrevios: documentoPrevio(expedition, good, faltan),
    documentosJustificativos: contexto.factura ? [{ tipo: 'N380', referencia: contexto.factura }] : [],
    valoracion: { metodo: String(expedition.valuation?.method || '1') },
    indicadoresValoracion: '0000'
  };
}

/**
 * @param {object} expedition
 * @param {{ declarante: object, cambio?: object, tenant?: object, mensajeId: string, lrn?: string, fecha?: Date, test?: boolean }} opciones
 * @returns {object} datos para `buildH1CauXML`
 * @throws {ErrorValidacion} 422 con `faltan`: lo que hay que completar
 */
function expeditionToH1CauData(expedition, { declarante, cambio, tenant, mensajeId, lrn, fecha = new Date(), test = true } = {}) {
  const faltan = [];
  const decl = expedition.declaration || {};
  const goods = expedition.goods || [];
  const tipoCambio = cambioObligatorio(expedition, cambio);

  const config = tenant?.customsConfig || {};
  const medioDePago = String(decl.paymentMethod || config.medioDePago || 'A').toUpperCase();
  const garantias = garantiasDe({ medio: medioDePago, grn: decl.guaranteeGRN || config.garantiaGRN, tipoGarantia: config.tipoGarantia }, faltan);

  const personas = partes(expedition, declarante, faltan);
  const ubicacion = ubicacionDe(expedition);
  // Sin aduana indicada, la del recinto donde estan las mercancias: son los
  // ocho primeros caracteres de la ubicacion (regla ESR0001).
  const aduanaDespacho = aduana(decl.customsOffice || config.customsOffice) || (ubicacion ? aduana(`ES${ubicacion.slice(2, 8)}`) : null);
  if (!aduanaDespacho) faltan.push('aduana de despacho');
  if (!texto(decl.lrn) && !texto(lrn)) faltan.push('referencia local de la declaración (LRN)');
  if (goods.length === 0) faltan.push('al menos una partida');

  const paisExpedicion = (texto(expedition.exporter?.country) || texto(goods[0]?.originCountry) || '').toUpperCase() || null;
  if (!paisExpedicion) faltan.push('país de expedición');
  const region = provinciaDe(expedition.client?.address);
  if (!region) faltan.push('provincia de destino (código postal del importador)');
  const factura = texto(decl.invoiceNumber) || texto(expedition.invoiceNumber);
  if (!factura) faltan.push('número de la factura comercial');

  // Autorizacion de despacho (Separata 19, ESR0009): sin representacion o con
  // autorizacion global no se declara nada; por operacion, documento 1005.
  const ambito = texto(expedition.representative?.dispatchAuthorizationScope) || 'OSRE';
  const referenciaAutorizacion = personas.forma === '1' ? null : AMBITOS_AUTORIZACION[ambito];
  if (personas.forma !== '1' && !(ambito in AMBITOS_AUTORIZACION)) faltan.push('tipo de autorización de despacho (global, OCRE u OSRE)');

  const numeros = goods.map((_, i) => i + 1);
  const contexto = { cambio: tipoCambio, medioDePago, factura };
  const datos = {
    mensaje: { id: mensajeId, fecha, test },
    operacion: 'A',
    aduanaImportacion: aduanaDespacho,
    declaracion: { lrn: texto(lrn) || texto(decl.lrn), tipo: 'IM', tipoAdicional: 'A', idioma: 'ES' },
    // La aduana de presentacion son los ocho primeros caracteres de la ubicacion (ESR0001).
    aduanaPresentacion: ubicacion ? `ES${ubicacion.slice(2, 8)}` : aduanaDespacho,
    importador: personas.importador,
    declarante: personas.declarante,
    representante: personas.representante,
    formaRepresentacion: personas.forma,
    garantias,
    tipoCambio,
    envio: {
      naturalezaTransaccion: String(decl.natureOfTransaction || '11'),
      divisa: tipoCambio.divisa,
      exportador: exportadorDe(expedition.exporter, faltan),
      entrega: entregaDe(expedition, paisExpedicion, faltan),
      paisExpedicion,
      destino: { pais: 'ES', region },
      documentosJustificativos: referenciaAutorizacion ? [{ tipo: '1005', referencia: referenciaAutorizacion }] : [],
      expedicion: expedicionDe(expedition, numeros, faltan),
      partidas: goods.map((g, i) => partidaDe(expedition, g, i, contexto, faltan))
    }
  };

  if (faltan.length > 0) {
    const unicos = [...new Set(faltan)];
    const error = new ErrorValidacion(`Faltan datos para presentar el H1: ${unicos.join('; ')}`, { code: 'DATOS_H1_FALTANTES' });
    error.faltan = unicos;
    throw error;
  }
  return datos;
}

module.exports = { expeditionToH1CauData, conPais, aduana, ubicacionDe, provinciaDe, PAGOS_CON_GARANTIA };
