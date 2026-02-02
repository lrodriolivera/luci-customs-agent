/**
 * Portal Statistics Component
 * Phase 6.7: Portal Cliente Avanzado
 * Shows client statistics and expedition history
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  RefreshCw,
  ChevronRight,
  Calendar,
  Truck,
  Ship,
  Plane
} from 'lucide-react';
import { portalAPI } from '../../services/api';

const PortalStats = ({ token }) => {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState({ expeditions: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyPage, setHistoryPage] = useState(0);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, historyRes] = await Promise.all([
        portalAPI.getStats(token),
        portalAPI.getHistory(token, { limit: 10 })
      ]);

      setStats(statsRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      setError('Error al cargar estadisticas');
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreHistory = async () => {
    try {
      const skip = (historyPage + 1) * 10;
      const res = await portalAPI.getHistory(token, { limit: 10, skip });
      setHistory(prev => ({
        ...res.data,
        expeditions: [...prev.expeditions, ...res.data.expeditions]
      }));
      setHistoryPage(historyPage + 1);
    } catch (err) {
      console.error('Error loading more history:', err);
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'gray',
      pending_documents: 'yellow',
      documents_received: 'blue',
      validating_documents: 'blue',
      declaration_submitted: 'indigo',
      green_channel: 'green',
      orange_channel: 'orange',
      red_channel: 'red',
      levante: 'green',
      completed: 'green'
    };
    return colors[status] || 'gray';
  };

  const getStatusText = (status) => {
    const texts = {
      draft: 'Borrador',
      pending_documents: 'Pendiente Docs',
      documents_received: 'Docs Recibidos',
      validating_documents: 'Validando',
      declaration_submitted: 'DUA Enviado',
      green_channel: 'Canal Verde',
      orange_channel: 'Canal Naranja',
      red_channel: 'Canal Rojo',
      levante: 'Levante',
      completed: 'Completado'
    };
    return texts[status] || status;
  };

  const getOperationIcon = (type) => {
    switch (type) {
      case 'import':
        return <Package className="w-4 h-4" />;
      case 'export':
        return <Truck className="w-4 h-4" />;
      case 'transit':
        return <Ship className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
        <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500">
        <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>No hay estadisticas disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Expedientes</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.summary?.totalExpeditions || 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Completados</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.summary?.completedExpeditions || 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En Proceso</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.summary?.pendingExpeditions || 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tiempo Medio</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.summary?.avgProcessingDays || 0}d
              </p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      {stats.financial && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-600" />
            Resumen Financiero
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Total Derechos</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(stats.financial.totalDuties)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Total IVA</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(stats.financial.totalVat)}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-700 mb-1">Total Pagado</p>
              <p className="text-xl font-bold text-green-700">
                {formatCurrency(stats.financial.totalPaid)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Channel Analysis */}
      {stats.channelAnalysis && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Analisis de Canales
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Green channel rate */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Tasa Canal Verde</span>
                <span className="font-bold text-green-600">
                  {stats.channelAnalysis.greenChannelRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full"
                  style={{ width: `${stats.channelAnalysis.greenChannelRate}%` }}
                />
              </div>
            </div>

            {/* Channel breakdown */}
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
                  <span className="text-green-600 font-bold">{stats.byChannel?.green || 0}</span>
                </div>
                <span className="text-xs text-gray-500">Verde</span>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-1">
                  <span className="text-orange-600 font-bold">{stats.byChannel?.orange || 0}</span>
                </div>
                <span className="text-xs text-gray-500">Naranja</span>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-1">
                  <span className="text-red-600 font-bold">{stats.byChannel?.red || 0}</span>
                </div>
                <span className="text-xs text-gray-500">Rojo</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Volume Chart */}
      {stats.monthlyVolume && stats.monthlyVolume.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-gray-600" />
            Volumen Mensual
          </h2>

          <div className="flex items-end space-x-2 h-32">
            {stats.monthlyVolume.slice(0, 6).reverse().map((month, idx) => {
              const maxCount = Math.max(...stats.monthlyVolume.map(m => m.count));
              const height = maxCount > 0 ? (month.count / maxCount) * 100 : 0;

              return (
                <div key={month.month} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${height}%`, minHeight: month.count > 0 ? '4px' : '0' }}
                  />
                  <span className="text-xs text-gray-500 mt-1">
                    {month.month.split('-')[1]}
                  </span>
                  <span className="text-xs font-medium">{month.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Expeditions */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Historial de Expedientes
        </h2>

        {history.expeditions.length > 0 ? (
          <div className="space-y-3">
            {history.expeditions.map((exp) => (
              <div
                key={exp.expeditionId}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                    {getOperationIcon(exp.operationType)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{exp.expeditionId}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(exp.createdAt)}
                      {exp.mrn && ` • MRN: ${exp.mrn}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${getStatusColor(exp.status)}-100 text-${getStatusColor(exp.status)}-700`}>
                    {getStatusText(exp.status)}
                  </span>
                  {exp.channel && (
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full bg-${getStatusColor(exp.channel + '_channel')}-100 text-${getStatusColor(exp.channel + '_channel')}-700`}>
                      {exp.channel}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {history.hasMore && (
              <button
                onClick={loadMoreHistory}
                className="w-full py-2 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center justify-center"
              >
                Cargar mas
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No hay expedientes anteriores</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalStats;
