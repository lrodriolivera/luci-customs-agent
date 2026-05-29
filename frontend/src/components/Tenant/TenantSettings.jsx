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
  ArrowPathIcon,
  FlagIcon,
  ArrowUpTrayIcon,
  SignalIcon
} from '@heroicons/react/24/outline';
import api from '../../services/api';

const TenantSettings = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [roles, setRoles] = useState([]);
  const [message, setMessage] = useState(null);
  // Certificate upload state
  const [certFile, setCertFile] = useState(null);
  const [certPassword, setCertPassword] = useState('');
  const [certUploading, setCertUploading] = useState(false);
  const [certInfo, setCertInfo] = useState(null);
  // EORI per country state
  const [eoriNumbers, setEoriNumbers] = useState({ ES: '', NL: '' });
  const [eoriSaving, setEoriSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const tenantRes = await api.get('/api/tenant');
      if (tenantRes.data.success || tenantRes.data.data || tenantRes.data._id) {
        setTenant(tenantRes.data.data || tenantRes.data);
      }

      setSettings({
        branding: {
          logo: null,
          primaryColor: '#8B5CF6',
          companyName: tenantRes.data.data?.name || tenantRes.data.name || ''
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
    { id: 'customs', name: 'Aduanas', icon: FlagIcon },
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

        {/* Customs / Country Configuration Tab */}
        {activeTab === 'customs' && (
          <CustomsTab
            tenant={tenant}
            setTenant={setTenant}
            eoriNumbers={eoriNumbers}
            setEoriNumbers={setEoriNumbers}
            eoriSaving={eoriSaving}
            setEoriSaving={setEoriSaving}
            certFile={certFile}
            setCertFile={setCertFile}
            certPassword={certPassword}
            setCertPassword={setCertPassword}
            certUploading={certUploading}
            setCertUploading={setCertUploading}
            certInfo={certInfo}
            setCertInfo={setCertInfo}
            message={message}
            setMessage={setMessage}
          />
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

// Multi-country customs configuration sub-component
function CustomsTab({ tenant, setTenant, eoriNumbers, setEoriNumbers, eoriSaving, setEoriSaving,
  certFile, setCertFile, certPassword, setCertPassword, certUploading, setCertUploading,
  certInfo, setCertInfo, message, setMessage }) {

  const availableCountries = [
    { code: 'ES', name: 'Espana', system: 'AEAT', systemFull: 'Agencia Estatal de Administracion Tributaria', flag: '\u{1F1EA}\u{1F1F8}', placeholder: 'ESB22477020', certLabel: 'Certificado FNMT / Digital' },
    { code: 'NL', name: 'Paises Bajos', system: 'DMS/DECO', systemFull: 'Douane Management Systeem', flag: '\u{1F1F3}\u{1F1F1}', placeholder: 'NL123456789012', certLabel: 'Certificado PKIoverheid / eHerkenning' },
    { code: 'BE', name: 'Belgica', system: 'PLDA', systemFull: 'Paperless Douane en Accijnzen', flag: '\u{1F1E7}\u{1F1EA}', disabled: true, label: 'Proximamente' },
    { code: 'DE', name: 'Alemania', system: 'ATLAS', systemFull: 'Automatisiertes Tarif- und Lokales Zoll-Abwicklungssystem', flag: '\u{1F1E9}\u{1F1EA}', disabled: true, label: 'Proximamente' },
    { code: 'FR', name: 'Francia', system: 'DELTA', systemFull: 'Dedouanement En Ligne par Traitement Automatise', flag: '\u{1F1EB}\u{1F1F7}', disabled: true, label: 'Proximamente' },
  ];

  // Enabled countries state (stored in localStorage)
  const [enabledCountries, setEnabledCountries] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('customsCountries') || '[]');
      if (stored.length > 0) return stored.map(c => c.code);
    } catch {}
    return [tenant?.customsConfig?.country || 'ES'];
  });

  // Per-country config state
  const [countryConfigs, setCountryConfigs] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('customsCountryConfigs') || '{}');
      if (Object.keys(stored).length > 0) return stored;
    } catch {}
    return {
      ES: { eori: tenant?.customsConfig?.eori || '', environment: tenant?.customsConfig?.environment || 'test' },
      NL: { eori: eoriNumbers?.NL || '', environment: 'test' },
    };
  });

  const toggleCountry = (code) => {
    setEnabledCountries(prev => {
      const next = prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code];
      // Save to localStorage
      const countriesData = next.map(c => {
        const info = availableCountries.find(ac => ac.code === c);
        return { code: c, name: info?.name, system: info?.system, flag: info?.flag };
      });
      localStorage.setItem('customsCountries', JSON.stringify(countriesData));
      return next;
    });
  };

  const updateCountryConfig = (code, key, value) => {
    setCountryConfigs(prev => {
      const next = { ...prev, [code]: { ...prev[code], [key]: value } };
      localStorage.setItem('customsCountryConfigs', JSON.stringify(next));
      return next;
    });
  };

  const saveAllConfigs = async () => {
    setEoriSaving(true);
    try {
      const eoriMap = {};
      enabledCountries.forEach(code => {
        eoriMap[code] = countryConfigs[code]?.eori || '';
      });
      await api.put('/api/tenant/eori', { eoriNumbers: eoriMap });
      setMessage({ type: 'success', text: 'Configuracion de paises guardada correctamente' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error guardando configuracion' });
    } finally {
      setEoriSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Configuracion de Paises y Aduanas</h2>
      <p className="text-sm text-gray-500">
        Activa los paises donde opera tu organizacion. Cada pais tiene su propia configuracion de EORI, certificado y entorno.
      </p>

      {/* Country toggles */}
      <div className="space-y-3">
        {availableCountries.map(country => {
          const isEnabled = enabledCountries.includes(country.code);
          const config = countryConfigs[country.code] || {};

          return (
            <div key={country.code} className={`border rounded-lg overflow-hidden transition-colors ${
              country.disabled ? 'border-gray-100 bg-gray-50 opacity-60' :
              isEnabled ? 'border-violet-200 bg-white' : 'border-gray-200 bg-white'
            }`}>
              {/* Country header with toggle */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{country.flag}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{country.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                        {country.system}
                      </span>
                      {country.label && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          {country.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{country.systemFull}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => !country.disabled && toggleCountry(country.code)}
                    disabled={country.disabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Expanded config for enabled countries */}
              {isEnabled && !country.disabled && (
                <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* EORI */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        EORI ({country.code})
                      </label>
                      <input
                        type="text"
                        value={config.eori || ''}
                        onChange={(e) => updateCountryConfig(country.code, 'eori', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder={country.placeholder}
                      />
                    </div>

                    {/* Environment */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Entorno
                      </label>
                      <select
                        value={config.environment || 'test'}
                        onChange={(e) => updateCountryConfig(country.code, 'environment', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="test">Test / Pre-produccion</option>
                        <option value="production">Produccion</option>
                      </select>
                    </div>
                  </div>

                  {/* Certificate status */}
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white">
                    <div className="flex items-center gap-3">
                      <ShieldCheckIcon className={`h-5 w-5 ${
                        (country.code === (tenant?.customsConfig?.country) && tenant?.customsConfig?.certificateStatus === 'configured')
                          ? 'text-green-500' : 'text-gray-400'
                      }`} />
                      <div>
                        <span className="text-sm font-medium text-gray-700">{country.certLabel}</span>
                        <p className="text-xs text-gray-500">
                          {(country.code === (tenant?.customsConfig?.country) && tenant?.customsConfig?.certificateStatus === 'configured')
                            ? 'Configurado'
                            : 'No configurado'}
                        </p>
                      </div>
                    </div>
                    {(country.code === (tenant?.customsConfig?.country) && tenant?.customsConfig?.certificateStatus === 'configured') ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Activo</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">Pendiente</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Certificate Upload (shared) */}
      <div className="border-t pt-6">
        <h3 className="font-medium text-gray-900 mb-4">Subir certificado digital</h3>
        <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pais del certificado</label>
              <select
                value={tenant?.customsConfig?.country || 'ES'}
                onChange={(e) => {
                  const country = e.target.value;
                  const systemMap = { ES: 'AEAT', NL: 'DMS/DECO' };
                  setTenant(prev => ({
                    ...prev,
                    customsConfig: { ...prev.customsConfig, country, system: systemMap[country] || 'AEAT' }
                  }));
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {enabledCountries.map(code => {
                  const info = availableCountries.find(c => c.code === code);
                  return <option key={code} value={code}>{info?.flag} {info?.name} ({info?.system})</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Archivo de certificado (.p12 / .pfx)</label>
              <input
                type="file"
                accept=".p12,.pfx"
                onChange={(e) => setCertFile(e.target.files[0])}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password del certificado</label>
              <input
                type="password"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Contrasena del archivo .p12"
              />
            </div>
            <button
              onClick={async () => {
                if (!certFile || !certPassword) {
                  setMessage({ type: 'error', text: 'Selecciona un archivo y escribe la password' });
                  return;
                }
                setCertUploading(true);
                try {
                  const formData = new FormData();
                  formData.append('certificate', certFile);
                  formData.append('password', certPassword);
                  formData.append('country', tenant?.customsConfig?.country || 'ES');

                  const res = await api.post('/api/certificates/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                  });

                  if (res.data?.success) {
                    setCertInfo(res.data.certificate?.metadata || {});
                    setCertFile(null);
                    setCertPassword('');
                    setTenant(prev => ({
                      ...prev,
                      customsConfig: { ...prev.customsConfig, certificateStatus: 'configured' }
                    }));
                    setMessage({ type: 'success', text: 'Certificado subido correctamente' });
                  } else {
                    setMessage({ type: 'error', text: res.data?.error || 'Error subiendo certificado' });
                  }
                } catch (err) {
                  setMessage({ type: 'error', text: err.response?.data?.error || 'Error subiendo certificado' });
                } finally {
                  setCertUploading(false);
                  setTimeout(() => setMessage(null), 5000);
                }
              }}
              disabled={certUploading || !certFile || !certPassword}
              className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
            >
              {certUploading ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpTrayIcon className="h-4 w-4" />
              )}
              Subir certificado
            </button>
          </div>
        </div>
      </div>

      {/* Save all button */}
      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={saveAllConfigs}
          disabled={eoriSaving}
          className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
        >
          {eoriSaving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
          Guardar configuracion de paises
        </button>
      </div>

      {/* Connection Status per country */}
      <div className="p-4 rounded-lg bg-gray-50">
        <div className="flex items-center gap-3 mb-3">
          <SignalIcon className="h-5 w-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Estado de conexion por pais</span>
        </div>
        <div className="space-y-2">
          {enabledCountries.map(code => {
            const info = availableCountries.find(c => c.code === code);
            const config = countryConfigs[code] || {};
            const hasEori = !!config.eori;
            const hasCert = code === (tenant?.customsConfig?.country) && tenant?.customsConfig?.certificateStatus === 'configured';
            const isReady = hasEori && hasCert;

            return (
              <div key={code} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2">
                  <span>{info?.flag}</span>
                  <span className="text-sm font-medium text-gray-700">{info?.name} ({info?.system})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{config.environment === 'production' ? 'Produccion' : 'Test'}</span>
                  {isReady ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Listo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      Pendiente
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TenantSettings;
