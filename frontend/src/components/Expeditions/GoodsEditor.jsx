import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { interpretarImporte } from '../../utils/importe'
import ImporteInput from '../common/ImporteInput'
import { PACKAGE_TYPES, DEFAULT_PACKAGE_TYPE, toNumberOrUndefined } from './packageTypes'

const TARIC_PATTERN = /^\d{8,10}$/

const asInput = (value) => (value === undefined || value === null ? '' : String(value))

/**
 * Formulario para corregir una partida de un expediente ya creado: codigo
 * TARIC, bultos, pesos e importe. Sin esto el agente no podia completar los
 * datos que el H1 exige (bultos, TARIC) despues del alta.
 *
 * @param {{
 *   item: object,
 *   index: number,
 *   isSaving: boolean,
 *   onSave: (changes: object) => void,
 *   onCancel: () => void
 * }} props
 */
// Exenciones del impuesto al plastico (art. 75 Ley 7/2022), casilla 37.2.
const PLASTIC_EXEMPTIONS = ['1P1', '1P2', '1P3', '1P4', '1P5']

export default function GoodsEditor({ item, index, isSaving, onSave, onCancel }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    taricCode: asInput(item.taricCode),
    packagesQuantity: asInput(item.packages?.quantity),
    packagesType: item.packages?.type || DEFAULT_PACKAGE_TYPE,
    netWeight: asInput(item.netWeight),
    grossWeight: asInput(item.grossWeight),
    // El importe guardado se muestra con coma decimal para que el campo, que
    // lee formato español, no tome un decimal de tres cifras por millares.
    invoiceValue: asInput(item.invoiceValue).replace('.', ','),
    plasticoKg: asInput(item.impuestoPlastico?.kg),
    plasticoExencion: item.impuestoPlastico?.exencion || '',
    plasticoKgReciclado: asInput(item.impuestoPlastico?.kgReciclado),
    plasticoCertificado: item.impuestoPlastico?.certificadoReciclado || ''
  })
  const [error, setError] = useState(null)

  const handleChange = (field) => (e) => {
    const { value } = e.target
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const validate = () => {
    const taricCode = form.taricCode.replace(/[\s.]/g, '')
    if (taricCode && !TARIC_PATTERN.test(taricCode)) return t('expeditions.editGoodsTaricInvalid')

    const packagesQuantity = toNumberOrUndefined(form.packagesQuantity)
    if (form.packagesQuantity !== '' && !(Number.isInteger(packagesQuantity) && packagesQuantity > 0)) {
      return t('expeditions.editGoodsPackagesInvalid')
    }

    const invoiceValue = interpretarImporte(form.invoiceValue)
    if (!(invoiceValue > 0)) return t('expeditions.editGoodsValueInvalid')

    const negativo = [form.netWeight, form.grossWeight, form.plasticoKg, form.plasticoKgReciclado].some((v) => toNumberOrUndefined(v) < 0)
    if (negativo) return t('expeditions.editGoodsWeightInvalid')

    if (toNumberOrUndefined(form.plasticoKgReciclado) > 0 && !form.plasticoCertificado.trim()) {
      return t('expeditions.plasticCertificateRequired')
    }
    if (form.plasticoExencion && !(toNumberOrUndefined(form.plasticoKg) > 0)) {
      return t('expeditions.plasticExemptionNeedsKg')
    }

    return null
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)

    const packagesQuantity = toNumberOrUndefined(form.packagesQuantity)
    onSave({
      taricCode: form.taricCode.replace(/[\s.]/g, ''),
      netWeight: toNumberOrUndefined(form.netWeight),
      grossWeight: toNumberOrUndefined(form.grossWeight),
      invoiceValue: interpretarImporte(form.invoiceValue) ?? undefined,
      packages: {
        ...item.packages,
        quantity: packagesQuantity,
        type: packagesQuantity ? form.packagesType : item.packages?.type
      },
      // Impuesto sobre envases de plastico no reutilizables (1PL, 0,45 EUR/kg).
      impuestoPlastico: {
        kg: toNumberOrUndefined(form.plasticoKg) || 0,
        exencion: form.plasticoExencion || undefined,
        kgReciclado: toNumberOrUndefined(form.plasticoKgReciclado) || 0,
        certificadoReciclado: form.plasticoCertificado.trim() || undefined
      }
    })
  }

  const fieldId = (name) => `goods-${index}-${name}`

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-3 space-y-3" aria-label={t('expeditions.editGoods')}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor={fieldId('taric')}>{t('expeditions.taricCode')}</label>
          <input
            id={fieldId('taric')}
            type="text"
            inputMode="numeric"
            maxLength={13}
            value={form.taricCode}
            onChange={handleChange('taricCode')}
            className="input font-mono"
          />
        </div>
        <div>
          <label className="label" htmlFor={fieldId('packages')}>{t('expeditions.packagesQuantity')}</label>
          <input
            id={fieldId('packages')}
            type="number"
            min="1"
            step="1"
            value={form.packagesQuantity}
            onChange={handleChange('packagesQuantity')}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={fieldId('packagesType')}>{t('expeditions.packagesType')}</label>
          <select
            id={fieldId('packagesType')}
            value={form.packagesType}
            onChange={handleChange('packagesType')}
            className="input"
          >
            {PACKAGE_TYPES.map((type) => (
              <option key={type.code} value={type.code}>{t(type.labelKey)} ({type.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={fieldId('net')}>{t('expeditions.netWeight')}</label>
          <input
            id={fieldId('net')}
            type="number"
            min="0"
            step="0.001"
            value={form.netWeight}
            onChange={handleChange('netWeight')}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={fieldId('gross')}>{t('expeditions.grossWeight')}</label>
          <input
            id={fieldId('gross')}
            type="number"
            min="0"
            step="0.001"
            value={form.grossWeight}
            onChange={handleChange('grossWeight')}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={fieldId('value')}>
            {t('expeditions.invoiceValue')} ({item.currency || 'EUR'})
          </label>
          <ImporteInput
            id={fieldId('value')}
            value={form.invoiceValue}
            currency={item.currency || 'EUR'}
            onChange={(texto) => setForm((prev) => ({ ...prev, invoiceValue: texto }))}
          />
        </div>
        <div>
          <label className="label" htmlFor={fieldId('plastic')}>{t('expeditions.plasticKg')}</label>
          <input
            id={fieldId('plastic')}
            type="number"
            min="0"
            step="0.001"
            value={form.plasticoKg}
            onChange={handleChange('plasticoKg')}
            className="input"
          />
          <p className="mt-1 text-xs text-gray-500">{t('expeditions.plasticHelp')}</p>
        </div>
        <div>
          <label className="label" htmlFor={fieldId('plasticExemption')}>{t('expeditions.plasticExemption')}</label>
          <select
            id={fieldId('plasticExemption')}
            value={form.plasticoExencion}
            onChange={handleChange('plasticoExencion')}
            className="input"
          >
            <option value="">{t('expeditions.plasticExemptionNone')}</option>
            {PLASTIC_EXEMPTIONS.map((code) => (
              <option key={code} value={code}>{code} · {t(`expeditions.plasticExemptions.${code}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={fieldId('plasticRecycled')}>{t('expeditions.plasticRecycledKg')}</label>
          <input
            id={fieldId('plasticRecycled')}
            type="number"
            min="0"
            step="0.001"
            value={form.plasticoKgReciclado}
            onChange={handleChange('plasticoKgReciclado')}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={fieldId('plasticCertificate')}>{t('expeditions.plasticCertificate')}</label>
          <input
            id={fieldId('plasticCertificate')}
            type="text"
            maxLength={70}
            value={form.plasticoCertificado}
            onChange={handleChange('plasticoCertificado')}
            className="input"
          />
          <p className="mt-1 text-xs text-gray-500">{t('expeditions.plasticRecycledHelp')}</p>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={isSaving} className="btn-secondary">
          {t('common.cancel')}
        </button>
        <button type="submit" disabled={isSaving} className="btn-primary">
          {isSaving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  )
}
