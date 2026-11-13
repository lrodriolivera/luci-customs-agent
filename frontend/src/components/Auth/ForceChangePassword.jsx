import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

// Misma politica que el servidor (backend/src/utils/passwordPolicy.js):
// 10-128 caracteres, con al menos una letra y un numero. Validar aqui
// tambien evita un viaje al servidor solo para que lo rechace igual.
const MIN_LENGTH = 10
const REGEX_LETRA = /[A-Za-z]/
const REGEX_NUMERO = /\d/

function cumplePoliticaDePassword(password) {
  return typeof password === 'string' &&
    password.length >= MIN_LENGTH &&
    REGEX_LETRA.test(password) &&
    REGEX_NUMERO.test(password)
}

/**
 * Pantalla de primer acceso: se muestra en lugar de la app cuando el usuario
 * entro con la contrasena temporal de una invitacion (admin/invite) y aun no
 * la ha cambiado (user.mustChangePassword === true). El backend bloquea el
 * resto de rutas con 403 MUST_CHANGE_PASSWORD mientras esto no se complete,
 * asi que no hay ninguna otra accion disponible en esta pantalla.
 */
export default function ForceChangePassword() {
  const { t } = useTranslation()
  const { completeMandatoryPasswordChange, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error(t('auth.passwordMismatch'))
      return
    }
    if (!cumplePoliticaDePassword(newPassword)) {
      toast.error(t('auth.passwordPolicyError'))
      return
    }
    setLoading(true)
    const result = await completeMandatoryPasswordChange(currentPassword, newPassword)
    setLoading(false)
    if (!result.success) {
      toast.error(result.error || t('auth.changePasswordError'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">
          {t('auth.newPasswordTitle')}
        </h2>
        <p className="text-sm text-gray-600 text-center mb-6">
          {t('auth.newPasswordSubtitle')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="currentPassword" className="label">
              {t('auth.temporaryPasswordLabel')}
            </label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="label">
              {t('auth.newPassword')}
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              placeholder="Min. 10 caracteres, con letra y numero"
              required
              minLength={10}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="label">
              {t('auth.confirmPassword')}
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              required
              minLength={10}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-base"
          >
            {loading ? t('auth.saving') : t('auth.savePassword')}
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            {t('nav.logout')}
          </button>
        </form>
      </div>
    </div>
  )
}
