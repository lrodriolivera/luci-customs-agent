import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GlobeAltIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  ArrowUpTrayIcon,
  SignalIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import api from '../../services/api';

const NL_CUSTOMS_OFFICES = [
  { code: 'NL000396', name: 'Amsterdam' },
  { code: 'NL000297', name: 'Rotterdam Haven' },
  { code: 'NL000251', name: 'Rotterdam Rijnmond' },
  { code: 'NL000399', name: 'Schiphol' },
  { code: 'NL000440', name: 'Eindhoven' },
  { code: 'NL000447', name: 'Maastricht' },
  { code: 'NL000460', name: 'Groningen' },
  { code: 'NL000231', name: 'Breda' },
  { code: 'NL000441', name: 'Heerlen' },
  { code: 'NL000448', name: 'Venlo' },
];

const NLExpeditionPanel = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [certStatus, setCertStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [healthRes, correctionsRes, certRes] = await Promise.allSettled([
        api.get('/api/declarations/nl/monitor/health'),
        api.get('/api/declarations/corrections/pending'),
        api.get('/api/certificates/NL/status')
      ]);

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data?.data);
      if (correctionsRes.status === 'fulfilled') setCorrections(correctionsRes.value.data?.data || []);
      if (certRes.status === 'fulfilled') setCertStatus(certRes.value.data);
    } catch (err) {
      console.error('NL Panel load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational': return 'text-green-600 bg-green-100';
      case 'configured': return 'text-green-600 bg-green-100';
      case 'unavailable': return 'text-red-600 bg-red-100';
      case 'not_configured': return 'text-amber-600 bg-amber-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getDaysUntilDeadline = (deadline) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">NL</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Panel Aduanas Paises Bajos</h2>
            <p className="text-sm text-gray-500">DMS 4.0 / DECO - Douane Management Systeem</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DECO */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">DECO</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health?.systems?.deco?.status)}`}>
              {health?.systems?.deco?.status || 'desconocido'}
            </span>
          </div>
          <p className="text-xs text-gray-500">E-commerce (H7, valores bajos)</p>
          {health?.systems?.deco?.responseTime > 0 && (
            <p className="text-xs text-gray-400 mt-1">{health.systems.deco.responseTime}ms</p>
          )}
        </div>

        {/* DMS */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">DMS 4.0</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health?.systems?.dms?.status)}`}>
              {health?.systems?.dms?.status || 'desconocido'}
            </span>
          </div>
          <p className="text-xs text-gray-500">Importacion/Exportacion estandar (H1)</p>
        </div>

        {/* Digipoort */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Digipoort</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health?.systems?.digipoort?.status)}`}>
              {health?.systems?.digipoort?.status || 'desconocido'}
            </span>
          </div>
          <p className="text-xs text-gray-500">Canal de comunicacion con Douane</p>
          {health?.systems?.digipoort?.certificate && (
            <p className="text-xs text-gray-400 mt-1">Cert: {health.systems.digipoort.certificate}</p>
          )}
        </div>
      </div>

      {/* Certificate + EORI Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-violet-600" />
          Configuracion NL
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            {certStatus?.status === 'configured' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
            )}
            <div>
              <span className="text-sm font-medium text-gray-700">Certificado PKIoverheid</span>
              <p className="text-xs text-gray-500">
                {certStatus?.status === 'configured' ? 'Configurado' : 'No configurado'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SignalIcon className="h-5 w-5 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700">Entorno</span>
              <p className="text-xs text-gray-500">
                {health?.systems?.deco?.environment || 'test'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GlobeAltIcon className="h-5 w-5 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700">Declaraciones rastreadas</span>
              <p className="text-xs text-gray-500">
                {health?.tracking?.pending || 0} pendientes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Acciones rapidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a
            href="/expeditions/new?country=NL&type=H7"
            className="flex flex-col items-center gap-2 p-4 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors text-center"
          >
            <DocumentTextIcon className="h-6 w-6 text-violet-600" />
            <span className="text-sm font-medium text-violet-700">Crear H7 (DECO)</span>
            <span className="text-xs text-violet-500">Valor bajo, e-commerce</span>
          </a>
          <a
            href="/expeditions/new?country=NL&type=H1"
            className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center"
          >
            <DocumentTextIcon className="h-6 w-6 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Crear H1 (DMS)</span>
            <span className="text-xs text-blue-500">Importacion estandar</span>
          </a>
          <a
            href="/expeditions/new?country=NL&type=H7&batch=true"
            className="flex flex-col items-center gap-2 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-center"
          >
            <ArrowUpTrayIcon className="h-6 w-6 text-green-600" />
            <span className="text-sm font-medium text-green-700">Batch DECO</span>
            <span className="text-xs text-green-500">CSV/Excel masivo</span>
          </a>
          <a
            href="/channels"
            className="flex flex-col items-center gap-2 p-4 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors text-center"
          >
            <TruckIcon className="h-6 w-6 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">Estado CVB</span>
            <span className="text-xs text-amber-500">Container Release</span>
          </a>
        </div>
      </div>

      {/* Maritime Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-amber-800">Importaciones maritimas</h4>
            <p className="text-sm text-amber-700 mt-1">
              Se requiere Container Release Message (CVB) para importaciones maritimas al puerto de Rotterdam o Amsterdam.
              Solicite el CVB antes de enviar la declaracion H1 por DMS.
            </p>
          </div>
        </div>
      </div>

      {/* Pending Corrections */}
      {corrections.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
            Correcciones pendientes ({corrections.length})
          </h3>
          <div className="space-y-3">
            {corrections.map((correction, idx) => {
              const days = getDaysUntilDeadline(correction.deadline);
              const isUrgent = days !== null && days <= 2;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${isUrgent ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {correction.expeditionId || correction.mrn}
                      </span>
                      {correction.errorCode && (
                        <span className="ml-2 text-xs text-gray-500">Codigo: {correction.errorCode}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {days !== null && (
                        <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-red-700' : 'text-amber-700'}`}>
                          <ClockIcon className="h-3.5 w-3.5" />
                          {days <= 0 ? 'VENCIDO' : `${days} dias`}
                        </span>
                      )}
                      <a
                        href={`/expeditions/${correction.expeditionId}`}
                        className="px-2 py-1 text-xs bg-violet-100 text-violet-700 rounded hover:bg-violet-200"
                      >
                        Corregir
                      </a>
                    </div>
                  </div>
                  {correction.description && (
                    <p className="text-xs text-gray-600 mt-1">{correction.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tracked Declarations */}
      {health?.tracking?.declarations?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Declaraciones en seguimiento</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">MRN</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Desde</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Checks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {health.tracking.declarations.map((decl, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm font-mono text-gray-900">{decl.mrn}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        decl.status === 'ACCEPTED' || decl.status === 'RELEASED'
                          ? 'bg-green-100 text-green-700'
                          : decl.status === 'REJECTED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {decl.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {decl.trackedSince ? new Date(decl.trackedSince).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">{decl.checks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default NLExpeditionPanel;
