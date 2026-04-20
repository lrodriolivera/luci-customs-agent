import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { declarationsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  UserIcon,
  TruckIcon,
  ShoppingBagIcon,
  CurrencyEuroIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline'

// --- Constants ---

const CUSTOMS_OFFICES_ES = [
  { code: 'ES002801', name: 'Madrid - Barajas' },
  { code: 'ES000801', name: 'Barcelona' },
  { code: 'ES000101', name: 'Valencia' },
  { code: 'ES004601', name: 'Sevilla' },
  { code: 'ES003001', name: 'Las Palmas' },
  { code: 'ES004801', name: 'Bilbao' },
  { code: 'ES003601', name: 'Malaga' },
  { code: 'ES000301', name: 'Alicante' },
  { code: 'ES004101', name: 'Vigo' },
  { code: 'ES001101', name: 'Cadiz' }
]

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']

const TRANSPORT_MODES = [
  { code: '1', name: 'Maritimo' },
  { code: '2', name: 'Ferrocarril' },
  { code: '3', name: 'Carretera' },
  { code: '4', name: 'Aereo' },
  { code: '5', name: 'Correo postal' },
  { code: '7', name: 'Instalaciones fijas' },
  { code: '8', name: 'Navegacion interior' },
  { code: '9', name: 'Propulsion propia' }
]

const PROCEDURE_CODES = [
  { code: '4000', name: 'Despacho a libre practica' },
  { code: '4200', name: 'Despacho LP con exencion IVA' },
  { code: '4051', name: 'Perfeccionamiento activo (desde deposito)' },
  { code: '5100', name: 'Perfeccionamiento activo' },
  { code: '5300', name: 'Importacion temporal' },
  { code: '6100', name: 'Reimportacion' },
  { code: '7100', name: 'Inclusion en deposito' }
]

const PREFERENCE_CODES = [
  { code: '100', name: 'Normal (arancel erga omnes)' },
  { code: '200', name: 'GSP (Sistema Preferencias Generalizadas)' },
  { code: '300', name: 'Preferencial (acuerdo bilateral)' },
  { code: '400', name: 'Especial' }
]

const VALUATION_METHODS = [
  { code: '1', name: 'Valor de transaccion' },
  { code: '2', name: 'Valor de transaccion mercancias identicas' },
  { code: '3', name: 'Valor de transaccion mercancias similares' },
  { code: '4', name: 'Metodo deductivo' },
  { code: '5', name: 'Metodo del valor reconstruido' },
  { code: '6', name: 'Ultimo recurso' }
]

const TAX_CLASSES = [
  { code: 'A00', name: 'Arancel' },
  { code: 'B00', name: 'IVA' },
  { code: '1PL', name: 'Impuesto especial' }
]

const PAYMENT_METHODS = [
  { code: 'D', name: 'Diferido' },
  { code: 'R', name: 'Al contado' },
  { code: 'E', name: 'Aplazamiento' }
]

// --- Empty templates ---

const EMPTY_DOC = { code: '', country: '', reference: '' }

const EMPTY_ITEM = {
  marks: '',
  containerNumber: '',
  packageCount: 1,
  packageType: 'CT',
  description: '',
  taricCode: '',
  taricAdditional: '',
  countryOfOrigin: '',
  grossWeight: '',
  preference: '100',
  procedure: '4000',
  netWeight: '',
  quota: '',
  previousDocument: '',
  supplementaryUnits: '',
  itemPrice: '',
  valuationMethod: '1',
  documents: [{ ...EMPTY_DOC }],
  adjustment: ''
}

const EMPTY_TAX = { classCode: 'A00', base: '', rate: '', amount: '', method: 'D' }

// --- Component ---

export default function H1DirectForm() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  // Declaration-level state
  const [form, setForm] = useState({
    // Casilla 1
    declarationType: 'IM',
    declarationAdditional: 'A',
    // Casilla 2 - Expedidor
    senderName: '',
    senderAddress: '',
    senderCity: '',
    senderPostal: '',
    senderCountry: '',
    // Casilla 7
    referenceNumber: '',
    // Casilla 8 - Destinatario
    recipientName: '',
    recipientEori: '',
    recipientAddress: '',
    recipientCity: '',
    recipientPostal: '',
    recipientCountry: 'ES',
    // Casilla 9
    financialResponsible: '',
    // Casilla 14 - Declarante
    declarantStatus: '2',
    declarantEori: '',
    declarantName: '',
    declarantAddress: '',
    // Casilla 15
    dispatchCountryCode: '',
    dispatchCountryName: '',
    // Casilla 17
    destinationCountry: 'ES',
    // Casilla 18
    transportIdAtDeparture: '',
    // Casilla 19
    containers: '0',
    // Casilla 20
    incoterm: 'CIF',
    incotermLocation: '',
    incotermCountry: '',
    // Casilla 21
    borderTransportNationality: '',
    // Casilla 22
    currency: 'EUR',
    totalInvoiceAmount: '',
    exchangeRate: '1',
    // Casilla 24
    transactionNature: '11',
    // Casilla 25
    borderTransportMode: '4',
    // Casilla 26
    inlandTransportMode: '3',
    // Casilla 29
    customsOffice: 'ES002801',
    // Casilla 30
    warehouseCode: '',
    warehouseName: '',
    // Casilla 48
    defermentReference: '',
    // Casilla 49
    guaranteeGRN: '',
    // Casilla 54
    placeAndDate: ''
  })

  const [items, setItems] = useState([{ ...EMPTY_ITEM, documents: [{ ...EMPTY_DOC }] }])
  const [taxes, setTaxes] = useState([{ ...EMPTY_TAX }])

  // --- Handlers ---

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleItemChange = (idx, field, value) => {
    setItems(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM, documents: [{ ...EMPTY_DOC }] }])
  const removeItem = (idx) => {
    if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx))
  }

  // Casilla 44 documents per item
  const handleDocChange = (itemIdx, docIdx, field, value) => {
    setItems(prev => {
      const updated = [...prev]
      const docs = [...updated[itemIdx].documents]
      docs[docIdx] = { ...docs[docIdx], [field]: value }
      updated[itemIdx] = { ...updated[itemIdx], documents: docs }
      return updated
    })
  }
  const addDoc = (itemIdx) => {
    setItems(prev => {
      const updated = [...prev]
      updated[itemIdx] = { ...updated[itemIdx], documents: [...updated[itemIdx].documents, { ...EMPTY_DOC }] }
      return updated
    })
  }
  const removeDoc = (itemIdx, docIdx) => {
    setItems(prev => {
      const updated = [...prev]
      if (updated[itemIdx].documents.length > 1) {
        updated[itemIdx] = { ...updated[itemIdx], documents: updated[itemIdx].documents.filter((_, i) => i !== docIdx) }
      }
      return updated
    })
  }

  // Casilla 47 taxes
  const handleTaxChange = (idx, field, value) => {
    setTaxes(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      // Auto-calc amount from base * rate
      if (field === 'base' || field === 'rate') {
        const base = parseFloat(field === 'base' ? value : updated[idx].base) || 0
        const rate = parseFloat(field === 'rate' ? value : updated[idx].rate) || 0
        updated[idx].amount = (base * rate / 100).toFixed(2)
      }
      return updated
    })
  }
  const addTax = () => setTaxes(prev => [...prev, { ...EMPTY_TAX }])
  const removeTax = (idx) => {
    if (taxes.length > 1) setTaxes(prev => prev.filter((_, i) => i !== idx))
  }

  // --- Auto-calculations ---

  const totalPartidas = items.length
  const totalBultos = items.reduce((sum, it) => sum + (parseInt(it.packageCount) || 0), 0)
  const totalGrossWeight = items.reduce((sum, it) => sum + (parseFloat(it.grossWeight) || 0), 0)
  const totalNetWeight = items.reduce((sum, it) => sum + (parseFloat(it.netWeight) || 0), 0)
  const exchangeRate = parseFloat(form.exchangeRate) || 1

  const computeStatValue = (item) => {
    const price = parseFloat(item.itemPrice) || 0
    return (price / exchangeRate).toFixed(2)
  }

  const totalStatValue = items.reduce((sum, it) => sum + parseFloat(computeStatValue(it)), 0)
  const totalTaxAmount = taxes.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)

  // --- Submit ---

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.recipientName) return toast.error('Destinatario (casilla 8) requerido')
    if (!form.declarantEori) return toast.error('EORI declarante (casilla 14) requerido')
    if (items.some(i => !i.description || !i.taricCode)) return toast.error('Complete descripcion y TARIC de todas las partidas')

    setSubmitting(true)
    try {
      const payload = {
        type: 'H1',
        country: 'ES',
        customsSystem: 'AEAT',
        // Casilla 1
        declarationType: form.declarationType,
        declarationAdditional: form.declarationAdditional,
        // Casilla 2
        sender: {
          name: form.senderName,
          address: form.senderAddress,
          city: form.senderCity,
          postalCode: form.senderPostal,
          country: form.senderCountry
        },
        // Casilla 7
        referenceNumber: form.referenceNumber,
        // Casilla 8
        recipient: {
          name: form.recipientName,
          eori: form.recipientEori,
          address: form.recipientAddress,
          city: form.recipientCity,
          postalCode: form.recipientPostal,
          country: form.recipientCountry
        },
        // Casilla 9
        financialResponsible: form.financialResponsible,
        // Casilla 14
        declarant: {
          status: form.declarantStatus,
          eori: form.declarantEori,
          name: form.declarantName,
          address: form.declarantAddress
        },
        // Casilla 15
        dispatchCountry: { code: form.dispatchCountryCode, name: form.dispatchCountryName },
        // Casilla 17
        destinationCountry: form.destinationCountry,
        // Casilla 18
        transportIdAtDeparture: form.transportIdAtDeparture,
        // Casilla 19
        containers: form.containers,
        // Casilla 20
        deliveryTerms: {
          incoterm: form.incoterm,
          location: form.incotermLocation,
          country: form.incotermCountry
        },
        // Casilla 21
        borderTransportNationality: form.borderTransportNationality,
        // Casilla 22
        currency: form.currency,
        totalInvoiceAmount: parseFloat(form.totalInvoiceAmount) || 0,
        exchangeRate: parseFloat(form.exchangeRate) || 1,
        // Casilla 24
        transactionNature: form.transactionNature,
        // Casilla 25-26
        borderTransportMode: form.borderTransportMode,
        inlandTransportMode: form.inlandTransportMode,
        // Casilla 29-30
        customsOffice: form.customsOffice,
        warehouseCode: form.warehouseCode,
        warehouseName: form.warehouseName,
        // Casilla 5-6 (auto)
        totalItems: totalPartidas,
        totalPackages: totalBultos,
        // Items (partidas)
        items: items.map((item, idx) => ({
          sequenceNumber: idx + 1,
          marks: item.marks,
          containerNumber: item.containerNumber,
          packageCount: parseInt(item.packageCount) || 1,
          packageType: item.packageType,
          description: item.description,
          taricCode: item.taricCode,
          taricAdditional: item.taricAdditional,
          countryOfOrigin: item.countryOfOrigin,
          grossWeight: parseFloat(item.grossWeight) || 0,
          preference: item.preference,
          procedure: item.procedure,
          netWeight: parseFloat(item.netWeight) || 0,
          quota: item.quota,
          previousDocument: item.previousDocument,
          supplementaryUnits: item.supplementaryUnits,
          itemPrice: parseFloat(item.itemPrice) || 0,
          valuationMethod: item.valuationMethod,
          documents: item.documents.filter(d => d.code).map(d => ({
            code: d.code,
            country: d.country,
            reference: d.reference
          })),
          adjustment: item.adjustment,
          statisticalValue: parseFloat(computeStatValue(item))
        })),
        // Casilla 47
        taxes: taxes.filter(t => t.base).map(t => ({
          classCode: t.classCode,
          base: parseFloat(t.base) || 0,
          rate: parseFloat(t.rate) || 0,
          amount: parseFloat(t.amount) || 0,
          method: t.method
        })),
        // Casilla 48-49
        defermentReference: form.defermentReference,
        guaranteeGRN: form.guaranteeGRN,
        // Casilla 54
        placeAndDate: form.placeAndDate,
        // Totals
        totalStatisticalValue: totalStatValue
      }

      const response = await declarationsAPI.generateH1(payload)

      if (response.data.success) {
        toast.success('Declaracion H1 creada correctamente')
        const id = response.data.data?._id || response.data.data?.id
        if (id) {
          navigate(`/expeditions/${id}`)
        } else {
          navigate('/declarations')
        }
      } else {
        toast.error(response.data.message || 'Error al crear H1')
        if (response.data.errors) {
          response.data.errors.forEach(err => toast.error(err.message || err))
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al crear declaracion H1'
      toast.error(msg)
      if (err.response?.data?.errors) {
        err.response.data.errors.forEach(e => toast.error(e.message || JSON.stringify(e)))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // --- Styles ---

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  const labelClass = "block text-xs font-medium text-gray-600 mb-1"
  const casillaTag = (num) => (
    <span className="inline-block bg-gray-200 text-gray-700 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mr-1">{num}</span>
  )

  // --- Render ---

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DocumentTextIcon className="w-7 h-7 text-blue-600" />
            Nueva Declaracion H1 - DUA Importacion
          </h1>
          <p className="text-sm text-gray-500 mt-1">Documento Unico Administrativo - Declaracion completa de importacion</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ============================================================ */}
        {/* SECCION 1: TIPO DE DECLARACION Y PARTES */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <DocumentTextIcon className="w-5 h-5 text-blue-500" />
            Tipo de declaracion y referencia
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className={labelClass}>{casillaTag('1.1')} Tipo declaracion</label>
              <select name="declarationType" value={form.declarationType} onChange={handleChange} className={inputClass}>
                <option value="IM">IM - Importacion</option>
                <option value="CO">CO - Complementaria</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{casillaTag('1.2')} Adicional</label>
              <select name="declarationAdditional" value={form.declarationAdditional} onChange={handleChange} className={inputClass}>
                <option value="A">A - Normal</option>
                <option value="D">D - Presentacion anticipada</option>
                <option value="Y">Y - Complementaria</option>
                <option value="Z">Z - Complementaria simplificada</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{casillaTag('5')} Total partidas</label>
              <input type="number" value={totalPartidas} readOnly className={`${inputClass} bg-gray-100`} />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('6')} Total bultos</label>
              <input type="number" value={totalBultos} readOnly className={`${inputClass} bg-gray-100`} />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('7')} N. referencia</label>
              <input name="referenceNumber" value={form.referenceNumber} onChange={handleChange} className={inputClass} placeholder="Ref. interna" />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECCION 2: EXPEDIDOR / EXPORTADOR (Casilla 2) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <UserIcon className="w-5 h-5 text-orange-500" />
            {casillaTag('2')} Expedidor / Exportador
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>Nombre / Razon social</label>
              <input name="senderName" value={form.senderName} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Pais</label>
              <input name="senderCountry" value={form.senderCountry} onChange={handleChange} className={inputClass} maxLength={2} placeholder="CN" />
            </div>
            <div>
              <label className={labelClass}>Direccion</label>
              <input name="senderAddress" value={form.senderAddress} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Ciudad</label>
              <input name="senderCity" value={form.senderCity} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Codigo postal</label>
              <input name="senderPostal" value={form.senderPostal} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECCION 3: DESTINATARIO (Casilla 8) + RESPONSABLE FINANCIERO (9) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <UserIcon className="w-5 h-5 text-green-500" />
            {casillaTag('8')} Destinatario
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Nombre / Razon social *</label>
              <input name="recipientName" value={form.recipientName} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>NIF / EORI</label>
              <input name="recipientEori" value={form.recipientEori} onChange={handleChange} className={inputClass} placeholder="ESB12345678" />
            </div>
            <div>
              <label className={labelClass}>Pais</label>
              <input name="recipientCountry" value={form.recipientCountry} onChange={handleChange} className={inputClass} maxLength={2} />
            </div>
            <div>
              <label className={labelClass}>Direccion</label>
              <input name="recipientAddress" value={form.recipientAddress} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Ciudad</label>
              <input name="recipientCity" value={form.recipientCity} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Codigo postal</label>
              <input name="recipientPostal" value={form.recipientPostal} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>{casillaTag('9')} Responsable financiero</label>
            <input name="financialResponsible" value={form.financialResponsible} onChange={handleChange} className={inputClass} placeholder="EORI o nombre del responsable financiero" />
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECCION 4: DECLARANTE / REPRESENTANTE (Casilla 14) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <BuildingOfficeIcon className="w-5 h-5 text-indigo-500" />
            {casillaTag('14')} Declarante / Representante
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Estado representacion *</label>
              <select name="declarantStatus" value={form.declarantStatus} onChange={handleChange} className={inputClass}>
                <option value="1">1 - Representacion directa</option>
                <option value="2">2 - Representacion indirecta</option>
                <option value="3">3 - Declarante (sin representacion)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>EORI *</label>
              <input name="declarantEori" value={form.declarantEori} onChange={handleChange} className={inputClass} placeholder="ESB22477020" required />
            </div>
            <div>
              <label className={labelClass}>Nombre</label>
              <input name="declarantName" value={form.declarantName} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Direccion</label>
              <input name="declarantAddress" value={form.declarantAddress} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECCION 5: TRANSPORTE Y PAISES (Casillas 15-21, 25-26) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <TruckIcon className="w-5 h-5 text-blue-500" />
            Transporte y paises
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>{casillaTag('15')} Pais expedicion (cod)</label>
              <input name="dispatchCountryCode" value={form.dispatchCountryCode} onChange={handleChange} className={inputClass} maxLength={2} placeholder="CN" />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('15')} Pais expedicion (nombre)</label>
              <input name="dispatchCountryName" value={form.dispatchCountryName} onChange={handleChange} className={inputClass} placeholder="China" />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('17')} Pais destino</label>
              <input name="destinationCountry" value={form.destinationCountry} onChange={handleChange} className={inputClass} maxLength={2} />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('19')} Contenedores</label>
              <select name="containers" value={form.containers} onChange={handleChange} className={inputClass}>
                <option value="0">0 - No</option>
                <option value="1">1 - Si</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{casillaTag('18')} Identidad transporte partida</label>
              <input name="transportIdAtDeparture" value={form.transportIdAtDeparture} onChange={handleChange} className={inputClass} placeholder="Matricula / vuelo" />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('21')} Nacionalidad transp. frontera</label>
              <input name="borderTransportNationality" value={form.borderTransportNationality} onChange={handleChange} className={inputClass} maxLength={2} placeholder="ES" />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('25')} Modo transporte frontera</label>
              <select name="borderTransportMode" value={form.borderTransportMode} onChange={handleChange} className={inputClass}>
                {TRANSPORT_MODES.map(m => <option key={m.code} value={m.code}>{m.code} - {m.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{casillaTag('26')} Modo transporte interior</label>
              <select name="inlandTransportMode" value={form.inlandTransportMode} onChange={handleChange} className={inputClass}>
                {TRANSPORT_MODES.map(m => <option key={m.code} value={m.code}>{m.code} - {m.name}</option>)}
              </select>
            </div>
          </div>

          {/* Condiciones entrega - Casilla 20 */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="block text-xs font-semibold text-gray-700 mb-2">{casillaTag('20')} Condiciones de entrega (Incoterm)</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Incoterm</label>
                <select name="incoterm" value={form.incoterm} onChange={handleChange} className={inputClass}>
                  {INCOTERMS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Lugar</label>
                <input name="incotermLocation" value={form.incotermLocation} onChange={handleChange} className={inputClass} placeholder="Puerto / aeropuerto" />
              </div>
              <div>
                <label className={labelClass}>Pais</label>
                <input name="incotermCountry" value={form.incotermCountry} onChange={handleChange} className={inputClass} maxLength={2} placeholder="ES" />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECCION 6: DATOS FINANCIEROS (Casilla 22, 24) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <CurrencyEuroIcon className="w-5 h-5 text-yellow-500" />
            Datos financieros
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>{casillaTag('22')} Divisa</label>
              <input name="currency" value={form.currency} onChange={handleChange} className={inputClass} maxLength={3} placeholder="EUR" />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('22')} Importe total factura</label>
              <input type="number" step="0.01" name="totalInvoiceAmount" value={form.totalInvoiceAmount} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('22')} Tipo de cambio</label>
              <input type="number" step="0.000001" name="exchangeRate" value={form.exchangeRate} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('24')} Naturaleza transaccion</label>
              <input name="transactionNature" value={form.transactionNature} onChange={handleChange} className={inputClass} maxLength={2} placeholder="11" />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECCION 7: ADUANA Y LOCALIZACION (Casillas 29, 30) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <BuildingOfficeIcon className="w-5 h-5 text-red-500" />
            Aduana y localizacion
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{casillaTag('29')} Aduana de presentacion</label>
              <select name="customsOffice" value={form.customsOffice} onChange={handleChange} className={inputClass}>
                {CUSTOMS_OFFICES_ES.map(o => <option key={o.code} value={o.code}>{o.name} ({o.code})</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{casillaTag('30')} Cod. almacen</label>
              <input name="warehouseCode" value={form.warehouseCode} onChange={handleChange} className={inputClass} placeholder="ESA2801001" />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('30')} Nombre almacen</label>
              <input name="warehouseName" value={form.warehouseName} onChange={handleChange} className={inputClass} placeholder="Almacen temporal T1" />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECCION 8: PARTIDAS (Items) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <ShoppingBagIcon className="w-5 h-5 text-purple-500" />
              Partidas ({totalPartidas})
            </h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <PlusIcon className="w-4 h-4" /> Agregar partida
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
              {/* Item header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">
                  {casillaTag('32')} Partida {idx + 1}
                </span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Row 1: Bultos y descripcion (Casilla 31) */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-700 mb-2">{casillaTag('31')} Bultos y descripcion de mercancias</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className={labelClass}>Marcas</label>
                    <input value={item.marks} onChange={e => handleItemChange(idx, 'marks', e.target.value)} className={inputClass} placeholder="N/M" />
                  </div>
                  <div>
                    <label className={labelClass}>N. contenedor</label>
                    <input value={item.containerNumber} onChange={e => handleItemChange(idx, 'containerNumber', e.target.value)} className={inputClass} placeholder="MSKU1234567" />
                  </div>
                  <div>
                    <label className={labelClass}>N. bultos</label>
                    <input type="number" value={item.packageCount} onChange={e => handleItemChange(idx, 'packageCount', e.target.value)} className={inputClass} min={0} />
                  </div>
                  <div>
                    <label className={labelClass}>Tipo bulto</label>
                    <input value={item.packageType} onChange={e => handleItemChange(idx, 'packageType', e.target.value)} className={inputClass} placeholder="CT" maxLength={2} />
                  </div>
                  <div>
                    <label className={labelClass}>Descripcion *</label>
                    <input value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} className={inputClass} placeholder="Mercancias..." required />
                  </div>
                </div>
              </div>

              {/* Row 2: TARIC, origen, pesos (Casillas 33-38) */}
              <div className="mb-3">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div>
                    <label className={labelClass}>{casillaTag('33')} TARIC (8 dig) *</label>
                    <input value={item.taricCode} onChange={e => handleItemChange(idx, 'taricCode', e.target.value)} className={inputClass} placeholder="84713000" maxLength={8} required />
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('33')} Adic. (2 dig)</label>
                    <input value={item.taricAdditional} onChange={e => handleItemChange(idx, 'taricAdditional', e.target.value)} className={inputClass} placeholder="00" maxLength={4} />
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('34')} Pais origen</label>
                    <input value={item.countryOfOrigin} onChange={e => handleItemChange(idx, 'countryOfOrigin', e.target.value)} className={inputClass} maxLength={2} placeholder="CN" />
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('35')} Masa bruta (kg)</label>
                    <input type="number" step="0.001" value={item.grossWeight} onChange={e => handleItemChange(idx, 'grossWeight', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('38')} Masa neta (kg)</label>
                    <input type="number" step="0.001" value={item.netWeight} onChange={e => handleItemChange(idx, 'netWeight', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('41')} Uds. suplementarias</label>
                    <input value={item.supplementaryUnits} onChange={e => handleItemChange(idx, 'supplementaryUnits', e.target.value)} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Row 3: Regimen, preferencia, valoracion (Casillas 36, 37, 42, 43, 45, 46) */}
              <div className="mb-3">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div>
                    <label className={labelClass}>{casillaTag('36')} Preferencia</label>
                    <select value={item.preference} onChange={e => handleItemChange(idx, 'preference', e.target.value)} className={inputClass}>
                      {PREFERENCE_CODES.map(p => <option key={p.code} value={p.code}>{p.code} - {p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('37')} Regimen</label>
                    <select value={item.procedure} onChange={e => handleItemChange(idx, 'procedure', e.target.value)} className={inputClass}>
                      {PROCEDURE_CODES.map(p => <option key={p.code} value={p.code}>{p.code} - {p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('42')} Precio articulo</label>
                    <input type="number" step="0.01" value={item.itemPrice} onChange={e => handleItemChange(idx, 'itemPrice', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('43')} Cod. M.E.</label>
                    <select value={item.valuationMethod} onChange={e => handleItemChange(idx, 'valuationMethod', e.target.value)} className={inputClass}>
                      {VALUATION_METHODS.map(v => <option key={v.code} value={v.code}>{v.code} - {v.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('45')} Ajuste (%)</label>
                    <input value={item.adjustment} onChange={e => handleItemChange(idx, 'adjustment', e.target.value)} className={inputClass} placeholder="+5 / -3" />
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('46')} Valor estadistico</label>
                    <input type="number" step="0.01" value={computeStatValue(item)} readOnly className={`${inputClass} bg-gray-100`} />
                  </div>
                </div>
              </div>

              {/* Row 4: Contingente y documento previo (Casillas 39, 40) */}
              <div className="mb-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{casillaTag('39')} Contingente</label>
                    <input value={item.quota} onChange={e => handleItemChange(idx, 'quota', e.target.value)} className={inputClass} placeholder="Numero contingente" />
                  </div>
                  <div>
                    <label className={labelClass}>{casillaTag('40')} Documento de cargo / precedente</label>
                    <input value={item.previousDocument} onChange={e => handleItemChange(idx, 'previousDocument', e.target.value)} className={inputClass} placeholder="N337 25ES00280183415518 00010" />
                  </div>
                </div>
              </div>

              {/* Casilla 44: Documentos presentados */}
              <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700">
                    {casillaTag('44')} Indicaciones especiales / Documentos presentados
                  </label>
                  <button type="button" onClick={() => addDoc(idx)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                    <PlusIcon className="w-3 h-3" /> Agregar documento
                  </button>
                </div>
                {item.documents.map((doc, dIdx) => (
                  <div key={dIdx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                    <div className="col-span-3">
                      <label className={labelClass}>Codigo</label>
                      <input value={doc.code} onChange={e => handleDocChange(idx, dIdx, 'code', e.target.value)} className={inputClass} placeholder="N380, C514, N740..." />
                    </div>
                    <div className="col-span-2">
                      <label className={labelClass}>Pais</label>
                      <input value={doc.country} onChange={e => handleDocChange(idx, dIdx, 'country', e.target.value)} className={inputClass} maxLength={2} placeholder="ES" />
                    </div>
                    <div className="col-span-6">
                      <label className={labelClass}>Referencia</label>
                      <input value={doc.reference} onChange={e => handleDocChange(idx, dIdx, 'reference', e.target.value)} className={inputClass} placeholder="Numero de referencia del documento" />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {item.documents.length > 1 && (
                        <button type="button" onClick={() => removeDoc(idx, dIdx)} className="text-red-400 hover:text-red-600 pb-2">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ============================================================ */}
        {/* SECCION 9: CALCULO DE TRIBUTOS (Casilla 47) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <ClipboardDocumentListIcon className="w-5 h-5 text-red-500" />
              {casillaTag('47')} Calculo de tributos
            </h2>
            <button type="button" onClick={addTax} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <PlusIcon className="w-4 h-4" /> Agregar linea
            </button>
          </div>

          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-2">Clase</div>
              <div className="col-span-3">Base imponible</div>
              <div className="col-span-2">Tipo / Rate (%)</div>
              <div className="col-span-2">Importe</div>
              <div className="col-span-2">MP (metodo pago)</div>
              <div className="col-span-1"></div>
            </div>
            {taxes.map((tax, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2">
                  <select value={tax.classCode} onChange={e => handleTaxChange(idx, 'classCode', e.target.value)} className={inputClass}>
                    {TAX_CLASSES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <input type="number" step="0.01" value={tax.base} onChange={e => handleTaxChange(idx, 'base', e.target.value)} className={inputClass} placeholder="0.00" />
                </div>
                <div className="col-span-2">
                  <input type="number" step="0.01" value={tax.rate} onChange={e => handleTaxChange(idx, 'rate', e.target.value)} className={inputClass} placeholder="21" />
                </div>
                <div className="col-span-2">
                  <input type="number" step="0.01" value={tax.amount} onChange={e => handleTaxChange(idx, 'amount', e.target.value)} className={`${inputClass} bg-gray-100`} readOnly />
                </div>
                <div className="col-span-2">
                  <select value={tax.method} onChange={e => handleTaxChange(idx, 'method', e.target.value)} className={inputClass}>
                    {PAYMENT_METHODS.map(m => <option key={m.code} value={m.code}>{m.code} - {m.name}</option>)}
                  </select>
                </div>
                <div className="col-span-1 flex justify-center">
                  {taxes.length > 1 && (
                    <button type="button" onClick={() => removeTax(idx)} className="text-red-400 hover:text-red-600">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tax totals */}
          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end">
            <div className="text-sm font-semibold text-gray-700">
              Total tributos: <span className="text-lg text-gray-900">{totalTaxAmount.toFixed(2)} EUR</span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECCION 10: GARANTIA, APLAZAMIENTO, LUGAR Y FECHA (48, 49, 54) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <DocumentTextIcon className="w-5 h-5 text-gray-500" />
            Garantia y finalizacion
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{casillaTag('48')} Aplazamiento de pago (DPO)</label>
              <input name="defermentReference" value={form.defermentReference} onChange={handleChange} className={inputClass} placeholder="Referencia DPO" />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('49')} GRN Garantia</label>
              <input name="guaranteeGRN" value={form.guaranteeGRN} onChange={handleChange} className={inputClass} placeholder="19ESAGL2800004968" />
            </div>
            <div>
              <label className={labelClass}>{casillaTag('54')} Lugar y fecha</label>
              <input name="placeAndDate" value={form.placeAndDate} onChange={handleChange} className={inputClass} placeholder="Madrid, 19/03/2026" />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RESUMEN */}
        {/* ============================================================ */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Resumen de la declaracion</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Partidas</span>
              <p className="font-bold text-lg text-gray-900">{totalPartidas}</p>
            </div>
            <div>
              <span className="text-gray-500">Total bultos</span>
              <p className="font-bold text-lg text-gray-900">{totalBultos}</p>
            </div>
            <div>
              <span className="text-gray-500">Masa bruta total</span>
              <p className="font-bold text-lg text-gray-900">{totalGrossWeight.toFixed(3)} kg</p>
            </div>
            <div>
              <span className="text-gray-500">Masa neta total</span>
              <p className="font-bold text-lg text-gray-900">{totalNetWeight.toFixed(3)} kg</p>
            </div>
            <div>
              <span className="text-gray-500">Valor estadistico</span>
              <p className="font-bold text-lg text-gray-900">{totalStatValue.toFixed(2)} EUR</p>
            </div>
            <div>
              <span className="text-gray-500">Total tributos</span>
              <p className="font-bold text-lg text-gray-900">{totalTaxAmount.toFixed(2)} EUR</p>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* BOTONES */}
        {/* ============================================================ */}
        <div className="flex justify-end gap-3 pb-8">
          <button type="button" onClick={() => navigate('/declarations')} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><span className="animate-spin">&#9696;</span> Creando...</>
            ) : (
              <><CheckCircleIcon className="w-5 h-5" /> Crear declaracion H1</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
