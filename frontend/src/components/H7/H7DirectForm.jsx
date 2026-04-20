import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { h7API } from '../../services/api'
import toast from 'react-hot-toast'
import EU2026382Banner from './EU2026382Banner'
import {
  PlusIcon,
  TrashIcon,
  PaperAirplaneIcon,
  DocumentTextIcon,
  UserIcon,
  TruckIcon,
  ShoppingBagIcon,
  CurrencyEuroIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

const CARRIERS = [
  { code: 'CORREOS', name: 'Correos' },
  { code: 'DHL', name: 'DHL' },
  { code: 'UPS', name: 'UPS' },
  { code: 'FEDEX', name: 'FedEx' },
  { code: 'TNT', name: 'TNT' },
  { code: 'GLS', name: 'GLS' },
  { code: 'SEUR', name: 'SEUR' },
  { code: 'MRW', name: 'MRW' },
  { code: 'AMAZON', name: 'Amazon Logistics' },
  { code: 'OTHER', name: 'Otro' }
]

const CUSTOMS_OFFICES_ES = [
  { code: 'ES000101', name: 'Valencia' },
  { code: 'ES002801', name: 'Madrid - Barajas' },
  { code: 'ES000801', name: 'Barcelona' },
  { code: 'ES004601', name: 'Sevilla' },
  { code: 'ES003001', name: 'Las Palmas' },
  { code: 'ES004801', name: 'Bilbao' },
  { code: 'ES003601', name: 'Malaga' },
  { code: 'ES000301', name: 'Alicante' },
  { code: 'ES004101', name: 'Vigo' },
]

const EMPTY_ITEM = {
  description: '',
  taricCode: '',
  quantity: 1,
  unitValue: '',
  totalValue: '',
  netWeight: '',
  countryOfOrigin: 'CN'
}

export default function H7DirectForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    // Envio
    trackingNumber: '',
    carrierCode: 'DHL',
    carrierName: '',
    operationType: 'B2C',
    customsOffice: 'ES002801',
    // N337
    documentoPrevioTipo: 'N337',
    documentoPrevioRef: '',
    garantiaGRN: '',
    // IOSS
    iossNumber: '',
    ecommercePlatform: '',
    // Remitente
    senderName: '',
    senderStreet: '',
    senderCity: '',
    senderPostalCode: '',
    senderCountry: 'CN',
    senderEori: '',
    // Destinatario
    recipientName: '',
    recipientTaxId: '',
    recipientStreet: '',
    recipientCity: '',
    recipientPostalCode: '',
    recipientProvince: '',
    recipientCountry: 'ES',
    recipientEmail: '',
    recipientPhone: '',
    // Totales
    shippingCost: 0,
    insuranceCost: 0,
    grossWeight: '',
    packages: 1,
    currency: 'EUR'
  })

  const [items, setItems] = useState([{ ...EMPTY_ITEM }])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      // Auto-calc totalValue
      if (field === 'quantity' || field === 'unitValue') {
        const qty = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(updated[index].quantity) || 0
        const unit = field === 'unitValue' ? parseFloat(value) || 0 : parseFloat(updated[index].unitValue) || 0
        updated[index].totalValue = (qty * unit).toFixed(2)
      }
      return updated
    })
  }

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (index) => {
    if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== index))
  }

  // Calcular totales
  const intrinsicValue = items.reduce((sum, item) => sum + (parseFloat(item.totalValue) || 0), 0)
  const totalNetWeight = items.reduce((sum, item) => sum + (parseFloat(item.netWeight) || 0), 0)
  const customsValue = intrinsicValue + (parseFloat(form.shippingCost) || 0) + (parseFloat(form.insuranceCost) || 0)

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validaciones
    if (!form.trackingNumber) return toast.error('Numero de tracking requerido')
    if (!form.senderName) return toast.error('Nombre del remitente requerido')
    if (!form.recipientName) return toast.error('Nombre del destinatario requerido')
    if (!form.recipientStreet) return toast.error('Direccion del destinatario requerida')
    if (items.some(i => !i.description || !i.taricCode || !i.netWeight)) return toast.error('Complete todos los campos de los articulos')
    if (intrinsicValue > 150) return toast.error('Valor intrinseco excede 150 EUR (usar H1)')
    if (intrinsicValue <= 0) return toast.error('El valor debe ser mayor que 0')

    setSubmitting(true)
    try {
      const payload = {
        trackingNumber: form.trackingNumber,
        carrier: {
          code: form.carrierCode,
          name: form.carrierName || CARRIERS.find(c => c.code === form.carrierCode)?.name || form.carrierCode
        },
        operationType: form.operationType,
        customsOffice: form.customsOffice,
        country: 'ES',
        customsSystem: 'AEAT',
        documentoPrevio: {
          tipo: form.documentoPrevioTipo || '',
          referencia: form.documentoPrevioRef || '',
          descripcion: form.documentoPrevioTipo === 'N337' ? 'Deposito temporal G4' : ''
        },
        garantiaGRN: form.garantiaGRN || undefined,
        iossNumber: form.iossNumber || undefined,
        vatPrepaid: !!form.iossNumber,
        ecommercePlatform: form.ecommercePlatform || undefined,
        sender: {
          name: form.senderName,
          address: {
            street: form.senderStreet,
            city: form.senderCity,
            postalCode: form.senderPostalCode,
            country: form.senderCountry
          },
          eori: form.senderEori || undefined
        },
        recipient: {
          name: form.recipientName,
          taxId: form.recipientTaxId || '',
          address: {
            street: form.recipientStreet,
            city: form.recipientCity,
            postalCode: form.recipientPostalCode,
            province: form.recipientProvince || undefined,
            country: form.recipientCountry
          },
          email: form.recipientEmail || undefined,
          phone: form.recipientPhone || undefined
        },
        items: items.map(item => ({
          description: item.description,
          taricCode: item.taricCode,
          quantity: parseInt(item.quantity) || 1,
          unitValue: parseFloat(item.unitValue) || 0,
          totalValue: parseFloat(item.totalValue) || 0,
          netWeight: parseFloat(item.netWeight) || 0,
          countryOfOrigin: item.countryOfOrigin || 'CN'
        })),
        totals: {
          intrinsicValue: parseFloat(intrinsicValue.toFixed(2)),
          shippingCost: parseFloat(form.shippingCost) || 0,
          insuranceCost: parseFloat(form.insuranceCost) || 0,
          customsValue: parseFloat(customsValue.toFixed(2)),
          grossWeight: parseFloat(form.grossWeight) || totalNetWeight * 1.1,
          netWeight: parseFloat(totalNetWeight.toFixed(3)),
          packages: parseInt(form.packages) || 1,
          originalCurrency: form.currency
        }
      }

      const response = await h7API.create(payload)

      if (response.data.success) {
        toast.success('H7 creada correctamente')
        navigate(`/h7/${response.data.data._id}`)
      } else {
        toast.error(response.data.message || 'Error al crear H7')
        if (response.data.errors) {
          response.data.errors.forEach(err => toast.error(err.message || err))
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al crear H7'
      toast.error(msg)
      if (err.response?.data?.errors) {
        err.response.data.errors.forEach(e => toast.error(e.message || JSON.stringify(e)))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  const labelClass = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DocumentTextIcon className="w-7 h-7 text-blue-600" />
            Nueva Declaracion H7
          </h1>
          <p className="text-sm text-gray-500 mt-1">Declaracion simplificada para envios de bajo valor (max 150 EUR)</p>
        </div>
      </div>

      <EU2026382Banner variant="inline" />

      <form onSubmit={handleSubmit} className="space-y-6 mt-4">

        {/* DATOS DEL ENVIO */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <TruckIcon className="w-5 h-5 text-blue-500" />
            Datos del envio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Numero de tracking / AWB *</label>
              <input name="trackingNumber" value={form.trackingNumber} onChange={handleChange} className={inputClass} placeholder="Ej: 1234567890" required />
            </div>
            <div>
              <label className={labelClass}>Transportista *</label>
              <select name="carrierCode" value={form.carrierCode} onChange={handleChange} className={inputClass}>
                {CARRIERS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Aduana de despacho</label>
              <select name="customsOffice" value={form.customsOffice} onChange={handleChange} className={inputClass}>
                {CUSTOMS_OFFICES_ES.map(o => <option key={o.code} value={o.code}>{o.name} ({o.code})</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tipo de operacion</label>
              <select name="operationType" value={form.operationType} onChange={handleChange} className={inputClass}>
                <option value="B2C">B2C (Particular)</option>
                <option value="C2C">C2C (Entre particulares)</option>
                <option value="B2B_LOW_VALUE">B2B Bajo valor</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>IOSS (si aplica)</label>
              <input name="iossNumber" value={form.iossNumber} onChange={handleChange} className={inputClass} placeholder="IM1234567890" />
            </div>
            <div>
              <label className={labelClass}>Plataforma e-commerce</label>
              <select name="ecommercePlatform" value={form.ecommercePlatform} onChange={handleChange} className={inputClass}>
                <option value="">-- Ninguna --</option>
                <option value="AMAZON">Amazon</option>
                <option value="EBAY">eBay</option>
                <option value="ALIEXPRESS">AliExpress</option>
                <option value="SHEIN">Shein</option>
                <option value="TEMU">Temu</option>
                <option value="WISH">Wish</option>
                <option value="OTHER">Otra</option>
              </select>
            </div>
          </div>

          {/* N337 */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-1 mb-2">
              <ExclamationTriangleIcon className="w-4 h-4" />
              Documento Previo G4 (N337) - Obligatorio aereos desde 9/Mar/2026
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Tipo documento previo</label>
                <select name="documentoPrevioTipo" value={form.documentoPrevioTipo} onChange={handleChange} className={inputClass}>
                  <option value="N337">N337 - G4 Deposito temporal</option>
                  <option value="5025">5025 - PreH7 desde G3</option>
                  <option value="">No aplica</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Referencia documento previo</label>
                <input name="documentoPrevioRef" value={form.documentoPrevioRef} onChange={handleChange} className={inputClass} placeholder="Ej: G4-2801-2026-00001" />
              </div>
              <div>
                <label className={labelClass}>GRN Garantia</label>
                <input name="garantiaGRN" value={form.garantiaGRN} onChange={handleChange} className={inputClass} placeholder="Ej: 26ESAGL2800000054" />
              </div>
            </div>
          </div>
        </div>

        {/* REMITENTE */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <UserIcon className="w-5 h-5 text-orange-500" />
            Remitente (Vendedor/Expedidor)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Nombre / Razon social *</label>
              <input name="senderName" value={form.senderName} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>EORI (si disponible)</label>
              <input name="senderEori" value={form.senderEori} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Pais *</label>
              <input name="senderCountry" value={form.senderCountry} onChange={handleChange} className={inputClass} maxLength={2} placeholder="CN" required />
            </div>
            <div>
              <label className={labelClass}>Direccion</label>
              <input name="senderStreet" value={form.senderStreet} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Ciudad</label>
              <input name="senderCity" value={form.senderCity} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Codigo postal</label>
              <input name="senderPostalCode" value={form.senderPostalCode} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* DESTINATARIO */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <UserIcon className="w-5 h-5 text-green-500" />
            Destinatario (Comprador)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Nombre / Razon social *</label>
              <input name="recipientName" value={form.recipientName} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>NIF/NIE (vacio si particular sin NIF)</label>
              <input name="recipientTaxId" value={form.recipientTaxId} onChange={handleChange} className={inputClass} placeholder="Ej: 12345678Z" />
            </div>
            <div>
              <label className={labelClass}>Pais</label>
              <input name="recipientCountry" value={form.recipientCountry} onChange={handleChange} className={inputClass} maxLength={2} />
            </div>
            <div>
              <label className={labelClass}>Direccion *</label>
              <input name="recipientStreet" value={form.recipientStreet} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Ciudad *</label>
              <input name="recipientCity" value={form.recipientCity} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Codigo postal *</label>
              <input name="recipientPostalCode" value={form.recipientPostalCode} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Provincia</label>
              <input name="recipientProvince" value={form.recipientProvince} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input name="recipientEmail" value={form.recipientEmail} onChange={handleChange} className={inputClass} type="email" />
            </div>
            <div>
              <label className={labelClass}>Telefono</label>
              <input name="recipientPhone" value={form.recipientPhone} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* ARTICULOS */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <ShoppingBagIcon className="w-5 h-5 text-purple-500" />
              Articulos ({items.length})
            </h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
              <PlusIcon className="w-4 h-4" /> Agregar articulo
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="border border-gray-100 rounded-lg p-3 mb-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Articulo {idx + 1}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Descripcion *</label>
                  <input value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} className={inputClass} placeholder="Ej: Funda movil silicona" required />
                </div>
                <div>
                  <label className={labelClass}>Codigo TARIC (6 dig) *</label>
                  <input value={item.taricCode} onChange={e => handleItemChange(idx, 'taricCode', e.target.value)} className={inputClass} placeholder="392690" maxLength={10} required />
                </div>
                <div>
                  <label className={labelClass}>Pais origen *</label>
                  <input value={item.countryOfOrigin} onChange={e => handleItemChange(idx, 'countryOfOrigin', e.target.value)} className={inputClass} maxLength={2} />
                </div>
                <div>
                  <label className={labelClass}>Cantidad *</label>
                  <input type="number" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} className={inputClass} min={1} required />
                </div>
                <div>
                  <label className={labelClass}>Valor unitario (EUR) *</label>
                  <input type="number" step="0.01" value={item.unitValue} onChange={e => handleItemChange(idx, 'unitValue', e.target.value)} className={inputClass} min={0} required />
                </div>
                <div>
                  <label className={labelClass}>Valor total (EUR)</label>
                  <input type="number" step="0.01" value={item.totalValue} onChange={e => handleItemChange(idx, 'totalValue', e.target.value)} className={`${inputClass} bg-gray-100`} readOnly />
                </div>
                <div>
                  <label className={labelClass}>Peso neto (kg) *</label>
                  <input type="number" step="0.001" value={item.netWeight} onChange={e => handleItemChange(idx, 'netWeight', e.target.value)} className={inputClass} min={0} required />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* TOTALES Y COSTES */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <CurrencyEuroIcon className="w-5 h-5 text-yellow-500" />
            Totales y costes
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Coste envio (EUR)</label>
              <input type="number" step="0.01" name="shippingCost" value={form.shippingCost} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Seguro (EUR)</label>
              <input type="number" step="0.01" name="insuranceCost" value={form.insuranceCost} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Peso bruto total (kg)</label>
              <input type="number" step="0.001" name="grossWeight" value={form.grossWeight} onChange={handleChange} className={inputClass} placeholder={`Auto: ${(totalNetWeight * 1.1).toFixed(3)}`} />
            </div>
            <div>
              <label className={labelClass}>Bultos</label>
              <input type="number" name="packages" value={form.packages} onChange={handleChange} className={inputClass} min={1} />
            </div>
          </div>

          {/* Resumen */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Valor intrinseco</span>
                <p className={`font-bold text-lg ${intrinsicValue > 150 ? 'text-red-600' : 'text-gray-900'}`}>
                  {intrinsicValue.toFixed(2)} EUR
                </p>
                {intrinsicValue > 150 && <p className="text-xs text-red-500">Excede limite H7</p>}
              </div>
              <div>
                <span className="text-gray-500">Valor en aduana (CIF)</span>
                <p className="font-bold text-lg text-gray-900">{customsValue.toFixed(2)} EUR</p>
              </div>
              <div>
                <span className="text-gray-500">Peso neto total</span>
                <p className="font-bold text-lg text-gray-900">{totalNetWeight.toFixed(3)} kg</p>
              </div>
              <div>
                <span className="text-gray-500">Articulos</span>
                <p className="font-bold text-lg text-gray-900">{items.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* BOTON ENVIAR */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/h7')} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || intrinsicValue > 150 || intrinsicValue <= 0}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><span className="animate-spin">&#9696;</span> Creando...</>
            ) : (
              <><CheckCircleIcon className="w-5 h-5" /> Crear declaracion H7</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
