/**
 * Mensajes NCTS del operador en la aduana de partida: presentación de la
 * mercancía de una predeclaración (CC170C), modificación de la predeclaración
 * (CC013C) y anulación (CC014C).
 *
 * Qué se puede enviar en cada estado lo fija la guía «Servicios Web de Tránsito
 * NCTS6» v1.21 (tabla de 4.3): CC170C y CC013C solo en PA (en LUCI,
 * `prelodged`); CC014C en PA o PG (pendiente de garantía extranjera). Un
 * tránsito despachado (PD/DE) solo se anula pidiéndolo en la aduana por
 * registro, así que aquí no se ofrece.
 */
import React, { useState } from 'react'
import { transitAPI } from '../../services/api'

const MAX_MOTIVO = 512
const FORMATO_UBICACION = /^[A-Z0-9]{10}$/

/** @returns {{key: string, label: string, color: string, form: string}[]} */
export function accionesNctsOperador(transit) {
  if (transit?.status === 'prelodged') {
    return [
      { key: 'present', label: 'Presentar Mercancia (CC170)', color: 'blue', form: 'cc170' },
      { key: 'amend', label: 'Modificar Predeclaracion (CC013)', color: 'cyan', form: 'cc013' },
      { key: 'invalidate', label: 'Anular en AEAT (CC014)', color: 'red', form: 'cc014' }
    ]
  }
  if (transit?.status === 'accepted' && transit?.ncts?.estado === 'PG') {
    return [{ key: 'invalidate', label: 'Anular en AEAT (CC014)', color: 'red', form: 'cc014' }]
  }
  return []
}

export const ubicacionValida = (valor) => FORMATO_UBICACION.test(String(valor || '').trim().toUpperCase())

const numero = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))

/**
 * Cambios de la modificación respecto de la predeclaración, solo lo que cambia.
 * Las partidas van enteras (el backend sustituye la lista), conservando lo que
 * el formulario no edita (TARIC, documentos previos...).
 */
export function cambiosModificacion(transit, { destino, partidas }) {
  const cambios = {}
  const originales = transit.goodsItems || []
  const nuevas = originales.map((g, i) => {
    const p = partidas[i] || {}
    return {
      ...g,
      description: (p.description ?? g.description ?? '').trim(),
      grossWeight: numero(p.grossWeight) ?? g.grossWeight,
      netWeight: numero(p.netWeight) ?? g.netWeight,
      packages: { ...(g.packages || {}), count: numero(p.packages) ?? g.packages?.count }
    }
  })
  const cambiaPartida = nuevas.some((n, i) => {
    const g = originales[i]
    return n.description !== (g.description || '') || n.grossWeight !== g.grossWeight
      || n.netWeight !== g.netWeight || n.packages.count !== g.packages?.count
  })
  if (cambiaPartida) cambios.goodsItems = nuevas
  const destinoLimpio = String(destino || '').trim().toUpperCase()
  if (destinoLimpio && destinoLimpio !== transit.destinationOffice?.code) {
    cambios.destinationOffice = { ...(transit.destinationOffice || {}), code: destinoLimpio }
  }
  return cambios
}

const errorDe = (err, porDefecto) => err?.response?.data?.error || err?.message || porDefecto

function Modal({ titulo, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="bg-white rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

function Error({ texto }) {
  if (!texto) return null
  return <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{texto}</p>
}

/** CC170C: la mercancía de la predeclaración ya está en la aduana de partida. */
export function FormularioPresentacion({ transit, onClose, onHecho }) {
  const [ubicacion, setUbicacion] = useState(transit.locationAuthorisationNumber || '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    const limpia = ubicacion.trim().toUpperCase()
    if (!ubicacionValida(limpia)) {
      setError('La ubicación tiene 10 caracteres: recinto (4) + ubicación (6), p. ej. 2801AAAAAA')
      return
    }
    try {
      setEnviando(true)
      setError(null)
      await transitAPI.presentGoods(transit._id, { locationAuthorisationNumber: limpia })
      onHecho()
    } catch (err) {
      setError(errorDe(err, 'Error presentando la mercancía'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Presentar mercancía en la aduana de partida (CC170)" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-gray-600">
          Convierte la predeclaración {transit.mrn} en declaración: la AEAT la admite, data la sumaria o el
          documento de depósito, traba la garantía y asigna circuito. Envíelo solo cuando la mercancía esté
          físicamente en la ubicación indicada.
        </p>
        <div>
          <label htmlFor="cc170-ubicacion" className="block text-sm font-medium mb-1">Ubicación de la mercancía</label>
          <input id="cc170-ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}
            maxLength={10} className="w-full border rounded-lg px-3 py-2 font-mono uppercase" placeholder="2801AAAAAA" />
        </div>
        <Error texto={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
          <button type="submit" disabled={enviando} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
            {enviando ? 'Enviando...' : 'Presentar mercancía'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** CC013C: modificación completa de la predeclaración (sigue en PA). */
export function FormularioModificacion({ transit, onClose, onHecho }) {
  const [destino, setDestino] = useState(transit.destinationOffice?.code || '')
  const [partidas, setPartidas] = useState((transit.goodsItems || []).map((g) => ({
    description: g.description || '',
    grossWeight: g.grossWeight ?? '',
    netWeight: g.netWeight ?? '',
    packages: g.packages?.count ?? ''
  })))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const cambiar = (i, campo, valor) =>
    setPartidas((ps) => ps.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)))

  const enviar = async (e) => {
    e.preventDefault()
    const cambios = cambiosModificacion(transit, { destino, partidas })
    if (Object.keys(cambios).length === 0) {
      setError('No ha cambiado nada: no hay modificación que enviar')
      return
    }
    try {
      setEnviando(true)
      setError(null)
      await transitAPI.amend(transit._id, cambios)
      onHecho()
    } catch (err) {
      setError(errorDe(err, 'Error enviando la modificación'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Modificar predeclaración (CC013)" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-gray-600">
          Se envía la predeclaración entera con los cambios; LUCI solo los guarda si la AEAT los admite.
          No se pueden modificar la aduana de partida, el titular, el representante, la seguridad ni el
          tipo de declaración: si alguno es incorrecto, anule y presente otra.
        </p>
        <div>
          <label htmlFor="cc013-destino" className="block text-sm font-medium mb-1">Aduana de destino</label>
          <input id="cc013-destino" value={destino} onChange={(e) => setDestino(e.target.value)} maxLength={8}
            className="w-full border rounded-lg px-3 py-2 font-mono uppercase" />
        </div>
        {partidas.map((p, i) => (
          <fieldset key={i} className="border rounded-lg p-3 space-y-2">
            <legend className="text-sm font-medium px-1">Partida {i + 1}</legend>
            <label htmlFor={`cc013-desc-${i}`} className="block text-xs text-gray-600">Descripción partida {i + 1}</label>
            <input id={`cc013-desc-${i}`} value={p.description} onChange={(e) => cambiar(i, 'description', e.target.value)}
              maxLength={512} className="w-full border rounded px-2 py-1" />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor={`cc013-bruto-${i}`} className="block text-xs text-gray-600">Peso bruto (kg)</label>
                <input id={`cc013-bruto-${i}`} type="number" min="0" step="0.001" value={p.grossWeight}
                  onChange={(e) => cambiar(i, 'grossWeight', e.target.value)} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label htmlFor={`cc013-neto-${i}`} className="block text-xs text-gray-600">Peso neto (kg)</label>
                <input id={`cc013-neto-${i}`} type="number" min="0" step="0.001" value={p.netWeight}
                  onChange={(e) => cambiar(i, 'netWeight', e.target.value)} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label htmlFor={`cc013-bultos-${i}`} className="block text-xs text-gray-600">Bultos</label>
                <input id={`cc013-bultos-${i}`} type="number" min="0" step="1" value={p.packages}
                  onChange={(e) => cambiar(i, 'packages', e.target.value)} className="w-full border rounded px-2 py-1" />
              </div>
            </div>
          </fieldset>
        ))}
        <Error texto={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
          <button type="submit" disabled={enviando} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
            {enviando ? 'Enviando...' : 'Enviar modificación'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** CC014C: anulación. Destructiva: motivo obligatorio y confirmación explícita. */
export function FormularioAnulacion({ transit, onClose, onHecho }) {
  const [motivo, setMotivo] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const listo = motivo.trim().length > 0 && confirmado && !enviando

  const enviar = async (e) => {
    e.preventDefault()
    if (!listo) return
    try {
      setEnviando(true)
      setError(null)
      await transitAPI.invalidate(transit._id, { motivo: motivo.trim() })
      onHecho()
    } catch (err) {
      setError(errorDe(err, 'Error anulando el tránsito'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Anular tránsito en la AEAT (CC014)" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2">
          Se solicita a la AEAT la invalidación del MRN {transit.mrn}. Si la admite, queda invalidado desde ese
          momento, se liberan los datados y no hay marcha atrás: habría que presentar otra declaración.
        </p>
        <div>
          <label htmlFor="cc014-motivo" className="block text-sm font-medium mb-1">Motivo de la anulación</label>
          <textarea id="cc014-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={MAX_MOTIVO}
            rows={3} className="w-full border rounded-lg px-3 py-2" />
          <p className="text-xs text-gray-500 text-right">{motivo.length}/{MAX_MOTIVO}</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="mt-1" />
          <span>Entiendo que la anulación es definitiva</span>
        </label>
        <Error texto={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
          <button type="submit" disabled={!listo} className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">
            {enviando ? 'Anulando...' : 'Anular en la AEAT'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Abre el formulario que corresponde a la acción (`form` de accionesNctsOperador). */
export function FormularioNctsOperador({ tipo, transit, onClose, onHecho }) {
  if (tipo === 'cc170') return <FormularioPresentacion transit={transit} onClose={onClose} onHecho={onHecho} />
  if (tipo === 'cc013') return <FormularioModificacion transit={transit} onClose={onClose} onHecho={onHecho} />
  if (tipo === 'cc014') return <FormularioAnulacion transit={transit} onClose={onClose} onHecho={onHecho} />
  return null
}
