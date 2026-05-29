import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

export default function VerificationCode({ email, onConfirm, onResend }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (code.length !== 6) {
      toast.error(t('auth.codeLength'))
      return
    }
    setLoading(true)
    await onConfirm(code)
    setLoading(false)
  }

  const handleResend = async () => {
    setResending(true)
    const result = await onResend()
    if (result.success) {
      toast.success(t('auth.codeResent'))
    } else {
      toast.error(result.error)
    }
    setResending(false)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">
        {t('auth.verifyTitle')}
      </h2>
      <p className="text-sm text-gray-600 text-center mb-6">
        {t('auth.verifySubtitle')} <strong>{email}</strong>
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="code" className="label">
            {t('auth.verificationCode')}
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="input text-center text-2xl tracking-[0.5em] font-mono"
            placeholder="000000"
            maxLength={6}
            autoFocus
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full btn-primary py-3 text-base"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('auth.verifying')}
            </span>
          ) : (
            t('auth.verifyButton')
          )}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-luci hover:text-luci-dark"
        >
          {resending ? t('auth.resending') : t('auth.resendCode')}
        </button>
      </div>
    </div>
  )
}
