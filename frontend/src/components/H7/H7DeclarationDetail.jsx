import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { h7API } from '../../services/api'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  DocumentTextIcon,
  TruckIcon,
  UserIcon,
  CurrencyEuroIcon,
  ScaleIcon,
  ArrowPathIcon,
  XMarkIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'

const statusConfig = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-800', icon: DocumentTextIcon },
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon },
  validating: { label: 'Validando', color: 'bg-blue-100 text-blue-800', icon: ArrowPathIcon },
  submitted: { label: 'Enviada', color: 'bg-indigo-100 text-indigo-800', icon: PaperAirplaneIcon },
  released: { label: 'Levante', color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
  rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: XCircleIcon },
  cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500', icon: XMarkIcon },
  error: { label: 'Error', color: 'bg-red-100 text-red-800', icon: ExclamationTriangleIcon }
}

export default function H7DeclarationDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [declaration, setDeclaration] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadDeclaration()
  }, [id])

  const loadDeclaration = async () => {
    try {
      setLoading(true)
      const res = await h7API.get(id)
      setDeclaration(res.data.data)
    } catch (err) {
      toast.error('Error cargando declaración')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      const res = await h7API.submit(id)
      if (res.data.success) {
        toast.success(`Declaración enviada - MRN: ${res.data.data?.mrn || 'Pendiente'}`)
        loadDeclaration()
      } else {
        toast.error(res.data.message || 'Error al enviar')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al enviar a AEAT')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!declaration) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Declaración no encontrada</p>
        <button onClick={() => navigate('/h7')} className="mt-4 text-blue-600 hover:underline">
          Volver a la lista
        </button>
      </div>
    )
  }

  const d = declaration
  const status = statusConfig[d.status] || statusConfig.draft
  const StatusIcon = status.icon

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/h7')} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{d.reference}</h1>
            <p className="text-sm text-gray-500">Tracking: {d.trackingNumber}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
            <StatusIcon className="h-4 w-4" />
            {status.label}
          </span>
        </div>
        <div className="flex gap-3">
          {(d.status === 'draft' || d.status === 'pending') && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <PaperAirplaneIcon className="h-4 w-4" />
              )}
              {submitting ? 'Enviando...' : 'Enviar a AEAT'}
            </button>
          )}
        </div>
      </div>

      {/* MRN Banner */}
      {d.mrn && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800">MRN: {d.mrn}</p>
            {d.aeatResponse?.message && (
              <p className="text-sm text-green-600">{d.aeatResponse.message}</p>
            )}
            {d.aeatResponse?.csv && (
              <p className="text-sm text-green-600">CSV: {d.aeatResponse.csv}</p>
            )}
          </div>
        </div>
      )}

      {/* Circuito aduanero */}
      {(d.channel || d.aeatResponse?.channel) && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          (d.channel || d.aeatResponse?.channel) === 'green' ? 'bg-green-50 border-green-200' :
          (d.channel || d.aeatResponse?.channel) === 'orange' ? 'bg-orange-50 border-orange-200' :
          (d.channel || d.aeatResponse?.channel) === 'red' ? 'bg-red-50 border-red-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className={`h-4 w-4 rounded-full ${
            (d.channel || d.aeatResponse?.channel) === 'green' ? 'bg-green-500' :
            (d.channel || d.aeatResponse?.channel) === 'orange' ? 'bg-orange-500' :
            (d.channel || d.aeatResponse?.channel) === 'red' ? 'bg-red-500' :
            'bg-gray-400'
          }`} />
          <div>
            <p className="font-semibold text-gray-800">
              Circuito: {
                (d.channel || d.aeatResponse?.channel) === 'green' ? 'Verde — Levante automático' :
                (d.channel || d.aeatResponse?.channel) === 'orange' ? 'Naranja — Revisión documental' :
                (d.channel || d.aeatResponse?.channel) === 'red' ? 'Rojo — Inspección física' :
                (d.channel || d.aeatResponse?.channel)
              }
            </p>
            <p className="text-sm text-gray-500">
              {(d.channel || d.aeatResponse?.channel) === 'green' && 'La mercancía puede ser entregada al destinatario sin inspección.'}
              {(d.channel || d.aeatResponse?.channel) === 'orange' && 'Se requiere revisión de documentación antes de liberar la mercancía.'}
              {(d.channel || d.aeatResponse?.channel) === 'red' && 'Se requiere inspección física de la mercancía.'}
            </p>
          </div>
        </div>
      )}

      {/* Cumplimiento Normativo - Cambios 9/Mar/2026 + EU 2026/382 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-white" />
              <h3 className="font-bold text-white">Cumplimiento Normativo</h3>
            </div>
            <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full font-medium">
              Actualizado 9/Mar/2026
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Checklist de cumplimiento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* N337 - OBLIGATORIO */}
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${
              d.documentoPrevio?.tipo ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                d.documentoPrevio?.tipo ? 'bg-green-500' : 'bg-red-500'
              }`}>
                <span className="text-white text-xs font-bold">{d.documentoPrevio?.tipo ? '✓' : '!'}</span>
              </div>
              <div>
                <p className={`text-sm font-semibold ${d.documentoPrevio?.tipo ? 'text-green-800' : 'text-red-800'}`}>
                  Documento previo N337
                </p>
                <p className={`text-xs ${d.documentoPrevio?.tipo ? 'text-green-600' : 'text-red-600'}`}>
                  Cierre DSDT aereos - AEAT ADU-F-37/26
                </p>
                {d.documentoPrevio?.tipo && (
                  <p className="text-xs text-green-700 font-mono mt-1">
                    Tipo: {d.documentoPrevio.tipo} | Ref: {d.documentoPrevio.referencia}
                  </p>
                )}
              </div>
            </div>

            {/* G4 Deposito Temporal */}
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${
              d.documentoPrevio?.referencia ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                d.documentoPrevio?.referencia ? 'bg-green-500' : 'bg-yellow-500'
              }`}>
                <span className="text-white text-xs font-bold">{d.documentoPrevio?.referencia ? '✓' : '?'}</span>
              </div>
              <div>
                <p className={`text-sm font-semibold ${d.documentoPrevio?.referencia ? 'text-green-800' : 'text-yellow-800'}`}>
                  Referencia G4 deposito temporal
                </p>
                <p className={`text-xs ${d.documentoPrevio?.referencia ? 'text-green-600' : 'text-yellow-600'}`}>
                  Mensajes G3v2/G4/G5v2 obligatorios en aereos
                </p>
                {d.documentoPrevio?.referencia && (
                  <p className="text-xs text-green-700 font-mono mt-1">{d.documentoPrevio.referencia}</p>
                )}
              </div>
            </div>

            {/* Garantia GRN */}
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${
              d.garantiaGRN ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                d.garantiaGRN ? 'bg-green-500' : 'bg-gray-400'
              }`}>
                <span className="text-white text-xs font-bold">{d.garantiaGRN ? '✓' : '-'}</span>
              </div>
              <div>
                <p className={`text-sm font-semibold ${d.garantiaGRN ? 'text-green-800' : 'text-gray-600'}`}>
                  Garantia aduanera (GRN)
                </p>
                <p className={`text-xs ${d.garantiaGRN ? 'text-green-600' : 'text-gray-500'}`}>
                  Despacho a consumo
                </p>
                {d.garantiaGRN && (
                  <p className="text-xs text-green-700 font-mono mt-1">{d.garantiaGRN}</p>
                )}
              </div>
            </div>

            {/* Desconsolidacion G4 restringida */}
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-orange-50 border-orange-200">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-orange-500">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-orange-800">
                  Desconsolidacion G4 restringida
                </p>
                <p className="text-xs text-orange-600">
                  Desde 10/Mar solo en ubicaciones con "Admite DSDT = Si"
                </p>
              </div>
            </div>

            {/* EU 2026/382 - Derecho fijo */}
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-amber-50 border-amber-200">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-amber-500">
                <span className="text-white text-xs font-bold">⏳</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Derecho fijo 3 EUR/articulo
                </p>
                <p className="text-xs text-amber-600">
                  Reg. (UE) 2026/382 - Entra en vigor 1 julio 2026
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  LUCI aplicara automaticamente el tributo A00 = 3 EUR
                </p>
              </div>
            </div>
          </div>

          {/* XML Preview - fragmento del documento enviado */}
          {d.documentoPrevio?.tipo && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">XML generado para AEAT (fragmento C44)</p>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-green-400 font-mono leading-relaxed">
{`<Partida>
  ...
  <C44DocumentosYCertificados>
    <C44Tipo>N380</C44Tipo>
    <C44Referencia>FACTURA-001</C44Referencia>
  </C44DocumentosYCertificados>
  `}<span className="text-yellow-300 font-bold">{`<C44DocumentosYCertificados>
    <C44Tipo>${d.documentoPrevio?.tipo || 'N337'}</C44Tipo>
    <C44Referencia>${d.documentoPrevio?.referencia || ''}</C44Referencia>
  </C44DocumentosYCertificados>`}</span>{`
  <C47TributoDeclarado>
    <C47TributoClase>A00</C47TributoClase>
    <C47TributoCuota>0.00</C47TributoCuota>  `}<span className="text-gray-500">{`<!-- 3.00 EUR desde 01/Jul/2026 -->`}</span>{`
  </C47TributoDeclarado>
  ...
</Partida>`}
                </pre>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                El documento previo N337 referencia el G4 de deposito temporal conforme a AEAT ADU-F-37/26 y ADU-F-42/26
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Remitente */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <TruckIcon className="h-5 w-5 text-orange-500" />
            Remitente
          </h3>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{d.sender?.name || '-'}</p>
            <p className="text-gray-500">{d.sender?.address?.country || '-'}</p>
            {d.sender?.eori && <p className="text-gray-500">EORI: {d.sender.eori}</p>}
          </div>
        </div>

        {/* Destinatario */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-blue-500" />
            Destinatario
          </h3>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{d.recipient?.name || '-'}</p>
            <p className="text-gray-500">NIF: {d.recipient?.taxId || '-'}</p>
            <p className="text-gray-500">{d.recipient?.address?.street}, {d.recipient?.address?.city} {d.recipient?.address?.postalCode}</p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-purple-500" />
          Partidas ({d.items?.length || 0})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Descripción</th>
                <th className="py-2 pr-4">HS Code</th>
                <th className="py-2 pr-4">Origen</th>
                <th className="py-2 pr-4 text-right">Cant.</th>
                <th className="py-2 pr-4 text-right">Valor</th>
                <th className="py-2 text-right">Peso</th>
              </tr>
            </thead>
            <tbody>
              {(d.items || []).map((item, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                  <td className="py-2 pr-4 font-medium">{item.description}</td>
                  <td className="py-2 pr-4"><code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{item.taricCode}</code></td>
                  <td className="py-2 pr-4">{item.countryOfOrigin}</td>
                  <td className="py-2 pr-4 text-right">{item.quantity}</td>
                  <td className="py-2 pr-4 text-right">{Number(item.totalValue || 0).toFixed(2)} €</td>
                  <td className="py-2 text-right">{Number(item.netWeight || 0).toFixed(2)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totales y Derechos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <CurrencyEuroIcon className="h-5 w-5 text-green-500" />
            Totales
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Valor intrínseco</span><span className="font-medium">{Number(d.totals?.intrinsicValue || 0).toFixed(2)} €</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Valor aduanero</span><span className="font-medium">{Number(d.totals?.customsValue || 0).toFixed(2)} €</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Peso bruto</span><span className="font-medium">{Number(d.totals?.grossWeight || 0).toFixed(2)} kg</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Bultos</span><span className="font-medium">{d.totals?.packages || 1}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <ScaleIcon className="h-5 w-5 text-amber-500" />
            Derechos
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Arancel ({d.duties?.tariff?.rate || 0}%)</span><span className="font-medium">{Number(d.duties?.tariff?.amount || 0).toFixed(2)} €</span></div>
            <div className="flex justify-between"><span className="text-gray-500">IVA ({d.duties?.vat?.rate || 21}%)</span><span className="font-medium">{Number(d.duties?.vat?.amount || 0).toFixed(2)} €</span></div>
            <div className="flex justify-between border-t pt-2"><span className="font-semibold">Total a pagar</span><span className="font-bold text-lg">{Number(d.duties?.totalDue || 0).toFixed(2)} €</span></div>
          </div>
        </div>
      </div>

      {/* Carrier */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <TruckIcon className="h-5 w-5 text-gray-500" />
          Transportista
        </h3>
        <div className="text-sm">
          <span className="font-medium">{d.carrier?.name || d.carrier?.code || '-'}</span>
          {d.iossNumber && <span className="ml-4 text-gray-500">IOSS: {d.iossNumber}</span>}
        </div>
      </div>

      {/* Status History */}
      {d.statusHistory?.length > 0 && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-700">Historial</h3>
          <div className="space-y-2">
            {d.statusHistory.map((h, i) => {
              const st = statusConfig[h.status] || statusConfig.draft
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>{st.label}</span>
                  <span className="text-gray-400">{new Date(h.timestamp).toLocaleString('es-ES')}</span>
                  {h.reason && <span className="text-gray-500">— {h.reason}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
