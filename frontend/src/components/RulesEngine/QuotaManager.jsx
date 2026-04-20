import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { countriesGrouped } from '../../data/countries'
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  CurrencyEuroIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

export default function QuotaManager() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [quotas, setQuotas] = useState([])
  const [critical, setCritical] = useState([])
  const [availability, setAvailability] = useState(null)
  const [selectedTab, setSelectedTab] = useState('search')
  const [formData, setFormData] = useState({
    taricCode: '',
    originCountry: 'AR',
    quantity: '',
    unit: 'kg',
    customsValue: ''
  })

  useEffect(() => {
    if (selectedTab === 'list') {
      fetchAllQuotas()
    } else if (selectedTab === 'critical') {
      fetchCriticalQuotas()
    }
  }, [selectedTab])

  const fetchAllQuotas = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:5001/api/quotas/list')
      const data = await response.json()

      if (data.success) {
        setQuotas(data.data.quotas)
      } else {
        toast.error('Error al cargar contingentes')
      }
    } catch (error) {
      console.error('Error fetching quotas:', error)
      toast.error('Error al cargar contingentes')
    } finally {
      setLoading(false)
    }
  }

  const fetchCriticalQuotas = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:5001/api/quotas/critical')
      const data = await response.json()

      if (data.success) {
        setCritical(data.data.quotas)
      } else {
        toast.error('Error al cargar contingentes críticos')
      }
    } catch (error) {
      console.error('Error fetching critical quotas:', error)
      toast.error('Error al cargar contingentes críticos')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckAvailability = async (e) => {
    e.preventDefault()

    if (!formData.taricCode || !formData.originCountry || !formData.quantity) {
      toast.error('Complete TARIC, país de origen y cantidad')
      return
    }

    setChecking(true)
    setAvailability(null)

    try {
      const response = await fetch('http://localhost:5001/api/quotas/check-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taricCode: formData.taricCode,
          originCountry: formData.originCountry,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit
        })
      })

      const data = await response.json()

      if (data.success) {
        setAvailability(data.data)
        if (data.data.found && data.data.count > 0) {
          toast.success(`${data.data.count} contingente(s) encontrado(s)`)
        } else {
          toast.info('No se encontraron contingentes para este producto')
        }
      } else {
        toast.error(data.error || 'Error al verificar disponibilidad')
      }
    } catch (error) {
      console.error('Error checking availability:', error)
      toast.error('Error al verificar disponibilidad')
    } finally {
      setChecking(false)
    }
  }

  const countries = countriesGrouped.flatMap(g => g.options.map(c => ({ code: c.code, name: c.label })))

  const getStatusBadge = (status) => {
    switch (status) {
      case 'available':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Disponible</span>
      case 'critical':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">Crítico</span>
      case 'exhausted':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Agotado</span>
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{status}</span>
    }
  }

  const getUtilizationColor = (percent) => {
    if (percent >= 95) return 'text-red-600 bg-red-50'
    if (percent >= 80) return 'text-orange-600 bg-orange-50'
    if (percent >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <ChartBarIcon className="h-8 w-8 mr-3 text-indigo-600" />
          {t('quotaManager.title')}
        </h1>
        <p className="mt-2 text-gray-600">
          {t('quotaManager.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setSelectedTab('search')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'search'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Buscar Disponibilidad
          </button>
          <button
            onClick={() => setSelectedTab('list')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'list'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Todos los Contingentes
          </button>
          <button
            onClick={() => setSelectedTab('critical')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'critical'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Contingentes Críticos
            {critical.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                {critical.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Buscar Disponibilidad */}
      {selectedTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div>
            <form onSubmit={handleCheckAvailability} className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Verificar Disponibilidad</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código TARIC *
                </label>
                <input
                  type="text"
                  value={formData.taricCode}
                  onChange={(e) => setFormData({ ...formData, taricCode: e.target.value })}
                  placeholder="ej. 02011000 (carne de vacuno)"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  País de Origen *
                </label>
                <select
                  value={formData.originCountry}
                  onChange={(e) => setFormData({ ...formData, originCountry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                >
                  {countries.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="10000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unidad
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="L">Litros (L)</option>
                    <option value="ton">Toneladas (ton)</option>
                    <option value="units">Unidades</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Aduanero (EUR) - Opcional
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.customsValue}
                  onChange={(e) => setFormData({ ...formData, customsValue: e.target.value })}
                  placeholder="50000.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Para calcular ahorro potencial</p>
              </div>

              <button
                type="submit"
                disabled={checking}
                className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 font-medium flex items-center justify-center"
              >
                {checking ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verificando...
                  </>
                ) : (
                  <>
                    <ChartBarIcon className="h-5 w-5 mr-2" />
                    Verificar Disponibilidad
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Resultados */}
          <div>
            {availability && (
              <>
                {availability.found && availability.quotas.length > 0 ? (
                  <div className="space-y-4">
                    {availability.quotas.map((quota, idx) => (
                      <div key={idx} className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">{quota.description}</h3>
                            <p className="text-sm text-gray-600">Orden: {quota.orderNumber}</p>
                            {quota.agreement && (
                              <p className="text-xs text-gray-500">Acuerdo: {quota.agreement}</p>
                            )}
                          </div>
                          {getStatusBadge(quota.available ? 'available' : 'exhausted')}
                        </div>

                        {/* Volumen */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-600">Utilización:</span>
                            <span className="font-medium">{quota.volume.utilizationPercent}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                quota.volume.utilizationPercent >= 95 ? 'bg-red-500' :
                                quota.volume.utilizationPercent >= 80 ? 'bg-orange-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(quota.volume.utilizationPercent, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Disponible: {quota.volume.available.toLocaleString()} {quota.volume.unit}</span>
                            <span>Total: {quota.volume.total.toLocaleString()} {quota.volume.unit}</span>
                          </div>
                        </div>

                        {/* Arancel */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-green-50 p-3 rounded-md">
                            <p className="text-xs text-green-700">Arancel en contingente</p>
                            <p className="text-lg font-bold text-green-900">{(quota.duty.inQuota * 100).toFixed(1)}%</p>
                          </div>
                          <div className="bg-red-50 p-3 rounded-md">
                            <p className="text-xs text-red-700">Arancel normal (NMF)</p>
                            <p className="text-lg font-bold text-red-900">{(quota.duty.outQuota * 100).toFixed(1)}%</p>
                          </div>
                        </div>

                        {/* Ahorro */}
                        {formData.customsValue && (
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                            <p className="text-sm font-medium text-blue-900">Ahorro Estimado:</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {(parseFloat(formData.customsValue) * quota.duty.savings).toFixed(2)} EUR
                            </p>
                          </div>
                        )}

                        {/* Alertas */}
                        {quota.critical && (
                          <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-3">
                            <div className="flex items-start">
                              <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 mr-2 flex-shrink-0" />
                              <p className="text-sm text-orange-800">
                                Contingente en estado crítico. Solicite reserva con urgencia.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Recomendación */}
                        <div className="text-sm text-gray-700">
                          <p className="font-medium mb-1">Recomendación:</p>
                          <p>{quota.recommendation}</p>
                        </div>

                        {quota.requiresCertificate && (
                          <p className="text-xs text-gray-600 mt-2">
                            📄 Certificado requerido: {quota.requiresCertificate}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <InformationCircleIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No se encontraron contingentes para este producto</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Se aplicará el arancel NMF (Nación Más Favorecida)
                    </p>
                  </div>
                )}
              </>
            )}

            {!availability && (
              <div className="bg-gray-50 rounded-lg p-12 text-center h-full flex flex-col justify-center">
                <ChartBarIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">
                  Complete el formulario para verificar contingentes disponibles
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lista de todos los contingentes */}
      {selectedTab === 'list' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-12 w-12 mx-auto border-4 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-500">Cargando contingentes...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilización</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotas.map((quota) => (
                    <tr key={quota.quotaId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {quota.orderNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {quota.description}
                        {quota.agreement && (
                          <div className="text-xs text-gray-500">{quota.agreement}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {quota.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className={`h-2 rounded-full ${
                                quota.volume.utilizationPercent >= 95 ? 'bg-red-500' :
                                quota.volume.utilizationPercent >= 80 ? 'bg-orange-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(quota.volume.utilizationPercent, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-700">{quota.volume.utilizationPercent}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(quota.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Contingentes Críticos */}
      {selectedTab === 'critical' && (
        <div>
          {loading ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="animate-spin h-12 w-12 mx-auto border-4 border-orange-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-500">Cargando contingentes críticos...</p>
            </div>
          ) : critical.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {critical.map((quota) => (
                <div key={quota.quotaId} className="bg-white rounded-lg shadow-md border-2 border-orange-500 p-6">
                  <div className="flex items-start mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6 text-orange-600 mr-3 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{quota.description}</h3>
                      <p className="text-sm text-gray-600">Orden: {quota.orderNumber}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getUtilizationColor(quota.utilizationPercent)}`}>
                      {quota.utilizationPercent}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Disponible:</span>
                      <span className="font-medium">{quota.available.toLocaleString()} {quota.unit}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Agotamiento estimado:</span>
                      <span className="font-medium text-orange-600">{quota.estimatedExhaustion}</span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-orange-50 rounded-md">
                    <p className="text-xs text-orange-800">
                      ⚠️ Solicite reserva urgente para garantizar disponibilidad
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <CheckCircleIcon className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <p className="text-gray-600">No hay contingentes en estado crítico</p>
              <p className="text-sm text-gray-500 mt-2">
                Todos los contingentes activos tienen disponibilidad adecuada
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
