/**
 * Contraste del arancel y el IVA de una partida con el Arancel Integrado de la
 * AEAT (ver arancelIntegrado.js). Funciones puras: reciben el resultado de la
 * consulta y la partida, no llaman a la AEAT.
 *
 * - Arancel general: la medida 103 (derecho de terceros paises).
 * - Preferencias: medidas 1xx distintas de la 103 cuya area geografica es el
 *   origen consultado (p. ej. 142-PREF "VN Vietnam"). Exigen prueba de origen,
 *   asi que usarlas es una decision de la agente, nunca automatica.
 * - IVA: la medida IVA.
 */

/** "12,000%" -> 12; un derecho que no es un porcentaje (EUR, unidades) -> null. */
function porcentaje(derecho) {
  const m = String(derecho || '').match(/^\s*([\d.,]+)\s*%\s*$/);
  return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null;
}

/**
 * Tipos que da la AEAT para el origen consultado.
 * @returns {{ general: number|null, preferencias: {codigo: string, tipo: number}[], iva: number|null }}
 */
function tiposAeat(resultado) {
  const medidas = resultado?.medidas || [];
  const area = resultado?.areaGeografica || '';
  const general = porcentaje(medidas.find((m) => m.codigo.startsWith('103'))?.derecho);
  const preferencias = medidas
    .filter((m) => /^1\d\d/.test(m.codigo) && !m.codigo.startsWith('103') && area && m.areaGeografica?.startsWith(area))
    .map((m) => ({ codigo: m.codigo, tipo: porcentaje(m.derecho) }))
    .filter((p) => p.tipo !== null);
  const iva = porcentaje(medidas.find((m) => m.tipo === 'iva')?.derecho);
  return { general, preferencias, iva };
}

/**
 * Diferencias entre la partida y la AEAT. Un arancel igual a una preferencia
 * del origen no es diferencia (la agente la eligio con su prueba de origen).
 * @returns {{ campo: 'arancel'|'iva', expediente: number, aeat: number }[]}
 */
function diferencias(partida, resultado) {
  if (!resultado?.existe) return [];
  const { general, preferencias, iva } = tiposAeat(resultado);
  const salida = [];
  const arancel = typeof partida?.dutyRate === 'number' ? partida.dutyRate : null;
  if (arancel !== null && general !== null && arancel !== general && !preferencias.some((p) => p.tipo === arancel)) {
    salida.push({ campo: 'arancel', expediente: arancel, aeat: general });
  }
  const ivaPartida = typeof partida?.vatRate === 'number' ? partida.vatRate : null;
  if (ivaPartida !== null && iva !== null && ivaPartida !== iva) {
    salida.push({ campo: 'iva', expediente: ivaPartida, aeat: iva });
  }
  return salida;
}

/**
 * Tipos que se guardan en la partida al "usar los datos de la AEAT".
 * @param {object} resultado  - consulta del Arancel Integrado
 * @param {string} [medida]   - codigo de una preferencia del origen; sin el, el general
 * @returns {{ dutyRate: number, vatRate: number|null, medidaArancel: string }}
 * @throws {Error} con `codigo` 'SIN_ARANCEL' o 'PREFERENCIA_NO_VALIDA'
 */
function tiposParaAplicar(resultado, medida) {
  const { general, preferencias, iva } = tiposAeat(resultado);
  if (medida) {
    const preferencia = preferencias.find((p) => p.codigo === medida);
    if (!preferencia) {
      const error = new Error(`La medida ${medida} no es una preferencia de este origen en la AEAT`);
      error.codigo = 'PREFERENCIA_NO_VALIDA';
      throw error;
    }
    return { dutyRate: preferencia.tipo, vatRate: iva, medidaArancel: preferencia.codigo };
  }
  if (general === null) {
    const error = new Error('La AEAT no da un derecho de terceros países en porcentaje para este código');
    error.codigo = 'SIN_ARANCEL';
    throw error;
  }
  const codigoGeneral = (resultado.medidas || []).find((m) => m.codigo.startsWith('103')).codigo;
  return { dutyRate: general, vatRate: iva, medidaArancel: codigoGeneral };
}

module.exports = { porcentaje, tiposAeat, diferencias, tiposParaAplicar };
