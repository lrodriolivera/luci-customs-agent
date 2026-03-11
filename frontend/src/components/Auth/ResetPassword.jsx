import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const { t } = useTranslation()
  const { token } = useParams()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast.error(t('auth.passwordMismatch'))
      return
    }

    if (formData.password.length < 6) {
      toast.error(t('auth.resetError'))
      return
    }

    setLoading(true)

    try {
      const response = await authAPI.resetPassword(token, formData.password)

      if (response.data.success) {
        toast.success(t('auth.resetSuccess'))
        navigate('/login')
      } else {
        toast.error(response.data.error || t('auth.resetError'))
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error || t('auth.resetError')
      )
    }

    setLoading(false)
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-luci-light via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-luci rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-4xl font-bold">L</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">LUCI</h1>
          <p className="text-gray-600 mt-1">{t('auth.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            {t('auth.resetTitle')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="label">{t('auth.newPassword')}</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input"
                placeholder="Minimo 6 caracteres"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">{t('auth.confirmPassword')}</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input"
                placeholder="Repite tu contrasena"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('auth.resetting')}
                </span>
              ) : (
                t('auth.resetButton')
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            <Link to="/login" className="text-luci hover:text-luci-dark font-medium">
              {t('auth.backToLogin')}
            </Link>
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          STRIX AI &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
