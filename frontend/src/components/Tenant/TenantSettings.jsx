import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BuildingOfficeIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  BellIcon,
  GlobeAltIcon,
  KeyIcon,
  PaintBrushIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const TenantSettings = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [roles, setRoles] = useState([]);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Simulated data - replace with API calls
      setTenant({
        id: 'tenant-1',
        name: 'Agencia Aduanera Demo',
        slug: 'demo-agency',
        status: 'active',
        businessInfo: {
          type: 'customs_agent',
          nif: 'B12345678',
          eori: 'ES12345678901234',
          rea: '12345',
          address: {
            street: 'Calle Principal 123',
            city: 'Barcelona',
            postalCode: '08001',
            province: 'Barcelona',
            country: 'ES'
          }
        },
        subscription: {
          plan: 'professional',
          status: 'active',
          currentPeriodEnd: '2026-02-20'
        }
      });

      setSettings({
        branding: {
          logo: null,
          primaryColor: '#8B5CF6',
          companyName: 'Agencia Aduanera Demo'
        },
        defaults: {
          declarationOffice: 'ES004101',
          currency: 'EUR',
          language: 'es',
          timezone: 'Europe/Madrid',
          dateFormat: 'DD/MM/YYYY'
        },
        notifications: {
          emailAlerts: true,
          deadlineReminders: true,
          channelNotifications: true,
          weeklyReport: false
        },
        security: {
          mfaRequired: false,
          sessionTimeout: 480,
          ipWhitelist: [],
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireNumbers: true,
            requireSpecialChars: false,
            expiryDays: 0
          }
        }
      });

      setRoles([
        { id: 'tenant_admin', name: 'Administrador', usersCount: 2, isBuiltIn: true },
        { id: 'manager', name: 'Gestor', usersCount: 5, isBuiltIn: true },
        { id: 'agent', name: 'Agente Aduanero', usersCount: 12, isBuiltIn: true },
        { id: 'operator', name: 'Operador', usersCount: 8, isBuiltIn: true },
        { id: 'viewer', name: 'Visualizador', usersCount: 3, isBuiltIn: true }
      ]);

    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: t('settings.loadError') });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // API call to save settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessage({ type: 'success', text: t('settings.saved') });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.saveError') });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const tabs = [
    { id: 'general', name: t('settings.general'), icon: BuildingOfficeIcon },
    { id: 'branding', name: t('settings.brand'), icon: PaintBrushIcon },
    { id: 'defaults', name: t('settings.defaults'), icon: Cog6ToothIcon },
    { id: 'notifications', name: t('settings.notifications'), icon: BellIcon },
    { id: 'security', name: t('settings.security'), icon: ShieldCheckIcon },
    { id: 'roles', name: t('settings.roles'), icon: UserGroupIcon },
    { id: 'integrations', name: t('settings.integrations'), icon: GlobeAltIcon }
  ];

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
          <p className="text-gray-500 mt-1">
            {t('settings.subtitle')} {tenant?.name}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
          {t('settings.saveChanges')}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5" />
          ) : (
            <ExclamationCircleIcon className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">{t('settings.generalInfo')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.orgName')}
                </label>
                <input
                  type="text"
                  value={tenant?.name || ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.slug')}
                </label>
                <input
                  type="text"
                  value={tenant?.slug || ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.nifCif')}
                </label>
                <input
                  type="text"
                  value={tenant?.businessInfo?.nif || ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  EORI
                </label>
                <input
                  type="text"
                  value={tenant?.businessInfo?.eori || ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  REA
                </label>
                <input
                  type="text"
                  value={tenant?.businessInfo?.rea || ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.orgType')}
                </label>
                <select
                  value={tenant?.businessInfo?.type || ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="customs_agent">{t('settings.typeAgent')}</option>
                  <option value="importer">{t('settings.typeImporter')}</option>
                  <option value="exporter">{t('settings.typeExporter')}</option>
                  <option value="carrier">{t('settings.typeCarrier')}</option>
                  <option value="other">{t('settings.typeOther')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.address')}
              </label>
              <input
                type="text"
                value={tenant?.businessInfo?.address?.street || ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2"
                placeholder="Calle y numero"
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={tenant?.businessInfo?.address?.city || ''}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ciudad"
                />
                <input
                  type="text"
                  value={tenant?.businessInfo?.address?.province || ''}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Provincia"
                />
                <input
                  type="text"
                  value={tenant?.businessInfo?.address?.postalCode || ''}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Codigo Postal"
                />
                <input
                  type="text"
                  value={tenant?.businessInfo?.address?.country || 'ES'}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Pais"
                />
              </div>
            </div>

            {/* Status */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('settings.accountStatus')}</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    tenant?.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {tenant?.status === 'active' ? t('common.active') : tenant?.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  Plan: <span className="font-medium capitalize">{tenant?.subscription?.plan}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">{t('settings.brandCustomization')}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.companyLogo')}
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <PaintBrushIcon className="h-12 w-12 mx-auto text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  {t('settings.dragLogo')}
                </p>
                <input type="file" className="hidden" accept="image/*" />
                <button className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                  {t('settings.selectFile')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.primaryColor')}
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={settings?.branding?.primaryColor || '#8B5CF6'}
                  onChange={(e) => updateSettings('branding', 'primaryColor', e.target.value)}
                  className="h-10 w-20 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={settings?.branding?.primaryColor || '#8B5CF6'}
                  onChange={(e) => updateSettings('branding', 'primaryColor', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 w-32"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.displayName')}
              </label>
              <input
                type="text"
                value={settings?.branding?.companyName || ''}
                onChange={(e) => updateSettings('branding', 'companyName', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        )}

        {/* Defaults Tab */}
        {activeTab === 'defaults' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">{t('settings.defaults')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.defaultCustoms')}
                </label>
                <input
                  type="text"
                  value={settings?.defaults?.declarationOffice || ''}
                  onChange={(e) => updateSettings('defaults', 'declarationOffice', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ej: ES004101"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.currency')}
                </label>
                <select
                  value={settings?.defaults?.currency || 'EUR'}
                  onChange={(e) => updateSettings('defaults', 'currency', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="EUR">EUR - Euro</option>
                  <option value="USD">USD - Dolar estadounidense</option>
                  <option value="GBP">GBP - Libra esterlina</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.language')}
                </label>
                <select
                  value={settings?.defaults?.language || 'es'}
                  onChange={(e) => updateSettings('defaults', 'language', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="es">Espanol</option>
                  <option value="en">Ingles</option>
                  <option value="fr">Frances</option>
                  <option value="de">Aleman</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.timezone')}
                </label>
                <select
                  value={settings?.defaults?.timezone || 'Europe/Madrid'}
                  onChange={(e) => updateSettings('defaults', 'timezone', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="Europe/Madrid">Europe/Madrid</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.dateFormat')}
                </label>
                <select
                  value={settings?.defaults?.dateFormat || 'DD/MM/YYYY'}
                  onChange={(e) => updateSettings('defaults', 'dateFormat', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">{t('settings.notificationPrefs')}</h2>

            <div className="space-y-4">
              {[
                { key: 'emailAlerts', label: t('settings.emailAlerts'), description: t('settings.emailAlertsDesc') },
                { key: 'deadlineReminders', label: t('settings.deadlineReminders'), description: t('settings.deadlineRemindersDesc') },
                { key: 'channelNotifications', label: t('settings.channelNotifications'), description: t('settings.channelNotificationsDesc') },
                { key: 'weeklyReport', label: t('settings.weeklyReport'), description: t('settings.weeklyReportDesc') }
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900">{item.label}</span>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.notifications?.[item.key] || false}
                      onChange={(e) => updateSettings('notifications', item.key, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">{t('settings.securityConfig')}</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium text-gray-900">{t('settings.mfaRequired')}</span>
                  <p className="text-sm text-gray-500">{t('settings.mfaRequiredDesc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings?.security?.mfaRequired || false}
                    onChange={(e) => updateSettings('security', 'mfaRequired', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.sessionTimeout')}
                </label>
                <input
                  type="number"
                  value={settings?.security?.sessionTimeout || 480}
                  onChange={(e) => updateSettings('security', 'sessionTimeout', parseInt(e.target.value))}
                  className="w-48 border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.ipWhitelist')}
                </label>
                <textarea
                  value={(settings?.security?.ipWhitelist || []).join('\n')}
                  onChange={(e) => updateSettings('security', 'ipWhitelist', e.target.value.split('\n').filter(ip => ip.trim()))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 h-24"
                  placeholder={t('settings.ipWhitelistDesc')}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-4">{t('settings.passwordPolicy')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.minLength')}
                    </label>
                    <input
                      type="number"
                      value={settings?.security?.passwordPolicy?.minLength || 8}
                      className="w-32 border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.expiration')}
                    </label>
                    <input
                      type="number"
                      value={settings?.security?.passwordPolicy?.expiryDays || 0}
                      className="w-32 border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-4">
                  {[
                    { key: 'requireUppercase', label: t('settings.uppercase') },
                    { key: 'requireNumbers', label: t('settings.numbers') },
                    { key: 'requireSpecialChars', label: t('settings.specialChars') }
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings?.security?.passwordPolicy?.[item.key] || false}
                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">{t('settings.rolesPermissions')}</h2>
              <button className="px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200">
                {t('settings.createCustomRole')}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('settings.role')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.type')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('settings.users')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {roles.map(role => (
                    <tr key={role.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <UserGroupIcon className="h-5 w-5 text-gray-400" />
                          <span className="font-medium text-gray-900">{role.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          role.isBuiltIn ? 'bg-gray-100 text-gray-600' : 'bg-violet-100 text-violet-600'
                        }`}>
                          {role.isBuiltIn ? t('settings.predefined') : t('settings.custom')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {role.usersCount} usuarios
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button className="text-violet-600 hover:text-violet-800 mr-3">
                          {t('settings.viewPermissions')}
                        </button>
                        {!role.isBuiltIn && (
                          <button className="text-red-600 hover:text-red-800">
                            {t('common.delete')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">{t('settings.integrations')}</h2>

            <div className="space-y-4">
              {/* AEAT Certificate */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <ShieldCheckIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">{t('settings.aeatCertificate')}</span>
                      <p className="text-sm text-gray-500">{t('settings.aeatCertificateDesc')}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    {t('settings.configured')}
                  </span>
                </div>
              </div>

              {/* API Key */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 rounded-lg">
                      <KeyIcon className="h-6 w-6 text-violet-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">{t('settings.apiKey')}</span>
                      <p className="text-sm text-gray-500">{t('settings.apiKeyDesc')}</p>
                    </div>
                  </div>
                  <button className="px-3 py-1 text-sm bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200">
                    {t('settings.manage')}
                  </button>
                </div>
              </div>

              {/* Webhooks */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <GlobeAltIcon className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">{t('settings.webhooks')}</span>
                      <p className="text-sm text-gray-500">{t('settings.webhooksDesc')}</p>
                    </div>
                  </div>
                  <button className="px-3 py-1 text-sm bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200">
                    {t('settings.configure')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantSettings;
