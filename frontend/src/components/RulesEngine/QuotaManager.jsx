/**
 * Contingentes arancelarios (TRQ) sobre el catalogo oficial de la Comision.
 *
 * QUE PINTABA ANTES ESTA PANTALLA
 * -------------------------------
 * Los campos que consumia (`quota.duty.inQuota`, `quota.duty.outQuota`,
 * `quota.duty.savings`, `quota.volume.total`, `quota.volume.available`,
 * `quota.agreement`, `quota.status`, `quota.estimatedExhaustion`) venian de un
 * catalogo de 11 contingentes escritos a mano en el backend, del que 10 numeros
 * de orden no existen en la base de la Comision. De ahi salia un "Ahorro
 * Estimado" en euros calculado sobre un tipo cableado a 0,00.
 *
 * Lo que se muestra ahora sale del catalogo sincronizado con la fuente oficial:
 *  - El saldo va SIEMPRE con la fecha en que se consulto, y se avisa cuando ya
 *    esta caducado: un contingente de reparto simultaneo (FCFS) se agota en
 *    horas, asi que un saldo de ayer no es disponibilidad de hoy.
 *  - No se muestra ahorro. El tipo dentro del contingente no lo publica el
 *    sistema de contingentes, esta en la medida de TARIC del codigo y el origen
 *    concretos.
 *  - "Disponible" pasa a ser un dato de tres estados: el saldo puede venir en
 *    otra unidad (hay contingentes en EURO o en metros cubicos) y entonces no se
 *    puede comparar con la cantidad pedida. Antes ese caso se pintaba "Agotado".
 *  - Se dice que la elegibilidad por origen no esta resuelta, y no se ofrece
 *    ninguna "reserva": el cupo lo atribuye la aduana al aceptar la declaracion.
 */
import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { countriesGrouped } from '../../data/countries'
import api from '../../services/api'
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

const POR_PAGINA = 25

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('es-ES') : '—')

const fecha = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('es-ES')
}

/** Cantidad con su unidad tal como la publica la fuente ("27.624.751,3 Kilogram"). */
const conUnidad = (cantidad, unidad) => {
  if (typeof cantidad?.amount === 'number') return `${numero(cantidad.amount)} ${cantidad.unit || ''}`.trim()
  if (typeof cantidad === 'number') return `${numero(cantidad)} ${unidad || ''}`.trim()
  return '—'
}

export default function QuotaManager() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [quotas, setQuotas] = useState([])
  const [listado, setListado] = useState({ total: 0, page: 1, synced: true, lastSyncAt: null })
  const [critical, setCritical] = useState([])
  const [availability, setAvailability] = useState(null)
  const [selectedTab, setSelectedTab] = useState('search')
  const [pagina, setPagina] = useState(1)
  const [formData, setFormData] = useState({
    taricCode: '',
    originCountry: 'AR',
    quantity: '',
    unit: 'kg'
  })

  useEffect(() => {
    if (selectedTab === 'list') {
      fetchAllQuotas(pagina)
    } else if (selectedTab === 'critical') {
      fetchCriticalQuotas()
    }
  }, [selectedTab, pagina])

  // La fuente publica del orden de 1.100 contingentes por ano: el listado va
  // paginado y el total viaja en la respuesta para no dar por completa una
  // primera pagina.
  const fetchAllQuotas = async (page) => {
    setLoading(true)
    try {
      const response = await api.get(`/api/quotas/list?page=${page}&limit=${POR_PAGINA}`)
      const data = response.data

      if (data.success) {
        setQuotas(data.data.quotas)
        setListado({
          total: data.data.total,
          page: data.data.page,
          synced: data.data.synced,
          lastSyncAt: data.data.lastSyncAt
        })
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
      const response = await api.get('/api/quotas/critical')
      const data = response.data

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
      const response = await api.post('/api/quotas/check-availability', {
        taricCode: formData.taricCode,
        originCountry: formData.originCountry,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit
      })

      const data = response.data

      if (data.success) {
        setAvailability(data.data)
        if (data.data.found && data.data.count > 0) {
          toast.success(`${data.data.count} contingente(s) en el catálogo`)
        } else {
          toast('El catálogo sincronizado no tiene contingente para este código')
        }
      } else {
        toast.error(data.error || 'Error al consultar contingentes')
      }
    } catch (error) {
      console.error('Error checking availability:', error)
      toast.error('Error al consultar contingentes')
    } finally {
      setChecking(false)
    }
  }

  const countries = countriesGrouped.flatMap(g => g.countries.map(c => ({ code: c.code, name: c.label || c.name })))

  /**
   * Estado del saldo frente a la cantidad pedida. `null` es un estado propio:
   * significa que no se ha podido comparar, no que este agotado.
   */
  const badgeSaldo = (available) => {
    if (available === true) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Saldo suficiente</span>
    }
    if (available === false) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Saldo insuficiente</span>
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Saldo sin comprobar</span>
  }

  /** Barra de consumo. Si la fuente no da el porcentaje, no se dibuja una al azar. */
  const barraConsumo = (percent) => {
    if (typeof percent !== 'number') {
      return <p className="text-xs text-gray-500">La fuente no publica el porcentaje de consumo de este contingente.</p>
    }
    return (
      <>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Consumo publicado:</span>
          <span className="font-medium">{percent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              percent >= 95 ? 'bg-red-500' : percent >= 80 ? 'bg-orange-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </>
    )
  }

  /** Fecha del saldo + aviso si ya esta caducado. */
  const avisoSaldo = (volume) => {
    const consultado = fecha(volume?.syncedAt)
    return (
      <div className={`text-xs rounded px-2 py-1 mt-2 ${volume?.balanceStale ? 'text-amber-800 bg-amber-50' : 'text-gray-600 bg-gray-50'}`}>
        <ClockIcon className="h-4 w-4 inline mr-1 -mt-0.5" />
        {consultado
          ? `Saldo consultado el ${consultado}${volume?.balanceStale ? ' — ya no sirve para decidir' : ''}.`
          : 'El saldo no tiene fecha de consulta registrada.'}
        {' '}
        <a
          href={volume?.officialSource}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium"
        >
          Consultar el saldo oficial
        </a>{' '}
        antes de declarar: un contingente FCFS puede agotarse en horas.
      </div>
    )
  }

  const paginas = Math.max(1, Math.ceil((listado.total || 0) / POR_PAGINA))

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
            Buscar Contingentes
          </button>
          <button
            onClick={() => setSelectedTab('list')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'list'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Catálogo Oficial
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

      {/* Buscar contingentes */}
      {selectedTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div>
            <form onSubmit={handleCheckAvailability} className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Consultar el catálogo</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código TARIC *
                </label>
                <input
                  type="text"
                  value={formData.taricCode}
                  onChange={(e) => setFormData({ ...formData, taricCode: e.target.value })}
                  placeholder="ej. 0302410000 (arenques)"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo 6 dígitos: con menos se devolverían contingentes de otro producto.</p>
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
                    <option value="hl">Hectolitros (hl)</option>
                    <option value="l">Litros (l)</option>
                    <option value="t">Toneladas (t)</option>
                    <option value="ud">Unidades</option>
                  </select>
                </div>
              </div>

              {/* No se pide valor aduanero: el ahorro no se puede cifrar aqui. El
                  tipo dentro del contingente esta en la medida de TARIC del codigo
                  y el origen concretos, y el sistema de contingentes no lo publica.
                  El campo anterior alimentaba un "Ahorro Estimado" calculado sobre
                  un tipo cableado a 0,00. */}
              <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
                Esta consulta no calcula el ahorro: el tipo dentro del contingente
                figura en la medida de TARIC del código y el origen concretos, no en
                el sistema de contingentes.
              </p>

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
                    Consultando...
                  </>
                ) : (
                  <>
                    <ChartBarIcon className="h-5 w-5 mr-2" />
                    Consultar contingentes
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
                      <div key={quota.quotaId || idx} className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-sm text-gray-600">Número de orden</p>
                            <h3 className="font-semibold text-gray-900 text-lg">{quota.orderNumber}</h3>
                            {quota.period?.start && (
                              <p className="text-xs text-gray-500">
                                Periodo: {quota.period.start} — {quota.period.end}
                              </p>
                            )}
                          </div>
                          {badgeSaldo(quota.available)}
                        </div>

                        {/* Origenes: es el texto que publica la fuente, no una lista
                            de paises resuelta. */}
                        {quota.origins && (
                          <p className="text-sm text-gray-700 mb-4">
                            <span className="text-gray-500">Origen / descripción de la fuente:</span> {quota.origins}
                          </p>
                        )}

                        {/* Volumen */}
                        <div className="mb-4">
                          {barraConsumo(quota.volume?.utilizationPercent)}
                          <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>Saldo: {conUnidad(quota.volume?.balance)}</span>
                            <span>Volumen inicial: {conUnidad(quota.volume?.initial)}</span>
                          </div>
                          {avisoSaldo(quota.volume)}
                        </div>

                        {quota.unitMismatch && (
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-3 text-sm text-gray-700">
                            {quota.unitMismatch}
                          </div>
                        )}

                        {quota.critical && (
                          <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-3">
                            <div className="flex items-start">
                              <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 mr-2 flex-shrink-0" />
                              <p className="text-sm text-orange-800">
                                TARIC marca este contingente como crítico: puede agotarse
                                antes de que se admita la declaración.
                              </p>
                            </div>
                          </div>
                        )}

                        {quota.exhaustionDate && (
                          <p className="text-sm text-red-700 mb-3">
                            Fecha de agotamiento publicada: {quota.exhaustionDate}
                          </p>
                        )}

                        {/* Recomendación */}
                        {quota.recommendation && (
                          <div className="text-sm text-gray-700 mb-3">
                            <p className="font-medium mb-1">Recomendación:</p>
                            <p>{quota.recommendation}</p>
                          </div>
                        )}

                        {/* Los avisos vienen del backend: la elegibilidad por origen no
                            esta resuelta y hay que decirlo aqui, no dar el contingente
                            por aplicable al pais consultado. */}
                        {quota.warnings?.length > 0 && (
                          <ul className="text-xs text-gray-600 space-y-1 border-t border-gray-100 pt-3">
                            {quota.warnings.map((w, i) => (
                              <li key={i}>• {w}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <InformationCircleIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">
                      El catálogo oficial sincronizado no tiene contingente para este código
                    </p>
                    {/* No es lo mismo que "no existe contingente": si el catalogo esta
                        sin sincronizar, la respuesta vacia no dice nada de la realidad. */}
                    <p className="text-sm text-gray-500 mt-2">
                      Confirmarlo en{' '}
                      <a
                        href={availability.officialSource}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        la consulta oficial de contingentes
                      </a>{' '}
                      antes de asumir que se aplica el arancel NMF.
                    </p>
                  </div>
                )}
              </>
            )}

            {!availability && (
              <div className="bg-gray-50 rounded-lg p-12 text-center h-full flex flex-col justify-center">
                <ChartBarIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">
                  Complete el formulario para consultar el catálogo de contingentes
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Catálogo oficial */}
      {selectedTab === 'list' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-12 w-12 mx-auto border-4 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-500">Cargando contingentes...</p>
            </div>
          ) : !listado.synced ? (
            /* Un catalogo vacio significa que no se ha sincronizado, no que la UE
               no tenga contingentes: la fuente publica ~1.100 por año. */
            <div className="p-12 text-center">
              <ExclamationTriangleIcon className="h-16 w-16 mx-auto text-amber-500 mb-4" />
              <p className="text-gray-700 font-medium">El catálogo de contingentes está sin sincronizar</p>
              <p className="text-sm text-gray-500 mt-2">
                No hay ningún contingente cargado. Esto no significa que no existan:
                hay que ejecutar la sincronización con la fuente oficial.
              </p>
            </div>
          ) : (
            <>
              <div className="px-6 py-3 bg-gray-50 text-sm text-gray-600 flex justify-between items-center">
                <span>{numero(listado.total)} contingentes en el catálogo</span>
                {listado.lastSyncAt && (
                  <span className="text-xs">Última sincronización: {fecha(listado.lastSyncAt)}</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origen / descripción</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consumo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {quotas.map((quota) => (
                      <tr key={quota.quotaId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {quota.orderNumber}
                          {quota.critical && (
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">
                              crítico
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate" title={quota.origins || ''}>
                          {quota.origins || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                          {quota.period?.start ? `${quota.period.start} — ${quota.period.end}` : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {typeof quota.volume?.utilizationPercent === 'number' ? (
                            <div className="flex items-center">
                              <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    quota.volume.utilizationPercent >= 95 ? 'bg-red-500'
                                      : quota.volume.utilizationPercent >= 80 ? 'bg-orange-500'
                                        : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(quota.volume.utilizationPercent, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-700">{quota.volume.utilizationPercent}%</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">sin dato</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {conUnidad(quota.volume?.balance)}
                          {quota.volume?.balanceStale && (
                            <span className="block text-xs text-amber-700">saldo caducado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 flex justify-between items-center border-t border-gray-200">
                <button
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-600">Página {listado.page} de {paginas}</span>
                <button
                  onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
                  disabled={pagina >= paginas}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </>
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
                      <h3 className="font-semibold text-gray-900">Orden {quota.orderNumber}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{quota.origins || '—'}</p>
                    </div>
                    {/* La criticidad la declara TARIC. No es funcion del porcentaje de
                        consumo: hay contingentes criticos al 17%. */}
                    {typeof quota.volume?.utilizationPercent === 'number' && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {quota.volume.utilizationPercent}% consumido
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Saldo publicado:</span>
                      <span className="font-medium">{conUnidad(quota.volume?.balance)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fecha de agotamiento:</span>
                      <span className="font-medium text-orange-600">
                        {quota.exhaustionDate || 'no publicada'}
                      </span>
                    </div>
                  </div>

                  {avisoSaldo(quota.volume)}

                  <div className="mt-3 p-3 bg-orange-50 rounded-md">
                    <p className="text-xs text-orange-800">
                      ⚠️ TARIC lo marca como crítico. No se puede reservar cupo: la
                      atribución la hace la aduana al aceptar la declaración.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <CheckCircleIcon className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <p className="text-gray-600">Ningún contingente del catálogo está marcado como crítico</p>
              <p className="text-sm text-gray-500 mt-2">
                Es lo que declara TARIC en la última sincronización, no una comprobación
                en vivo del saldo.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
