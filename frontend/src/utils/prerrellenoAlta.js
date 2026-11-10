/**
 * Prerrelleno del alta de un expediente con lo que LUCI ha leido en un
 * documento (factura, packing list, BL, AWB, CMR…).
 *
 * UAT 10/Nov/2026: el agente pidio empezar el alta subiendo la documentacion.
 *
 * Reglas:
 *  - Solo se rellena lo que esta VACIO. Lo que el agente ya ha escrito, o lo
 *    que relleno un documento anterior, no se toca: si el documento dice otra
 *    cosa, se devuelve como aviso para que el agente decida.
 *  - Los desplegables que nacen con un valor por defecto (modo de transporte,
 *    incoterm, moneda, tipo de bulto) si se cambian, salvo que ya los haya
 *    fijado un documento anterior (`fijados`).
 *  - No se deduce nada: un dato que el documento no trae se queda sin rellenar.
 */

import { DEFAULT_PACKAGE_TYPE } from '../components/Expeditions/packageTypes'

export const MONEDAS_ALTA = ['EUR', 'USD', 'GBP', 'CNY']
export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']
export const MODO_POR_DEFECTO = 'SEA'
export const INCOTERM_POR_DEFECTO = 'CIF'
export const MONEDA_POR_DEFECTO = 'EUR'

const MODO_POR_DOCUMENTO = { bill_of_lading: 'SEA', air_waybill: 'AIR', cmr: 'ROAD' }
const TIPO_TRANSPORTE = { bill_of_lading: 'BL', air_waybill: 'AWB', cmr: 'CMR' }

// Unidades del documento que corresponden a las cuatro que ofrece el alta.
const UNIDADES = {
  PCS: 'PCS', PC: 'PCS', PIECE: 'PCS', PIECES: 'PCS', UNIT: 'PCS', UNITS: 'PCS', UN: 'PCS', UD: 'PCS', UDS: 'PCS',
  UNIDAD: 'PCS', UNIDADES: 'PCS', PIEZA: 'PCS', PIEZAS: 'PCS', SET: 'PCS', SETS: 'PCS', EA: 'PCS',
  KG: 'KGM', KGS: 'KGM', KGM: 'KGM', KILO: 'KGM', KILOS: 'KGM',
  M: 'MTR', MTR: 'MTR', MTS: 'MTR', METRO: 'MTR', METROS: 'MTR', METER: 'MTR', METERS: 'MTR',
  L: 'LTR', LTR: 'LTR', LTS: 'LTR', LITRO: 'LTR', LITROS: 'LTR', LITER: 'LTR', LITERS: 'LTR'
}

/** Partida en blanco del formulario de alta. */
export const partidaVacia = () => ({
  description: '',
  taricCode: '',
  originCountry: '',
  quantity: '',
  quantityUnit: 'KGM',
  netWeight: '',
  grossWeight: '',
  packages: { quantity: '', type: DEFAULT_PACKAGE_TYPE },
  invoiceValue: '',
  currency: MONEDA_POR_DEFECTO
})

/** Datos del transporte que el alta no pedia y que traen el BL, el AWB o el CMR. */
export const transporteVacio = () => ({
  documentType: '', documentNumber: '', vehicleId: '', departurePort: '', arrivalPort: '', containers: ''
})

const vacio = (v) => v === '' || v === null || v === undefined
const esNumero = (v) => !vacio(v) && Number.isFinite(Number(String(v).replace(',', '.')))
const iguales = (a, b) => {
  if (esNumero(a) && esNumero(b)) return Number(String(a).replace(',', '.')) === Number(String(b).replace(',', '.'))
  return String(a).trim().toUpperCase() === String(b).trim().toUpperCase()
}

// El importe se teclea a la española: coma decimal y sin separador de millares.
const importeParaFormulario = (n) => String(n).replace('.', ',')

const partidaEnBlanco = (g) => vacio(g.description) && vacio(g.taricCode) && vacio(g.invoiceValue) &&
  vacio(g.packages?.quantity) && vacio(g.grossWeight) && vacio(g.netWeight)

const partidaConDatos = (p) => p && Object.values(p).some((v) => !vacio(v))

/**
 * Separa la identificacion fiscal leida en NIF y EORI.
 * «ESB12345678» es un EORI español: su NIF son los nueve ultimos caracteres.
 *
 * @returns {{ nif?: string, eori?: string }}
 */
export const identificacionFiscal = (texto) => {
  const limpio = String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (/^ES[A-Z0-9]{9}$/.test(limpio)) return { nif: limpio.slice(2), eori: limpio }
  if (/^[A-Z0-9]{8,10}$/.test(limpio)) return { nif: limpio }
  return {}
}

const claveDe = (campo, partida) => (partida ? `${campo}|${partida}` : campo)

/**
 * Aplica una lectura al formulario de alta.
 *
 * @param {object} formData estado del formulario de alta
 * @param {object} extraccion lectura normalizada que devuelve el backend
 * @param {{ tipoDocumento?: string, fijados?: string[] }} [opciones]
 *   `fijados`: claves (`claveDe`) que ya relleno un documento anterior.
 * @returns {{
 *   formData: object,
 *   rellenados: Array<{ campo: string, valor: *, partida?: number, clave: string }>,
 *   avisos: Array<{ campo: string, valor: *, actual?: *, partida?: number }>
 * }}
 */
export function prerrellenarAlta(formData, extraccion, { tipoDocumento, fijados = [] } = {}) {
  const rellenados = []
  const avisos = []
  if (!extraccion || extraccion.legible === false || extraccion.leido === false) {
    return { formData, rellenados, avisos }
  }

  const yaFijado = new Set(fijados)
  const next = {
    ...formData,
    client: { ...formData.client },
    exporter: { ...formData.exporter },
    consignee: { ...formData.consignee },
    transportDetails: { ...transporteVacio(), ...(formData.transportDetails || {}) },
    goods: formData.goods.map((g) => ({ ...g, packages: { ...(g.packages || {}) } }))
  }

  // Rellena `destino[propiedad]` si esta vacio (o en su valor por defecto); si
  // tiene otro dato, lo deja y avisa.
  const proponer = (campo, destino, propiedad, nuevo, { partida, porDefecto } = {}) => {
    if (vacio(nuevo)) return
    const actual = destino[propiedad]
    const clave = claveDe(campo, partida)
    const sustituible = vacio(actual) || (porDefecto !== undefined && actual === porDefecto && !yaFijado.has(clave))
    if (sustituible) {
      if (!vacio(actual) && iguales(actual, nuevo)) return
      destino[propiedad] = nuevo
      rellenados.push({ campo, valor: nuevo, clave, ...(partida ? { partida } : {}) })
      return
    }
    if (!iguales(actual, nuevo)) avisos.push({ campo, valor: nuevo, actual, ...(partida ? { partida } : {}) })
  }

  // ---- Partes -----------------------------------------------------------------
  const exp = extraccion.exportador || {}
  const imp = extraccion.importador || {}
  const esExportacion = formData.operationType === 'EXPORT'
  const cliente = esExportacion ? exp : imp
  const contraparte = esExportacion ? imp : exp
  const destinoContraparte = esExportacion ? next.consignee : next.exporter

  proponer('clientName', next.client, 'companyName', cliente.nombre)
  proponer('clientAddress', next.client, 'address', cliente.direccion)
  proponer('clientCity', next.client, 'city', cliente.ciudad)
  if (!vacio(cliente.identificacionFiscal)) {
    const { nif, eori } = identificacionFiscal(cliente.identificacionFiscal)
    if (!nif) avisos.push({ campo: 'fiscalIdNotRecognised', valor: cliente.identificacionFiscal })
    proponer('clientNif', next.client, 'nif', nif)
    proponer('clientEori', next.client, 'eori', eori)
  }
  proponer('counterpartName', destinoContraparte, 'companyName', contraparte.nombre)
  proponer('counterpartCountry', destinoContraparte, 'country', contraparte.pais)
  proponer('counterpartCity', destinoContraparte, 'city', contraparte.ciudad)
  proponer('counterpartAddress', destinoContraparte, 'address', contraparte.direccion)

  // ---- Partidas ---------------------------------------------------------------
  const partidas = (extraccion.partidas || []).filter(partidaConDatos)
  const totales = extraccion.totales || {}
  const factura = extraccion.factura || {}
  if (partidas.length > 1 && next.goods.every(partidaEnBlanco)) {
    next.goods = partidas.map(() => partidaVacia())
  }

  const unaSola = next.goods.length === 1 && partidas.length <= 1
  if (partidas.length > 0 && partidas.length !== next.goods.length) {
    avisos.push({ campo: 'itemsMismatch', valor: partidas.length, actual: next.goods.length })
  } else {
    next.goods.forEach((good, i) => {
      const p = partidas[i] || {}
      const n = i + 1
      // Con una sola partida, los totales del documento son los de esa partida
      // (un packing list puede detallar un bulto y totalizar doce).
      const bultos = unaSola ? (totales.bultos ?? p.bultos) : p.bultos
      const pesoBruto = unaSola ? (totales.pesoBrutoKg ?? p.pesoBrutoKg) : p.pesoBrutoKg
      const pesoNeto = unaSola ? (totales.pesoNetoKg ?? p.pesoNetoKg) : p.pesoNetoKg
      const importe = p.importe ?? (unaSola ? factura.importeTotal : null)

      proponer('description', good, 'description', p.descripcion, { partida: n })
      if (/^\d{10}$/.test(p.codigoMercancia || '')) proponer('taricCode', good, 'taricCode', p.codigoMercancia, { partida: n })
      proponer('originCountry', good, 'originCountry', p.paisOrigen, { partida: n })

      const unidad = UNIDADES[String(p.unidad || '').toUpperCase().replace(/[^A-Z]/g, '')]
      if (!vacio(p.cantidad) && unidad && vacio(good.quantity)) {
        proponer('quantity', good, 'quantity', String(p.cantidad), { partida: n })
        good.quantityUnit = unidad
      }

      if (!vacio(bultos)) {
        proponer('packagesQuantity', good.packages, 'quantity', String(bultos), { partida: n })
        proponer('packagesType', good.packages, 'type', p.tipoBulto, { partida: n, porDefecto: DEFAULT_PACKAGE_TYPE })
      }
      if (!vacio(pesoBruto)) proponer('grossWeight', good, 'grossWeight', String(pesoBruto), { partida: n })
      if (!vacio(pesoNeto)) proponer('netWeight', good, 'netWeight', String(pesoNeto), { partida: n })

      if (!vacio(importe)) {
        proponer('invoiceValue', good, 'invoiceValue', importeParaFormulario(importe), { partida: n })
        if (MONEDAS_ALTA.includes(factura.moneda)) {
          proponer('currency', good, 'currency', factura.moneda, { partida: n, porDefecto: MONEDA_POR_DEFECTO })
        } else if (!vacio(factura.moneda)) {
          avisos.push({ campo: 'currencyNotAvailable', valor: factura.moneda, partida: n })
        }
      }
    })
  }

  // ---- Transporte y condiciones -------------------------------------------------
  const tra = extraccion.transporte || {}
  const modo = MODO_POR_DOCUMENTO[tipoDocumento]
  proponer('transportMode', next, 'transportMode', modo, { porDefecto: MODO_POR_DEFECTO })
  if (modo && modo === MODO_POR_DEFECTO && formData.transportMode === MODO_POR_DEFECTO && !yaFijado.has('transportMode')) {
    // El BL confirma el modo por defecto: queda fijado frente a otros documentos.
    rellenados.push({ campo: 'transportMode', valor: modo, clave: 'transportMode' })
  }
  if (next.transportMode === 'SEA') proponer('loadType', next, 'loadType', tra.tipoCarga)

  if (INCOTERMS.includes(factura.incoterm)) {
    proponer('incotermCode', next, 'incoterm', factura.incoterm, { porDefecto: INCOTERM_POR_DEFECTO })
  }
  proponer('incotermPlace', next, 'incotermPlace', factura.lugarIncoterm)

  const detalle = next.transportDetails
  if (TIPO_TRANSPORTE[tipoDocumento]) {
    if (!vacio(tra.numeroDocumento) && vacio(detalle.documentNumber)) detalle.documentType = TIPO_TRANSPORTE[tipoDocumento]
    proponer('documentNumber', detalle, 'documentNumber', tra.numeroDocumento)
  }
  proponer('vehicleId', detalle, 'vehicleId', tra.medio)
  proponer('departurePort', detalle, 'departurePort', tra.puertoCarga)
  proponer('arrivalPort', detalle, 'arrivalPort', tra.puertoDescarga)
  proponer('containers', detalle, 'containers', (tra.contenedores || []).join(', '))

  return { formData: next, rellenados, avisos }
}

/**
 * Datos de transporte del alta en la forma que espera el backend.
 *
 * @returns {object|undefined} undefined si no hay nada que enviar
 */
export function transporteParaAlta(formData) {
  const d = formData.transportDetails || {}
  const contenedores = String(d.containers || '').split(/[,;\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean)
  const transporte = {
    ...(formData.transportMode === 'SEA' && formData.loadType ? { loadType: formData.loadType } : {}),
    ...(d.documentNumber ? { documentNumber: d.documentNumber.trim(), ...(d.documentType ? { documentType: d.documentType } : {}) } : {}),
    ...(d.vehicleId ? { vehicleId: d.vehicleId.trim() } : {}),
    ...(d.departurePort ? { departurePort: d.departurePort.trim() } : {}),
    ...(d.arrivalPort ? { arrivalPort: d.arrivalPort.trim() } : {}),
    ...(contenedores.length > 0 ? { containers: contenedores.map((number) => ({ number })) } : {})
  }
  return Object.keys(transporte).length > 0 ? transporte : undefined
}
