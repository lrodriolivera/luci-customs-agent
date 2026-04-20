import React from 'react'
import * as Sentry from '@sentry/react'
import i18n from '../i18n/i18n'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, eventId: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, errorInfo)
    }
    try {
      const eventId = Sentry.captureException(error, {
        contexts: { react: { componentStack: errorInfo?.componentStack } }
      })
      this.setState({ eventId })
    } catch (_) { /* Sentry may be disabled */ }
  }

  render() {
    const t = i18n.t.bind(i18n)

    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('errorBoundary.title')}</h1>
            <p className="text-gray-600 mb-6">
              {t('errorBoundary.description')}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark font-medium"
              >
                {t('errorBoundary.reload')}
              </button>
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/' }}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                {t('errorBoundary.goHome')}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-6">soporte@strixai.es</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
