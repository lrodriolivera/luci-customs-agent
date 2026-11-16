import React, { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { declarationsAPI } from '../../services/api'
import { formatearImporte } from '../../utils/importe'
import { MONEDAS_ALTA } from '../../utils/prerrellenoAlta'
import LiquidacionAeat from './LiquidacionAeat'
import RegimenH1Campos, { useCatalogoRegimenesH1 } from './RegimenH1Campos'

const CIRCUITOS = { V: 'Verde', A: 'Amarillo (pendiente de certificados)', N: 'Naranja (revisión documental)', R: 'Rojo (reconocimiento físico)' }
/** Texto de la guía de la AEAT con su código; si el código no está en la guía, solo el código. */
const conCodigo = (texto, codigo) => (texto ? `${texto} (${codigo})` : codigo || '—')
/** «2026-11-12T10:57:04» -> «12/11/2026 10:57». */
const fecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '')
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '—'
}

const CAMPOS = [
  'invoiceNumber', 'exporterPostalCode', 'vehicleNationality', 'dispatchAuthorizationScope', 'paymentMethod',
  'freightAmount', 'freightCurrency', 'insuranceAmount', 'insuranceCurrency', 'appliedExchangeRate',
  'freightAfterEntryAmount', 'freightAfterEntryCurrency', 'procedure', 'additionalProcedure'
]
// El backend exige un motivo de al menos cinco caracteres.
const MOTIVO_MINIMO = 5
const comoTexto = (v) => (v === null || v === undefined ? '' : String(v))

/** Qué dice el incoterm sobre el flete y el seguro hasta la entrada en la UE. */
function explicacionGastos(incoterm, sumar) {
  if (!sumar) return 'Sin un incoterm reconocido en el expediente: el flete y el seguro que escribas se suman al valor en aduana.'
  if (sumar.flete && sumar.seguro) return `Con ${incoterm} el precio no incluye el flete ni el seguro hasta la entrada en la UE: se suman al valor en aduana. Escribe 0 si no hubo.`
  if (sumar.seguro) return `Con ${incoterm} el precio incluye el flete, no el seguro: el seguro hasta la entrada en la UE se suma al valor en aduana. Escribe 0 si no hubo.`
  return `Con ${incoterm} el precio ya incluye el flete y el seguro hasta la entrada en la UE: no se suma nada.`
}

/** Qué dice el incoterm sobre el transporte desde la entrada en la UE hasta el lugar de entrega (deducción BA). */
function explicacionTrasLaEntrada(incoterm, regla) {
  if (regla === 'exigir') return `Con ${incoterm} el precio incluye el transporte desde la entrada en la UE hasta el lugar de entrega: no forma parte del valor en aduana y se resta (código BA). Escribe 0 si se entrega en el punto de entrada.`
  return `Con ${incoterm}, si el lugar convenido es interior (o hay transbordo en otro puerto de la UE), el precio incluye ese transporte dentro de la UE: escríbelo y se resta del valor en aduana (código BA). Si no, déjalo vacío.`
}

/** Ajustes con importes como texto, para comparar lo editado con lo guardado. */
const ajustesComoTexto = (lista) => JSON.stringify((lista || []).map((a) => [a.code || '', comoTexto(a.amount), a.currency || 'EUR']))
const gastosIvaComoTexto = (lista) => JSON.stringify((lista || []).map((a) => [a.concept || '', comoTexto(a.amount), a.currency || 'EUR']))

/** Importe y divisa de un gasto (flete o seguro). */
function CampoGasto({ id, etiqueta, nombreDivisa, importe, divisa, onImporte, onDivisa }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{etiqueta}</label>
      <div className="flex gap-2">
        <input id={id} className="input" type="number" min="0" step="0.01" inputMode="decimal" value={comoTexto(importe)} onChange={onImporte} />
        <select aria-label={nombreDivisa} className="input w-28" value={divisa || 'EUR'} onChange={onDivisa}>
          {MONEDAS_ALTA.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  )
}

// La global registrada en la AEAT es la mas habitual: va primera y es la de
// por defecto (UAT 16/Nov/2026).
const AMBITOS = [
  { valor: 'global', texto: 'Global, registrada en la AEAT' },
  { valor: 'OSRE', texto: 'Por operación, sin registro electrónico en la AEAT' },
  { valor: 'OCRE', texto: 'Por operación, con registro electrónico en la AEAT' }
]

// Forma de pago del H1 (methodOfPayment). Vacia: la de Ajustes de la agencia.
const FORMAS_DE_PAGO = [
  { valor: '', texto: 'La configurada en Ajustes de la agencia' },
  { valor: 'A', texto: 'A · Pago previo al levante (modelo 031)' },
  { valor: 'R', texto: 'R · Pago aplazado con garantía del agente' }
]

/**
 * Datos del expediente que solo se usan al presentar el H1 (número de
 * factura, nacionalidad del medio de transporte y autorización de despacho) y
 * lista de lo que aún falta para poder presentarlo por el servicio de la AEAT
 * adaptado al CAU (CC415A).
 *
 * Con `soloEstado` (declaración ya presentada) solo muestra la consulta de estado.
 *
 * @param {{ expedition: object, soloEstado?: boolean, onCambio?: () => void }} props
 *   `onCambio`: se llama cuando cambia la declaración en la AEAT (p. ej. al activar una predeclaración)
 */
export default function H1DataCard({ expedition, soloEstado = false, onCambio }) {
  const [estado, setEstado] = useState(null)
  const [form, setForm] = useState({ invoiceNumber: '', exporterPostalCode: '', vehicleNationality: '', dispatchAuthorizationScope: 'global', paymentMethod: '' })
  const sumar = estado?.datos?.gastosASumar
  const pideFlete = !sumar || sumar.flete
  const pideSeguro = !sumar || sumar.seguro
  const divisaSinBce = estado?.datos?.invoiceCurrencyWithoutBce ? estado.datos.invoiceCurrency : null
  const reglaTrasLaEntrada = estado?.datos?.transporteTrasLaEntrada || null
  const codigosDeAjuste = estado?.datos?.codigosDeAjuste || {}
  const conceptosBaseIva = estado?.datos?.conceptosBaseIva || {}
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const regimenes = useCatalogoRegimenesH1()

  const cargar = useCallback(async () => {
    try {
      const datos = (await declarationsAPI.getH1Requirements(expedition._id)).data?.data
      setEstado(datos)
      setForm({ ...datos.datos })
      setError(null)
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudieron comprobar los datos del H1')
    }
  }, [expedition._id])

  // Se recarga cuando el expediente cambia en otra parte de la pantalla (p. ej. al
  // aplicar lo leido de la factura), salvo que haya cambios sin guardar aqui:
  // si no, esta tarjeta guardaba despues los valores viejos (UAT 16/Nov/2026).
  const hayCambiosSinGuardar = useRef(false)
  useEffect(() => { if (!hayCambiosSinGuardar.current) cargar() }, [cargar, expedition.updatedAt])

  const ajustesCambiados = Boolean(estado) && ajustesComoTexto(form.otherAdjustments) !== ajustesComoTexto(estado.datos.otherAdjustments)
  const gastosIvaCambiados = Boolean(estado) && gastosIvaComoTexto(form.vatAdditions) !== gastosIvaComoTexto(estado.datos.vatAdditions)
  const cambiar = (campo) => (e) => setForm((previo) => ({ ...previo, [campo]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      // Solo los campos editables; los gastos que el incoterm no pide no se tocan.
      const omitir = new Set([
        ...(pideFlete ? [] : ['freightAmount', 'freightCurrency']),
        ...(pideSeguro ? [] : ['insuranceAmount', 'insuranceCurrency']),
        ...(divisaSinBce ? [] : ['appliedExchangeRate']),
        ...(reglaTrasLaEntrada ? [] : ['freightAfterEntryAmount', 'freightAfterEntryCurrency'])
      ])
      // Solo lo que se ha cambiado aqui: lo demas puede haberlo rellenado otra
      // tarjeta despues de cargar esta, y no se pisa.
      const datos = Object.fromEntries(CAMPOS
        .filter((c) => form[c] !== undefined && !omitir.has(c) && comoTexto(form[c]) !== comoTexto(estado?.datos?.[c]))
        .map((c) => [c, form[c] === null ? '' : form[c]]))
      // Un importe va siempre con su divisa (aunque la divisa no se haya tocado).
      for (const [importe, divisa] of [['freightAmount', 'freightCurrency'], ['insuranceAmount', 'insuranceCurrency'], ['freightAfterEntryAmount', 'freightAfterEntryCurrency']]) {
        if (importe in datos && !(divisa in datos) && form[divisa] !== undefined && !omitir.has(divisa)) datos[divisa] = form[divisa] || 'EUR'
      }
      if (ajustesCambiados) datos.otherAdjustments = (form.otherAdjustments || []).map((a) => ({ code: a.code, amount: comoTexto(a.amount), currency: a.currency || 'EUR' }))
      if (gastosIvaCambiados) datos.vatAdditions = (form.vatAdditions || []).map((a) => ({ concept: a.concept, amount: comoTexto(a.amount), currency: a.currency || 'EUR' }))
      await declarationsAPI.updateH1Data(expedition._id, datos)
      toast.success('Datos del H1 guardados')
      hayCambiosSinGuardar.current = false
      await cargar()
      onCambio?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudieron guardar los datos del H1')
    } finally {
      setGuardando(false)
    }
  }

  const presentadoPorCau = expedition.declaration?.mrn && expedition.declaration?.aeatResponse?.servicio === 'CC415AV1'
  const [consulta, setConsulta] = useState(expedition.declaration?.aeatResponse?.consulta || null)
  const [consultando, setConsultando] = useState(false)

  const [anulacion, setAnulacion] = useState({ abierta: false, motivo: '', enviando: false, mensaje: null, error: null })
  const pulsarAnular = () => {
    // Lo activado no se anula por servicio web: se le pide a la aduana (no se envía nada).
    if (estado?.anulacion && !estado.anulacion.anulable) {
      setAnulacion((a) => ({ ...a, abierta: false, error: null, mensaje: 'Esta declaración ya está activada: no se puede anular por servicio web, hay que solicitar la anulación a la aduana. La resolución llega por la Bandeja de Entrada de la AEAT.' }))
      return
    }
    setAnulacion({ abierta: true, motivo: '', enviando: false, mensaje: null, error: null })
  }
  const confirmarAnulacion = async (e) => {
    e.preventDefault()
    setAnulacion((a) => ({ ...a, enviando: true, error: null }))
    try {
      await declarationsAPI.cancelH1(expedition._id, anulacion.motivo.trim())
      setAnulacion({ abierta: false, motivo: '', enviando: false, mensaje: 'La AEAT ha aceptado la anulación.', error: null })
      toast.success('Anulación aceptada por la AEAT')
      await cargar()
    } catch (err) {
      setAnulacion((a) => ({ ...a, enviando: false, error: err.response?.data?.error || 'No se pudo enviar la anulación a la AEAT' }))
    }
  }

  // Predeclaración «la activo yo» pendiente de activar (estado 63).
  const [activacion, setActivacion] = useState({ abierta: false, enviando: false, mensaje: null, error: null })
  const predeclaracion = estado?.predeclaracion
  const confirmarActivacion = async () => {
    setActivacion((a) => ({ ...a, enviando: true, error: null }))
    try {
      await declarationsAPI.activateH1(expedition._id)
      setActivacion({ abierta: false, enviando: false, mensaje: 'La AEAT ha activado la declaración.', error: null })
      toast.success('Declaración activada en la AEAT')
      await cargar()
      onCambio?.()
    } catch (err) {
      setActivacion((a) => ({ ...a, enviando: false, error: err.response?.data?.error || 'No se pudo activar la declaración en la AEAT' }))
    }
  }

  const consultarEstado = async () => {
    setConsultando(true)
    try {
      setConsulta((await declarationsAPI.getH1Status(expedition._id)).data?.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo consultar el estado en la AEAT')
    } finally {
      setConsultando(false)
    }
  }

  const sinCambios = estado && !ajustesCambiados && !gastosIvaCambiados && CAMPOS.every((campo) => comoTexto(form[campo]) === comoTexto(estado.datos[campo]))
  hayCambiosSinGuardar.current = Boolean(estado) && !sinCambios
  const ajustes = form.otherAdjustments || []
  const cambiarAjuste = (i, campo) => (e) => setForm((previo) => ({
    ...previo, otherAdjustments: (previo.otherAdjustments || []).map((a, j) => (j === i ? { ...a, [campo]: e.target.value } : a))
  }))
  const anadirAjuste = () => setForm((previo) => ({
    ...previo, otherAdjustments: [...(previo.otherAdjustments || []), { code: Object.keys(codigosDeAjuste)[0] || '', amount: '', currency: 'EUR' }]
  }))
  const quitarAjuste = (i) => setForm((previo) => ({ ...previo, otherAdjustments: (previo.otherAdjustments || []).filter((_, j) => j !== i) }))
  const gastosIva = form.vatAdditions || []
  const cambiarGastoIva = (i, campo) => (e) => setForm((previo) => ({
    ...previo, vatAdditions: (previo.vatAdditions || []).map((a, j) => (j === i ? { ...a, [campo]: e.target.value } : a))
  }))
  const anadirGastoIva = (concepto) => setForm((previo) => ({
    ...previo, vatAdditions: [...(previo.vatAdditions || []), { concept: concepto, amount: '', currency: 'EUR' }]
  }))
  const quitarGastoIva = (i) => setForm((previo) => ({ ...previo, vatAdditions: (previo.vatAdditions || []).filter((_, j) => j !== i) }))

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">Datos para presentar el H1</h2>
      <p className="text-sm text-gray-600 mb-4">
        La AEAT los exige en la declaración de importación adaptada al Código Aduanero de la Unión.
      </p>

      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

      {!soloEstado && <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="h1-invoice-number">Número de la factura comercial</label>
          <input id="h1-invoice-number" className="input" maxLength={70} value={form.invoiceNumber} onChange={cambiar('invoiceNumber')} />
        </div>
        <div>
          <label className="label" htmlFor="h1-vehicle-nationality">Nacionalidad del medio de transporte en frontera</label>
          <input
            id="h1-vehicle-nationality" className="input uppercase" maxLength={2} placeholder="Código de país, p. ej. PA"
            value={form.vehicleNationality} onChange={cambiar('vehicleNationality')}
          />
        </div>
        <div>
          <label className="label" htmlFor="h1-exporter-postcode">Código postal del exportador</label>
          <input id="h1-exporter-postcode" className="input" maxLength={17} value={form.exporterPostalCode || ''} onChange={cambiar('exporterPostalCode')} />
        </div>
        {regimenes.catalogo && (
          <RegimenH1Campos
            catalogo={regimenes.catalogo} procedure={form.procedure} additionalProcedure={form.additionalProcedure}
            onProcedure={cambiar('procedure')} onAdditionalProcedure={cambiar('additionalProcedure')}
          />
        )}
        {regimenes.error && <p role="status" className="sm:col-span-2 text-xs text-amber-800">No se pudo cargar la lista oficial de regímenes.</p>}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="h1-authorization-scope">Autorización de despacho del representante</label>
          <select id="h1-authorization-scope" className="input" value={form.dispatchAuthorizationScope} onChange={cambiar('dispatchAuthorizationScope')}>
            {AMBITOS.map((a) => <option key={a.valor} value={a.valor}>{a.texto}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">No se usa en autodespacho. Con autorización global no se declara ningún documento.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="h1-payment-method">Forma de pago</label>
          <select id="h1-payment-method" className="input" value={form.paymentMethod || ''} onChange={cambiar('paymentMethod')}>
            {FORMAS_DE_PAGO.map((f) => <option key={f.valor || 'ajustes'} value={f.valor}>{f.texto}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Con pago previo al levante el importador paga los tributos con el modelo 031 antes del levante. Con pago aplazado, el agente los garantiza con su garantía (GRN de Ajustes).
          </p>
        </div>
        {divisaSinBce && (
          <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <label className="label" htmlFor="h1-applied-rate">{`Cambio aplicado: 1 EUR = … ${divisaSinBce}`}</label>
            <input
              id="h1-applied-rate" className="input sm:w-60" type="number" min="0" step="0.00001" inputMode="decimal"
              value={comoTexto(form.appliedExchangeRate)} onChange={cambiar('appliedExchangeRate')}
            />
            <p className="mt-1 text-xs text-amber-900">
              {`El BCE no cotiza ${divisaSinBce} y la AEAT no la admite: el H1 se declara en euros con el contravalor y el documento 1017, que lleva la divisa y este cambio.`}
            </p>
          </div>
        )}
        <fieldset className="sm:col-span-2 grid gap-3 sm:grid-cols-2 rounded-lg border border-gray-200 p-3">
          <legend className="px-1 text-sm font-medium">Flete y seguro hasta la entrada en la UE</legend>
          <p className="sm:col-span-2 text-xs text-gray-600">{explicacionGastos(estado?.datos?.incoterm, sumar)}</p>
          {pideFlete && (
            <CampoGasto
              id="h1-freight" etiqueta="Flete hasta la entrada en la UE" nombreDivisa="Divisa del flete"
              importe={form.freightAmount} divisa={form.freightCurrency}
              onImporte={cambiar('freightAmount')} onDivisa={cambiar('freightCurrency')}
            />
          )}
          {pideSeguro && (
            <CampoGasto
              id="h1-insurance" etiqueta="Seguro hasta la entrada en la UE" nombreDivisa="Divisa del seguro"
              importe={form.insuranceAmount} divisa={form.insuranceCurrency}
              onImporte={cambiar('insuranceAmount')} onDivisa={cambiar('insuranceCurrency')}
            />
          )}
        </fieldset>
        {reglaTrasLaEntrada && (
          <fieldset className="sm:col-span-2 grid gap-3 sm:grid-cols-2 rounded-lg border border-gray-200 p-3">
            <legend className="px-1 text-sm font-medium">Transporte dentro de la UE incluido en el precio</legend>
            <p className="sm:col-span-2 text-xs text-gray-600">{explicacionTrasLaEntrada(estado?.datos?.incoterm, reglaTrasLaEntrada)}</p>
            <CampoGasto
              id="h1-freight-after-entry" etiqueta="Transporte desde la entrada en la UE" nombreDivisa="Divisa del transporte desde la entrada en la UE"
              importe={form.freightAfterEntryAmount} divisa={form.freightAfterEntryCurrency}
              onImporte={cambiar('freightAfterEntryAmount')} onDivisa={cambiar('freightAfterEntryCurrency')}
            />
          </fieldset>
        )}
        {Object.keys(codigosDeAjuste).length > 0 && (
          <fieldset className="sm:col-span-2 rounded-lg border border-gray-200 p-3">
            <legend className="px-1 text-sm font-medium">Otros ajustes del valor en aduana (opcional)</legend>
            <p className="text-xs text-gray-600">
              Comisiones, cánones, comisiones de compra… que la factura no recoge o que no forman parte del valor. Los códigos A se suman y los B se restan.
            </p>
            {ajustes.map((a, i) => (
              <div key={i} className="mt-2 flex flex-wrap gap-2">
                <select aria-label={`Código del ajuste ${i + 1}`} className="input sm:w-80" value={a.code || ''} onChange={cambiarAjuste(i, 'code')}>
                  {Object.entries(codigosDeAjuste).map(([codigo, texto]) => <option key={codigo} value={codigo}>{`${codigo} — ${texto}`}</option>)}
                </select>
                <input
                  aria-label={`Importe del ajuste ${i + 1}`} className="input w-36" type="number" min="0" step="0.01" inputMode="decimal"
                  value={comoTexto(a.amount)} onChange={cambiarAjuste(i, 'amount')}
                />
                <select aria-label={`Divisa del ajuste ${i + 1}`} className="input w-28" value={a.currency || 'EUR'} onChange={cambiarAjuste(i, 'currency')}>
                  {MONEDAS_ALTA.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" className="btn-secondary" aria-label={`Quitar el ajuste ${i + 1}`} onClick={() => quitarAjuste(i)}>Quitar</button>
              </div>
            ))}
            <button type="button" className="btn-secondary mt-2" onClick={anadirAjuste}>Añadir ajuste</button>
          </fieldset>
        )}
        {Object.keys(conceptosBaseIva).length > 0 && (
          <fieldset className="sm:col-span-2 rounded-lg border border-gray-200 p-3">
            <legend className="px-1 text-sm font-medium">Gastos a añadir a la base del IVA (opcional)</legend>
            <p className="text-xs text-gray-600">
              THC (manipulación en la terminal), T3 (tasa de la mercancía) y otros gastos hasta el primer lugar de destino en la UE (art. 83 de la Ley del IVA).
              Suben la base del IVA, no el valor en aduana: se declaran con el código CA en cada partida, repartidos por su valor.
            </p>
            <p className="mt-1 text-xs font-medium text-amber-800">Si la naviera factura estos gastos con IVA, no los incluyas aquí.</p>
            {gastosIva.map((a, i) => (
              <div key={i} className="mt-2 flex flex-wrap gap-2">
                <select aria-label={`Concepto del gasto ${i + 1} de la base del IVA`} className="input sm:w-80" value={a.concept || ''} onChange={cambiarGastoIva(i, 'concept')}>
                  {Object.entries(conceptosBaseIva).map(([codigo, texto]) => <option key={codigo} value={codigo}>{texto}</option>)}
                </select>
                <input
                  aria-label={`Importe del gasto ${i + 1} de la base del IVA`} className="input w-36" type="number" min="0" step="0.01" inputMode="decimal"
                  value={comoTexto(a.amount)} onChange={cambiarGastoIva(i, 'amount')}
                />
                <select aria-label={`Divisa del gasto ${i + 1} de la base del IVA`} className="input w-28" value={a.currency || 'EUR'} onChange={cambiarGastoIva(i, 'currency')}>
                  {MONEDAS_ALTA.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" className="btn-secondary" aria-label={`Quitar el gasto ${i + 1} de la base del IVA`} onClick={() => quitarGastoIva(i)}>Quitar</button>
              </div>
            ))}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => anadirGastoIva('THC')}>Añadir THC</button>
              <button type="button" className="btn-secondary" onClick={() => anadirGastoIva('T3')}>Añadir T3</button>
              <button type="button" className="btn-secondary" onClick={() => anadirGastoIva('OTHER')}>Añadir otro gasto</button>
            </div>
          </fieldset>
        )}
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn-primary" disabled={guardando || !estado || sinCambios}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>}

      {estado && !soloEstado && (
        <div className={`mt-4 rounded-lg border p-3 text-sm ${estado.listo ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {estado.listo ? (
            <p>El expediente tiene todos los datos que exige el H1.</p>
          ) : (
            <>
              <p className="font-medium">Faltan datos para presentar el H1:</p>
              <ul className="mt-1 list-disc pl-5">
                {estado.faltan.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </>
          )}
          {estado.servicio !== 'cau' && (
            <p className="mt-2 text-xs text-gray-600">
              El H1 se presenta todavía por el servicio anterior, que no exige estos datos. Se activa en Ajustes &gt; Aduanas.
            </p>
          )}
        </div>
      )}

      {/* Avisos que no impiden presentar (p. ej. aduana distinta de la del recinto) */}
      {estado?.avisos?.length > 0 && !soloEstado && (
        <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {estado.avisos.map((a) => <p key={a.codigo}>{a.texto}</p>)}
        </div>
      )}

      {presentadoPorCau && (
        <div className="mt-4 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Estado en la AEAT · MRN {expedition.declaration.mrn}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={consultarEstado} disabled={consultando}>
                {consultando ? 'Consultando...' : 'Consultar estado en la AEAT'}
              </button>
              <button type="button" className="btn-secondary text-red-700" onClick={pulsarAnular} disabled={anulacion.abierta}>
                Anular declaración
              </button>
            </div>
          </div>
          {predeclaracion?.pendiente && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
              <p className="font-medium text-blue-900">{`Predeclaración pendiente de activar · nº de registro ${predeclaracion.numeroRegistro}`}</p>
              <p className="mt-1 text-xs text-blue-900">
                Al activarla, la AEAT hace el análisis de riesgos y liquida con el tipo de cambio del día de la activación: si cambia de mes, la liquidación puede diferir de la de LUCI.
              </p>
              {!activacion.abierta ? (
                <button type="button" className="btn-primary mt-2" onClick={() => setActivacion({ abierta: true, enviando: false, mensaje: null, error: null })}>
                  Activar declaración
                </button>
              ) : (
                <div role="dialog" aria-label="Activar la declaración en la AEAT" className="mt-2">
                  <p>Se pedirá a la AEAT que active la predeclaración. Las mercancías deben estar ya presentadas en la ubicación declarada.</p>
                  {activacion.error && <p role="alert" className="mt-2 text-red-700">{activacion.error}</p>}
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className="btn-secondary" disabled={activacion.enviando} onClick={() => setActivacion((a) => ({ ...a, abierta: false, error: null }))}>
                      Cancelar
                    </button>
                    <button type="button" className="btn-primary" disabled={activacion.enviando} onClick={confirmarActivacion}>
                      {activacion.enviando ? 'Activando...' : 'Confirmar activación'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activacion.mensaje && <p role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{activacion.mensaje}</p>}
          {anulacion.mensaje && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{anulacion.mensaje}</p>}
          {anulacion.abierta && (
            <form role="dialog" aria-label="Anular la declaración en la AEAT" onSubmit={confirmarAnulacion} className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
              <p className="font-medium text-red-900">Se pedirá a la AEAT que anule la declaración {expedition.declaration.mrn}. No se puede deshacer.</p>
              <label className="label mt-2" htmlFor="h1-motivo-anulacion">Motivo de la anulación</label>
              <textarea
                id="h1-motivo-anulacion" className="input" rows={2} maxLength={512}
                value={anulacion.motivo} onChange={(e) => setAnulacion((a) => ({ ...a, motivo: e.target.value }))}
              />
              {anulacion.error && <p role="alert" className="mt-2 text-red-700">{anulacion.error}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setAnulacion((a) => ({ ...a, abierta: false, error: null }))} disabled={anulacion.enviando}>
                  Cancelar
                </button>
                {/* btn-primary pinta un gradiente (background-image) que tapa bg-red-600
                    (background-color): salia azul aunque llevara la clase roja.
                    btn-danger ya es bg-red-600 solido, sin gradiente. */}
                <button type="submit" className="btn-danger" disabled={anulacion.enviando || anulacion.motivo.trim().length < MOTIVO_MINIMO}>
                  {anulacion.enviando ? 'Enviando...' : 'Confirmar anulación'}
                </button>
              </div>
            </form>
          )}
          {consulta?.estado && (
            <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2" aria-label="Estado de la declaración en la AEAT">
              <div><dt className="inline text-gray-500">Estado: </dt><dd className="inline font-medium">{conCodigo(consulta.estado.textos?.operacionRegistrada, consulta.estado.operacionRegistrada)}</dd></div>
              <div><dt className="inline text-gray-500">Despacho: </dt><dd className="inline font-medium">{conCodigo(consulta.estado.textos?.levante, consulta.estado.levante)}</dd></div>
              <div><dt className="inline text-gray-500">Pago: </dt><dd className="inline font-medium">{conCodigo(consulta.estado.textos?.pago, consulta.estado.pago)}</dd></div>
              <div><dt className="inline text-gray-500">Circuito: </dt><dd className="inline font-medium">{CIRCUITOS[consulta.estado.circuito] || 'Sin asignar'}</dd></div>
              <div><dt className="inline text-gray-500">Admisión: </dt><dd className="inline font-medium">{fecha(consulta.estado.fechaAdmision)}</dd></div>
              <div><dt className="inline text-gray-500">Levante: </dt><dd className="inline font-medium">{fecha(consulta.estado.fechaLevante)}</dd></div>
              {consulta.liquidacion && (
                <div><dt className="inline text-gray-500">Total a pagar: </dt><dd className="inline font-medium">{formatearImporte(consulta.liquidacion.totalAPagar, 'EUR')}</dd></div>
              )}
              {consulta.estado.textos?.bajoControl && (
                <div className="sm:col-span-2 text-amber-800">En control: {consulta.estado.textos.bajoControl.toLowerCase()}.</div>
              )}
              {consulta.estado.textos?.documentacionPendiente && (
                <div className="sm:col-span-2 text-amber-800">Hay una solicitud de documentación pendiente ({consulta.estado.textos.documentacionPendiente.toLowerCase()}).</div>
              )}
              {consulta.estado.certificadosRequeridos === 'S' && (
                <div className="sm:col-span-2 text-amber-800">La AEAT exige certificados de otros organismos.</div>
              )}
            </dl>
          )}
          {/* La última consulta manda; si no se ha consultado, lo que respondió la AEAT al presentar. */}
          <LiquidacionAeat datos={consulta?.liquidacionAeat || estado?.liquidacionAeat || null} />
          {consulta?.documentosSolicitados?.length > 0 && (
            <div className="mt-3 text-sm">
              <p className="font-medium">Documentos que pide la aduana:</p>
              <ul className="mt-1 list-disc pl-5">
                {consulta.documentosSolicitados.map((d, i) => (
                  <li key={`${d.tipo}-${i}`}>{d.tipo}{d.descripcion ? ` — ${d.descripcion}` : ''}{d.partida ? ` (partida ${d.partida})` : ''}</li>
                ))}
              </ul>
            </div>
          )}
          {consulta?.notificaciones?.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-gray-700">
              {consulta.notificaciones.map((n, i) => <li key={`${n.codigo}-${i}`}>{n.texto}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
