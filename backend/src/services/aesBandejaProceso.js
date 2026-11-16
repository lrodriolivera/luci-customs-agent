/**
 * Lectura periódica de la bandeja de avisos de exportación AES y su efecto en
 * los expedientes (worker: workers/aesBandejaWorker.js; peticiones y lectura
 * de los mensajes: services/aeat/aesBandeja.js).
 *
 * Una pasada:
 *  1. Buzones: los NIF destinatarios de los avisos de los AES presentados que
 *     aún no tienen resultado final. El destinatario es el que la AEAT dice
 *     (guía §4.2): el representante del CC515C o, si no hay, el declarante; en
 *     LUCI suele ser la agencia (EORI del tenant en Ajustes › Aduanas). Cada
 *     buzón sabe qué tenants tienen AES vivos con ese destinatario.
 *  2. Avisos ya guardados sin expediente: se vuelven a intentar asociar.
 *  3. Por cada buzón, la lista de pendientes (ListaDecV4) y, de cada aviso AES
 *     cuya clave no esté ya guardada, el detalle (DetalleV5). Leer el detalle
 *     lo marca leído en la AEAT, así que se guarda en AvisoAeat al momento.
 *  4. Asociación: expediente AES con ese MRN de uno de los tenants del buzón.
 *     Con un solo certificado de LUCI para todos los tenants, la AEAT entrega
 *     al certificado los avisos de cada NIF para el que está apoderado; el
 *     aislamiento lo da que un aviso leído del buzón del NIF X solo puede ir a
 *     un expediente de un tenant cuyo AES tiene a X como destinatario (y el
 *     aviso dice ser para X). Si hay más de un candidato, no se aplica
 *     (`ambiguo`); si ninguno, se guarda (`sin_expediente`).
 *  5. Efecto: estado AES y datos del aviso en `declaration.aesSalida`; con
 *     salida efectiva, `declaration.exitConfirmedAt`; el aviso en
 *     `declaration.aesAvisos` y en el historial; el seguimiento del monitor
 *     con el estado nuevo (final con SA/ST). Un aviso (por su Id) se aplica una
 *     sola vez aunque llegue dos veces, y uno no final no deshace un final.
 *
 * No escribe en la AEAT salvo la lectura del detalle (que la marca leída).
 */
const logger = require('../config/logger');
const Expedition = require('../models/Expedition');
const Tenant = require('../models/Tenant');
const AvisoAeat = require('../models/AvisoAeat');
const aeatTransport = require('./aeat/aeatTransport');
const {
  buildListaBandejaXML, buildDetalleBandejaXML, interpretarLista, interpretarAviso, nifBandeja,
  TIPOS_AVISO_AES, ENDPOINT_LISTA, ENDPOINT_DETALLE
} = require('./aeat/aesBandeja');
const { expeditionToAesData } = require('./aeat/aesData');
const { representanteDelTenant } = require('./forms/identificadorAduanero');

const LIMITE_POR_DEFECTO = 100;
const MAX_XML = 20000;
const DIAS_REASOCIAR = 30;
const DIAS_TRAS_FINAL = 7;
const DIA_MS = 24 * 3600 * 1000;

const nifSeguro = (valor) => {
  try {
    return nifBandeja(valor);
  } catch (e) {
    return null;
  }
};

/** NIF al que la AEAT manda los avisos de este AES (representante o declarante). */
function destinatarioDe(expedition, tenant) {
  try {
    const datos = expeditionToAesData(expedition, { tenant, isPRE: process.env.AEAT_ENVIRONMENT !== 'production' });
    const nif = nifSeguro(datos.representative?.id || datos.declarantEORI);
    if (nif) return nif;
  } catch (e) {
    // Datos del expediente cambiados o incompletos tras presentarlo: el del tenant.
  }
  return nifSeguro(representanteDelTenant(tenant).eori);
}

/** NIF -> { nombre, tenantIds } de los AES presentados sin resultado final (o final hace poco). */
async function _buzones(ahora) {
  // También los que acaban de quedar finales: aún pueden llegar avisos
  // rezagados (p. ej. el levante en salida tras el resultado de la salida).
  const vivas = await Expedition.find({
    'declaration.type': 'AES',
    'declaration.status': 'submitted',
    'declaration.mrn': { $nin: [null, ''] },
    $or: [
      { 'declaration.aesSalida.final': { $ne: true } },
      { 'declaration.aesSalida.actualizadoEn': { $gte: new Date(ahora.getTime() - DIAS_TRAS_FINAL * DIA_MS) } }
    ]
  }).select('-documents -aiAnalysis -timeline -communications -declaration.xmlContent -declaration.responseXml').lean();
  if (vivas.length === 0) return new Map();

  const ids = [...new Set(vivas.map((e) => String(e.tenantId)).filter((t) => t && t !== 'undefined' && t !== 'null'))];
  const tenants = new Map((await Tenant.find({ _id: { $in: ids } }).lean()).map((t) => [String(t._id), t]));
  const buzones = new Map();
  for (const exp of vivas) {
    const tenant = tenants.get(String(exp.tenantId));
    if (!tenant) continue;
    const nif = destinatarioDe(exp, tenant);
    if (!nif) continue;
    const buzon = buzones.get(nif) || { nombre: null, tenantIds: new Set() };
    buzon.tenantIds.add(String(tenant._id));
    if (!buzon.nombre && nifSeguro(representanteDelTenant(tenant).eori) === nif) {
      buzon.nombre = representanteDelTenant(tenant).companyName;
    }
    buzones.set(nif, buzon);
  }
  return buzones;
}

/** Fecha (Date) de un AAAA-MM-DD o del día de un AAAA-MM-DDTHH:MM:SS. */
const dia = (valor) => (valor && /^\d{4}-\d{2}-\d{2}/.test(valor) ? new Date(`${valor.slice(0, 10)}T00:00:00.000Z`) : null);

/** Campos de `declaration.aesSalida` (y la salida confirmada) que cambia el aviso. */
function _cambios(aviso, previo, officeOfExit) {
  const d = aviso.datos || {};
  const set = { 'declaration.aesSalida.actualizadoEn': new Date(), 'declaration.aesSalida.ultimoAviso': aviso.tipo };
  if (aviso.estadoAES && !(previo.final === true && !aviso.final)) {
    set['declaration.aesSalida.estado'] = aviso.estadoAES;
    set['declaration.aesSalida.estadoTexto'] = aviso.estadoTexto;
    set['declaration.aesSalida.final'] = aviso.final;
  }
  // El aviso no dice por qué aduana salió: se muestra la de salida declarada.
  if (officeOfExit) set['declaration.aesSalida.aduanaSalida'] = officeOfExit;
  const poner = (campo, valor) => { set[`declaration.aesSalida.${campo}`] = valor; };

  switch (aviso.tipo) {
    case 'CLEVEX':
      poner('levanteExportacion', { fecha: d.fechaLevante || null, csv: d.csvLevante || null, csvT2L: d.csvT2L || null, salidaDirecta: d.salidaDirecta ?? null });
      break;
    case 'CLEVSA':
      poner('levanteSalida', { fecha: d.fechaLevanteSalida || null, csv: d.csvLevanteSalida || null });
      break;
    case 'CSALID':
      if (aviso.estadoAES === 'SA') {
        poner('salida', { confirmada: true, fecha: d.fechaSalidaEfectiva || null, resultado: d.resultadoSalida || null, resultadoTexto: d.resultadoSalidaTexto || null });
        // Sin fecha (salida en base a prueba), la del aviso.
        set['declaration.exitConfirmedAt'] = dia(d.fechaSalidaEfectiva) || dia(aviso.fechaPreparacion) || new Date();
      } else {
        poner('salida', { confirmada: false, parada: aviso.estadoAES === 'ST', fechaParada: d.fechaParada || null, resultado: d.resultadoSalida || null, resultadoTexto: d.resultadoSalidaTexto || null });
      }
      break;
    case 'CDISEX':
    case 'CDISSA':
      poner('disconformidad', { aduana: aviso.tipo === 'CDISEX' ? 'exportacion' : 'salida', fecha: d.fechaDisconforme || null, motivo: d.motivo || null });
      break;
    case 'CINVAL':
      poner('invalidacion', { fecha: d.fechaInvalidacion || null, iniciadaPorAduana: d.iniciadaPorAduana ?? null, justificacion: d.justificacion || null });
      break;
    case 'CONCCE':
      poner('controles', { fecha: d.fechaNotificacion || null, tipoNotificacion: d.tipoNotificacion || null, controles: d.controles || [], documentos: d.documentos || [] });
      break;
    default:
      break;
  }
  return set;
}

/** Aplica el aviso al expediente; false si ese aviso ya estaba aplicado. */
async function _aplicar(exp, aviso) {
  const id = aviso.avisoId || aviso.clave;
  const texto = TIPOS_AVISO_AES[aviso.tipo]?.texto || aviso.tipo;
  const fecha = aviso.datos?.fechaSalidaEfectiva || aviso.datos?.fechaLevante || aviso.datos?.fechaLevanteSalida || aviso.fechaPreparacion || null;
  const r = await Expedition.updateOne(
    { _id: exp._id, tenantId: exp.tenantId, 'declaration.mrn': aviso.mrn, 'declaration.aesAvisos.id': { $ne: id } },
    {
      $set: _cambios(aviso, exp.declaration?.aesSalida || {}, exp.declaration?.officeOfExit),
      $push: {
        'declaration.aesAvisos': { id, clave: aviso.clave, tipo: aviso.tipo, texto, estadoAES: aviso.estadoAES, fecha, recibidoEn: new Date() },
        timeline: {
          action: 'aes_aviso_aeat',
          description: `AEAT: ${texto}${aviso.estadoAES ? ` (estado ${aviso.estadoAES})` : ''}`,
          performedBy: 'AEAT (bandeja de avisos)',
          timestamp: new Date(),
          metadata: { mrn: aviso.mrn, tipo: aviso.tipo, estadoAES: aviso.estadoAES }
        }
      }
    }
  );
  if (r.modifiedCount === 0) return false;
  try {
    const monitor = require('./aeat/aeatStatusMonitorService');
    await monitor.aplicarAvisoBandeja({ mrn: aviso.mrn, tenantId: String(exp.tenantId), tipo: aviso.tipo, estado: aviso.estadoAES, fecha });
  } catch (error) {
    logger.warn(`[AES-BANDEJA] No se pudo actualizar el seguimiento: ${error.message}`);
  }
  return true;
}

/**
 * Asocia un aviso guardado a su expediente (solo tenants del buzón) y lo aplica.
 * @returns {Promise<'aplicado'|'repetido'|'sin_expediente'|'ambiguo'>}
 */
async function _asociarYAplicar(aviso, buzon) {
  const candidatos = buzon ? await Expedition.find({
    'declaration.type': 'AES', 'declaration.mrn': aviso.mrn, tenantId: { $in: [...buzon.tenantIds] }
  }).select('_id tenantId declaration.aesSalida declaration.officeOfExit').lean() : [];

  let estado;
  let destino = {};
  if (candidatos.length === 0) estado = 'sin_expediente';
  else if (candidatos.length > 1) estado = 'ambiguo';
  else {
    const [exp] = candidatos;
    estado = (await _aplicar(exp, aviso)) ? 'aplicado' : 'repetido';
    destino = { tenantId: exp.tenantId, expeditionId: exp._id, aplicadoEn: new Date() };
  }
  await AvisoAeat.updateOne({ _id: aviso._id }, { $set: { estado, ...destino } });
  return estado;
}

/** Lee el detalle de un aviso de la lista y lo guarda. @returns aviso guardado o null */
async function _leer(item, nif, enviar, resumen) {
  const base = { nif, referencia: item.referencia, tipoRespuesta: item.tipoRespuesta, tipo: item.codigo, mrn: item.mrn };
  let cuerpo = '';
  let aviso;
  try {
    const respuesta = await enviar(buildDetalleBandejaXML({ clave: item.clave }), ENDPOINT_DETALLE);
    cuerpo = String(respuesta?.data ?? '');
    aviso = interpretarAviso(cuerpo, { mrn: item.mrn });
  } catch (error) {
    aviso = { success: false, tipo: 'red', error: `No se pudo leer el aviso: ${error.message}` };
  }
  if (aviso.success && aviso.destinatario && aviso.destinatario !== nif) {
    aviso = { success: false, tipo: 'aviso', error: `El aviso es para ${aviso.destinatario}, no para ${nif}` };
  }
  if (!aviso.success) {
    resumen.errores += 1;
    // Un aviso que llegó pero no se entiende ya está leído en la AEAT: no se reintenta.
    const estado = aviso.tipo === 'aviso' ? 'no_valido' : 'error_lectura';
    await AvisoAeat.updateOne(
      { clave: item.clave },
      { $set: { ...base, estado, error: aviso.error, xml: cuerpo.slice(0, MAX_XML), ...(estado === 'no_valido' ? { leidoEn: new Date() } : {}) }, $inc: { intentos: 1 } },
      { upsert: true }
    );
    logger.warn(`[AES-BANDEJA] Aviso ${item.codigo} no leído: ${aviso.error}`);
    return null;
  }
  resumen.leidos += 1;
  return AvisoAeat.findOneAndUpdate(
    { clave: item.clave },
    {
      $set: {
        ...base, tipo: aviso.tipo, mrn: aviso.mrn, avisoId: aviso.id || aviso.mensajeId, estadoAES: aviso.estadoAES,
        fechaPreparacion: aviso.fechaPreparacion, datos: { ...aviso.datos, estadoTexto: aviso.estadoTexto, final: aviso.final },
        xml: cuerpo.slice(0, MAX_XML), leidoEn: new Date(), estado: 'sin_expediente', error: null
      },
      $inc: { intentos: 1 }
    },
    { upsert: true, new: true, lean: true }
  );
}

/** Aviso guardado -> forma que esperan _cambios/_aplicar. */
const avisoDe = (doc) => ({
  _id: doc._id, clave: doc.clave, tipo: doc.tipo, mrn: doc.mrn, avisoId: doc.avisoId, estadoAES: doc.estadoAES,
  estadoTexto: doc.datos?.estadoTexto || null, final: doc.datos?.final === true, fechaPreparacion: doc.fechaPreparacion, datos: doc.datos || {}
});

function _contar(resumen, estado) {
  if (estado === 'aplicado') resumen.aplicados += 1;
  else if (estado === 'sin_expediente' || estado === 'ambiguo') resumen.sinExpediente += 1;
}

/**
 * Una pasada por la bandeja.
 * @param {{ enviar?: Function, limite?: number, ahora?: Date }} [opciones]
 *   enviar: transporte SOAP (por defecto aeatTransport.sendSoap); limite: avisos
 *   leídos como mucho en la pasada (el resto, en la siguiente).
 * @returns {Promise<{ buzones, leidos, aplicados, sinExpediente, repetidos, errores, restantes }>}
 */
async function procesarBandeja({ enviar = aeatTransport.sendSoap, limite = LIMITE_POR_DEFECTO, ahora = new Date() } = {}) {
  const resumen = { buzones: 0, leidos: 0, aplicados: 0, sinExpediente: 0, repetidos: 0, errores: 0, restantes: 0 };
  const buzones = await _buzones(ahora);
  resumen.buzones = buzones.size;
  if (buzones.size === 0) return resumen;

  // Avisos ya leídos que aún no tenían expediente.
  const pendientes = await AvisoAeat.find({
    estado: { $in: ['sin_expediente', 'ambiguo'] }, nif: { $in: [...buzones.keys()] },
    leidoEn: { $gte: new Date(ahora.getTime() - DIAS_REASOCIAR * DIA_MS) }
  }).limit(200).lean();
  for (const doc of pendientes) {
    const estado = await _asociarYAplicar(avisoDe(doc), buzones.get(doc.nif));
    if (estado === 'aplicado') resumen.aplicados += 1;
  }

  let lecturas = 0;
  for (const [nif, buzon] of buzones) {
    let lista;
    try {
      const respuesta = await enviar(buildListaBandejaXML({ nif, nombre: buzon.nombre }), ENDPOINT_LISTA);
      lista = interpretarLista(String(respuesta?.data ?? ''));
    } catch (error) {
      lista = { success: false, error: error.message };
    }
    if (!lista.success) {
      resumen.errores += 1;
      logger.warn(`[AES-BANDEJA] No se pudo leer la lista de un buzón: ${lista.error}`);
      continue;
    }

    for (const item of lista.avisos) {
      const guardado = await AvisoAeat.findOne({ clave: item.clave }).select('estado').lean();
      if (guardado && guardado.estado !== 'error_lectura') {
        resumen.repetidos += 1;
        continue;
      }
      if (lecturas >= limite) {
        resumen.restantes += 1;
        continue;
      }
      lecturas += 1;
      const doc = await _leer(item, nif, enviar, resumen);
      if (!doc) continue;
      _contar(resumen, await _asociarYAplicar(avisoDe(doc), buzon));
    }
  }
  return resumen;
}

module.exports = { procesarBandeja, destinatarioDe };
