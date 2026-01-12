import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { expeditionsAPI } from '../../services/api'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

export default function ExpeditionList() {
  const [expeditions, setExpeditions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    operationType: ''
  })

  const fetchExpeditions = async () => {
    setLoading(true)
    try {
      // Only send non-empty filter values
      const params = {}
      if (filters.search) params.search = filters.search
      if (filters.status) params.status = filters.status
      if (filters.operationType) params.operationType = filters.operationType

      const response = await expeditionsAPI.list(params)
      // Handle backend response format: { success, data: { expeditions } }
      const expeditionsData = response.data?.data?.expeditions || response.data?.expeditions || []
      setExpeditions(expeditionsData)
    } catch (error) {
      console.error('Error fetching expeditions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpeditions()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchExpeditions()
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'draft': { label: 'Borrador', class: 'bg-gray-100 text-gray-800' },
      'pending_documents': { label: 'Pendiente Docs', class: 'bg-yellow-100 text-yellow-800' },
      'documents_received': { label: 'Docs Recibidos', class: 'bg-blue-100 text-blue-800' },
      'validating_documents': { label: 'Validando', class: 'bg-purple-100 text-purple-800' },
      'documents_validated': { label: 'Docs Validados', class: 'bg-indigo-100 text-indigo-800' },
      'ready_for_declaration': { label: 'Listo Declaracion', class: 'bg-cyan-100 text-cyan-800' },
      'declaration_submitted': { label: 'Presentada', class: 'bg-orange-100 text-orange-800' },
      'green_channel': { label: 'Canal Verde', class: 'bg-green-100 text-green-800' },
      'orange_channel': { label: 'Canal Naranja', class: 'bg-orange-100 text-orange-800' },
      'red_channel': { label: 'Canal Rojo', class: 'bg-red-100 text-red-800' },
      'completed': { label: 'Completado', class: 'bg-green-100 text-green-800' },
      'cancelled': { label: 'Cancelado', class: 'bg-gray-100 text-gray-800' }
    }
    const config = statusMap[status] || { label: status, class: 'bg-gray-100 text-gray-800' }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>{config.label}</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expedientes</h1>
          <p className="text-gray-500 mt-1">Gestiona expedientes de importacion/exportacion</p>
        </div>
        <Link to="/expeditions/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Nuevo Expediente
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por ID, cliente..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input pl-10"
              />
            </div>
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input w-auto"
          >
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="pending_documents">Pendiente Docs</option>
            <option value="documents_received">Docs Recibidos</option>
            <option value="validating_documents">Validando</option>
            <option value="ready_for_declaration">Listo Declaracion</option>
            <option value="completed">Completado</option>
          </select>

          <select
            value={filters.operationType}
            onChange={(e) => setFilters({ ...filters, operationType: e.target.value })}
            className="input w-auto"
          >
            <option value="">Todos los tipos</option>
            <option value="import">Importacion</option>
            <option value="export">Exportacion</option>
          </select>

          <button type="submit" className="btn-secondary flex items-center gap-2">
            <FunnelIcon className="w-5 h-5" />
            Filtrar
          </button>

          <button
            type="button"
            onClick={fetchExpeditions}
            className="btn-secondary"
            title="Actualizar"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci"></div>
          </div>
        ) : expeditions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No se encontraron expedientes</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID Expediente</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Origen/Destino</th>
                  <th>Estado</th>
                  <th>Documentos</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {expeditions.map((exp) => (
                  <tr key={exp._id} className="hover:bg-gray-50">
                    <td className="font-medium text-luci">{exp.expeditionId}</td>
                    <td>
                      <div>
                        <p className="font-medium">{exp.client?.companyName || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{exp.client?.nif || ''}</p>
                      </div>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${exp.operationType === 'import' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {exp.operationType === 'import' ? 'Importacion' : 'Exportacion'}
                      </span>
                    </td>
                    <td>
                      {exp.operationType === 'import'
                        ? exp.exporter?.country || 'N/A'
                        : exp.consignee?.address?.country || 'N/A'
                      }
                    </td>
                    <td>{getStatusBadge(exp.status)}</td>
                    <td>
                      <span className="text-sm">
                        {exp.documents?.length || 0} doc(s)
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">
                      {new Date(exp.createdAt).toLocaleDateString('es-ES')}
                    </td>
                    <td>
                      <Link
                        to={`/expeditions/${exp._id}`}
                        className="text-luci hover:text-luci-dark text-sm font-medium"
                      >
                        Ver Detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
