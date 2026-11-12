import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { declarationsAPI } from '../../services/api'
import { formatearImporte } from '../../utils/importe'
import { MONEDAS_ALTA } from '../../utils/prerrellenoAlta'

const CIRCUITOS = { V: 'Verde', A: 'Amarillo (pendiente de certificados)', N: 'Naranja (revisión documental)', R: 'Rojo (reconocimiento físico)' }
/** Texto de la guía de la AEAT con su código; si el código no está en la guía, solo el código. */
const conCodigo = (texto, codigo) => (texto ? `${texto} (${codigo})` : codigo || '—')
/** «2026-11-12T10:57:04» -> «12/11/2026 10:57». */
const fecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '')
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '—'
}

const CAMPOS = [
  'invoiceNumber', 'exporterPostalCode', 'vehicleNationality', 'dispatchAuthorizationScope',
  'freightAmount', 'freightCurrency', 'insuranceAmount', 'insuranceCurrency'
]
const comoTexto = (v) => (v === null || v === undefined ? '' : String(v))

/** Qué dice el incoterm sobre el flete y el seguro hasta la entrada en la UE. */
function explicacionGastos(incoterm, sumar) {
  if (!sumar) return 'Sin un incoterm reconocido en el expediente: el flete y el seguro que escribas se suman al valor en aduana.'
  if (sumar.flete && sumar.seguro) return `Con ${incoterm} el precio no incluye el flete ni el seguro hasta la entrada en la UE: se suman al valor en aduana. Escribe 0 si no hubo.`
  if (sumar.seguro) return `Con ${incoterm} el precio incluye el flete, no el seguro: el seguro hasta la entrada en la UE se suma al valor en aduana. Escribe 0 si no hubo.`
  return `Con ${incoterm} el precio ya incluye el flete y el seguro hasta la entrada en la UE: no se suma nada.`
}

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

const AMBITOS = [
  { valor: 'OSRE', texto: 'Por operación, sin registro electrónico en la AEAT' },
  { valor: 'OCRE', texto: 'Por operación, con registro electrónico en la AEAT' },
  { valor: 'global', texto: 'Global, registrada en la AEAT' }
]

/**
 * Datos del expediente que solo se usan al presentar el H1 (número de
 * factura, nacionalidad del medio de transporte y autorización de despacho) y
 * lista de lo que aún falta para poder presentarlo por el servicio de la AEAT
 * adaptado al CAU (CC415A).
 *
 * Con `soloEstado` (declaración ya presentada) solo muestra la consulta de estado.
 *
 * @param {{ expedition: object, soloEstado?: boolean }} props
 */
export default function H1DataCard({ expedition, soloEstado = false }) {
  const [estado, setEstado] = useState(null)
  const [form, setForm] = useState({ invoiceNumber: '', exporterPostalCode: '', vehicleNationality: '', dispatchAuthorizationScope: 'OSRE' })
  const sumar = estado?.datos?.gastosASumar
  const pideFlete = !sumar || sumar.flete
  const pideSeguro = !sumar || sumar.seguro
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

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

  useEffect(() => { cargar() }, [cargar])

  const cambiar = (campo) => (e) => setForm((previo) => ({ ...previo, [campo]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      // Solo los campos editables; los gastos que el incoterm no pide no se tocan.
      const omitir = new Set([...(pideFlete ? [] : ['freightAmount', 'freightCurrency']), ...(pideSeguro ? [] : ['insuranceAmount', 'insuranceCurrency'])])
      const datos = Object.fromEntries(CAMPOS.filter((c) => form[c] !== undefined && !omitir.has(c)).map((c) => [c, form[c] === null ? '' : form[c]]))
      await declarationsAPI.updateH1Data(expedition._id, datos)
      toast.success('Datos del H1 guardados')
      await cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudieron guardar los datos del H1')
    } finally {
      setGuardando(false)
    }
  }

  const presentadoPorCau = expedition.declaration?.mrn && expedition.declaration?.aeatResponse?.servicio === 'CC415AV1'
  const [consulta, setConsulta] = useState(expedition.declaration?.aeatResponse?.consulta || null)
  const [consultando, setConsultando] = useState(false)

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

  const sinCambios = estado && CAMPOS.every((campo) => comoTexto(form[campo]) === comoTexto(estado.datos[campo]))

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
        <div className="sm:col-span-2">
          <label className="label" htmlFor="h1-authorization-scope">Autorización de despacho del representante</label>
          <select id="h1-authorization-scope" className="input" value={form.dispatchAuthorizationScope} onChange={cambiar('dispatchAuthorizationScope')}>
            {AMBITOS.map((a) => <option key={a.valor} value={a.valor}>{a.texto}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">No se usa en autodespacho. Con autorización global no se declara ningún documento.</p>
        </div>
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

      {presentadoPorCau && (
        <div className="mt-4 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Estado en la AEAT · MRN {expedition.declaration.mrn}</p>
            <button type="button" className="btn-secondary" onClick={consultarEstado} disabled={consultando}>
              {consultando ? 'Consultando...' : 'Consultar estado en la AEAT'}
            </button>
          </div>
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
