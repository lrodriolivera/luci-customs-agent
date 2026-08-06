import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminPanel from './AdminPanel'
import api from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => {
  const mockError = vi.fn()
  const mockSuccess = vi.fn()
  const toastObj = {
    error: mockError,
    success: mockSuccess
  }
  return {
    default: toastObj,
    toast: toastObj
  }
})

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

global.window.confirm = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn()
  }
})

const mockDashboardStats = {
  stats: {
    users: { total: 42, active: 38, inactive: 4, byRole: { admin: 5, supervisor: 10, agent: 20, viewer: 7 } },
    activity: { last24h: 152, totalLogs: 2450 },
    system: { aeatStatus: 'connected', aiStatus: 'active' }
  }
}

const mockUsers = [
  {
    id: 'u1',
    name: 'Alice Admin',
    email: 'alice@test.com',
    role: 'admin',
    status: 'active',
    lastLogin: '2026-08-05T10:00:00Z'
  },
  {
    id: 'u2',
    name: 'Bob Agent',
    email: 'bob@test.com',
    role: 'agent',
    status: 'inactive',
    lastLogin: null
  }
]

const mockRoles = [
  { id: 'admin', name: 'Administrator' },
  { id: 'supervisor', name: 'Supervisor' },
  { id: 'agent', name: 'Agent' },
  { id: 'viewer', name: 'Viewer' }
]

const mockSettings = {
  general: { companyName: 'Test Corp', timezone: 'Europe/Madrid', dateFormat: 'DD/MM/YYYY', currency: 'EUR' },
  notifications: { emailEnabled: true, deadlineAlertDays: 3, inspectionAlertHours: 24, requirementAlertHours: 48 },
  integrations: { aeatEnvironment: 'test', aeatEnabled: true, taricApiEnabled: true, aiAssistantEnabled: true },
  security: { sessionTimeout: 60, passwordMinLength: 8, maxLoginAttempts: 5, requireTwoFactor: false }
}

const mockAuditLogs = [
  {
    id: 'log1',
    timestamp: '2026-08-06T09:15:00Z',
    userName: 'Alice Admin',
    ip: '192.168.1.1',
    action: 'LOGIN',
    module: 'auth',
    description: 'User logged in successfully'
  },
  {
    id: 'log2',
    timestamp: '2026-08-06T09:30:00Z',
    userName: 'Bob Agent',
    ip: '192.168.1.2',
    action: 'CREATE',
    module: 'expeditions',
    description: 'Created expedition EXP-001'
  }
]

const mockAuditStats = {
  totalLogs: 2450,
  last7Days: 830,
  byModule: { auth: 450, expeditions: 820, declarations: 680, settings: 200, users: 100, aeat: 150, reports: 50 },
  byUser: { 'Alice Admin': 1200, 'Bob Agent': 800, 'Carol Supervisor': 450 }
}

describe('<AdminPanel />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.confirm.mockReturnValue(true)
  })

  // ================== DASHBOARD TAB ==================
  test('renderiza el panel con la pestaña dashboard por defecto y carga stats', async () => {
    api.get.mockResolvedValueOnce({ data: mockDashboardStats })
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    expect(screen.getByText('admin.panelTitle')).toBeInTheDocument()
    expect(screen.getByText('admin.dashboard')).toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/admin/dashboard'))
    expect(screen.queryByText('admin.totalUsers')).toBeInTheDocument()
  })

  test('dashboard muestra stats de usuarios con totales y activos/inactivos', async () => {
    api.get.mockResolvedValueOnce({ data: mockDashboardStats })
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())
    expect(screen.getByText('38 admin.activeUsers')).toBeInTheDocument()
    expect(screen.getByText('4 admin.inactiveUsers')).toBeInTheDocument()
  })

  test('dashboard muestra actividad 24h', async () => {
    api.get.mockResolvedValueOnce({ data: mockDashboardStats })
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('152')).toBeInTheDocument())
    expect(screen.getByText('2450 admin.totalEvents')).toBeInTheDocument()
  })

  test.each([
    ['connected', 'admin.connected'],
    ['disconnected', 'admin.disconnected']
  ])('dashboard muestra estado AEAT: %s', async (aeatStatus, expected) => {
    const stats = { stats: { ...mockDashboardStats.stats, system: { aeatStatus, aiStatus: 'active' } } }
    api.get.mockResolvedValueOnce({ data: stats })
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument())
  })

  test.each([
    ['active', 'admin.aiActive'],
    ['inactive', 'admin.aiInactive']
  ])('dashboard muestra estado IA: %s', async (aiStatus, expected) => {
    const stats = { stats: { ...mockDashboardStats.stats, system: { aeatStatus: 'connected', aiStatus } } }
    api.get.mockResolvedValueOnce({ data: stats })
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument())
  })

  test('dashboard muestra usuarios por rol', async () => {
    api.get.mockResolvedValueOnce({ data: mockDashboardStats })
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('admin.usersByRole')).toBeInTheDocument())
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  test('dashboard con error de carga muestra toast', async () => {
    api.get.mockRejectedValueOnce(new Error('API down'))
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('admin.errorLoadingData'))
  })

  test('dashboard con datos vacíos no rompe', async () => {
    const emptyStats = { stats: { users: { total: 0, active: 0, inactive: 0 }, activity: {}, system: {} } }
    api.get.mockResolvedValueOnce({ data: emptyStats })
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('admin.usersByRole')).toBeInTheDocument())
  })

  test('dashboard con byRole muestra correctamente cada rol', async () => {
    api.get.mockResolvedValueOnce({ data: mockDashboardStats })
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('admin.usersByRole')).toBeInTheDocument())

    expect(screen.getByText('admin.roleAdmin')).toBeInTheDocument()
    expect(screen.getByText('admin.roleSupervisor')).toBeInTheDocument()
    expect(screen.getByText('admin.roleAgent')).toBeInTheDocument()
    expect(screen.getByText('admin.roleConsultant')).toBeInTheDocument()
  })

  // ================== USERS TAB ==================
  test('cambiar a pestaña users carga usuarios y roles', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/admin/dashboard'))

    fireEvent.click(screen.getByText('admin.users'))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/admin/users')
      expect(api.get).toHaveBeenCalledWith('/api/admin/roles')
    })
    expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    expect(screen.getByText('Bob Agent')).toBeInTheDocument()
  })

  test('TEST DE DISCRIMINANCIA: users tab con API sin campo .users no crashea', async () => {
    // Sin el fix `(users || [])`, el render lanza "Cannot read properties of
    // undefined (reading 'filter')". React lo emite como error NO capturado en
    // window (no como rechazo del render), así que hay que espiarlo explícitamente:
    // un queryByText no basta para discriminar el fix.
    const onError = vi.fn()
    window.addEventListener('error', onError)
    try {
      api.get
        .mockResolvedValueOnce({ data: mockDashboardStats })
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: { roles: mockRoles } })

      render(
        <MemoryRouter>
          <AdminPanel />
        </MemoryRouter>
      )
      fireEvent.click(screen.getByText('admin.users'))

      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/admin/users'))
      // Deja asentar el render que consumiría `users.filter`.
      await waitFor(() => expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument())

      const filterCrash = onError.mock.calls.some(([e]) =>
        String(e?.error?.message || e?.message || '').includes("reading 'filter'")
      )
      expect(filterCrash).toBe(false)
    } finally {
      window.removeEventListener('error', onError)
    }
  })

  test('filtro de búsqueda por nombre filtra usuarios', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText('admin.searchByNameEmail')
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    expect(screen.queryByText('Bob Agent')).not.toBeInTheDocument()
  })

  test('filtro de búsqueda por email filtra usuarios', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText('admin.searchByNameEmail')
    fireEvent.change(searchInput, { target: { value: 'bob@test' } })

    expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Agent')).toBeInTheDocument()
  })

  test('filtro por status filtra usuarios', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const statusSelect = screen.getAllByRole('combobox')[1]
    fireEvent.change(statusSelect, { target: { value: 'active' } })

    expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    expect(screen.queryByText('Bob Agent')).not.toBeInTheDocument()
  })

  test('filtro por role filtra usuarios', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const roleSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(roleSelect, { target: { value: 'admin' } })

    expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    expect(screen.queryByText('Bob Agent')).not.toBeInTheDocument()
  })

  test('filtro combinado de role y status', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const roleSelect = screen.getAllByRole('combobox')[0]
    const statusSelect = screen.getAllByRole('combobox')[1]

    fireEvent.change(roleSelect, { target: { value: 'agent' } })
    fireEvent.change(statusSelect, { target: { value: 'inactive' } })

    expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Agent')).toBeInTheDocument()
  })

  test('crear usuario abre modal', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))

    expect(screen.getByText('admin.newUserTitle')).toBeInTheDocument()
  })

  test('crear usuario con password generada automáticamente', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.post.mockResolvedValueOnce({
      data: {
        user: { id: 'u3', name: 'Charlie', email: 'charlie@test.com', role: 'agent', status: 'active' },
        temporaryPassword: 'Temp1234!'
      }
    })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))

    const inputs = document.querySelectorAll('input')
    const emailInput = Array.from(inputs).find(inp => inp.type === 'email')
    const nameInput = Array.from(inputs).find(inp => inp.type === 'text' && inp.required && !inp.type.includes('checkbox'))

    fireEvent.change(emailInput, { target: { value: 'charlie@test.com' } })
    fireEvent.change(nameInput, { target: { value: 'Charlie' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({
        email: 'charlie@test.com',
        name: 'Charlie',
        role: 'agent',
        status: 'active',
        generatePassword: true
      }))
    )
    expect(screen.getByText('admin.tempPassword')).toBeInTheDocument()
    expect(screen.getByText('Temp1234!')).toBeInTheDocument()
  })

  test('crear usuario con password manual requiere minimo 6 caracteres', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))

    const inputs = document.querySelectorAll('input')
    const emailInput = Array.from(inputs).find(inp => inp.type === 'email')
    const nameInput = Array.from(inputs).find(inp => inp.type === 'text' && inp.required && !inp.type.includes('checkbox'))
    const checkboxes = Array.from(inputs).filter(inp => inp.type === 'checkbox')

    fireEvent.change(emailInput, { target: { value: 'dave@test.com' } })
    fireEvent.change(nameInput, { target: { value: 'Dave' } })
    fireEvent.click(checkboxes[0])

    await waitFor(() => expect(screen.queryByPlaceholderText('admin.minChars')).toBeInTheDocument())
    const passwordInput = screen.getByPlaceholderText('admin.minChars')
    fireEvent.change(passwordInput, { target: { value: '12345' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('admin.passwordMinError'))
    expect(api.post).not.toHaveBeenCalled()
  })

  test('crear usuario sin password temporal muestra toast success', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.post.mockResolvedValueOnce({
      data: {
        user: { id: 'u3', name: 'Charlie', email: 'charlie@test.com', role: 'agent', status: 'active' }
      }
    })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))

    const inputs = document.querySelectorAll('input')
    const emailInput = Array.from(inputs).find(inp => inp.type === 'email')
    const nameInput = Array.from(inputs).find(inp => inp.type === 'text' && inp.required && !inp.type.includes('checkbox'))

    fireEvent.change(emailInput, { target: { value: 'charlie@test.com' } })
    fireEvent.change(nameInput, { target: { value: 'Charlie' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('admin.userCreated'))
  })

  test('crear usuario con error muestra toast de error', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.post.mockRejectedValueOnce({ response: { data: { error: 'Email already exists' } } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))

    const inputs = document.querySelectorAll('input')
    const emailInput = Array.from(inputs).find(inp => inp.type === 'email')
    const nameInput = Array.from(inputs).find(inp => inp.type === 'text' && inp.required && !inp.type.includes('checkbox'))

    fireEvent.change(emailInput, { target: { value: 'alice@test.com' } })
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Email already exists'))
  })

  test('editar usuario abre modal con datos', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])

    expect(screen.getByText('admin.editUserTitle')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Alice Admin')).toBeInTheDocument()
  })

  test('actualizar usuario guarda cambios', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.put.mockResolvedValueOnce({
      data: { user: { ...mockUsers[0], name: 'Alice Updated' } }
    })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])

    fireEvent.change(screen.getByDisplayValue('Alice Admin'), { target: { value: 'Alice Updated' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/admin/users/u1', expect.objectContaining({
        name: 'Alice Updated'
      }))
    )
    expect(toast.success).toHaveBeenCalledWith('admin.userUpdated')
  })

  test('resetear password de usuario muestra contraseña temporal', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.post.mockResolvedValueOnce({ data: { temporaryPassword: 'NewTemp999!' } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const resetButtons = screen.getAllByTitle('Restablecer contraseña')
    fireEvent.click(resetButtons[0])

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/admin/users/u1/reset-password')
    )
    expect(screen.getByText('NewTemp999!')).toBeInTheDocument()
  })

  test('resetear password cancelado no llama a la API', async () => {
    window.confirm.mockReturnValueOnce(false)
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const resetButtons = screen.getAllByTitle('Restablecer contraseña')
    fireEvent.click(resetButtons[0])

    expect(api.post).not.toHaveBeenCalled()
  })

  test('eliminar usuario pide confirmacion y elimina', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.delete.mockResolvedValueOnce({ data: {} })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/admin/users/u1'))
    expect(toast.success).toHaveBeenCalledWith('admin.userDeleted')
  })

  test('copiar contraseña temporal al portapapeles', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.post.mockResolvedValueOnce({
      data: {
        user: { id: 'u3', name: 'Charlie', email: 'charlie@test.com', role: 'agent', status: 'active' },
        temporaryPassword: 'Temp1234!'
      }
    })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))

    const inputs = document.querySelectorAll('input')
    const emailInput = Array.from(inputs).find(inp => inp.type === 'email')
    const nameInput = Array.from(inputs).find(inp => inp.type === 'text' && inp.required && !inp.type.includes('checkbox'))

    fireEvent.change(emailInput, { target: { value: 'charlie@test.com' } })
    fireEvent.change(nameInput, { target: { value: 'Charlie' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByText('Temp1234!')).toBeInTheDocument())

    const copyButton = screen.getByTitle('Copiar')
    fireEvent.click(copyButton)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Temp1234!')
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('admin.passwordCopied'))
  })

  test('toggle de mostrar/ocultar password en modal de crear usuario', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))

    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
    fireEvent.click(checkboxes[0])

    const passwordInput = screen.getByPlaceholderText('admin.minChars')
    expect(passwordInput).toHaveAttribute('type', 'password')

    const toggleButton = passwordInput.parentElement.querySelector('button')
    fireEvent.click(toggleButton)

    expect(passwordInput).toHaveAttribute('type', 'text')

    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('editar usuario con nuevo password', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.put.mockResolvedValueOnce({
      data: { user: { ...mockUsers[0], name: 'Alice Updated' } }
    })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])

    fireEvent.change(screen.getByDisplayValue('Alice Admin'), { target: { value: 'Alice Updated' } })

    const passwordInput = screen.getByPlaceholderText('admin.leaveEmptyNoChange')
    fireEvent.change(passwordInput, { target: { value: 'NewPass123' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/admin/users/u1', expect.objectContaining({
        name: 'Alice Updated',
        password: 'NewPass123'
      }))
    )
  })

  test('modal de edicion muestra campos correctos', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])

    expect(screen.getByText('admin.editUserTitle')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Alice Admin')).toBeInTheDocument()
    expect(screen.getByDisplayValue('alice@test.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('admin.leaveEmptyNoChange')).toBeInTheDocument()
  })

  test('crear usuario con password manual de 6 caracteres exactos pasa validacion', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.post.mockResolvedValueOnce({
      data: {
        user: { id: 'u4', name: 'Dave', email: 'dave@test.com', role: 'agent', status: 'active' }
      }
    })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))

    const inputs = document.querySelectorAll('input')
    const emailInput = Array.from(inputs).find(inp => inp.type === 'email')
    const nameInput = Array.from(inputs).find(inp => inp.type === 'text' && inp.required && !inp.type.includes('checkbox'))
    const checkboxes = Array.from(inputs).filter(inp => inp.type === 'checkbox')

    fireEvent.change(emailInput, { target: { value: 'dave@test.com' } })
    fireEvent.change(nameInput, { target: { value: 'Dave' } })
    fireEvent.click(checkboxes[0])

    await waitFor(() => expect(screen.queryByPlaceholderText('admin.minChars')).toBeInTheDocument())
    const passwordInput = screen.getByPlaceholderText('admin.minChars')
    fireEvent.change(passwordInput, { target: { value: '123456' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({
        email: 'dave@test.com',
        name: 'Dave',
        password: '123456'
      }))
    )
  })

  test('modal de usuario puede cancelarse con boton Cancel', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))
    expect(screen.getByText('admin.newUserTitle')).toBeInTheDocument()

    fireEvent.click(screen.getByText('common.cancel'))

    await waitFor(() => expect(screen.queryByText('admin.newUserTitle')).not.toBeInTheDocument())
  })

  test('toggle de password en modal de edicion', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])

    const passwordInput = screen.getByPlaceholderText('admin.leaveEmptyNoChange')
    expect(passwordInput).toHaveAttribute('type', 'password')

    const toggleButton = passwordInput.parentElement.querySelector('button')
    fireEvent.click(toggleButton)

    expect(passwordInput).toHaveAttribute('type', 'text')

    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('password modal muestra email y password correctamente', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.post.mockResolvedValueOnce({
      data: {
        user: { id: 'u5', name: 'Eve', email: 'eve@test.com', role: 'agent', status: 'active' },
        temporaryPassword: 'TestPassword123!'
      }
    })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))

    const inputs = document.querySelectorAll('input')
    const emailInput = Array.from(inputs).find(inp => inp.type === 'email')
    const nameInput = Array.from(inputs).find(inp => inp.type === 'text' && inp.required && !inp.type.includes('checkbox'))

    fireEvent.change(emailInput, { target: { value: 'eve@test.com' } })
    fireEvent.change(nameInput, { target: { value: 'Eve' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByText('TestPassword123!')).toBeInTheDocument())

    expect(screen.getAllByText('eve@test.com').length).toBeGreaterThan(0)
    expect(screen.getByText('admin.tempPasswordGenerated')).toBeInTheDocument()
    expect(screen.getByText('admin.passwordLabel')).toBeInTheDocument()
    expect(screen.getByText('admin.tempPasswordImportant')).toBeInTheDocument()
  })

  test('modal de usuario se cierra al hacer clic en X', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))
    expect(screen.getByText('admin.newUserTitle')).toBeInTheDocument()

    const modalContainer = document.querySelector('.fixed.inset-0')
    const closeButton = modalContainer.querySelectorAll('button')[0]
    fireEvent.click(closeButton)

    await waitFor(() => expect(screen.queryByText('admin.newUserTitle')).not.toBeInTheDocument())
  })

  test('modal de password temporal se cierra', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.post.mockResolvedValueOnce({
      data: {
        user: { id: 'u3', name: 'Charlie', email: 'charlie@test.com', role: 'agent', status: 'active' },
        temporaryPassword: 'Temp1234!'
      }
    })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.newUser'))

    const inputs = document.querySelectorAll('input')
    const emailInput = Array.from(inputs).find(inp => inp.type === 'email')
    const nameInput = Array.from(inputs).find(inp => inp.type === 'text' && inp.required && !inp.type.includes('checkbox'))

    fireEvent.change(emailInput, { target: { value: 'charlie@test.com' } })
    fireEvent.change(nameInput, { target: { value: 'Charlie' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByText('Temp1234!')).toBeInTheDocument())

    fireEvent.click(screen.getByText('admin.understood'))

    await waitFor(() => expect(screen.queryByText('Temp1234!')).not.toBeInTheDocument())
  })

  test('usuario sin lastLogin muestra never', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Bob Agent')).toBeInTheDocument())

    expect(screen.getByText('admin.never')).toBeInTheDocument()
  })

  // ================== SETTINGS TAB ==================
  test('cambiar a pestaña settings carga configuracion', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { settings: mockSettings } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.settings'))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/admin/settings'))
    expect(screen.getByText('admin.generalSettings')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Corp')).toBeInTheDocument()
  })

  test('guardar configuracion general', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { settings: mockSettings } })
    api.put.mockResolvedValueOnce({ data: {} })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.settings'))
    await waitFor(() => expect(screen.getByDisplayValue('Test Corp')).toBeInTheDocument())

    fireEvent.change(screen.getByDisplayValue('Test Corp'), { target: { value: 'Updated Corp' } })

    const saveButtons = screen.getAllByText('admin.saveChanges')
    fireEvent.click(saveButtons[0])

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/admin/settings', {
        section: 'general',
        settings: expect.objectContaining({ companyName: 'Updated Corp' })
      })
    )
    expect(toast.success).toHaveBeenCalledWith('admin.settingsSaved')
  })

  test('guardar notificaciones', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { settings: mockSettings } })
    api.put.mockResolvedValueOnce({ data: {} })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.settings'))
    await waitFor(() => expect(screen.getByText('admin.notifications')).toBeInTheDocument())

    const deadlineInput = screen.getByDisplayValue('3')
    fireEvent.change(deadlineInput, { target: { value: '5' } })

    const saveButtons = screen.getAllByText('admin.saveChanges')
    fireEvent.click(saveButtons[1])

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/admin/settings', {
        section: 'notifications',
        settings: expect.objectContaining({ deadlineAlertDays: 5 })
      })
    )
  })

  test('guardar integraciones', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { settings: mockSettings } })
    api.put.mockResolvedValueOnce({ data: {} })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.settings'))
    await waitFor(() => expect(screen.getByText('admin.integrationsTitle')).toBeInTheDocument())

    const aeatSelect = screen.getByDisplayValue('admin.testEnvironment')
    fireEvent.change(aeatSelect, { target: { value: 'production' } })

    const saveButtons = screen.getAllByText('admin.saveChanges')
    fireEvent.click(saveButtons[2])

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/admin/settings', {
        section: 'integrations',
        settings: expect.objectContaining({ aeatEnvironment: 'production' })
      })
    )
  })

  test('guardar seguridad', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { settings: mockSettings } })
    api.put.mockResolvedValueOnce({ data: {} })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.settings'))
    await waitFor(() => expect(screen.getByText('admin.securityTitle')).toBeInTheDocument())

    const sessionInput = screen.getByDisplayValue('60')
    fireEvent.change(sessionInput, { target: { value: '120' } })

    const saveButtons = screen.getAllByText('admin.saveChanges')
    fireEvent.click(saveButtons[3])

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/admin/settings', {
        section: 'security',
        settings: expect.objectContaining({ sessionTimeout: 120 })
      })
    )
  })

  test('toggle de notificaciones por email', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { settings: mockSettings } })
    api.put.mockResolvedValueOnce({ data: {} })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.settings'))
    await waitFor(() => expect(screen.getByText('admin.notifications')).toBeInTheDocument())

    const emailToggle = screen.getAllByRole('checkbox')[0]
    fireEvent.click(emailToggle)

    const saveButtons = screen.getAllByText('admin.saveChanges')
    fireEvent.click(saveButtons[1])

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/admin/settings', {
        section: 'notifications',
        settings: expect.objectContaining({ emailEnabled: false })
      })
    )
  })

  test('toggle de AEAT habilitado', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { settings: mockSettings } })
    api.put.mockResolvedValueOnce({ data: {} })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.settings'))
    await waitFor(() => expect(screen.getByText('admin.integrationsTitle')).toBeInTheDocument())

    const aeatToggle = screen.getAllByRole('checkbox')[1]
    fireEvent.click(aeatToggle)

    const saveButtons = screen.getAllByText('admin.saveChanges')
    fireEvent.click(saveButtons[2])

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/admin/settings', {
        section: 'integrations',
        settings: expect.objectContaining({ aeatEnabled: false })
      })
    )
  })

  // ================== AUDIT TAB ==================
  test('cambiar a pestaña audit carga logs y stats', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { logs: mockAuditLogs } })
      .mockResolvedValueOnce({ data: { stats: mockAuditStats } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.audit'))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/admin/audit', { params: { module: '', action: '', limit: 50 } })
      expect(api.get).toHaveBeenCalledWith('/api/admin/audit/stats')
    })
    const aliceElements = screen.getAllByText('Alice Admin')
    expect(aliceElements.length).toBeGreaterThan(0)
    expect(screen.getByText('Bob Agent')).toBeInTheDocument()
  })

  test('audit muestra stats totales', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { logs: mockAuditLogs } })
      .mockResolvedValueOnce({ data: { stats: mockAuditStats } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.audit'))

    await waitFor(() => expect(screen.getByText('2450')).toBeInTheDocument())
    expect(screen.getByText('830')).toBeInTheDocument()
  })

  test('audit muestra modulo mas activo', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { logs: mockAuditLogs } })
      .mockResolvedValueOnce({ data: { stats: mockAuditStats } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.audit'))

    await waitFor(() => expect(screen.getByText('admin.mostActiveModule')).toBeInTheDocument())
    const expeditionsElements = screen.getAllByText('expeditions')
    expect(expeditionsElements.length).toBeGreaterThan(0)
  })

  test('audit muestra usuario mas activo', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { logs: mockAuditLogs } })
      .mockResolvedValueOnce({ data: { stats: mockAuditStats } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.audit'))

    await waitFor(() => {
      const aliceTexts = screen.getAllByText('Alice Admin')
      expect(aliceTexts.length).toBeGreaterThan(0)
    })
  })

  test('filtrar audit por modulo', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { logs: mockAuditLogs } })
      .mockResolvedValueOnce({ data: { stats: mockAuditStats } })
      .mockResolvedValueOnce({ data: { logs: [mockAuditLogs[0]] } })
      .mockResolvedValueOnce({ data: { stats: mockAuditStats } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.audit'))
    await waitFor(() => expect(screen.getAllByText('Alice Admin').length).toBeGreaterThan(0))

    const moduleSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(moduleSelect, { target: { value: 'auth' } })

    fireEvent.click(screen.getByText('admin.refresh'))

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/api/admin/audit', { params: { module: 'auth', action: '', limit: 50 } })
    )
  })

  test('filtrar audit por accion', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { logs: mockAuditLogs } })
      .mockResolvedValueOnce({ data: { stats: mockAuditStats } })
      .mockResolvedValueOnce({ data: { logs: [mockAuditLogs[1]] } })
      .mockResolvedValueOnce({ data: { stats: mockAuditStats } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.audit'))
    await waitFor(() => expect(screen.getAllByText('Alice Admin').length).toBeGreaterThan(0))

    const actionSelect = screen.getAllByRole('combobox')[1]
    fireEvent.change(actionSelect, { target: { value: 'CREATE' } })

    fireEvent.click(screen.getByText('admin.refresh'))

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/api/admin/audit', { params: { module: '', action: 'CREATE', limit: 50 } })
    )
  })

  test('audit muestra iconos de accion correctos', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { logs: mockAuditLogs } })
      .mockResolvedValueOnce({ data: { stats: mockAuditStats } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.audit'))

    await waitFor(() => expect(screen.getAllByText('Alice Admin').length).toBeGreaterThan(0))
    expect(screen.getByText('LOGIN')).toBeInTheDocument()
    expect(screen.getByText('CREATE')).toBeInTheDocument()
  })

  test('audit con logs vacíos no rompe', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { logs: [] } })
      .mockResolvedValueOnce({ data: { stats: {} } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.audit'))

    await waitFor(() => expect(screen.getByText('admin.totalEventsAudit')).toBeInTheDocument())
  })

  // ================== ERROR HANDLERS ==================
  test('actualizar usuario con error muestra toast', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.put.mockRejectedValueOnce(new Error('Update failed'))

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const editButtons = screen.getAllByTitle('Editar')
    fireEvent.click(editButtons[0])

    fireEvent.change(screen.getByDisplayValue('Alice Admin'), { target: { value: 'Alice Updated' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('admin.errorUpdatingUser'))
  })

  test('resetear password con error muestra toast', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.post.mockRejectedValueOnce(new Error('Reset failed'))

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const resetButtons = screen.getAllByTitle('Restablecer contraseña')
    fireEvent.click(resetButtons[0])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('admin.errorResetPassword'))
  })

  test('eliminar usuario con error muestra toast', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
    api.delete.mockRejectedValueOnce(new Error('Delete failed'))

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('admin.errorDeletingUser'))
  })

  test('eliminar usuario cancelado no llama a la API', async () => {
    window.confirm.mockReturnValueOnce(false)
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())

    const deleteButtons = screen.getAllByTitle('Eliminar')
    fireEvent.click(deleteButtons[0])

    expect(api.delete).not.toHaveBeenCalled()
  })

  test('guardar settings con error muestra toast', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { settings: mockSettings } })
    api.put.mockRejectedValueOnce(new Error('Save failed'))

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('admin.settings'))
    await waitFor(() => expect(screen.getByDisplayValue('Test Corp')).toBeInTheDocument())

    fireEvent.change(screen.getByDisplayValue('Test Corp'), { target: { value: 'Updated Corp' } })

    const saveButtons = screen.getAllByText('admin.saveChanges')
    fireEvent.click(saveButtons[0])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('admin.errorSaving'))
  })

  // ================== LOADING STATES ==================
  test('muestra spinner mientras carga datos', async () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // ================== TAB SWITCHING ==================
  test('cambiar entre pestañas múltiples veces recarga datos', async () => {
    api.get
      .mockResolvedValueOnce({ data: mockDashboardStats })
      .mockResolvedValueOnce({ data: { users: mockUsers } })
      .mockResolvedValueOnce({ data: { roles: mockRoles } })
      .mockResolvedValueOnce({ data: mockDashboardStats })

    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    )
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/admin/dashboard'))

    fireEvent.click(screen.getByText('admin.users'))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/admin/users'))

    fireEvent.click(screen.getByText('admin.dashboard'))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(4))
  })
})
