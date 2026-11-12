import React, { useEffect, useState } from 'react'
import { tenantH1API } from '../../services/api'

const VACIO = { h1Service: 'precau', medioDePago: 'A', garantiaGRN: '', contacto: { name: '', phone: '', email: '' } }

/**
 * Ajustes > Aduanas: cómo presenta la agencia el H1. Servicio de la AEAT,
 * medio de pago, garantía y la persona de contacto que la AEAT exige en la
 * declaración adaptada al Código Aduanero de la Unión.
 */
export default function H1PresentationSettings() {
  const [datos, setDatos] = useState(VACIO)
  const [cargado, setCargado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    let vivo = true
    tenantH1API.get()
      .then((res) => { if (vivo) { setDatos({ ...VACIO, ...(res.data?.data || {}) }); setCargado(true) } })
      .catch((err) => { if (vivo) setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo cargar la configuración del H1' }) })
    return () => { vivo = false }
  }, [])

  const cambiar = (campo) => (e) => setDatos((previo) => ({ ...previo, [campo]: e.target.value }))
  const cambiarContacto = (campo) => (e) => setDatos((previo) => ({ ...previo, contacto: { ...previo.contacto, [campo]: e.target.value } }))

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    try {
      const res = await tenantH1API.update(datos)
      setDatos({ ...VACIO, ...(res.data?.data || {}) })
      setMensaje({ tipo: 'ok', texto: 'Configuración del H1 guardada' })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo guardar la configuración del H1' })
    } finally {
      setGuardando(false)
    }
  }

  const aplazado = datos.medioDePago === 'R'

  return (
    <form onSubmit={guardar} className="p-4 rounded-lg border border-gray-200 space-y-4" aria-label="Presentación del H1">
      <div>
        <h3 className="font-semibold text-gray-900">Presentación del H1 (importación)</h3>
        <p className="text-sm text-gray-600">
          La AEAT cerró el 14/10/2025 el DUA anterior para declaraciones nuevas; el H1 vigente es el mensaje adaptado al Código Aduanero de la Unión.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="h1-servicio">Servicio de la AEAT</label>
          <select id="h1-servicio" className="w-full px-3 py-2 border rounded-lg" value={datos.h1Service} onChange={cambiar('h1Service')}>
            <option value="precau">DUA anterior (cerrado para declaraciones reales)</option>
            <option value="cau">H1 adaptado al CAU (CC415A)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="h1-pago">Medio de pago</label>
          <select id="h1-pago" className="w-full px-3 py-2 border rounded-lg" value={datos.medioDePago} onChange={cambiar('medioDePago')}>
            <option value="A">A — Pago previo al levante</option>
            <option value="R">R — Pago aplazado con garantía</option>
            <option value="J">J — Aplazado sin garantía (entidades públicas)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="h1-grn">
            Número de garantía (GRN){aplazado ? ' *' : ''}
          </label>
          <input
            id="h1-grn" className="w-full px-3 py-2 border rounded-lg font-mono uppercase" maxLength={24} required={aplazado}
            placeholder="p. ej. 26ESAGL2800000054" value={datos.garantiaGRN} onChange={cambiar('garantiaGRN')}
          />
          <p className="mt-1 text-xs text-gray-500">Obligatorio con pago aplazado. Con pago previo al levante no hace falta.</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Persona de contacto de la agencia (obligatoria en la declaración)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1" htmlFor="h1-contacto-nombre">Nombre</label>
            <input id="h1-contacto-nombre" className="w-full px-3 py-2 border rounded-lg" maxLength={70} required value={datos.contacto.name} onChange={cambiarContacto('name')} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1" htmlFor="h1-contacto-telefono">Teléfono</label>
            <input id="h1-contacto-telefono" className="w-full px-3 py-2 border rounded-lg" maxLength={35} required value={datos.contacto.phone} onChange={cambiarContacto('phone')} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1" htmlFor="h1-contacto-email">Correo</label>
            <input id="h1-contacto-email" type="email" className="w-full px-3 py-2 border rounded-lg" required value={datos.contacto.email} onChange={cambiarContacto('email')} />
          </div>
        </div>
      </div>

      {mensaje && (
        <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`text-sm ${mensaje.tipo === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {mensaje.texto}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={guardando || !cargado} className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
          {guardando ? 'Guardando...' : 'Guardar presentación del H1'}
        </button>
      </div>
    </form>
  )
}
