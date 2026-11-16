import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const vacio = (v) => (v === null || v === undefined ? '' : String(v))

/** Formulario a partir del expediente: importador (client) y exportador. */
function formularioDe(expedition) {
  const c = expedition.client || {}
  const e = expedition.exporter || {}
  return {
    companyName: vacio(c.companyName),
    nif: vacio(c.nif),
    eori: vacio(c.eori),
    street: vacio(c.address?.street),
    city: vacio(c.address?.city),
    postalCode: vacio(c.address?.postalCode),
    country: vacio(c.address?.country || 'ES'),
    contactName: vacio(c.contact?.name),
    contactEmail: vacio(c.contact?.email),
    exporterName: vacio(e.companyName),
    exporterAddress: vacio(e.address),
    exporterCity: vacio(e.city),
    exporterPostalCode: vacio(e.postalCode),
    exporterCountry: vacio(e.country)
  }
}

function Campo({ id, etiqueta, valor, onChange, ...resto }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{etiqueta}</label>
      <input id={id} className="input" value={valor} onChange={onChange} {...resto} />
    </div>
  )
}

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{etiqueta}</p>
      <p className="font-medium">{valor || 'N/A'}</p>
    </div>
  )
}

/**
 * Partes del expediente: importador (cliente) y exportador. Mientras el
 * expediente admita cambios se pueden editar aqui sin rehacerlo (UAT
 * 16/Nov/2026: para cambiar el NIF del importador habia que crear otro).
 *
 * @param {{ expedition: object, onSave?: (cambios: { client: object, exporter: object }) => Promise<void>, isSaving?: boolean }} props
 */
export default function PartiesCard({ expedition, onSave, isSaving = false }) {
  const { t } = useTranslation()
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState(() => formularioDe(expedition))
  const [error, setError] = useState(null)
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  const c = expedition.client || {}
  const e = expedition.exporter || {}
  const esImportacion = expedition.operationType !== 'export'

  const abrir = () => { setForm(formularioDe(expedition)); setError(null); setEditando(true) }

  const guardar = async (ev) => {
    ev.preventDefault()
    if (!form.companyName.trim() || !form.nif.trim()) {
      setError(t('expeditions.parties.required'))
      return
    }
    if (form.exporterCountry && !/^[A-Za-z]{2}$/.test(form.exporterCountry.trim())) {
      setError(t('expeditions.parties.countryInvalid'))
      return
    }
    setError(null)
    try {
      await onSave({
      client: {
        ...c,
        companyName: form.companyName.trim(),
        nif: form.nif.trim().toUpperCase(),
        eori: form.eori.trim().toUpperCase(),
        address: { ...(c.address || {}), street: form.street.trim(), city: form.city.trim(), postalCode: form.postalCode.trim(), country: (form.country.trim() || 'ES').toUpperCase() },
        contact: { ...(c.contact || {}), name: form.contactName.trim(), email: form.contactEmail.trim() }
      },
      exporter: {
        ...e,
        companyName: form.exporterName.trim(),
        address: form.exporterAddress.trim(),
        city: form.exporterCity.trim(),
        postalCode: form.exporterPostalCode.trim(),
        country: form.exporterCountry.trim().toUpperCase()
      }
      })
      setEditando(false)
    } catch (_) {
      // El detalle ya avisa del error; el formulario sigue abierto para corregir.
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('expeditions.parties.title')}</h2>
        {onSave && !editando && (
          <button type="button" onClick={abrir} className="text-sm text-primary-600 hover:text-primary-800 font-medium">
            {t('common.edit')}
          </button>
        )}
      </div>

      {!editando ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{esImportacion ? t('expeditions.importer') : t('expeditions.exporter')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Dato etiqueta={t('expeditions.companyName')} valor={c.companyName} />
              <Dato etiqueta={t('expeditions.nifCif')} valor={c.nif} />
              <Dato etiqueta={t('expeditions.eori')} valor={c.eori} />
              <div>
                <p className="text-sm text-gray-500">{t('expeditions.contact')}</p>
                <p className="font-medium">{c.contact?.name || 'N/A'}</p>
                <p className="text-xs text-gray-500">{c.contact?.email || ''}</p>
              </div>
            </div>
          </div>
          {esImportacion && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('expeditions.parties.supplier')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <Dato etiqueta={t('expeditions.companyName')} valor={e.companyName} />
                <Dato etiqueta={t('expeditions.parties.address')} valor={[e.address, e.postalCode, e.city, e.country].filter(Boolean).join(', ')} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={guardar} className="space-y-4">
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <legend className="text-sm font-semibold text-gray-700 mb-2">{esImportacion ? t('expeditions.importer') : t('expeditions.exporter')}</legend>
            <Campo id="parte-razon" etiqueta={t('expeditions.companyName')} valor={form.companyName} onChange={cambiar('companyName')} maxLength={200} />
            <Campo id="parte-nif" etiqueta={t('expeditions.nifCif')} valor={form.nif} onChange={cambiar('nif')} maxLength={20} />
            <Campo id="parte-eori" etiqueta={t('expeditions.eori')} valor={form.eori} onChange={cambiar('eori')} maxLength={17} placeholder={t('expeditions.parties.eoriAuto')} />
            <Campo id="parte-calle" etiqueta={t('expeditions.parties.address')} valor={form.street} onChange={cambiar('street')} maxLength={200} />
            <Campo id="parte-ciudad" etiqueta={t('expeditions.parties.city')} valor={form.city} onChange={cambiar('city')} maxLength={100} />
            <Campo id="parte-cp" etiqueta={t('expeditions.parties.postalCode')} valor={form.postalCode} onChange={cambiar('postalCode')} maxLength={17} />
            <Campo id="parte-contacto" etiqueta={t('expeditions.contact')} valor={form.contactName} onChange={cambiar('contactName')} maxLength={100} />
            <Campo id="parte-email" etiqueta={t('expeditions.parties.email')} valor={form.contactEmail} onChange={cambiar('contactEmail')} type="email" maxLength={200} />
          </fieldset>
          {esImportacion && (
            <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <legend className="text-sm font-semibold text-gray-700 mb-2">{t('expeditions.parties.supplier')}</legend>
              <Campo id="exp-razon" etiqueta={t('expeditions.companyName')} valor={form.exporterName} onChange={cambiar('exporterName')} maxLength={200} />
              <Campo id="exp-direccion" etiqueta={t('expeditions.parties.address')} valor={form.exporterAddress} onChange={cambiar('exporterAddress')} maxLength={200} />
              <Campo id="exp-ciudad" etiqueta={t('expeditions.parties.city')} valor={form.exporterCity} onChange={cambiar('exporterCity')} maxLength={100} />
              <Campo id="exp-cp" etiqueta={t('expeditions.parties.postalCode')} valor={form.exporterPostalCode} onChange={cambiar('exporterPostalCode')} maxLength={17} />
              <Campo id="exp-pais" etiqueta={t('expeditions.parties.country')} valor={form.exporterCountry} onChange={cambiar('exporterCountry')} maxLength={2} />
            </fieldset>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <p className="text-xs text-gray-500">{t('expeditions.parties.regenerateHint')}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)} className="btn-secondary" disabled={isSaving}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? t('common.saving') : t('common.save')}</button>
          </div>
        </form>
      )}
    </div>
  )
}
