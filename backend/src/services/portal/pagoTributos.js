/**
 * Pago de los tributos del H1 de cara al cliente, en su portal publico (UAT
 * 16/Nov/2026). Con pago previo al levante (forma de pago A, modelo 031) y el
 * H1 admitido, el cliente necesita el H1 definitivo, los datos para pagar el
 * 031 y subir el justificante: la agente queda a la espera de ese justificante
 * para obtener el levante.
 *
 * Todo lo que sale de aqui llega a un portal publico con token: lista blanca de
 * campos, nunca la respuesta de la AEAT tal cual (lleva el XML enviado, el CSV
 * y datos de otros organismos).
 */

// Pagina de la Sede de la AEAT para pagar deudas de comercio exterior
// (modelo 031) que enlazaron las agentes (UAT 16/Nov/2026).
const URL_PAGO_AEAT = 'https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/presentacion-declaraciones-ayuda-tecnica/pago-consultas-comercio-exterior/realizar-pago-telematicamente.html';

// Tipo de documento del justificante de pago del modelo 031.
const TIPO_JUSTIFICANTE_031 = 'customs_payment_receipt';

const numeroONull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * La liquidacion vigente de la AEAT: la de la ultima consulta si trae partidas
 * (la AEAT puede haberla rectificado); si no, la de la respuesta al presentar.
 * Mismo criterio que liquidacionAeatDe en declarationController.
 */
function liquidacionVigente(decl) {
  const r = decl?.aeatResponse || {};
  const deConsulta = r.consulta?.liquidacion;
  if (deConsulta?.partidas?.length > 0) return deConsulta;
  return r.liquidacion || null;
}

/**
 * Levante concedido por la AEAT. En el H1 CAU no vale la fecha de levante que
 * pone LUCI al procesar el canal verde: con pago previo la AEAT no da el
 * levante hasta cobrar el 031. Solo la consulta a la AEAT lo acredita (estado
 * de despacho L o fecha de levante).
 */
function conLevante(expedition) {
  const decl = expedition.declaration || {};
  if (expedition.status === 'levante') return true;
  if (decl.aeatResponse?.servicio === 'CC415AV1') {
    const estado = decl.aeatResponse.consulta?.estado || {};
    return estado.levante === 'L' || Boolean(estado.fechaLevante);
  }
  return Boolean(decl.levanteDate);
}

/** Ultimo justificante de pago del 031 subido al expediente, o null. */
function justificanteDe(expedition) {
  const docs = (expedition.documents || []).filter((d) => d.type === TIPO_JUSTIFICANTE_031);
  const ultimo = docs[docs.length - 1];
  return ultimo ? { subidoEn: ultimo.uploadedAt || null } : null;
}

/**
 * Lo que ve el cliente sobre el pago de los tributos del H1: la forma de pago
 * elegida, si aun puede cambiarla (antes de presentar), si puede descargar el
 * H1 definitivo y, con pago previo al levante y el H1 admitido, el importe y
 * los datos para pagar el 031. Null en exportacion.
 */
function pagoTributosDe(expedition) {
  if (expedition.operationType === 'export') return null;
  const decl = expedition.declaration || {};
  const metodo = decl.paymentMethod || null;
  const presentado = Boolean(decl.mrn);
  const liquidacion = liquidacionVigente(decl);
  const totalAPagar = presentado ? numeroONull(liquidacion?.totalAPagar) : null;
  const pendientePago = presentado && metodo === 'A' && !conLevante(expedition);
  const estadoAeat = decl.aeatResponse?.consulta?.estado || {};
  return {
    paymentMethod: metodo,
    editable: !presentado,
    mrn: decl.mrn || null,
    totalAPagar,
    pendientePago,
    urlPago: URL_PAGO_AEAT,
    h1Definitivo: presentado && totalAPagar !== null,
    // En el modelo 031 la deuda de una declaracion aduanera se identifica por su MRN.
    modelo031: pendientePago && totalAPagar !== null ? {
      referencia: decl.mrn,
      importe: totalAPagar,
      nifImportador: expedition.client?.nif || null,
      fechaAdmision: decl.acceptanceDate ? new Date(decl.acceptanceDate).toISOString() : null,
      limiteDePago: typeof estadoAeat.limiteDePago === 'string' ? estadoAeat.limiteDePago : null
    } : null,
    justificante: justificanteDe(expedition)
  };
}

/** El cliente puede subir el justificante del 031: pago previo y H1 presentado. */
function admiteJustificante031(expedition) {
  const decl = expedition.declaration || {};
  return expedition.operationType !== 'export' && decl.paymentMethod === 'A' && Boolean(decl.mrn);
}

const descripcionDe = (val) => {
  if (val == null) return '';
  if (typeof val === 'object') return String(val.es || val.en || '');
  return String(val);
};

/**
 * Datos del H1 admitido para el PDF «H1 definitivo» del cliente, en lista
 * blanca: identificacion de la declaracion, importador, partidas con sus
 * tributos (lo que liquido la AEAT) y total. Null si aun no esta admitido.
 */
function h1DefinitivoDe(expedition) {
  if (!pagoTributosDe(expedition)?.h1Definitivo) return null;
  const decl = expedition.declaration;
  const liquidacion = liquidacionVigente(decl);
  const goods = expedition.goods || [];
  return {
    expeditionId: expedition.expeditionId,
    mrn: decl.mrn,
    csv: decl.aeatResponse?.csv || null,
    fechaAdmision: decl.acceptanceDate || null,
    aduana: decl.customsOffice || null,
    formaDePago: decl.paymentMethod || null,
    importador: { nombre: expedition.client?.companyName || '', nif: expedition.client?.nif || '' },
    partidas: (liquidacion.partidas || []).map((p) => {
      const mercancia = goods[(Number(p.numero) || 0) - 1] || {};
      return {
        numero: p.numero,
        codigo: mercancia.taricCode || null,
        descripcion: descripcionDe(mercancia.description),
        tributos: (p.tributos || []).flatMap((t) => (t.bases || []).map((b) => ({
          tipo: t.tipo || null,
          medioDePago: t.medioDePago || null,
          base: numeroONull(b.importe),
          tipoImpositivo: numeroONull(b.tipoImpositivo),
          cuota: numeroONull(b.cuota)
        })))
      };
    }),
    totalAPagar: numeroONull(liquidacion.totalAPagar)
  };
}

module.exports = {
  URL_PAGO_AEAT,
  TIPO_JUSTIFICANTE_031,
  pagoTributosDe,
  admiteJustificante031,
  h1DefinitivoDe
};
