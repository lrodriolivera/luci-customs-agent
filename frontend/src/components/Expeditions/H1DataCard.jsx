import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { declarationsAPI } from '../../services/api'
import { formatearImporte } from '../../utils/importe'

const CIRCUITOS = { V: 'Verde', A: 'Amarillo (pendiente de certificados)', N: 'Naranja (revisión documental)', R: 'Rojo (reconocimiento físico)' }
/** «2026-11-12T10:57:04» -> «12/11/2026 10:57». */
const fecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '')
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '—'
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
 * @param {{ expedition: object }} props
 */
export default function H1DataCard({ expedition }) {
  const [estado, setEstado] = useState(null)
  const [form, setForm] = useState({ invoiceNumber: '', vehicleNationality: '', dispatchAuthorizationScope: 'OSRE' })
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
      await declarationsAPI.updateH1Data(expedition._id, form)
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

  const sinCambios = estado && ['invoiceNumber', 'vehicleNationality', 'dispatchAuthorizationScope']
    .every((campo) => (form[campo] || '') === (estado.datos[campo] || ''))

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">Datos para presentar el H1</h2>
      <p className="text-sm text-gray-600 mb-4">
        La AEAT los exige en la declaración de importación adaptada al Código Aduanero de la Unión.
      </p>

      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2">
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
        <div className="sm:col-span-2">
          <label className="label" htmlFor="h1-authorization-scope">Autorización de despacho del representante</label>
          <select id="h1-authorization-scope" className="input" value={form.dispatchAuthorizationScope} onChange={cambiar('dispatchAuthorizationScope')}>
            {AMBITOS.map((a) => <option key={a.valor} value={a.valor}>{a.texto}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">No se usa en autodespacho. Con autorización global no se declara ningún documento.</p>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn-primary" disabled={guardando || !estado || sinCambios}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>

      {estado && (
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
              <div><dt className="inline text-gray-500">Estado (código AEAT): </dt><dd className="inline font-medium">{consulta.estado.operacionRegistrada || '—'}</dd></div>
              <div><dt className="inline text-gray-500">Circuito: </dt><dd className="inline font-medium">{CIRCUITOS[consulta.estado.circuito] || 'Sin asignar'}</dd></div>
              <div><dt className="inline text-gray-500">Admisión: </dt><dd className="inline font-medium">{fecha(consulta.estado.fechaAdmision)}</dd></div>
              <div><dt className="inline text-gray-500">Levante: </dt><dd className="inline font-medium">{fecha(consulta.estado.fechaLevante)}</dd></div>
              {consulta.liquidacion && (
                <div><dt className="inline text-gray-500">Total a pagar: </dt><dd className="inline font-medium">{formatearImporte(consulta.liquidacion.totalAPagar, 'EUR')}</dd></div>
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
