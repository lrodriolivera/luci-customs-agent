import React, { useState, useEffect } from 'react'
import { integrationsAPI } from '../../services/api'
import { useTranslation } from 'react-i18next'
import {
  CloudIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  BeakerIcon,
  ServerIcon,
  GlobeEuropeAfricaIcon,
  TruckIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
  ChartBarIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

const statusColors = {
  active: 'bg-green-100 text-green-800',
  simulation: 'bg-blue-100 text-blue-800',
  error: 'bg-red-100 text-red-800',
  inactive: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-yellow-100 text-yellow-800'
}

const statusIcons = {
  active: CheckCircleIcon,
  simulation: BeakerIcon,
  error: XCircleIcon,
  inactive: ServerIcon,
  maintenance: ExclamationTriangleIcon
}

const integrationIcons = {
  AEAT: DocumentCheckIcon,
  VUA: GlobeEuropeAfricaIcon,
  TRACES: ShieldCheckIcon,
  NCTS: TruckIcon
}

export default function IntegrationsManager() {
  const { t } = useTranslation()
  const [view, setView] = useState('dashboard')
  const [integrations, setIntegrations] = useState([])
  const [status, setStatus] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testingCode, setTestingCode] = useState(null)
  const [selectedIntegration, setSelectedIntegration] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [integrationsRes, statusRes, statsRes] = await Promise.all([
        integrationsAPI.list(),
        integrationsAPI.getStatus(),
        integrationsAPI.getStats()
      ])
      setIntegrations(integrationsRes.data.data || [])
      setStatus(statusRes.data.data || null)
      setStats(statsRes.data.data || null)
    } catch (error) {
      console.error('Error cargando integraciones:', error)
    } finally {
      setLoading(false)
    }
  }

  const testConnectivity = async (code) => {
    setTestingCode(code)
    try {
      const response = await integrationsAPI.testConnectivity(code)
      // Reload status after test
      const statusRes = await integrationsAPI.getStatus()
      setStatus(statusRes.data.data || null)
    } catch (error) {
      console.error('Error probando conectividad:', error)
    } finally {
      setTestingCode(null)
    }
  }

  const getStatusInfo = (code) => {
    if (!status?.integrations) return null
    return status.integrations[code]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-luci" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('integrations.title')}</h1>
          <p className="text-gray-600">{t('integrations.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('dashboard')}
            className={`px-4 py-2 rounded-lg ${view === 'dashboard' ? 'bg-luci text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setView('vua')}
            className={`px-4 py-2 rounded-lg ${view === 'vua' ? 'bg-luci text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            VUA
          </button>
          <button
            onClick={() => setView('traces')}
            className={`px-4 py-2 rounded-lg ${view === 'traces' ? 'bg-luci text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            TRACES
          </button>
          <button
            onClick={() => setView('ncts')}
            className={`px-4 py-2 rounded-lg ${view === 'ncts' ? 'bg-luci text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            NCTS
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <div className="space-y-6">
          {/* Status Summary */}
          {status?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Total</div>
                <div className="text-2xl font-bold">{status.summary.total}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Activas</div>
                <div className="text-2xl font-bold text-green-600">{status.summary.active}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Simulacion</div>
                <div className="text-2xl font-bold text-blue-600">{status.summary.simulation}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Error</div>
                <div className="text-2xl font-bold text-red-600">{status.summary.error}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Inactivas</div>
                <div className="text-2xl font-bold text-gray-600">{status.summary.inactive}</div>
              </div>
            </div>
          )}

          {/* Integrations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {integrations.map((integration) => {
              const statusInfo = getStatusInfo(integration.code)
              const StatusIcon = statusIcons[statusInfo?.status] || ServerIcon
              const IntegrationIcon = integrationIcons[integration.code] || CloudIcon

              return (
                <div
                  key={integration.code}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedIntegration(integration)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-luci-light rounded-lg flex items-center justify-center">
                          <IntegrationIcon className="w-6 h-6 text-luci" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{integration.code}</h3>
                          <p className="text-sm text-gray-600">{integration.name}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${statusColors[statusInfo?.status] || statusColors.inactive}`}>
                        <StatusIcon className="w-4 h-4" />
                        {statusInfo?.status || 'inactive'}
                      </span>
                    </div>

                    <p className="mt-4 text-sm text-gray-500">{integration.description}</p>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <div className="flex gap-4">
                        <span className="text-gray-500">
                          Pais: <span className="font-medium">{integration.country}</span>
                        </span>
                        <span className="text-gray-500">
                          Categoria: <span className="font-medium">{integration.category}</span>
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          testConnectivity(integration.code)
                        }}
                        disabled={testingCode === integration.code}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 flex items-center gap-1"
                      >
                        {testingCode === integration.code ? (
                          <>
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            Probando...
                          </>
                        ) : (
                          <>
                            <ArrowPathIcon className="w-4 h-4" />
                            Test
                          </>
                        )}
                      </button>
                    </div>

                    {statusInfo?.environment && (
                      <div className="mt-3 text-xs text-gray-400">
                        Ambiente: {statusInfo.environment}
                        {statusInfo.simulationMode && ' (Simulacion)'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Usage Stats */}
          {stats?.integrations && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-luci" />
                Estadisticas de Uso (Ultimos 30 dias)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Integracion</th>
                      <th className="text-right py-2">Llamadas</th>
                      <th className="text-right py-2">Exitosas</th>
                      <th className="text-right py-2">Errores</th>
                      <th className="text-right py-2">% Exito</th>
                      <th className="text-right py-2">Tiempo Resp. (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.integrations).map(([code, data]) => (
                      <tr key={code} className="border-b">
                        <td className="py-2 font-medium">{code}</td>
                        <td className="text-right py-2">{data.calls.toLocaleString()}</td>
                        <td className="text-right py-2 text-green-600">{data.success.toLocaleString()}</td>
                        <td className="text-right py-2 text-red-600">{data.errors}</td>
                        <td className="text-right py-2">
                          {((data.success / data.calls) * 100).toFixed(1)}%
                        </td>
                        <td className="text-right py-2">{data.avgResponseTime}s</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="py-2">Total</td>
                      <td className="text-right py-2">{stats.totals.calls.toLocaleString()}</td>
                      <td className="text-right py-2 text-green-600">{stats.totals.success.toLocaleString()}</td>
                      <td className="text-right py-2 text-red-600">{stats.totals.errors}</td>
                      <td className="text-right py-2">{stats.totals.successRate.toFixed(1)}%</td>
                      <td className="text-right py-2">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VUA View */}
      {view === 'vua' && <VUAPanel />}

      {/* TRACES View */}
      {view === 'traces' && <TRACESPanel />}

      {/* NCTS View */}
      {view === 'ncts' && <NCTSPanel />}

      {/* Integration Detail Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">{selectedIntegration.code} - {selectedIntegration.name}</h2>
              <button
                onClick={() => setSelectedIntegration(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Categoria</label>
                  <p className="font-medium">{selectedIntegration.category}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Pais/Region</label>
                  <p className="font-medium">{selectedIntegration.country}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Requerido</label>
                  <p className="font-medium">{selectedIntegration.required ? 'Si' : 'No'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Disponible</label>
                  <p className="font-medium">{selectedIntegration.available ? 'Si' : 'No'}</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Descripcion</label>
                <p className="font-medium">{selectedIntegration.description}</p>
              </div>
              {getStatusInfo(selectedIntegration.code) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Estado de Conexion</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-gray-500">Estado</label>
                      <p className="font-medium">{getStatusInfo(selectedIntegration.code).status}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">Ambiente</label>
                      <p className="font-medium">{getStatusInfo(selectedIntegration.code).environment}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">Modo Simulacion</label>
                      <p className="font-medium">{getStatusInfo(selectedIntegration.code).simulationMode ? 'Si' : 'No'}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">Ultima Verificacion</label>
                      <p className="font-medium">
                        {new Date(getStatusInfo(selectedIntegration.code).timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// VUA Panel Component
function VUAPanel() {
  const [services, setServices] = useState([])
  const [authorities, setAuthorities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVUAData()
  }, [])

  const loadVUAData = async () => {
    setLoading(true)
    try {
      const [servicesRes, authoritiesRes] = await Promise.all([
        integrationsAPI.vua.getServices(),
        integrationsAPI.vua.getAuthorities()
      ])
      setServices(servicesRes.data.data || [])
      setAuthorities(authoritiesRes.data.data || [])
    } catch (error) {
      console.error('Error cargando datos VUA:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32"><ArrowPathIcon className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <GlobeEuropeAfricaIcon className="w-5 h-5 text-luci" />
          Ventanilla Unica Aduanera
        </h2>
        <p className="text-gray-600 mb-4">
          La VUA permite la tramitacion electronica unificada de declaraciones aduaneras
          y controles paraduaneros con multiples autoridades.
        </p>

        <h3 className="font-semibold mt-6 mb-3">Servicios Disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((service) => (
            <div key={service.code} className="border rounded-lg p-4">
              <div className="font-medium">{service.name}</div>
              <div className="text-sm text-gray-500">{service.code}</div>
              <div className="text-xs text-gray-400 mt-1">
                Autoridades: {service.authorities?.join(', ')}
              </div>
            </div>
          ))}
        </div>

        <h3 className="font-semibold mt-6 mb-3">Autoridades Conectadas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {authorities.map((auth) => (
            <div key={auth.code} className="border rounded-lg p-4">
              <div className="font-medium">{auth.code}</div>
              <div className="text-sm text-gray-600">{auth.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// TRACES Panel Component
function TRACESPanel() {
  const [chedTypes, setChedTypes] = useState([])
  const [bcps, setBcps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTRACESData()
  }, [])

  const loadTRACESData = async () => {
    setLoading(true)
    try {
      const [typesRes, bcpsRes] = await Promise.all([
        integrationsAPI.traces.getCHEDTypes(),
        integrationsAPI.traces.getBCPs()
      ])
      setChedTypes(typesRes.data.data || [])
      setBcps(bcpsRes.data.data || [])
    } catch (error) {
      console.error('Error cargando datos TRACES:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32"><ArrowPathIcon className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ShieldCheckIcon className="w-5 h-5 text-luci" />
          TRACES NT - Control Sanitario UE
        </h2>
        <p className="text-gray-600 mb-4">
          Sistema de la Union Europea para control sanitario, veterinario y fitosanitario
          de importaciones de productos de origen animal y vegetal.
        </p>

        <h3 className="font-semibold mt-6 mb-3">Tipos de CHED</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {chedTypes.map((type) => (
            <div key={type.code} className="border rounded-lg p-4">
              <div className="font-medium">{type.code}</div>
              <div className="text-sm text-gray-600">{type.name}</div>
              <div className="text-xs text-gray-500 mt-1">{type.description}</div>
              <div className="text-xs text-gray-400 mt-1">
                Autoridad: {type.authority}
              </div>
            </div>
          ))}
        </div>

        <h3 className="font-semibold mt-6 mb-3">Puntos de Control Fronterizo (BCP)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Codigo</th>
                <th className="text-left py-2">Nombre</th>
                <th className="text-left py-2">Tipo</th>
                <th className="text-left py-2">Autoridades</th>
              </tr>
            </thead>
            <tbody>
              {bcps.slice(0, 10).map((bcp) => (
                <tr key={bcp.code} className="border-b">
                  <td className="py-2 font-mono">{bcp.code}</td>
                  <td className="py-2">{bcp.name}</td>
                  <td className="py-2">{bcp.type}</td>
                  <td className="py-2">{bcp.authorities?.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bcps.length > 10 && (
            <p className="text-sm text-gray-500 mt-2">... y {bcps.length - 10} mas</p>
          )}
        </div>
      </div>
    </div>
  )
}

// NCTS Panel Component
function NCTSPanel() {
  const [transitTypes, setTransitTypes] = useState([])
  const [guaranteeTypes, setGuaranteeTypes] = useState([])
  const [offices, setOffices] = useState({ departure: [], destination: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNCTSData()
  }, [])

  const loadNCTSData = async () => {
    setLoading(true)
    try {
      const [typesRes, guaranteesRes, officesRes] = await Promise.all([
        integrationsAPI.ncts.getTransitTypes(),
        integrationsAPI.ncts.getGuaranteeTypes(),
        integrationsAPI.ncts.getOffices()
      ])
      setTransitTypes(typesRes.data.data || [])
      setGuaranteeTypes(guaranteesRes.data.data || [])
      setOffices(officesRes.data.data || { departure: [], destination: [] })
    } catch (error) {
      console.error('Error cargando datos NCTS:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32"><ArrowPathIcon className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TruckIcon className="w-5 h-5 text-luci" />
          NCTS Phase 5 - Sistema de Transito UE
        </h2>
        <p className="text-gray-600 mb-4">
          Sistema informatizado para gestion de transitos comunitarios (T1, T2),
          transitos TIR y cuadernos ATA en la Union Europea.
        </p>

        <h3 className="font-semibold mt-6 mb-3">Tipos de Transito</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {transitTypes.map((type) => (
            <div key={type.code} className="border rounded-lg p-4">
              <div className="font-medium text-lg">{type.code}</div>
              <div className="text-sm text-gray-600">{type.name}</div>
              <div className="text-xs text-gray-500 mt-1">{type.description}</div>
              <div className="mt-2">
                {type.guaranteeRequired && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                    Requiere Garantia
                  </span>
                )}
                {type.carnetRequired && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded ml-1">
                    Requiere Carnet
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <h3 className="font-semibold mt-6 mb-3">Tipos de Garantia</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Codigo</th>
                <th className="text-left py-2">Nombre</th>
                <th className="text-left py-2">Descripcion</th>
              </tr>
            </thead>
            <tbody>
              {guaranteeTypes.slice(0, 8).map((type) => (
                <tr key={type.key} className="border-b">
                  <td className="py-2 font-mono">{type.code}</td>
                  <td className="py-2 font-medium">{type.name}</td>
                  <td className="py-2 text-gray-600">{type.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div>
            <h3 className="font-semibold mb-3">Aduanas de Salida (ES)</h3>
            <div className="space-y-2">
              {offices.departure?.slice(0, 5).map((office) => (
                <div key={office.code} className="text-sm border rounded p-2">
                  <span className="font-mono text-gray-500">{office.code}</span>
                  <span className="ml-2">{office.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Aduanas de Destino (UE)</h3>
            <div className="space-y-2">
              {offices.destination?.slice(0, 5).map((office) => (
                <div key={office.code} className="text-sm border rounded p-2">
                  <span className="font-mono text-gray-500">{office.code}</span>
                  <span className="ml-2">{office.name}</span>
                  <span className="text-xs text-gray-400 ml-1">({office.country})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
