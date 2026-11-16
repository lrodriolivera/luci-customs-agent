import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { declarationsAPI } from '../../services/api'

/**
 * Datos de la declaración AES que no se piden en el alta: aduana de salida
 * (obligatoria; si es la de exportación, la salida es directa) y ubicación de
 * las mercancías (código de 10 caracteres que da la AEAT).
 *
 * @param {{ expedition: object, onGuardado: () => void }} props
 */
export default function AesDatosSalida({ expedition, onGuardado }) {
  const decl = expedition?.declaration || {}
  const [aduanaSalida, setAduanaSalida] = useState(decl.officeOfExit || '')
  const [ubicacion, setUbicacion] = useState(decl.goodsLocation || '')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await declarationsAPI.update(expedition._id, {
        officeOfExit: aduanaSalida.trim().toUpperCase(),
        goodsLocation: ubicacion.trim().toUpperCase()
      })
      toast.success('Datos del AES guardados')
      await onGuardado()
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudieron guardar los datos del AES')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="label" htmlFor="aes-aduana-salida">Aduana de salida</label>
        <input id="aes-aduana-salida" className="input" value={aduanaSalida} placeholder="ES004601"
          onChange={(e) => setAduanaSalida(e.target.value)} />
        <p className="text-xs text-gray-500 mt-1">Si es la misma que la de exportación ({decl.customsOffice || '—'}), la salida es directa.</p>
      </div>
      <div>
        <label className="label" htmlFor="aes-ubicacion">Ubicación de las mercancías</label>
        <input id="aes-ubicacion" className="input" value={ubicacion} placeholder="2801AAAAAC"
          onChange={(e) => setUbicacion(e.target.value)} />
        <p className="text-xs text-gray-500 mt-1">Código de 10 caracteres de la AEAT; empieza por las 4 últimas cifras de la aduana de exportación.</p>
      </div>
      <div className="md:col-span-2">
        <button type="submit" disabled={guardando} className="btn-secondary text-sm">
          {guardando ? 'Guardando…' : 'Guardar datos del AES'}
        </button>
      </div>
    </form>
  )
}
