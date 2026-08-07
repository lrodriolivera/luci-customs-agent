import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import ConfirmDialog from '../common/ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import {
  UsersIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowPathIcon,
  FunnelIcon,
  EyeIcon,
  UserPlusIcon,
  XMarkIcon,
  KeyIcon,
  ClipboardDocumentIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'

const roleColors = {
  admin: 'bg-red-100 text-red-800',
  supervisor: 'bg-purple-100 text-purple-800',
  agent: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-800'
}

const actionIcons = {
  LOGIN: '🔐',
  CREATE: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
  EXPORT: '📤',
  SUBMIT: '📨',
  CONFIG_CHANGE: '⚙️',
  USER_CREATE: '👤',
  USER_UPDATE: '👤',
  USER_DELETE: '👤',
  INSPECTION_SCHEDULE: '🔍'
}

export default function AdminPanel() {
  const { t } = useTranslation()
  const { confirm, dialogProps } = useConfirm()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  const tabs = [
    { id: 'dashboard', name: t('admin.dashboard'), icon: ChartBarIcon },
    { id: 'users', name: t('admin.users'), icon: UsersIcon },
    { id: 'settings', name: t('admin.settings'), icon: Cog6ToothIcon },
    { id: 'audit', name: t('admin.audit'), icon: ClipboardDocumentListIcon }
  ]

  const roleLabels = {
    admin: t('admin.roleAdmin'),
    supervisor: t('admin.roleSupervisor'),
    agent: t('admin.roleAgent'),
    viewer: t('admin.roleConsultant')
  }

  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState(null)

  // Users state
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [userFilter, setUserFilter] = useState({ status: '', role: '', search: '' })
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  // Settings state
  const [settings, setSettings] = useState(null)
  const [editingSettings, setEditingSettings] = useState(null)

  // Audit state
  const [auditLogs, setAuditLogs] = useState([])
  const [auditStats, setAuditStats] = useState(null)
  const [auditFilter, setAuditFilter] = useState({ module: '', action: '', limit: 50 })

  // Password modal state
  const [tempPassword, setTempPassword] = useState(null)

  useEffect(() => {
    loadTabData(activeTab)
  }, [activeTab])

  const loadTabData = async (tab) => {
    setLoading(true)
    try {
      switch (tab) {
        case 'dashboard':
          const dashRes = await api.get('/api/admin/dashboard')
          setDashboardStats(dashRes.data.stats)
          break
        case 'users':
          const [usersRes, rolesRes] = await Promise.all([
            api.get('/api/admin/users'),
            api.get('/api/admin/roles')
          ])
          setUsers(usersRes.data.users)
          setRoles(rolesRes.data.roles)
          break
        case 'settings':
          const settingsRes = await api.get('/api/admin/settings')
          setSettings(settingsRes.data.settings)
          setEditingSettings(JSON.parse(JSON.stringify(settingsRes.data.settings)))
          break
        case 'audit':
          const [logsRes, statsRes] = await Promise.all([
            api.get('/api/admin/audit', { params: auditFilter }),
            api.get('/api/admin/audit/stats')
          ])
          setAuditLogs(logsRes.data.logs)
          setAuditStats(statsRes.data.stats)
          break
      }
    } catch (error) {
      toast.error(t('admin.errorLoadingData'))
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async (section) => {
    try {
      await api.put('/api/admin/settings', {
        section,
        settings: editingSettings[section]
      })
      setSettings(prev => ({ ...prev, [section]: editingSettings[section] }))
      toast.success(t('admin.settingsSaved'))
    } catch (error) {
      toast.error(t('admin.errorSaving'))
    }
  }

  const handleCreateUser = async (userData) => {
    try {
      const res = await api.post('/api/admin/users', userData)
      setUsers(prev => [res.data.user, ...prev])
      setShowUserModal(false)

      // Si se generó una contraseña temporal, mostrarla
      if (res.data.temporaryPassword) {
        setTempPassword({
          email: res.data.user.email,
          password: res.data.temporaryPassword
        })
      } else {
        toast.success(t('admin.userCreated'))
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('admin.errorCreatingUser'))
    }
  }

  const handleResetPassword = async (userId, userEmail) => {
    if (!await confirm({ message: `¿Restablecer contraseña de ${userEmail}?` })) return
    try {
      const res = await api.post(`/api/admin/users/${userId}/reset-password`)
      setTempPassword({
        email: userEmail,
        password: res.data.temporaryPassword
      })
    } catch (error) {
      toast.error(t('admin.errorResetPassword'))
    }
  }

  const handleUpdateUser = async (userId, userData) => {
    try {
      const res = await api.put(`/api/admin/users/${userId}`, userData)
      setUsers(prev => prev.map(u => u.id === userId ? res.data.user : u))
      setEditingUser(null)
      toast.success(t('admin.userUpdated'))
    } catch (error) {
      toast.error(t('admin.errorUpdatingUser'))
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!await confirm({ message: '¿Eliminar este usuario?', variant: 'danger' })) return
    try {
      await api.delete(`/api/admin/users/${userId}`)
      setUsers(prev => prev.filter(u => u.id !== userId))
      toast.success(t('admin.userDeleted'))
    } catch (error) {
      toast.error(t('admin.errorDeletingUser'))
    }
  }

  const filteredUsers = (users || []).filter(u => {
    if (userFilter.status && u.status !== userFilter.status) return false
    if (userFilter.role && u.role !== userFilter.role) return false
    if (userFilter.search) {
      const search = userFilter.search.toLowerCase()
      if (!u.name.toLowerCase().includes(search) && !u.email.toLowerCase().includes(search)) return false
    }
    return true
  })

  // Dashboard Tab
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('admin.totalUsers')}</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats?.users?.total || 0}</p>
            </div>
            <UsersIcon className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-green-600">{dashboardStats?.users?.active || 0} {t('admin.activeUsers')}</span>
            <span className="mx-2 text-gray-300">|</span>
            <span className="text-gray-500">{dashboardStats?.users?.inactive || 0} {t('admin.inactiveUsers')}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('admin.activity24h')}</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats?.activity?.last24h || 0}</p>
            </div>
            <ClockIcon className="w-12 h-12 text-purple-500 opacity-20" />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {dashboardStats?.activity?.totalLogs || 0} {t('admin.totalEvents')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('admin.aeatStatus')}</p>
              <p className="text-xl font-bold text-gray-900">
                {dashboardStats?.system?.aeatStatus === 'connected' ? t('admin.connected') : t('admin.disconnected')}
              </p>
            </div>
            {dashboardStats?.system?.aeatStatus === 'connected' ? (
              <CheckCircleIcon className="w-12 h-12 text-green-500" />
            ) : (
              <XCircleIcon className="w-12 h-12 text-red-500" />
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('admin.aiAssistant')}</p>
              <p className="text-xl font-bold text-gray-900">
                {dashboardStats?.system?.aiStatus === 'active' ? t('admin.aiActive') : t('admin.aiInactive')}
              </p>
            </div>
            {dashboardStats?.system?.aiStatus === 'active' ? (
              <CheckCircleIcon className="w-12 h-12 text-green-500" />
            ) : (
              <XCircleIcon className="w-12 h-12 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Users by Role */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{t('admin.usersByRole')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(dashboardStats?.users?.byRole || {}).map(([role, count]) => (
            <div key={role} className="text-center p-4 bg-gray-50 rounded-lg">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${roleColors[role]}`}>
                {roleLabels[role] || role}
              </span>
              <p className="text-2xl font-bold mt-2">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // Users Tab
  const renderUsers = () => (
    <div className="space-y-4">
      {/* Filters & Actions */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('admin.searchByNameEmail')}
                value={userFilter.search}
                onChange={(e) => setUserFilter(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-luci focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={userFilter.role}
            onChange={(e) => setUserFilter(prev => ({ ...prev, role: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">{t('admin.allRoles')}</option>
            {(roles || []).map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select
            value={userFilter.status}
            onChange={(e) => setUserFilter(prev => ({ ...prev, status: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">{t('admin.allStatuses')}</option>
            <option value="active">{t('admin.activeStatus')}</option>
            <option value="inactive">{t('admin.inactiveStatus')}</option>
          </select>
          <button
            onClick={() => { setEditingUser(null); setShowUserModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark"
          >
            <UserPlusIcon className="w-5 h-5" />
            {t('admin.newUser')}
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.user')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.role')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.lastAccess')}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-luci-light flex items-center justify-center">
                      <span className="text-luci font-medium">{user.name.charAt(0)}</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${roleColors[user.role]}`}>
                    {roleLabels[user.role] || user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.status === 'active' ? (
                    <span className="flex items-center text-green-600 text-sm">
                      <CheckCircleIcon className="w-4 h-4 mr-1" /> {t('admin.aiActive')}
                    </span>
                  ) : (
                    <span className="flex items-center text-gray-500 text-sm">
                      <XCircleIcon className="w-4 h-4 mr-1" /> {t('admin.aiInactive')}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString('es-ES') : t('admin.never')}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setEditingUser(user); setShowUserModal(true) }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Editar"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleResetPassword(user.id, user.email)}
                      className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                      title="Restablecer contraseña"
                    >
                      <KeyIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Eliminar"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <UserModal
          user={editingUser}
          roles={roles}
          onClose={() => { setShowUserModal(false); setEditingUser(null) }}
          onSave={editingUser ? (data) => handleUpdateUser(editingUser.id, data) : handleCreateUser}
        />
      )}

      {/* Password Modal */}
      {tempPassword && (
        <PasswordModal
          email={tempPassword.email}
          password={tempPassword.password}
          onClose={() => setTempPassword(null)}
        />
      )}
    </div>
  )

  // Settings Tab
  const renderSettings = () => (
    <div className="space-y-6">
      {/* General Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{t('admin.generalSettings')}</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.companyName')}</label>
            <input
              type="text"
              value={editingSettings?.general?.companyName || ''}
              onChange={(e) => setEditingSettings(prev => ({
                ...prev,
                general: { ...prev.general, companyName: e.target.value }
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.timezone')}</label>
            <select
              value={editingSettings?.general?.timezone || ''}
              onChange={(e) => setEditingSettings(prev => ({
                ...prev,
                general: { ...prev.general, timezone: e.target.value }
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="Europe/Madrid">Europe/Madrid</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dateFormat')}</label>
            <select
              value={editingSettings?.general?.dateFormat || ''}
              onChange={(e) => setEditingSettings(prev => ({
                ...prev,
                general: { ...prev.general, dateFormat: e.target.value }
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.currency')}</label>
            <select
              value={editingSettings?.general?.currency || ''}
              onChange={(e) => setEditingSettings(prev => ({
                ...prev,
                general: { ...prev.general, currency: e.target.value }
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="EUR">EUR - Euro</option>
              <option value="USD">USD - Dolar</option>
              <option value="GBP">GBP - Libra</option>
            </select>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={() => handleSaveSettings('general')}
            className="px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark"
          >
            {t('admin.saveChanges')}
          </button>
        </div>
      </div>

      {/* Notifications Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{t('admin.notifications')}</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('admin.emailNotifications')}</p>
              <p className="text-sm text-gray-500">{t('admin.emailAlertsDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={editingSettings?.notifications?.emailEnabled || false}
                onChange={(e) => setEditingSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, emailEnabled: e.target.checked }
                }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-luci-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-luci"></div>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.deadlineAlert')}</label>
              <input
                type="number"
                min="1"
                max="30"
                value={editingSettings?.notifications?.deadlineAlertDays || 3}
                onChange={(e) => setEditingSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, deadlineAlertDays: parseInt(e.target.value) }
                }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.inspectionAlert')}</label>
              <input
                type="number"
                min="1"
                max="72"
                value={editingSettings?.notifications?.inspectionAlertHours || 24}
                onChange={(e) => setEditingSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, inspectionAlertHours: parseInt(e.target.value) }
                }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.requirementAlert')}</label>
              <input
                type="number"
                min="1"
                max="72"
                value={editingSettings?.notifications?.requirementAlertHours || 48}
                onChange={(e) => setEditingSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, requirementAlertHours: parseInt(e.target.value) }
                }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={() => handleSaveSettings('notifications')}
            className="px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark"
          >
            {t('admin.saveChanges')}
          </button>
        </div>
      </div>

      {/* Integrations Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{t('admin.integrationsTitle')}</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🏛️</span>
              </div>
              <div>
                <p className="font-medium">{t('admin.aeatConnection')}</p>
                <p className="text-sm text-gray-500">{t('admin.taxAgency')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={editingSettings?.integrations?.aeatEnvironment || 'test'}
                onChange={(e) => setEditingSettings(prev => ({
                  ...prev,
                  integrations: { ...prev.integrations, aeatEnvironment: e.target.value }
                }))}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="test">{t('admin.testEnvironment')}</option>
                <option value="production">{t('admin.production')}</option>
              </select>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingSettings?.integrations?.aeatEnabled || false}
                  onChange={(e) => setEditingSettings(prev => ({
                    ...prev,
                    integrations: { ...prev.integrations, aeatEnabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-luci-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-luci"></div>
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
              <div>
                <p className="font-medium">{t('admin.taricApi')}</p>
                <p className="text-sm text-gray-500">{t('admin.tariffConsultation')}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={editingSettings?.integrations?.taricApiEnabled || false}
                onChange={(e) => setEditingSettings(prev => ({
                  ...prev,
                  integrations: { ...prev.integrations, taricApiEnabled: e.target.checked }
                }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-luci-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-luci"></div>
            </label>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <p className="font-medium">{t('admin.luciAiAssistant')}</p>
                <p className="text-sm text-gray-500">{t('admin.artificialIntelligence')}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={editingSettings?.integrations?.aiAssistantEnabled || false}
                onChange={(e) => setEditingSettings(prev => ({
                  ...prev,
                  integrations: { ...prev.integrations, aiAssistantEnabled: e.target.checked }
                }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-luci-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-luci"></div>
            </label>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={() => handleSaveSettings('integrations')}
            className="px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark"
          >
            {t('admin.saveChanges')}
          </button>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{t('admin.securityTitle')}</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.sessionTimeout')}</label>
            <input
              type="number"
              min="5"
              max="480"
              value={editingSettings?.security?.sessionTimeout || 60}
              onChange={(e) => setEditingSettings(prev => ({
                ...prev,
                security: { ...prev.security, sessionTimeout: parseInt(e.target.value) }
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.minPasswordLength')}</label>
            <input
              type="number"
              min="6"
              max="32"
              value={editingSettings?.security?.passwordMinLength || 8}
              onChange={(e) => setEditingSettings(prev => ({
                ...prev,
                security: { ...prev.security, passwordMinLength: parseInt(e.target.value) }
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.maxLoginAttempts')}</label>
            <input
              type="number"
              min="3"
              max="10"
              value={editingSettings?.security?.maxLoginAttempts || 5}
              onChange={(e) => setEditingSettings(prev => ({
                ...prev,
                security: { ...prev.security, maxLoginAttempts: parseInt(e.target.value) }
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={editingSettings?.security?.requireTwoFactor || false}
                onChange={(e) => setEditingSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, requireTwoFactor: e.target.checked }
                }))}
                className="w-4 h-4 text-luci border-gray-300 rounded focus:ring-luci"
              />
              <span className="ml-2 text-sm text-gray-700">{t('admin.require2fa')}</span>
            </label>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={() => handleSaveSettings('security')}
            className="px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark"
          >
            {t('admin.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  )

  // Audit Tab
  const renderAudit = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">{t('admin.totalEventsAudit')}</p>
          <p className="text-2xl font-bold">{auditStats?.totalLogs || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">{t('admin.last7Days')}</p>
          <p className="text-2xl font-bold">{auditStats?.last7Days || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">{t('admin.mostActiveModule')}</p>
          <p className="text-xl font-bold">
            {auditStats?.byModule ? Object.entries(auditStats.byModule).sort((a, b) => b[1] - a[1])[0]?.[0] || '-' : '-'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">{t('admin.mostActiveUser')}</p>
          <p className="text-xl font-bold truncate">
            {auditStats?.byUser ? Object.entries(auditStats.byUser).sort((a, b) => b[1] - a[1])[0]?.[0] || '-' : '-'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{t('admin.filters')}:</span>
          </div>
          <select
            value={auditFilter.module}
            onChange={(e) => setAuditFilter(prev => ({ ...prev, module: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">{t('admin.allModules')}</option>
            <option value="auth">{t('admin.authModule')}</option>
            <option value="expeditions">{t('admin.expeditionsModule')}</option>
            <option value="declarations">{t('admin.declarationsModule')}</option>
            <option value="inspections">{t('admin.inspectionsModule')}</option>
            <option value="settings">{t('admin.settingsModule')}</option>
            <option value="users">{t('admin.usersModule')}</option>
            <option value="aeat">{t('admin.aeatModule')}</option>
            <option value="reports">{t('admin.reportsModule')}</option>
          </select>
          <select
            value={auditFilter.action}
            onChange={(e) => setAuditFilter(prev => ({ ...prev, action: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">{t('admin.allActions')}</option>
            <option value="LOGIN">Login</option>
            <option value="CREATE">{t('common.create')}</option>
            <option value="UPDATE">{t('common.update')}</option>
            <option value="DELETE">{t('common.delete')}</option>
            <option value="EXPORT">{t('common.export')}</option>
            <option value="SUBMIT">{t('common.send')}</option>
            <option value="CONFIG_CHANGE">Config</option>
          </select>
          <button
            onClick={() => loadTabData('audit')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <ArrowPathIcon className="w-4 h-4" />
            {t('admin.refresh')}
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.dateTime')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.user')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.action')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.module')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.description')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(auditLogs || []).map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(log.timestamp).toLocaleString('es-ES')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{log.userName}</div>
                  <div className="text-xs text-gray-500">{log.ip}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-lg mr-2">{actionIcons[log.action] || '📝'}</span>
                  <span className="text-sm text-gray-700">{log.action}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                    {log.module}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                  {log.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.panelTitle')}</h1>
          <p className="text-gray-500">{t('admin.panelSubtitle')}</p>
        </div>
        <ShieldCheckIcon className="w-10 h-10 text-luci" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-luci text-luci'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-luci"></div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'settings' && renderSettings()}
          {activeTab === 'audit' && renderAudit()}
        </>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

// User Modal Component
function UserModal({ user, roles, onClose, onSave }) {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    email: user?.email || '',
    name: user?.name || '',
    role: user?.role || 'agent',
    status: user?.status || 'active',
    password: '',
    generatePassword: !user
  })
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const dataToSend = { ...formData }

    // Si es nuevo usuario y no genera password, validar que tenga contraseña
    if (!user && !formData.generatePassword && formData.password.length < 6) {
      toast.error(t('admin.passwordMinError'))
      return
    }

    // Si genera contraseña automática, no enviar password
    if (formData.generatePassword) {
      delete dataToSend.password
    }

    // Si está editando y no puso contraseña, no enviarla
    if (user && !formData.password) {
      delete dataToSend.password
    }

    onSave(dataToSend)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">
            {user ? t('admin.editUserTitle') : t('admin.newUserTitle')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email')}</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              disabled={!!user}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')}</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.role')}</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {(roles || []).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Contraseña - Solo para nuevo usuario o al editar */}
          {!user && (
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="generatePassword"
                  checked={formData.generatePassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, generatePassword: e.target.checked, password: '' }))}
                  className="w-4 h-4 text-luci border-gray-300 rounded focus:ring-luci"
                />
                <label htmlFor="generatePassword" className="ml-2 text-sm text-gray-700">
                  {t('admin.generateAutoPassword')}
                </label>
              </div>

              {!formData.generatePassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.password')}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={t('admin.minChars')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cambiar contraseña al editar */}
          {user && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="active">{t('admin.aiActive')}</option>
                  <option value="inactive">{t('admin.aiInactive')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.newPasswordOptional')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={t('admin.leaveEmptyNoChange')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark"
            >
              {user ? t('admin.saveChanges') : t('admin.createUser')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Password Modal Component - Shows temporary password
function PasswordModal({ email, password, onClose }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(password)
    setCopied(true)
    toast.success(t('admin.passwordCopied'))
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <KeyIcon className="w-5 h-5 text-amber-500" />
            {t('admin.tempPassword')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800 mb-2">
              {t('admin.tempPasswordGenerated')}
            </p>
            <p className="font-medium text-amber-900">{email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.passwordLabel')}</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-lg px-4 py-3 font-mono text-lg tracking-wider">
                {password}
              </div>
              <button
                onClick={copyToClipboard}
                className={`p-3 rounded-lg transition-colors ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                title="Copiar"
              >
                <ClipboardDocumentIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Importante:</strong> {t('admin.tempPasswordImportant')}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark"
            >
              {t('admin.understood')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
