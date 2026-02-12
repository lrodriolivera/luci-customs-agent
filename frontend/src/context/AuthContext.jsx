import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (token && storedUser) {
      setUser(JSON.parse(storedUser))
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    setLoading(false)
  }, [])

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password })

      // Handle backend response format: { success, data: { user, token } }
      if (response.data.success && response.data.data) {
        const { token, user: userData } = response.data.data

        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(userData))
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`

        setUser(userData)
        return { success: true }
      } else {
        return {
          success: false,
          error: response.data.error || 'Error al iniciar sesion'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al iniciar sesion'
      }
    }
  }

  const register = async (name, email, password, companyName) => {
    try {
      const response = await api.post('/api/auth/register', { name, email, password, companyName })

      if (response.data.success && response.data.data) {
        const { token, user: userData } = response.data.data

        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(userData))
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`

        setUser(userData)
        return { success: true }
      } else {
        return { success: false, error: response.data.error || 'Error al crear la cuenta' }
      }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al crear la cuenta' }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
