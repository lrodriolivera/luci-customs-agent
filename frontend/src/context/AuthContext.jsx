import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import * as cognitoService from '../services/cognitoService'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [needsNewPassword, setNeedsNewPassword] = useState(false)
  const [pendingEmail, setPendingEmail] = useState(null)
  const [pendingCognitoUser, setPendingCognitoUser] = useState(null)

  useEffect(() => {
    const restoreSession = async () => {
      try {
        if (cognitoService.isConfigured()) {
          const session = await cognitoService.getSession()
          const accessToken = session.getAccessToken().getJwtToken()
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
          const response = await api.post('/api/auth/session', { accessToken })
          if (response.data.success) {
            setUser(response.data.data.user)
            localStorage.setItem('user', JSON.stringify(response.data.data.user))
          }
        } else {
          const token = localStorage.getItem('token')
          const storedUser = localStorage.getItem('user')
          if (token && storedUser) {
            setUser(JSON.parse(storedUser))
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          }
        }
      } catch (_) {
        // Sesión expirada o no existe — usuario no autenticado
      } finally {
        setLoading(false)
      }
    }
    restoreSession()
  }, [])

  const login = async (email, password) => {
    try {
      if (cognitoService.isConfigured()) {
        const session = await cognitoService.signIn(email, password)
        const accessToken = session.getAccessToken().getJwtToken()
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
        const response = await api.post('/api/auth/session', { accessToken })
        if (response.data.success) {
          setUser(response.data.data.user)
          localStorage.setItem('user', JSON.stringify(response.data.data.user))
          return { success: true }
        }
        return { success: false, error: response.data.error || 'Error al iniciar sesion' }
      } else {
        const response = await api.post('/api/auth/login', { email, password })
        if (response.data.success && response.data.data) {
          const { token, user: userData } = response.data.data
          localStorage.setItem('token', token)
          localStorage.setItem('user', JSON.stringify(userData))
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          setUser(userData)
          return { success: true }
        }
        return { success: false, error: response.data.error || 'Error al iniciar sesion' }
      }
    } catch (error) {
      if (error.code === 'UserNotConfirmedException') {
        setNeedsConfirmation(true)
        setPendingEmail(email)
        return { success: false, error: 'Cuenta no verificada. Revisa tu email.', needsConfirmation: true }
      }
      if (error.code === 'NewPasswordRequiredException') {
        setNeedsNewPassword(true)
        setPendingCognitoUser(error.cognitoUser)
        setPendingEmail(email)
        return { success: false, error: 'Debes cambiar tu contrasena temporal.', needsNewPassword: true }
      }
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Error al iniciar sesion',
      }
    }
  }

  const register = async (givenName, familyName, email, password, companyName) => {
    try {
      if (cognitoService.isConfigured()) {
        await cognitoService.signUp(email, password, givenName, familyName, companyName)
        setNeedsConfirmation(true)
        setPendingEmail(email)
        return { success: true, needsConfirmation: true }
      } else {
        const name = [givenName, familyName].filter(Boolean).join(' ')
        const response = await api.post('/api/auth/register', { name, email, password, companyName })
        if (response.data.success && response.data.data) {
          const { token, user: userData } = response.data.data
          localStorage.setItem('token', token)
          localStorage.setItem('user', JSON.stringify(userData))
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          setUser(userData)
          return { success: true }
        }
        return { success: false, error: response.data.error || 'Error al crear la cuenta' }
      }
    } catch (error) {
      return { success: false, error: error.message || 'Error al crear la cuenta' }
    }
  }

  const confirmSignUp = async (code) => {
    try {
      await cognitoService.confirmSignUp(pendingEmail, code)
      setNeedsConfirmation(false)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message || 'Codigo incorrecto' }
    }
  }

  const completeNewPassword = async (newPassword) => {
    try {
      const session = await cognitoService.completeNewPassword(pendingCognitoUser, newPassword)
      const accessToken = session.getAccessToken().getJwtToken()
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      const response = await api.post('/api/auth/session', { accessToken })
      if (response.data.success) {
        setUser(response.data.data.user)
        localStorage.setItem('user', JSON.stringify(response.data.data.user))
        setNeedsNewPassword(false)
        return { success: true }
      }
      return { success: false, error: 'Error al iniciar sesion tras cambio de contrasena' }
    } catch (error) {
      return { success: false, error: error.message || 'Error al cambiar contrasena' }
    }
  }

  const logout = async () => {
    try {
      if (cognitoService.isConfigured()) cognitoService.signOut()
    } catch (_) {}
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    needsConfirmation,
    needsNewPassword,
    pendingEmail,
    login,
    register,
    logout,
    confirmSignUp,
    completeNewPassword,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
