import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import * as cognitoService from '../services/cognitoService'
import api from '../services/api'

// Mock dependencies
vi.mock('../services/cognitoService')
vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    defaults: {
      headers: {
        common: {}
      }
    }
  }
}))

describe('AuthContext', () => {
  let localStorageMock = {}

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {}
    global.localStorage = {
      getItem: vi.fn((key) => localStorageMock[key] || null),
      setItem: vi.fn((key, value) => {
        localStorageMock[key] = value
      }),
      removeItem: vi.fn((key) => {
        delete localStorageMock[key]
      }),
      clear: vi.fn(() => {
        localStorageMock = {}
      })
    }

    // Reset API mock
    api.defaults.headers.common = {}
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress console.error for this test as it's expected
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')

      consoleError.mockRestore()
    })

    it('returns context value when used inside AuthProvider', () => {
      cognitoService.isConfigured = vi.fn(() => false)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      expect(result.current).toHaveProperty('user')
      expect(result.current).toHaveProperty('isAuthenticated')
      expect(result.current).toHaveProperty('loading')
      expect(result.current).toHaveProperty('login')
      expect(result.current).toHaveProperty('register')
      expect(result.current).toHaveProperty('logout')
    })
  })

  describe('AuthProvider initial state', () => {
    it('starts with user null and eventually sets loading to false', async () => {
      cognitoService.isConfigured = vi.fn(() => false)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      // Initial state - user should be null
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)

      // Wait for loading to finish
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('sets loading to false after initialization', async () => {
      cognitoService.isConfigured = vi.fn(() => false)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('Session restoration - JWT mode (Cognito not configured)', () => {
    beforeEach(() => {
      cognitoService.isConfigured = vi.fn(() => false)
    })

    it('restores session from localStorage with valid token and user', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
      const mockToken = 'mock-jwt-token'

      localStorageMock['token'] = mockToken
      localStorageMock['user'] = JSON.stringify(mockUser)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(api.defaults.headers.common['Authorization']).toBe(`Bearer ${mockToken}`)
    })

    it('does not restore session when token missing', async () => {
      localStorageMock['user'] = JSON.stringify({ id: '1', email: 'test@example.com' })
      // No token in localStorage

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('does not restore session when user missing', async () => {
      localStorageMock['token'] = 'mock-token'
      // No user in localStorage

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('handles malformed JSON in localStorage gracefully', async () => {
      localStorageMock['token'] = 'mock-token'
      localStorageMock['user'] = 'invalid-json{{'

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('Session restoration - Cognito mode', () => {
    beforeEach(() => {
      cognitoService.isConfigured = vi.fn(() => true)
    })

    it('restores session from Cognito when configured', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
      const mockAccessToken = 'cognito-access-token'

      const mockSession = {
        getAccessToken: () => ({
          getJwtToken: () => mockAccessToken
        })
      }

      cognitoService.getSession = vi.fn(() => Promise.resolve(mockSession))
      api.post.mockResolvedValue({
        data: {
          success: true,
          data: { user: mockUser }
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(cognitoService.getSession).toHaveBeenCalled()
      expect(api.post).toHaveBeenCalledWith('/api/auth/session', { accessToken: mockAccessToken })
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser))
    })

    it('handles Cognito session restoration failure gracefully', async () => {
      cognitoService.getSession = vi.fn(() => Promise.reject(new Error('Session expired')))

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('handles API /auth/session failure in Cognito mode', async () => {
      const mockAccessToken = 'cognito-access-token'

      const mockSession = {
        getAccessToken: () => ({
          getJwtToken: () => mockAccessToken
        })
      }

      cognitoService.getSession = vi.fn(() => Promise.resolve(mockSession))
      api.post.mockResolvedValue({
        data: {
          success: false,
          error: 'Invalid token'
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('login - JWT mode', () => {
    beforeEach(() => {
      cognitoService.isConfigured = vi.fn(() => false)
    })

    it('logs in successfully with valid credentials', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
      const mockToken = 'jwt-token'

      api.post.mockResolvedValue({
        data: {
          success: true,
          data: { token: mockToken, user: mockUser }
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let loginResult
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password123')
      })

      expect(loginResult.success).toBe(true)
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('token', mockToken)
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser))
      expect(api.defaults.headers.common['Authorization']).toBe(`Bearer ${mockToken}`)
    })

    it('returns error on invalid credentials', async () => {
      api.post.mockResolvedValue({
        data: {
          success: false,
          error: 'Invalid credentials'
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let loginResult
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'wrongpassword')
      })

      expect(loginResult.success).toBe(false)
      expect(loginResult.error).toBe('Invalid credentials')
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('handles network error during login', async () => {
      api.post.mockRejectedValue({
        response: {
          data: { error: 'Network error' }
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let loginResult
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password')
      })

      expect(loginResult.success).toBe(false)
      expect(loginResult.error).toBe('Network error')
    })

    it('handles API error without response.data.error', async () => {
      api.post.mockRejectedValue(new Error('Unexpected error'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let loginResult
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password')
      })

      expect(loginResult.success).toBe(false)
      expect(loginResult.error).toBe('Unexpected error')
    })
  })

  describe('login - Cognito mode', () => {
    beforeEach(() => {
      cognitoService.isConfigured = vi.fn(() => true)
    })

    it('logs in successfully via Cognito', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
      const mockAccessToken = 'cognito-access-token'

      const mockSession = {
        getAccessToken: () => ({
          getJwtToken: () => mockAccessToken
        })
      }

      cognitoService.signIn = vi.fn(() => Promise.resolve(mockSession))
      api.post.mockResolvedValue({
        data: {
          success: true,
          data: { user: mockUser }
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let loginResult
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password123')
      })

      expect(loginResult.success).toBe(true)
      expect(cognitoService.signIn).toHaveBeenCalledWith('test@example.com', 'password123')
      expect(api.post).toHaveBeenCalledWith('/api/auth/session', { accessToken: mockAccessToken })
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('handles UserNotConfirmedException', async () => {
      const error = new Error('User not confirmed')
      error.code = 'UserNotConfirmedException'

      cognitoService.signIn = vi.fn(() => Promise.reject(error))

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let loginResult
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password123')
      })

      expect(loginResult.success).toBe(false)
      expect(loginResult.needsConfirmation).toBe(true)
      expect(loginResult.error).toContain('no verificada')
      expect(result.current.needsConfirmation).toBe(true)
      expect(result.current.pendingEmail).toBe('test@example.com')
    })

    it('handles NewPasswordRequiredException', async () => {
      const mockCognitoUser = { username: 'test@example.com' }
      const error = new Error('New password required')
      error.code = 'NewPasswordRequiredException'
      error.cognitoUser = mockCognitoUser

      cognitoService.signIn = vi.fn(() => Promise.reject(error))

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let loginResult
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'tempPassword')
      })

      expect(loginResult.success).toBe(false)
      expect(loginResult.needsNewPassword).toBe(true)
      expect(loginResult.error).toContain('contrasena temporal')

      await waitFor(() => {
        expect(result.current.needsNewPassword).toBe(true)
        expect(result.current.pendingEmail).toBe('test@example.com')
      })

      // pendingCognitoUser is internal state and may not be directly testable
    })

    it('handles Cognito API failure in session endpoint', async () => {
      const mockAccessToken = 'cognito-access-token'

      const mockSession = {
        getAccessToken: () => ({
          getJwtToken: () => mockAccessToken
        })
      }

      cognitoService.signIn = vi.fn(() => Promise.resolve(mockSession))
      api.post.mockResolvedValue({
        data: {
          success: false,
          error: 'Session validation failed'
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let loginResult
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password')
      })

      expect(loginResult.success).toBe(false)
      expect(loginResult.error).toBe('Session validation failed')
    })
  })

  describe('register - JWT mode', () => {
    beforeEach(() => {
      cognitoService.isConfigured = vi.fn(() => false)
    })

    it('registers successfully and logs in', async () => {
      const mockUser = { id: '1', email: 'new@example.com', name: 'New User' }
      const mockToken = 'jwt-token'

      api.post.mockResolvedValue({
        data: {
          success: true,
          data: { token: mockToken, user: mockUser }
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let registerResult
      await act(async () => {
        registerResult = await result.current.register('New', 'User', 'new@example.com', 'password123', 'ACME Corp')
      })

      expect(registerResult.success).toBe(true)
      expect(api.post).toHaveBeenCalledWith('/api/auth/register', {
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
        companyName: 'ACME Corp'
      })
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('handles registration failure', async () => {
      api.post.mockResolvedValue({
        data: {
          success: false,
          error: 'Email already exists'
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let registerResult
      await act(async () => {
        registerResult = await result.current.register('New', 'User', 'existing@example.com', 'password123', 'ACME')
      })

      expect(registerResult.success).toBe(false)
      expect(registerResult.error).toBe('Email already exists')
      expect(result.current.user).toBeNull()
    })

    it('handles network error during registration', async () => {
      api.post.mockRejectedValue(new Error('Network failure'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let registerResult
      await act(async () => {
        registerResult = await result.current.register('New', 'User', 'new@example.com', 'password', 'ACME')
      })

      expect(registerResult.success).toBe(false)
      expect(registerResult.error).toBe('Network failure')
    })
  })

  describe('register - Cognito mode', () => {
    beforeEach(() => {
      cognitoService.isConfigured = vi.fn(() => true)
    })

    it('registers successfully via Cognito and sets needsConfirmation', async () => {
      cognitoService.signUp = vi.fn(() => Promise.resolve())

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let registerResult
      await act(async () => {
        registerResult = await result.current.register('John', 'Doe', 'john@example.com', 'password123', 'ACME')
      })

      expect(registerResult.success).toBe(true)
      expect(registerResult.needsConfirmation).toBe(true)
      expect(cognitoService.signUp).toHaveBeenCalledWith('john@example.com', 'password123', 'John', 'Doe', 'ACME')
      expect(result.current.needsConfirmation).toBe(true)
      expect(result.current.pendingEmail).toBe('john@example.com')
      expect(result.current.user).toBeNull()
    })

    it('handles Cognito signUp failure', async () => {
      cognitoService.signUp = vi.fn(() => Promise.reject(new Error('Email already in use')))

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let registerResult
      await act(async () => {
        registerResult = await result.current.register('Jane', 'Doe', 'jane@example.com', 'password', 'Corp')
      })

      expect(registerResult.success).toBe(false)
      expect(registerResult.error).toBe('Email already in use')
    })
  })

  describe('confirmSignUp', () => {
    beforeEach(() => {
      cognitoService.isConfigured = vi.fn(() => true)
    })

    it('confirms signup successfully', async () => {
      cognitoService.confirmSignUp = vi.fn(() => Promise.resolve())
      cognitoService.signUp = vi.fn(() => Promise.resolve())

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Set pending email first by registering
      await act(async () => {
        await result.current.register('John', 'Doe', 'john@example.com', 'password', 'ACME')
      })

      // Wait for pendingEmail to be set
      await waitFor(() => {
        expect(result.current.pendingEmail).toBe('john@example.com')
      })

      let confirmResult
      await act(async () => {
        confirmResult = await result.current.confirmSignUp('123456')
      })

      expect(confirmResult.success).toBe(true)
      expect(cognitoService.confirmSignUp).toHaveBeenCalledWith('john@example.com', '123456')

      await waitFor(() => {
        expect(result.current.needsConfirmation).toBe(false)
      })
    })

    it('handles incorrect confirmation code', async () => {
      cognitoService.confirmSignUp = vi.fn(() => Promise.reject(new Error('Invalid code')))
      cognitoService.signUp = vi.fn(() => Promise.resolve())

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.register('John', 'Doe', 'john@example.com', 'password', 'ACME')
      })

      // Wait for registration to set pendingEmail
      await waitFor(() => {
        expect(result.current.pendingEmail).toBe('john@example.com')
      })

      let confirmResult
      await act(async () => {
        confirmResult = await result.current.confirmSignUp('000000')
      })

      expect(confirmResult.success).toBe(false)
      expect(confirmResult.error).toBe('Invalid code')
    })
  })

  describe('completeNewPassword', () => {
    beforeEach(() => {
      cognitoService.isConfigured = vi.fn(() => true)
    })

    it('completes new password successfully and logs in', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
      const mockAccessToken = 'new-access-token'
      const mockCognitoUser = { username: 'test@example.com' }

      const mockSession = {
        getAccessToken: () => ({
          getJwtToken: () => mockAccessToken
        })
      }

      cognitoService.completeNewPassword = vi.fn(() => Promise.resolve(mockSession))
      api.post.mockResolvedValue({
        data: {
          success: true,
          data: { user: mockUser }
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Simulate NewPasswordRequiredException flow
      const error = new Error('New password required')
      error.code = 'NewPasswordRequiredException'
      error.cognitoUser = mockCognitoUser
      cognitoService.signIn = vi.fn(() => Promise.reject(error))

      await act(async () => {
        await result.current.login('test@example.com', 'tempPassword')
      })

      let completeResult
      await act(async () => {
        completeResult = await result.current.completeNewPassword('newPassword123')
      })

      expect(completeResult.success).toBe(true)
      expect(cognitoService.completeNewPassword).toHaveBeenCalledWith(mockCognitoUser, 'newPassword123')
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.needsNewPassword).toBe(false)
    })

    it('handles completeNewPassword failure', async () => {
      const mockCognitoUser = { username: 'test@example.com' }

      cognitoService.completeNewPassword = vi.fn(() => Promise.reject(new Error('Password too weak')))
      cognitoService.signIn = vi.fn(() => {
        const error = new Error('New password required')
        error.code = 'NewPasswordRequiredException'
        error.cognitoUser = mockCognitoUser
        return Promise.reject(error)
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.login('test@example.com', 'tempPassword')
      })

      let completeResult
      await act(async () => {
        completeResult = await result.current.completeNewPassword('weak')
      })

      expect(completeResult.success).toBe(false)
      expect(completeResult.error).toBe('Password too weak')
    })
  })

  describe('logout', () => {
    beforeEach(() => {
      cognitoService.isConfigured = vi.fn(() => false)
    })

    it('clears user state and localStorage', async () => {
      const mockUser = { id: '1', email: 'test@example.com' }
      const mockToken = 'jwt-token'

      api.post.mockResolvedValue({
        data: {
          success: true,
          data: { token: mockToken, user: mockUser }
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Login first
      await act(async () => {
        await result.current.login('test@example.com', 'password')
      })

      expect(result.current.user).toEqual(mockUser)

      // Now logout
      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('user')
      expect(api.defaults.headers.common['Authorization']).toBeUndefined()
    })

    it('calls Cognito signOut when configured', async () => {
      cognitoService.isConfigured = vi.fn(() => true)
      cognitoService.signOut = vi.fn(() => Promise.resolve())
      cognitoService.signIn = vi.fn(() => {
        const mockSession = {
          getAccessToken: () => ({
            getJwtToken: () => 'token'
          })
        }
        return Promise.resolve(mockSession)
      })

      api.post.mockResolvedValue({
        data: {
          success: true,
          data: { user: { id: '1', email: 'test@example.com' } }
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.login('test@example.com', 'password')
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(cognitoService.signOut).toHaveBeenCalled()
      expect(result.current.user).toBeNull()
    })

    it('handles Cognito signOut errors gracefully', async () => {
      cognitoService.isConfigured = vi.fn(() => true)
      cognitoService.signOut = vi.fn(() => Promise.reject(new Error('Signout failed')))
      cognitoService.signIn = vi.fn(() => {
        const mockSession = {
          getAccessToken: () => ({
            getJwtToken: () => 'token'
          })
        }
        return Promise.resolve(mockSession)
      })

      api.post.mockResolvedValue({
        data: {
          success: true,
          data: { user: { id: '1', email: 'test@example.com' } }
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.login('test@example.com', 'password')
      })

      // Should not throw even if signOut fails
      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(localStorage.removeItem).toHaveBeenCalled()
    })
  })

  describe('context value properties', () => {
    beforeEach(() => {
      cognitoService.isConfigured = vi.fn(() => false)
    })

    it('provides all expected properties in context value', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current).toHaveProperty('user')
      expect(result.current).toHaveProperty('isAuthenticated')
      expect(result.current).toHaveProperty('loading')
      expect(result.current).toHaveProperty('needsConfirmation')
      expect(result.current).toHaveProperty('needsNewPassword')
      expect(result.current).toHaveProperty('pendingEmail')
      expect(result.current).toHaveProperty('login')
      expect(result.current).toHaveProperty('register')
      expect(result.current).toHaveProperty('logout')
      expect(result.current).toHaveProperty('confirmSignUp')
      expect(result.current).toHaveProperty('completeNewPassword')
    })

    it('isAuthenticated is true when user is set', async () => {
      const mockUser = { id: '1', email: 'test@example.com' }
      const mockToken = 'token'

      api.post.mockResolvedValue({
        data: {
          success: true,
          data: { token: mockToken, user: mockUser }
        }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.login('test@example.com', 'password')
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(mockUser)
    })

    it('isAuthenticated is false when user is null', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })
  })
})
