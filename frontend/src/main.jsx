import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import App from './App'
import './styles/index.css'
import './i18n/i18n'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Network Error',
      'Non-Error promise rejection captured'
    ]
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
