/**
 * Workflow Manager Component
 * Gestion visual de workflows automatizados
 * Fase 6.6 - LUCI Customs Agent
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// ==================== Workflow List Component ====================

const WorkflowList = ({ workflows, onSelect, onToggle, onDelete }) => {
  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      draft: 'bg-gray-100 text-gray-800',
      paused: 'bg-yellow-100 text-yellow-800',
      archived: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      import: '📦',
      export: '🚢',
      transit: '🚛',
      requirement: '📋',
      notification: '🔔',
      compliance: '✅',
      integration: '🔗',
      custom: '⚙️'
    };
    return icons[category] || '📄';
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Workflows</h3>
      </div>
      <ul className="divide-y divide-gray-200">
        {workflows.map(workflow => (
          <li key={workflow._id} className="hover:bg-gray-50">
            <div className="px-4 py-4 flex items-center justify-between">
              <div className="flex items-center flex-1 min-w-0">
                <span className="text-2xl mr-3">{getCategoryIcon(workflow.category)}</span>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onSelect(workflow)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate block text-left"
                  >
                    {workflow.name}
                  </button>
                  <p className="text-sm text-gray-500 truncate">
                    {workflow.description || 'Sin descripcion'}
                  </p>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(workflow.status)}`}>
                      {workflow.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {workflow.stats?.totalExecutions || 0} ejecuciones
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => onToggle(workflow._id, !workflow.enabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    workflow.enabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      workflow.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <button
                  onClick={() => onDelete(workflow._id)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        ))}
        {workflows.length === 0 && (
          <li className="px-4 py-8 text-center text-gray-500">
            No hay workflows configurados
          </li>
        )}
      </ul>
    </div>
  );
};

// ==================== Workflow Stats Component ====================

const WorkflowStats = ({ stats }) => {
  if (!stats) return null;

  const statItems = [
    { label: 'Total Workflows', value: stats.workflows?.totalWorkflows || 0, color: 'blue' },
    { label: 'Activos', value: stats.workflows?.activeWorkflows || 0, color: 'green' },
    { label: 'Ejecuciones', value: stats.executions?.total || 0, color: 'purple' },
    { label: 'Exitosas', value: stats.executions?.completed || 0, color: 'green' },
    { label: 'Fallidas', value: stats.executions?.failed || 0, color: 'red' },
    { label: 'En Progreso', value: stats.running || 0, color: 'yellow' }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {statItems.map((item, index) => (
        <div key={index} className="bg-white rounded-lg shadow p-4">
          <p className="text-sm font-medium text-gray-500">{item.label}</p>
          <p className={`text-2xl font-bold text-${item.color}-600`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
};

// ==================== Workflow Detail Modal ====================

const WorkflowDetail = ({ workflow, onClose, onExecute }) => {
  if (!workflow) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{workflow.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Info basica */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Descripcion</h3>
            <p className="mt-1 text-gray-900">{workflow.description || 'Sin descripcion'}</p>
          </div>

          {/* Trigger */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Trigger</h3>
            <div className="mt-1 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">{workflow.trigger?.type?.toUpperCase()}</p>
              {workflow.trigger?.event && (
                <p className="text-sm text-gray-600">Evento: {workflow.trigger.event}</p>
              )}
              {workflow.trigger?.schedule?.cron && (
                <p className="text-sm text-gray-600">Cron: {workflow.trigger.schedule.cron}</p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Acciones ({workflow.actions?.length || 0})</h3>
            <ul className="mt-2 space-y-2">
              {workflow.actions?.map((action, index) => (
                <li key={index} className="flex items-center p-2 bg-gray-50 rounded">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-3">
                    {action.order}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{action.name || action.type}</p>
                    <p className="text-xs text-gray-500">{action.type}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Estadisticas */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Estadisticas</h3>
            <div className="mt-2 grid grid-cols-3 gap-4">
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-xl font-bold">{workflow.stats?.totalExecutions || 0}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded">
                <p className="text-xl font-bold text-green-600">{workflow.stats?.successfulExecutions || 0}</p>
                <p className="text-xs text-gray-500">Exitosas</p>
              </div>
              <div className="text-center p-2 bg-red-50 rounded">
                <p className="text-xl font-bold text-red-600">{workflow.stats?.failedExecutions || 0}</p>
                <p className="text-xs text-gray-500">Fallidas</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cerrar
          </button>
          <button
            onClick={() => onExecute(workflow._id)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Ejecutar Ahora
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== Create Workflow Modal ====================

const CreateWorkflowModal = ({ templates, events, actions, onClose, onCreate }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'custom',
    trigger: { type: 'event', event: '' },
    actions: []
  });

  const handleTemplateSelect = (template) => {
    setFormData({
      ...formData,
      name: template.name,
      description: template.description,
      category: template.category,
      trigger: template.trigger,
      actions: template.actions
    });
    setStep(3);
  };

  const handleCreate = () => {
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Crear Workflow</h2>
          <div className="flex mt-4 space-x-4">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`flex-1 h-2 rounded ${step >= s ? 'bg-blue-600' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-4">
          {/* Step 1: Elegir plantilla o empezar de cero */}
          {step === 1 && (
            <div>
              <h3 className="text-lg font-medium mb-4">Elegir plantilla</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-500"
                >
                  <span className="text-3xl">➕</span>
                  <p className="mt-2 font-medium">Empezar de cero</p>
                  <p className="text-sm text-gray-500">Crear workflow personalizado</p>
                </button>
                {templates?.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="p-4 border border-gray-200 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50"
                  >
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Configuracion basica */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium mb-4">Configuracion basica</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Mi Workflow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Descripcion</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Descripcion del workflow..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Categoria</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="import">Importacion</option>
                  <option value="export">Exportacion</option>
                  <option value="transit">Transito</option>
                  <option value="requirement">Requerimientos</option>
                  <option value="notification">Notificaciones</option>
                  <option value="compliance">Cumplimiento</option>
                  <option value="integration">Integraciones</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de Trigger</label>
                <select
                  value={formData.trigger.type}
                  onChange={(e) => setFormData({
                    ...formData,
                    trigger: { ...formData.trigger, type: e.target.value }
                  })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="event">Evento</option>
                  <option value="schedule">Programado</option>
                  <option value="manual">Manual</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
              {formData.trigger.type === 'event' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Evento</label>
                  <select
                    value={formData.trigger.event}
                    onChange={(e) => setFormData({
                      ...formData,
                      trigger: { ...formData.trigger, event: e.target.value }
                    })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccionar evento...</option>
                    {events?.map(group => (
                      <optgroup key={group.category} label={group.category}>
                        {group.events.map(event => (
                          <option key={event.name} value={event.name}>
                            {event.description}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Revision y crear */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium mb-4">Revisar y crear</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Nombre:</dt>
                    <dd className="text-sm font-medium">{formData.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Categoria:</dt>
                    <dd className="text-sm font-medium">{formData.category}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Trigger:</dt>
                    <dd className="text-sm font-medium">{formData.trigger.type} - {formData.trigger.event}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Acciones:</dt>
                    <dd className="text-sm font-medium">{formData.actions?.length || 0}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={step > 1 ? () => setStep(step - 1) : onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {step > 1 ? 'Atras' : 'Cancelar'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && !formData.name}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
            >
              Crear Workflow
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== Main Component ====================

const WorkflowManager = () => {
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState([]);
  const [stats, setStats] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [events, setEvents] = useState([]);
  const [actions, setActions] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [workflowsRes, statsRes, templatesRes, eventsRes, actionsRes] = await Promise.all([
        fetch(`${API_BASE}/workflows`, { headers }),
        fetch(`${API_BASE}/workflows/stats`, { headers }),
        fetch(`${API_BASE}/workflows/templates`, { headers }),
        fetch(`${API_BASE}/workflows/events`, { headers }),
        fetch(`${API_BASE}/workflows/actions`, { headers })
      ]);

      const [workflowsData, statsData, templatesData, eventsData, actionsData] = await Promise.all([
        workflowsRes.json(),
        statsRes.json(),
        templatesRes.json(),
        eventsRes.json(),
        actionsRes.json()
      ]);

      if (workflowsData.success) setWorkflows(workflowsData.data);
      if (statsData.success) setStats(statsData.data);
      if (templatesData.success) setTemplates(templatesData.data);
      if (eventsData.success) setEvents(eventsData.data);
      if (actionsData.success) setActions(actionsData.data);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id, enabled) => {
    try {
      const res = await fetch(`${API_BASE}/workflows/${id}/toggle`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Estas seguro de eliminar este workflow?')) return;

    try {
      const res = await fetch(`${API_BASE}/workflows/${id}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExecute = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/workflows/${id}/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        alert(`Workflow ejecutado: ${data.data.executionId}`);
        setSelectedWorkflow(null);
        loadData();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreate = async (formData) => {
    try {
      const res = await fetch(`${API_BASE}/workflows`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        loadData();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('workflows.title')}</h1>
          <p className="text-gray-500">{t('workflows.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('workflows.newWorkflow')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">Cerrar</button>
        </div>
      )}

      {/* Stats */}
      <WorkflowStats stats={stats} />

      {/* Workflow List */}
      <WorkflowList
        workflows={workflows}
        onSelect={setSelectedWorkflow}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />

      {/* Detail Modal */}
      {selectedWorkflow && (
        <WorkflowDetail
          workflow={selectedWorkflow}
          onClose={() => setSelectedWorkflow(null)}
          onExecute={handleExecute}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateWorkflowModal
          templates={templates}
          events={events}
          actions={actions}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default WorkflowManager;
