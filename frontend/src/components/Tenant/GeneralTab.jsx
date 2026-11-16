import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import api from '../../services/api'

const MS_MENSAJE_GUARDADO = 3000

/** Campos de la dirección del tenant, en el orden en que se pintan. */
const CAMPOS_DIRECCION = [
  { campo: 'street', etiqueta: 'settings.street', maxLength: 70 },
  { campo: 'city', etiqueta: 'common.city', maxLength: 35 },
  { campo: 'province', etiqueta: 'settings.province', maxLength: 35 },
  { campo: 'postalCode', etiqueta: 'common.postalCode', maxLength: 17 },
  { campo: 'country', etiqueta: 'common.country', maxLength: 2 }
]

/** Formulario editable a partir del tenant: solo lo que guarda PUT /api/tenant/general. */
function formularioDesde(tenant) {
  const dir = tenant?.businessInfo?.address || {}
  return {
    name: tenant?.name || '',
    rea: tenant?.businessInfo?.rea || '',
    address: {
      street: dir.street || '',
      city: dir.city || '',
      province: dir.province || '',
      postalCode: dir.postalCode || '',
      country: dir.country || 'ES'
    }
  }
}

const claseCampo = (editable) =>
  `w-full border border-gray-300 rounded-lg px-3 py-2 ${editable ? '' : 'bg-gray-50 text-gray-600'}`

/**
 * Ajustes › General: datos de la empresa.
 *
 * Se guardan (PUT /api/tenant/general, solo admin/super_admin): nombre de la
 * organización, REA y dirección (el H7 la usa como dirección del declarante).
 * De solo lectura: slug, NIF (dato fiscal cifrado; se cambia por soporte),
 * EORI (se gestiona en Ajustes › Aduanas) y tipo de organización (decide si
 * el tenant actúa como parte o como representante ante la AEAT).
 *
 * @param {{ tenant: object, canEdit: boolean, onSaved: (tenant: object) => void, onGoToCustoms: () => void }} props
 */
export default function GeneralTab({ tenant, canEdit, onSaved, onGoToCustoms }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(() => formularioDesde(tenant))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)
  // Temporizador que borra el «guardado»: se cancela antes de otro guardado
  // (para que no borre un error posterior) y al desmontar.
  const temporizador = useRef(null)
  useEffect(() => () => clearTimeout(temporizador.current), [])

  const cambiarDireccion = (campo, valor) =>
    setForm(prev => ({ ...prev, address: { ...prev.address, [campo]: valor } }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)
    clearTimeout(temporizador.current)
    try {
      const res = await api.put('/api/tenant/general', form)
      const actualizado = res.data?.data
      if (!actualizado) throw new Error('Respuesta sin datos del tenant')
      onSaved(actualizado)
      setForm(formularioDesde(actualizado))
      setMessage({ type: 'success', text: t('settings.saved') })
      temporizador.current = setTimeout(() => setMessage(null), MS_MENSAJE_GUARDADO)
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || t('settings.saveError') })
    } finally {
      setIsSaving(false)
    }
  }

  const tipoOrganizacion = {
    customs_agent: t('settings.typeAgent'),
    importer: t('settings.typeImporter'),
    exporter: t('settings.typeExporter'),
    carrier: t('settings.typeCarrier'),
    other: t('settings.typeOther')
  }[tenant?.businessInfo?.type || 'customs_agent']

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-gray-900">{t('settings.generalInfo')}</h2>
        {canEdit && (
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t('settings.saveChanges')}
          </button>
        )}
      </div>

      {!canEdit && (
        <p className="text-sm text-gray-500">{t('settings.generalReadOnly')}</p>
      )}

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success'
            ? <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
            : <ExclamationCircleIcon className="h-5 w-5" aria-hidden="true" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="general-name" className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.orgName')}
          </label>
          <input
            id="general-name"
            type="text"
            value={form.name}
            maxLength={70}
            readOnly={!canEdit}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            className={claseCampo(canEdit)}
          />
        </div>

        <div>
          <label htmlFor="general-slug" className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.slug')}
          </label>
          <input id="general-slug" type="text" value={tenant?.slug || ''} readOnly className={claseCampo(false)} />
        </div>

        <div>
          <label htmlFor="general-nif" className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.nifCif')}
          </label>
          <input id="general-nif" type="text" value={tenant?.businessInfo?.nif || ''} readOnly className={claseCampo(false)} />
          <p className="mt-1 text-xs text-gray-500">{t('settings.nifReadOnly')}</p>
        </div>

        <div>
          <label htmlFor="general-eori" className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.eori')}
          </label>
          <input id="general-eori" type="text" value={tenant?.businessInfo?.eori || ''} readOnly className={claseCampo(false)} />
          <button
            type="button"
            onClick={onGoToCustoms}
            className="mt-1 text-xs text-violet-600 hover:text-violet-800 underline"
          >
            {t('settings.manageInCustoms')}
          </button>
        </div>

        <div>
          <label htmlFor="general-rea" className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.rea')}
          </label>
          <input
            id="general-rea"
            type="text"
            value={form.rea}
            maxLength={35}
            readOnly={!canEdit}
            onChange={(e) => setForm(prev => ({ ...prev, rea: e.target.value }))}
            className={claseCampo(canEdit)}
          />
        </div>

        <div>
          <label htmlFor="general-type" className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.orgType')}
          </label>
          <input id="general-type" type="text" value={tipoOrganizacion || ''} readOnly className={claseCampo(false)} />
        </div>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">{t('common.address')}</legend>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {CAMPOS_DIRECCION.map(({ campo, etiqueta, maxLength }) => (
            <div key={campo} className={campo === 'street' ? 'col-span-2' : ''}>
              <label htmlFor={`general-address-${campo}`} className="block text-xs text-gray-500 mb-1">
                {t(etiqueta)}
              </label>
              <input
                id={`general-address-${campo}`}
                type="text"
                value={form.address[campo]}
                maxLength={maxLength}
                readOnly={!canEdit}
                onChange={(e) => cambiarDireccion(campo, campo === 'country' ? e.target.value.toUpperCase() : e.target.value)}
                className={claseCampo(canEdit)}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-700">{t('settings.accountStatus')}</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
              tenant?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {tenant?.status === 'active' ? t('common.active') : tenant?.status}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            Plan: <span className="font-medium capitalize">{tenant?.subscription?.plan}</span>
          </div>
        </div>
      </div>
    </form>
  )
}
