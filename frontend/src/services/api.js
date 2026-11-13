import axios from 'axios'
import * as Sentry from '@sentry/react'
import i18n from '../i18n/i18n'
import * as cognitoService from './cognitoService'
import { seg } from '../utils/seg'
import { esRutaPublica } from './rutasPublicas'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor — Cognito token primero, legacy fallback
api.interceptors.request.use(
  async (config) => {
    if (!config.headers.Authorization && !esRutaPublica(config.url)) {
      if (cognitoService.isConfigured()) {
        try {
          const accessToken = await cognitoService.getAccessToken()
          config.headers.Authorization = `Bearer ${accessToken}`
        } catch (_) {
          const token = localStorage.getItem('token')
          if (token) config.headers.Authorization = `Bearer ${token}`
        }
      } else {
        const token = localStorage.getItem('token')
        if (token) config.headers.Authorization = `Bearer ${token}`
      }
    }
    try {
      Sentry.addBreadcrumb({
        category: 'http',
        message: `${config.method?.toUpperCase()} ${config.url}`,
        level: 'info'
      })
    } catch (_) { /* ignore */ }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const originalRequest = error.config

    // Llamadas públicas: sin reintento con token ni cierre de sesión forzado.
    if (esRutaPublica(originalRequest?.url)) {
      return Promise.reject(error)
    }

    if (status === 401 && !originalRequest._retry && !originalRequest?.url?.includes('/session')) {
      originalRequest._retry = true
      if (cognitoService.isConfigured()) {
        try {
          const accessToken = await cognitoService.getAccessToken()
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } catch (_) { /* session expired */ }
      }
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    if (status >= 500) {
      try {
        Sentry.captureException(error, {
          tags: { type: 'api_error', status, url: error.config?.url }
        })
      } catch (_) { /* ignore */ }
    }
    return Promise.reject(error)
  }
)

// Export vacío para compatibilidad con imports existentes
export const initTokenRefresh = () => {}

// API Methods

// Auth
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (data) => api.post('/api/auth/register', data),
  profile: () => api.get('/api/auth/me'),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post(`/api/auth/reset-password/${seg(token)}`, { password })
}

// Expeditions
export const expeditionsAPI = {
  list: (params) => api.get('/api/expeditions', { params }),
  get: (id) => api.get(`/api/expeditions/${seg(id)}`),
  create: (data) => api.post('/api/expeditions', data),
  update: (id, data) => api.put(`/api/expeditions/${seg(id)}`, data),
  delete: (id) => api.delete(`/api/expeditions/${seg(id)}`),
  getChecklist: (id) => api.get(`/api/expeditions/${seg(id)}/checklist`),
  sendPortalLink: (id, email) => api.post(`/api/expeditions/${seg(id)}/send-portal-link`, { email }),
  getStats: () => api.get('/api/expeditions/stats'),

  // AI-Powered Endpoints - LUCI Integration
  aiSuggestDocuments: (id) =>
    api.post(`/api/expeditions/${seg(id)}/ai/suggest-documents`, {}, { timeout: 60000 }),
  aiAnalyzeRisk: (id) =>
    api.post(`/api/expeditions/${seg(id)}/ai/analyze-risk`, {}, { timeout: 90000 }),
  aiSuggestTaric: (id) =>
    api.post(`/api/expeditions/${seg(id)}/ai/suggest-taric`, {}, { timeout: 120000 }),
  aiDetectInconsistencies: (id) =>
    api.post(`/api/expeditions/${seg(id)}/ai/detect-inconsistencies`, {}, { timeout: 60000 }),
  aiFullAnalysis: (id) =>
    api.post(`/api/expeditions/${seg(id)}/ai/full-analysis`, {}, { timeout: 180000 }),
  getAiAnalysis: (id) =>
    api.get(`/api/expeditions/${seg(id)}/ai/analysis`),
  applyTaricSuggestion: (id, itemIndex, taricCode, hsCode) =>
    api.post(`/api/expeditions/${seg(id)}/ai/apply-taric/${seg(itemIndex)}`, { taricCode, hsCode })
}

// Documents
export const documentsAPI = {
  // La ruta real es POST /api/documents/upload, con el expediente y el tipo en
  // el cuerpo multipart. Apuntaba a /api/expeditions/:id/documents, que no
  // existe en el backend, y ninguna pantalla la usaba: el agente no tenia forma
  // de adjuntar documentacion al expediente.
  upload: (expeditionId, file, documentType, { documentDate } = {}) => {
    const formData = new FormData()
    formData.append('expeditionId', expeditionId)
    formData.append('documentType', documentType)
    // Fecha del propio documento (AAAA-MM-DD); obligatoria en la autorizacion de despacho.
    if (documentDate) formData.append('documentDate', documentDate)
    // El fichero va el ultimo: multer solo ve los campos de texto anteriores.
    formData.append('file', file)
    return api.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Un PDF escaneado de 50 MB no sube en los 30 s por defecto.
      timeout: 120000
    })
  },
  // Alta desde la documentacion: sube y lee un documento antes de que exista
  // el expediente. Devuelve el borrador y lo leido; se adjunta al crear el
  // expediente (draftDocuments en expeditionsAPI.create).
  readDraft: (file, documentType) => {
    const formData = new FormData()
    formData.append('documentType', documentType)
    formData.append('file', file)
    return api.post('/api/documents/drafts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000
    })
  },
  removeDraft: (draftId) => api.delete(`/api/documents/drafts/${seg(draftId)}`),
  // Lee el documento con IA y devuelve lo leido y la propuesta de cambios. No
  // modifica el expediente. La lectura tarda unos 10 s por documento.
  read: (expeditionId, docId) =>
    api.post(`/api/documents/${seg(expeditionId)}/${seg(docId)}/extract`, {}, { timeout: 120000 }),
  // Propuesta de un documento ya leido, sin volver a llamar a la IA.
  proposal: (expeditionId, docId) => api.get(`/api/documents/${seg(expeditionId)}/${seg(docId)}/proposal`),
  // Aplica al expediente solo los datos marcados.
  apply: (expeditionId, docId, fields) =>
    api.post(`/api/documents/${seg(expeditionId)}/${seg(docId)}/apply`, { fields }),
  // Fichero original, para abrirlo en otra pestaña.
  download: (expeditionId, docId) =>
    api.get(`/api/documents/${seg(expeditionId)}/${seg(docId)}`, { responseType: 'blob', timeout: 120000 }),
  // Elimina un documento del expediente (subido por error). Devuelve el expediente.
  remove: (expeditionId, docId) => api.delete(`/api/documents/${seg(expeditionId)}/${seg(docId)}`)
}

// Classification
export const classificationAPI = {
  // La ruta real es /api/classification/suggest (POST). Apuntaba a /ai/classify,
  // que no existe en el backend y devolvia 405, dejando el boton "Clasificar" de
  // la pestaña Basico sin funcionar. El backend lee additionalInfo (camelCase).
  classify: (data) => api.post('/api/classification/suggest', data, { timeout: 90000 }),
  // Igual: /ai/validate-classification no existe (405). La ruta es
  // /api/classification/validate (POST) y lee el cuerpo, no query params.
  validate: (taricCode, description, origin) =>
    api.post('/api/classification/validate', { taricCode, description, origin }),
  search: (query) => api.get('/api/classification/search', { params: { q: query } }),
  searchByChapter: (chapter) => api.get('/api/classification/search', { params: { chapter } }),
  suggest: (data) => api.post('/api/classification/suggest', data, { timeout: 90000 }),
  getTaricInfo: (code) => api.get(`/api/classification/taric/${seg(code)}`),
  getChapters: () => api.get('/api/classification/chapters'),
  getTreeData: (parent) => api.get('/api/classification/tree', { params: parent ? { parent } : {} }),
  calculateDuties: (data) => api.post('/api/classification/calculate-duties', data),
  getRequiredDocuments: (code, origin) => api.get(`/api/classification/required-documents/${seg(code)}`, { params: { origin } }),
  getPreferences: (origin) => api.get(`/api/classification/preferences/${seg(origin)}`),
  applyClassification: (data) => api.post('/api/classification/apply', data),

  // AI-Powered Endpoints - LUCI Integration (Phase 7 - Mejoras TARIC)
  aiImproveWithFeedback: (productDescription, currentSuggestions, feedbackHistory) =>
    api.post('/api/classification/ai/improve-with-feedback', {
      productDescription,
      currentSuggestions,
      feedbackHistory
    }, { timeout: 90000 }),

  aiSuggestFromHistory: (productDescription, historicalClassifications, clientProfile) =>
    api.post('/api/classification/ai/suggest-from-history', {
      productDescription,
      historicalClassifications,
      clientProfile
    }, { timeout: 90000 }),

  aiCrossValidate: (classification, productDetails) =>
    api.post('/api/classification/ai/cross-validate', {
      classification,
      productDetails
    }, { timeout: 120000 }),

  aiFullAnalysis: (productData, options = {}) =>
    api.post('/api/classification/ai/full-analysis', {
      productData,
      options
    }, { timeout: 180000 }),

  aiRecordFeedback: (classificationData, feedback) =>
    api.post('/api/classification/ai/record-feedback', {
      classificationData,
      feedback
    }, { timeout: 30000 }),

  // History and Cache Endpoints
  getSearchHistory: (limit = 10) =>
    api.get('/api/classification/history', { params: { limit } }),

  getMostSearched: (days = 30, limit = 20) =>
    api.get('/api/classification/most-searched', { params: { days, limit } }),

  getSearchStats: (days = 30) =>
    api.get('/api/classification/search-stats', { params: { days } }),

  getCacheStats: () =>
    api.get('/api/classification/cache-stats'),

  markSearchAsUsed: (searchId, expeditionId) =>
    api.put(`/api/classification/history/${seg(searchId)}/mark-used`, { expeditionId }),

  cleanOldCache: (daysOld = 60) =>
    api.delete('/api/classification/cache/clean', { params: { daysOld } })
}

// Declarations
export const declarationsAPI = {
  // H1: qué falta para presentarlo y datos que solo se usan en la presentación
  getH1Requirements: (expeditionId) => api.get(`/api/declarations/${seg(expeditionId)}/h1/requisitos`),
  updateH1Data: (expeditionId, datos) => api.put(`/api/declarations/${seg(expeditionId)}/h1/datos`, datos),
  // Declarante y representante (casilla 14 del DUA), calculado con la misma
  // regla que el H1 (RepresentationCard).
  getDeclarante: (expeditionId) => api.get(`/api/declarations/${seg(expeditionId)}/declarante`),
  // H1 CAU: estado de la declaración en la AEAT (solo lectura)
  getH1Status: (expeditionId) => api.get(`/api/declarations/${seg(expeditionId)}/h1/estado`, { timeout: 60000 }),
  // Anulación ante la AEAT: solo predeclaraciones (lo activado responde 409 ANULACION_POR_LA_ADUANA).
  // Activa ante la AEAT una predeclaración pendiente de activar (CC432AV1).
  activateH1: (expeditionId) => api.post(`/api/declarations/${seg(expeditionId)}/h1/activar`, {}, { timeout: 60000 }),
  cancelH1: (expeditionId, reason) => api.post(`/api/declarations/${seg(expeditionId)}/cancel`, { reason }, { timeout: 60000 }),
  // H1 - Importacion estandar
  generateH1: (data) => api.post('/api/declarations/h1/generate-direct', data),
  // AES - Exportacion
  generateAES: (data) => api.post('/api/declarations/aes/generate', data),
  // H7 - Bajo valor (<= 150 EUR)
  checkH7Eligibility: (expeditionId) => api.get(`/api/declarations/h7/check-eligibility/${seg(expeditionId)}`),
  generateH7: (data) => api.post('/api/declarations/h7/generate', data),
  submitH7: (expeditionId) => api.post(`/api/declarations/h7/submit/${seg(expeditionId)}`),
  getH7Stats: (params) => api.get('/api/declarations/h7/stats', { params }),
  // Comunes
  getXML: (expeditionId) => api.get(`/api/declarations/${seg(expeditionId)}/xml`, { responseType: 'text' }),
  exportXML: (expeditionId, type) =>
    api.get(`/api/declarations/${seg(expeditionId)}/xml`, {
      params: { type },
      responseType: 'blob'
    }),
  // `predeclaracion`: 'Aduanas' u 'Operador' para presentar una predeclaración (tipo D); vacío, declaración.
  submit: (expeditionId, predeclaracion = '') => api.post(`/api/declarations/${seg(expeditionId)}/submit`, predeclaracion ? { predeclaracion } : {}),
  getSummary: (expeditionId) => api.get(`/api/declarations/${seg(expeditionId)}/summary`),
  // Consulta en la AEAT (DSDTCons) la declaracion sumaria registrada en el expediente.
  verifySummaryDeclaration: (expeditionId) =>
    api.post(`/api/declarations/${seg(expeditionId)}/summary-declaration/verify`, {}, { timeout: 60000 }),
  update: (expeditionId, data) => api.put(`/api/declarations/${seg(expeditionId)}`, data),

  // PDF Generation
  downloadPDF: (expeditionId, preview = false) =>
    api.get(`/api/declarations/${seg(expeditionId)}/pdf${preview ? '?preview=true' : ''}`, { responseType: 'blob' }),
  downloadH7PDF: (id, preview = false) =>
    api.get(`/api/declarations/h7/${seg(id)}/pdf${preview ? '?preview=true' : ''}`, { responseType: 'blob' }),
  downloadENSPDF: (id, preview = false) =>
    api.get(`/api/declarations/ens/${seg(id)}/pdf${preview ? '?preview=true' : ''}`, { responseType: 'blob' }),
  downloadSummaryPDF: (expeditionId) =>
    api.get(`/api/declarations/${seg(expeditionId)}/summary-pdf`, { responseType: 'blob' }),

  // Multi-country support
  supportedCountries: () => api.get('/api/declarations/supported-countries'),

  // AI-Powered Endpoints - LUCI Integration
  aiValidate: (expeditionId, declarationType) =>
    api.post(`/api/declarations/${seg(expeditionId)}/ai/validate`, { declarationType }, { timeout: 90000 }),
  aiDetectErrors: (expeditionId, declarationType) =>
    api.post(`/api/declarations/${seg(expeditionId)}/ai/detect-errors`, { declarationType }, { timeout: 60000 }),
  aiSuggestRegime: (expeditionId) =>
    api.post(`/api/declarations/${seg(expeditionId)}/ai/suggest-regime`, {}, { timeout: 90000 }),
  aiPredictChannel: (expeditionId, declarationType) =>
    api.post(`/api/declarations/${seg(expeditionId)}/ai/predict-channel`, { declarationType }, { timeout: 90000 }),
  aiFullAnalysis: (expeditionId, declarationType) =>
    api.post(`/api/declarations/${seg(expeditionId)}/ai/full-analysis`, { declarationType }, { timeout: 180000 }),
  getAiAnalysis: (expeditionId) =>
    api.get(`/api/declarations/${seg(expeditionId)}/ai/analysis`),
  applyRegimeSuggestion: (expeditionId, regime, preference, additionalProcedure) =>
    api.post(`/api/declarations/${seg(expeditionId)}/ai/apply-regime`, { regime, preference, additionalProcedure })
}

// Calculations
export const calculationsAPI = {
  // Calculate duties with AI-powered tariff lookup
  calculateDuties: (data) => api.post('/api/calculation/duties', data, { timeout: 60000 }),

  // Calculate VAT
  calculateVat: (data) => api.post('/api/calculation/vat', data),

  // Calculate total (duties + VAT + fees)
  calculateTotal: (data) => api.post('/api/calculation/total', data, { timeout: 90000 }),

  // Get exchange rate
  getExchangeRate: (currency = 'USD') => api.get('/api/calculation/exchange-rate', { params: { currency } }),

  // Get duty info for a specific TARIC code (AI-powered)
  getDutyInfo: (taricCode, origin = null) =>
    api.get(`/api/calculation/duty-info/${seg(taricCode)}`, {
      params: origin ? { origin } : {},
      timeout: 60000
    }),

  // Validate a duty rate against AI knowledge
  validateDutyRate: (taricCode, currentRate, origin = null) =>
    api.post('/api/calculation/validate-duty', { taricCode, currentRate, origin }, { timeout: 60000 }),

  // Clear calculation cache (admin)
  clearCache: () => api.delete('/api/calculation/cache')
}

// Portal
export const portalAPI = {
  // Basic access
  access: (token) => api.get(`/api/portal/${seg(token)}`),
  uploadDocument: (token, formData) => api.post(
    `/api/portal/${seg(token)}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ),
  getMessages: (token) => api.get(`/api/portal/${seg(token)}/chat`),
  sendMessage: (token, message) => api.post(`/api/portal/${seg(token)}/chat`, { content: message }),
  getStatus: (token) => api.get(`/api/portal/${seg(token)}/status`),
  getUnread: (token) => api.get(`/api/portal/${seg(token)}/unread`),

  // Self-service
  createExpedition: (data) => api.post('/api/portal/self-service/expeditions', data),
  updateExpedition: (token, data) => api.put(`/api/portal/${seg(token)}/expedition`, data),
  submitExpedition: (token) => api.post(`/api/portal/${seg(token)}/submit`),

  // Payments
  getPayments: (token) => api.get(`/api/portal/${seg(token)}/payments`),
  createPayment: (token) => api.post(`/api/portal/${seg(token)}/payments`),
  createCheckoutSession: (token, paymentId) =>
    api.post(`/api/portal/${seg(token)}/payments/${seg(paymentId)}/checkout`),
  getPaymentStatus: (token, paymentId) =>
    api.get(`/api/portal/${seg(token)}/payments/${seg(paymentId)}`),

  // Statistics
  getStats: (token) => api.get(`/api/portal/${seg(token)}/stats`),
  getHistory: (token, params) => api.get(`/api/portal/${seg(token)}/history`, { params }),

  // Signed documents
  getSignedDocuments: (token) => api.get(`/api/portal/${seg(token)}/signed-documents`),
  downloadLevante: (token) => api.get(`/api/portal/${seg(token)}/signed-documents/levante`),
  downloadDeclaration: (token) => api.get(`/api/portal/${seg(token)}/signed-documents/declaration`),

  // AI-Powered Endpoints - LUCI Integration
  aiEnhancedChat: (token, message) =>
    api.post(`/api/portal/${seg(token)}/ai/chat`, { message, language: i18n.language }, { timeout: 60000 }),
  aiDetectFAQ: (token, question) =>
    api.post(`/api/portal/${seg(token)}/ai/faq`, { question }, { timeout: 30000 }),
  aiGetSummary: (token, options = {}) =>
    api.get(`/api/portal/${seg(token)}/ai/summary`, { params: options, timeout: 60000 }),
  aiGenerateNotification: (token, event, preferences = {}) =>
    api.post(`/api/portal/${seg(token)}/ai/notification`, { event, preferences }, { timeout: 30000 }),
  aiFullAnalysis: (token) =>
    api.get(`/api/portal/${seg(token)}/ai/full-analysis`, { timeout: 120000 })
}

// Chat/AI
// La ruta real es POST /api/chat/ask-luci (backend, con login y fallback de
// cuenta Bedrock). Apuntaban a /ai/chat y /ai/ask, que solo existen tras el
// proxy de Vite en desarrollo: en produccion nginx solo enruta /api/ y el
// asistente respondia 405 a cualquier pregunta. Ademas /ai/* iba al servicio
// luci-ai, que no exige autenticacion y no debe exponerse.
//
// El backend responde { success, data: { answer, model, confidence, sources } }.
// Se aplana a data.message / data.model / data.confidence, que es lo que leen
// ChatAssistant y FloatingAssistant.
const askLuci = async (question) => {
  const response = await api.post(
    '/api/chat/ask-luci',
    { question, language: i18n.language },
    // Opus razona antes de responder: supera con facilidad los 30 s por defecto.
    { timeout: 90000 }
  )
  const payload = response?.data?.data || {}
  return {
    ...response,
    data: {
      ...response?.data,
      message: payload.answer,
      model: payload.model,
      confidence: payload.confidence,
      sources: payload.sources
    }
  }
}

export const chatAPI = {
  send: (data) => askLuci(data?.message),
  ask: (question) => askLuci(question)
}

// Knowledge
// Las rutas reales viven bajo /api/knowledge. Apuntaban a /ai/knowledge, que no
// existe en el backend: caian al fallback de la SPA (index.html con 200) y los
// paneles de régimen/incoterm quedaban vacios sin error visible.
export const knowledgeAPI = {
  search: (query) => api.get('/api/knowledge/search', { params: { query } }),
  categories: () => api.get('/api/knowledge/categories'),
  h1Guidance: (field) => api.get(`/api/knowledge/h1-guidance/${seg(field)}`),
  documentRequirements: (params) => api.get('/api/knowledge/document-requirements', { params }),
  regimeInfo: (code) => api.get(`/api/knowledge/regime/${seg(code)}`),
  incotermInfo: (incoterm) => api.get(`/api/knowledge/incoterm/${seg(incoterm)}`)
}

// Requirements (AEAT/Paraduanero)
export const requirementsAPI = {
  list: (params) => api.get('/api/requirements', { params }),
  get: (id) => api.get(`/api/requirements/${seg(id)}`),
  getByExpedition: (expeditionId) => api.get(`/api/requirements/expedition/${seg(expeditionId)}`),
  getStats: (params) => api.get('/api/requirements/stats', { params }),
  create: (data) => api.post('/api/requirements', data),
  update: (id, data) => api.put(`/api/requirements/${seg(id)}`, data),
  addResponse: (id, data) => api.post(`/api/requirements/${seg(id)}/response`, data),
  submitToAEAT: (id, responseIndex) => api.post(`/api/requirements/${seg(id)}/submit`, { responseIndex }),
  markItemProvided: (id, itemId, documentId) =>
    api.put(`/api/requirements/${seg(id)}/items/${seg(itemId)}/provided`, { documentId }),
  scheduleInspection: (id, data) => api.post(`/api/requirements/${seg(id)}/inspection/schedule`, data),
  recordInspectionResult: (id, data) => api.post(`/api/requirements/${seg(id)}/inspection/result`, data),
  resolve: (id, data) => api.post(`/api/requirements/${seg(id)}/resolve`, data),
  generateAIResponse: (id) => api.post(`/api/requirements/${seg(id)}/ai-response`, {}, { timeout: 120000 }),

  // AI-Powered Endpoints - LUCI Integration
  aiAnalyzeDocuments: (id) =>
    api.post(`/api/requirements/${seg(id)}/ai/analyze-documents`, {}, { timeout: 60000 }),
  aiSuggestArguments: (id) =>
    api.post(`/api/requirements/${seg(id)}/ai/suggest-arguments`, {}, { timeout: 120000 }),
  aiAnalyzeRisk: (id) =>
    api.post(`/api/requirements/${seg(id)}/ai/analyze-risk`, {}, { timeout: 60000 }),
  aiFullAnalysis: (id) =>
    api.post(`/api/requirements/${seg(id)}/ai/full-analysis`, {}, { timeout: 180000 }),
  aiDraftResponse: (id) =>
    api.post(`/api/requirements/${seg(id)}/ai/draft-response`, {}, { timeout: 120000 })
}

// Channels (Circuitos de control)
export const channelsAPI = {
  getConfig: () => api.get('/api/channels/config'),
  getStats: (params) => api.get('/api/channels/stats', { params }),
  getExpeditions: () => api.get('/api/channels/expeditions'),
  getStatus: (expeditionId) => api.get(`/api/channels/${seg(expeditionId)}/status`),
  getLevante: (expeditionId) => api.get(`/api/channels/${seg(expeditionId)}/levante`),
  reevaluate: (expeditionId) => api.post(`/api/channels/${seg(expeditionId)}/reevaluate`),
  processManually: (expeditionId, channel) =>
    api.post(`/api/channels/${seg(expeditionId)}/process`, { channel })
}

// Paraduanero (Controles paraduaneros: SOIVRE, MAPA, Sanidad, MITERD)
export const paraduaneroAPI = {
  list: (params) => api.get('/api/paraduanero', { params }),
  getStats: (params) => api.get('/api/paraduanero/stats', { params }),
  analyze: (expeditionId) => api.get(`/api/paraduanero/analyze/${seg(expeditionId)}`),
  createControls: (expeditionId) => api.post(`/api/paraduanero/create/${seg(expeditionId)}`),
  getByExpedition: (expeditionId) => api.get(`/api/paraduanero/expedition/${seg(expeditionId)}`),
  get: (id) => api.get(`/api/paraduanero/${seg(id)}`),
  update: (id, data) => api.put(`/api/paraduanero/${seg(id)}`, data),
  provideDocument: (id, code, data) => api.post(`/api/paraduanero/${seg(id)}/document/${seg(code)}/provide`, data),
  scheduleInspection: (id, data) => api.post(`/api/paraduanero/${seg(id)}/inspection/schedule`, data),
  recordResult: (id, data) => api.post(`/api/paraduanero/${seg(id)}/inspection/result`, data),
  issueCertificate: (id, data) => api.post(`/api/paraduanero/${seg(id)}/certificate`, data),
  changeStatus: (id, data) => api.post(`/api/paraduanero/${seg(id)}/status`, data)
}

// ENS Declarations (Entry Summary Declaration - ICS2)
export const ensAPI = {
  list: (params) => api.get('/api/ens', { params }),
  getStats: (params) => api.get('/api/ens/stats', { params }),
  get: (id) => api.get(`/api/ens/${seg(id)}`),
  create: (data) => api.post('/api/ens', data),
  update: (id, data) => api.put(`/api/ens/${seg(id)}`, data),
  validate: (data) => api.post('/api/ens/validate', data),
  submit: (id, certificateAlias) => api.post(`/api/ens/${seg(id)}/submit`, { certificateAlias }),
  amend: (id, data) => api.post(`/api/ens/${seg(id)}/amend`, data),
  cancel: (id, reason) => api.post(`/api/ens/${seg(id)}/cancel`, { reason }),
  notifyArrival: (id, data) => api.post(`/api/ens/${seg(id)}/arrival`, data),
  addDocument: (id, data) => api.post(`/api/ens/${seg(id)}/document`, data),
  getXML: (id) => api.get(`/api/ens/${seg(id)}/xml`, { responseType: 'text' }),
  searchByContainer: (container) => api.get(`/api/ens/search/container/${seg(container)}`),
  searchByBOL: (bol) => api.get(`/api/ens/search/bol/${seg(bol)}`),
  processBatch: (declarations, autoSubmit, certificateAlias) =>
    api.post('/api/ens/batch', { declarations, autoSubmit, certificateAlias }),
  getEntryOffices: (transportMode) => api.get('/api/ens/entry-offices', { params: { transportMode } }),
  getDeadlines: () => api.get('/api/ens/deadlines'),
  // AI-Powered Endpoints
  aiAnalyzeExpedition: (expeditionId, existingData) =>
    api.post('/api/ens/ai/analyze-expedition', { expeditionId, existingData }),
  aiValidate: (ensData) => api.post('/api/ens/ai/validate', { ensData }),
  aiPredictRejection: (ensId, ensData) =>
    api.post('/api/ens/ai/predict-rejection', { ensId, ensData }),
  aiGetSuggestions: (id) => api.get(`/api/ens/${seg(id)}/ai/suggestions`)
}

// Query Services (ADDS-JDIT Queries)
export const queryAPI = {
  byBillOfLading: (data) => api.post('/api/queries/bill-of-lading', data),
  byAWB: (data) => api.post('/api/queries/awb', data),
  byContainer: (data) => api.post('/api/queries/container', data),
  byLocation: (data) => api.post('/api/queries/location', data),
  byMRN: (data) => api.post('/api/queries/mrn', data),
  byEORI: (data) => api.post('/api/queries/eori', data),
  documents: (data) => api.post('/api/queries/documents', data),
  getHistory: (params) => api.get('/api/queries/history', { params }),
  get: (id) => api.get(`/api/queries/${seg(id)}`),
  getStats: (params) => api.get('/api/queries/stats', { params }),
  getServices: () => api.get('/api/queries/services')
}

// H7 Declarations (E-commerce, bajo valor <= 150 EUR)
export const h7API = {
  list: (params) => api.get('/api/h7', { params }),
  getStats: (params) => api.get('/api/h7/stats', { params }),
  get: (id) => api.get(`/api/h7/${seg(id)}`),
  create: (data) => api.post('/api/h7', data),
  update: (id, data) => api.put(`/api/h7/${seg(id)}`, data),
  validate: (data) => api.post('/api/h7/validate', data),
  validateIOSS: (iossNumber) => api.get(`/api/h7/validate-ioss/${seg(iossNumber)}`),
  calculateDuties: (data) => api.post('/api/h7/calculate-duties', data),
  submit: (id) => api.post(`/api/h7/${seg(id)}/submit`),
  cancel: (id, reason) => api.post(`/api/h7/${seg(id)}/cancel`, { reason }),
  addDocument: (id, data) => api.post(`/api/h7/${seg(id)}/document`, data),
  fraudCheck: (id) => api.get(`/api/h7/${seg(id)}/fraud-check`),
  processBatch: (declarations) => api.post('/api/h7/batch', { declarations }),
  importCSV: (csv, autoSubmit) => api.post('/api/h7/import-csv', { csv, autoSubmit }),
  createFromExpedition: (expeditionId) => api.post(`/api/h7/from-expedition/${seg(expeditionId)}`)
}

// Guarantees (Garantias aduaneras: CGU, avales, depositos)
export const guaranteesAPI = {
  list: (params) => api.get('/api/guarantees', { params }),
  getStats: () => api.get('/api/guarantees/stats'),
  getAlerts: () => api.get('/api/guarantees/alerts'),
  get: (id) => api.get(`/api/guarantees/${seg(id)}`),
  create: (data) => api.post('/api/guarantees', data),
  update: (id, data) => api.put(`/api/guarantees/${seg(id)}`, data),
  activate: (id, data) => api.post(`/api/guarantees/${seg(id)}/activate`, data),
  renew: (id, data) => api.post(`/api/guarantees/${seg(id)}/renew`, data),
  suspend: (id, data) => api.post(`/api/guarantees/${seg(id)}/suspend`, data),
  cancel: (id, data) => api.post(`/api/guarantees/${seg(id)}/cancel`, data),
  consume: (id, data) => api.post(`/api/guarantees/${seg(id)}/consume`, data),
  release: (id, data) => api.post(`/api/guarantees/${seg(id)}/release`, data),
  linkExpedition: (id, data) => api.post(`/api/guarantees/${seg(id)}/link-expedition`, data),
  releaseExpedition: (id, data) => api.post(`/api/guarantees/${seg(id)}/release-expedition`, data),
  addDocument: (id, data) => api.post(`/api/guarantees/${seg(id)}/document`, data),
  acknowledgeAlert: (id, alertId) => api.post(`/api/guarantees/${seg(id)}/alerts/${seg(alertId)}/acknowledge`),
  getMovements: (id, params) => api.get(`/api/guarantees/${seg(id)}/movements`, { params }),
  calculate: (data) => api.post('/api/guarantees/calculate', data),
  findSuitable: (params) => api.get('/api/guarantees/find-suitable', { params }),
  getReport: (params) => api.get('/api/guarantees/report', { params }),

  // AI-Powered Endpoints - LUCI Integration
  aiAnalyzeNeeds: (operation) =>
    api.post('/api/guarantees/ai/analyze-needs', { operation }, { timeout: 90000 }),
  aiRecommendType: (operatorProfile, operationDetails) =>
    api.post('/api/guarantees/ai/recommend-type', { operatorProfile, operationDetails }, { timeout: 90000 }),
  aiOptimize: (upcomingOperations) =>
    api.post('/api/guarantees/ai/optimize', { upcomingOperations }, { timeout: 90000 }),
  aiSmartCalculate: (operation) =>
    api.post('/api/guarantees/ai/smart-calculate', { operation }, { timeout: 60000 }),
  aiFullAnalysis: (operation, upcomingOperations) =>
    api.post('/api/guarantees/ai/full-analysis', { operation, upcomingOperations }, { timeout: 180000 }),
  getAiAnalysis: () =>
    api.get('/api/guarantees/ai/analysis')
}

// Dashboard
export const dashboardAPI = {
  getAlerts: () => api.get('/api/dashboard/alerts'),
  getStats: () => api.get('/api/dashboard/stats')
}

// Transit (NCTS - T1/T2/TIR)
export const transitAPI = {
  list: (params) => api.get('/api/transit', { params }),
  getStats: (params) => api.get('/api/transit/stats', { params }),
  getOverdue: () => api.get('/api/transit/overdue'),
  get: (id) => api.get(`/api/transit/${seg(id)}`),
  create: (data) => api.post('/api/transit', data),
  update: (id, data) => api.put(`/api/transit/${seg(id)}`, data),
  delete: (id) => api.delete(`/api/transit/${seg(id)}`),
  // NCTS Flow
  submit: (id) => api.post(`/api/transit/${seg(id)}/submit`),
  releaseAtDeparture: (id) => api.post(`/api/transit/${seg(id)}/release-departure`),
  startTransit: (id) => api.post(`/api/transit/${seg(id)}/start`),
  recordTransitOffice: (id, data) => api.post(`/api/transit/${seg(id)}/transit-office`, data),
  notifyArrival: (id, data) => api.post(`/api/transit/${seg(id)}/arrival`, data),
  notifyUnloading: (id, data) => api.post(`/api/transit/${seg(id)}/unloading`, data),
  recordControl: (id, data) => api.post(`/api/transit/${seg(id)}/control`, data),
  releaseGoods: (id) => api.post(`/api/transit/${seg(id)}/release-goods`),
  complete: (id) => api.post(`/api/transit/${seg(id)}/complete`),
  // Special procedures
  initiateEnquiry: (id, data) => api.post(`/api/transit/${seg(id)}/enquiry`, data),

  // AI-Powered Endpoints - LUCI Integration
  aiAutoComplete: (transitDraft, expeditionId) =>
    api.post('/api/transit/ai/auto-complete', { transitDraft, expeditionId }, { timeout: 90000 }),
  aiValidateRoute: (id) =>
    api.post(`/api/transit/${seg(id)}/ai/validate-route`, {}, { timeout: 90000 }),
  aiPredictIncidents: (id) =>
    api.post(`/api/transit/${seg(id)}/ai/predict-incidents`, {}, { timeout: 90000 }),
  aiSuggestGuarantee: (id) =>
    api.post(`/api/transit/${seg(id)}/ai/suggest-guarantee`, {}, { timeout: 60000 }),
  aiFullAnalysis: (id) =>
    api.post(`/api/transit/${seg(id)}/ai/full-analysis`, {}, { timeout: 180000 }),
  aiApplySuggestion: (id, suggestedData) =>
    api.post(`/api/transit/${seg(id)}/ai/apply-suggestion`, { suggestedData })
}

// Preferences (Preferencias Arancelarias)
export const preferencesAPI = {
  checkEligibility: (data) => api.post('/api/preferences/eligibility', data),
  listAgreements: () => api.get('/api/preferences/agreements'),
  getAgreement: (key) => api.get(`/api/preferences/agreements/${seg(key)}`),
  getByCountry: (code) => api.get(`/api/preferences/country/${seg(code)}`),
  validateCertificate: (data) => api.post('/api/preferences/validate-certificate', data),
  getRecommendations: (data) => api.post('/api/preferences/optimize', data),
  getOriginRules: (chapter) => api.get(`/api/preferences/origin-rules/${seg(chapter)}`),
  getInfo: () => api.get('/api/preferences/info')
}

// OEA (Operador Economico Autorizado)
export const oeaAPI = {
  // Information & Catalogs
  getInfo: () => api.get('/api/oea/info'),
  getStats: () => api.get('/api/oea/stats'),
  getExpiring: (days = 90) => api.get('/api/oea/expiring', { params: { days } }),
  getBenefitsCatalog: () => api.get('/api/oea/benefits'),
  getSimplifications: () => api.get('/api/oea/simplifications'),
  getMutualRecognition: () => api.get('/api/oea/mutual-recognition'),
  // CRUD
  list: (params) => api.get('/api/oea', { params }),
  get: (id) => api.get(`/api/oea/${seg(id)}`),
  getByEORI: (eori) => api.get(`/api/oea/eori/${seg(eori)}`),
  getByNIF: (nif) => api.get(`/api/oea/nif/${seg(nif)}`),
  create: (data) => api.post('/api/oea', data),
  update: (id, data) => api.put(`/api/oea/${seg(id)}`, data),
  // Certification Lifecycle
  submitForReview: (id) => api.post(`/api/oea/${seg(id)}/submit`),
  approve: (id, data) => api.post(`/api/oea/${seg(id)}/approve`, data),
  suspend: (id, data) => api.post(`/api/oea/${seg(id)}/suspend`, data),
  revoke: (id, data) => api.post(`/api/oea/${seg(id)}/revoke`, data),
  initiateRenewal: (id) => api.post(`/api/oea/${seg(id)}/renewal/initiate`),
  completeRenewal: (id, data) => api.post(`/api/oea/${seg(id)}/renewal/complete`, data),
  // Audits & Compliance
  addAudit: (id, data) => api.post(`/api/oea/${seg(id)}/audits`, data),
  updateRequirement: (id, requirement, data) => api.put(`/api/oea/${seg(id)}/requirements/${seg(requirement)}`, data),
  addComplianceRecord: (id, data) => api.post(`/api/oea/${seg(id)}/compliance`, data),
  // Benefits & Simplifications
  grantSimplification: (id, data) => api.post(`/api/oea/${seg(id)}/simplifications`, data),
  calculateGuaranteeReduction: (id, data) => api.post(`/api/oea/${seg(id)}/guarantee-reduction`, data),
  // Alerts
  acknowledgeAlert: (id, alertId, data) => api.post(`/api/oea/${seg(id)}/alerts/${seg(alertId)}/acknowledge`, data),
  resolveAlert: (id, alertId) => api.post(`/api/oea/${seg(id)}/alerts/${seg(alertId)}/resolve`)
}

// Special Regimes (Regimenes especiales: 51, 53, 71, T1/T2)
export const specialRegimesAPI = {
  list: (params) => api.get('/api/special-regimes', { params }),
  getStats: (params) => api.get('/api/special-regimes/stats', { params }),
  getExpiring: (days) => api.get('/api/special-regimes/expiring', { params: { days } }),
  calculateDuties: (data) => api.post('/api/special-regimes/calculate-duties', data),
  get: (id) => api.get(`/api/special-regimes/${seg(id)}`),
  create: (data) => api.post('/api/special-regimes', data),
  update: (id, data) => api.put(`/api/special-regimes/${seg(id)}`, data),
  delete: (id) => api.delete(`/api/special-regimes/${seg(id)}`),
  authorize: (id, data) => api.post(`/api/special-regimes/${seg(id)}/authorize`, data),
  activate: (id) => api.post(`/api/special-regimes/${seg(id)}/activate`),
  linkGuarantee: (id, guaranteeId) => api.post(`/api/special-regimes/${seg(id)}/link-guarantee`, { guaranteeId }),
  requestExtension: (id, data) => api.post(`/api/special-regimes/${seg(id)}/extension`, data),
  discharge: (id, data) => api.post(`/api/special-regimes/${seg(id)}/discharge`, data),
  addGoods: (id, data) => api.post(`/api/special-regimes/${seg(id)}/goods`, data),
  partialExit: (id, data) => api.post(`/api/special-regimes/${seg(id)}/partial-exit`, data),
  updateTransitStatus: (id, data) => api.put(`/api/special-regimes/${seg(id)}/transit-status`, data),
  // AI-powered features
  aiAdvise: (data) => api.post('/ai/special-regimes/advise', data),
  aiValidateYield: (data) => api.post('/ai/special-regimes/validate-yield', data),
  aiAnalyzeDeadline: (data) => api.post('/ai/special-regimes/analyze-deadline', data),
  aiAsk: (question, context) => api.post('/ai/special-regimes/ask', null, { params: { question }, data: context })
}

// Deadlines (Gestor de Plazos)
export const deadlinesAPI = {
  list: (params) => api.get('/api/deadlines', { params }),
  get: (id) => api.get(`/api/deadlines/${seg(id)}`),
  create: (data) => api.post('/api/deadlines', data),
  update: (id, data) => api.put(`/api/deadlines/${seg(id)}`, data),
  delete: (id) => api.delete(`/api/deadlines/${seg(id)}`),
  // Queries
  getPending: (params) => api.get('/api/deadlines/pending', { params }),
  getOverdue: () => api.get('/api/deadlines/overdue'),
  getUrgent: (hours) => api.get('/api/deadlines/urgent', { params: { hours } }),
  getCalendar: (startDate, endDate) => api.get('/api/deadlines/calendar', { params: { startDate, endDate } }),
  getDashboard: (userId) => api.get('/api/deadlines/dashboard', { params: { userId } }),
  getStats: (params) => api.get('/api/deadlines/stats', { params }),
  getTypes: () => api.get('/api/deadlines/types'),
  getCategories: () => api.get('/api/deadlines/categories'),
  getInfo: () => api.get('/api/deadlines/info'),
  // Actions
  complete: (id, notes) => api.post(`/api/deadlines/${seg(id)}/complete`, { notes }),
  extend: (id, newDate, reason) => api.post(`/api/deadlines/${seg(id)}/extend`, { newDate, reason }),
  cancel: (id, reason) => api.post(`/api/deadlines/${seg(id)}/cancel`, { reason }),
  processAlerts: () => api.post('/api/deadlines/process-alerts'),
  sync: () => api.post('/api/deadlines/sync')
}

// Inspections (Coordinacion de Inspecciones)
export const inspectionsAPI = {
  list: (params) => api.get('/api/inspections', { params }),
  get: (id) => api.get(`/api/inspections/${seg(id)}`),
  create: (data) => api.post('/api/inspections', data),
  // Queries
  getToday: () => api.get('/api/inspections/today'),
  getPending: (userId) => api.get('/api/inspections/pending', { params: { userId } }),
  getCalendar: (startDate, endDate) => api.get('/api/inspections/calendar', { params: { startDate, endDate } }),
  getDashboard: (userId) => api.get('/api/inspections/dashboard', { params: { userId } }),
  getStats: (params) => api.get('/api/inspections/stats', { params }),
  getTypes: () => api.get('/api/inspections/types'),
  getLocations: () => api.get('/api/inspections/locations'),
  getResults: () => api.get('/api/inspections/results'),
  getChecklist: (type) => api.get(`/api/inspections/checklist/${seg(type)}`),
  getInfo: () => api.get('/api/inspections/info'),
  // Workflow
  schedule: (id, data) => api.post(`/api/inspections/${seg(id)}/schedule`, data),
  confirm: (id, confirmationNumber) => api.post(`/api/inspections/${seg(id)}/confirm`, { confirmationNumber }),
  start: (id) => api.post(`/api/inspections/${seg(id)}/start`),
  complete: (id, data) => api.post(`/api/inspections/${seg(id)}/complete`, data),
  cancel: (id, reason) => api.post(`/api/inspections/${seg(id)}/cancel`, { reason }),
  reschedule: (id, data) => api.post(`/api/inspections/${seg(id)}/reschedule`, data),
  // Data management
  addParticipant: (id, data) => api.post(`/api/inspections/${seg(id)}/participants`, data),
  addEvidence: (id, data) => api.post(`/api/inspections/${seg(id)}/evidence`, data),
  addItem: (id, data) => api.post(`/api/inspections/${seg(id)}/items`, data),
  registerFinding: (id, data) => api.post(`/api/inspections/${seg(id)}/findings`, data),
  addSample: (id, data) => api.post(`/api/inspections/${seg(id)}/samples`, data),
  updateSampleResult: (id, sampleId, data) => api.put(`/api/inspections/${seg(id)}/samples/${seg(sampleId)}`, data),
  generateReport: (id, data) => api.post(`/api/inspections/${seg(id)}/report`, data),
  addAction: (id, data) => api.post(`/api/inspections/${seg(id)}/actions`, data)
}

// Communications (Comunicaciones con Inspectores)
export const communicationsAPI = {
  list: (params) => api.get('/api/communications', { params }),
  get: (id) => api.get(`/api/communications/${seg(id)}`),
  create: (data) => api.post('/api/communications', data),
  // Specific creation
  createAllegation: (data) => api.post('/api/communications/allegation', data),
  createAdministrativeAppeal: (data) => api.post('/api/communications/administrative-appeal', data),
  createEconomicAppeal: (data) => api.post('/api/communications/economic-appeal', data),
  // Queries
  getPending: (userId) => api.get('/api/communications/pending', { params: { userId } }),
  getAppeals: (status) => api.get('/api/communications/appeals', { params: { status } }),
  getOverdue: () => api.get('/api/communications/overdue'),
  getDashboard: (userId) => api.get('/api/communications/dashboard', { params: { userId } }),
  getStats: (params) => api.get('/api/communications/stats', { params }),
  getTypes: () => api.get('/api/communications/types'),
  getAuthorities: () => api.get('/api/communications/authorities'),
  getTemplates: () => api.get('/api/communications/templates'),
  getInfo: () => api.get('/api/communications/info'),
  // Utilities
  generateDraft: (communicationType, data) => api.post('/api/communications/draft', { communicationType, ...data }),
  calculateDeadline: (notificationDate, communicationType) =>
    api.post('/api/communications/calculate-deadline', { notificationDate, communicationType }),
  // Workflow
  addMessage: (id, data) => api.post(`/api/communications/${seg(id)}/messages`, data),
  addArgument: (id, data) => api.post(`/api/communications/${seg(id)}/arguments`, data),
  approve: (id) => api.post(`/api/communications/${seg(id)}/approve`),
  submit: (id) => api.post(`/api/communications/${seg(id)}/submit`),
  markDelivered: (id, confirmationNumber) => api.post(`/api/communications/${seg(id)}/delivered`, { confirmationNumber }),
  receiveResponse: (id, data) => api.post(`/api/communications/${seg(id)}/response`, data),
  resolve: (id, data) => api.post(`/api/communications/${seg(id)}/resolve`, data),
  updateStatus: (id, status, notes) => api.put(`/api/communications/${seg(id)}/status`, { status, notes }),
  archive: (id) => api.post(`/api/communications/${seg(id)}/archive`)
}

// Integrations (VUA, TRACES, NCTS)
export const integrationsAPI = {
  // General
  getStatus: () => api.get('/api/integrations/status'),
  list: () => api.get('/api/integrations/list'),
  getInfo: () => api.get('/api/integrations/info'),
  getConfig: () => api.get('/api/integrations/config'),
  getStats: () => api.get('/api/integrations/stats'),
  getServices: () => api.get('/api/integrations/services'),
  getIntegration: (code) => api.get(`/api/integrations/${seg(code)}`),
  testConnectivity: (code) => api.get(`/api/integrations/${seg(code)}/test`),
  getRequiredControls: (data) => api.post('/api/integrations/controls', data),

  // VUA (Ventanilla Unica Aduanera)
  vua: {
    getServices: () => api.get('/api/integrations/vua/services'),
    getAuthorities: () => api.get('/api/integrations/vua/authorities'),
    submitDocument: (data) => api.post('/api/integrations/vua/submit', data),
    queryStatus: (reference) => api.get(`/api/integrations/vua/status/${seg(reference)}`)
  },

  // TRACES (Control Sanitario/Veterinario UE)
  traces: {
    getCHEDTypes: () => api.get('/api/integrations/traces/ched-types'),
    getBCPs: () => api.get('/api/integrations/traces/bcps'),
    checkCountry: (country, productType) => api.get(`/api/integrations/traces/country/${seg(country)}/${seg(productType)}`),
    createCHED: (data) => api.post('/api/integrations/traces/ched', data),
    getCHED: (reference) => api.get(`/api/integrations/traces/ched/${seg(reference)}`),
    getCHEDStatus: (reference) => api.get(`/api/integrations/traces/ched/${seg(reference)}/status`),
    submitCHED: (reference) => api.post(`/api/integrations/traces/ched/${seg(reference)}/submit`)
  },

  // NCTS (Sistema de Transito UE)
  ncts: {
    getTransitTypes: () => api.get('/api/integrations/ncts/transit-types'),
    getGuaranteeTypes: () => api.get('/api/integrations/ncts/guarantee-types'),
    getOffices: (type) => api.get('/api/integrations/ncts/offices', { params: { type } }),
    search: (params) => api.get('/api/integrations/ncts/search', { params }),
    createDeclaration: (data) => api.post('/api/integrations/ncts/declaration', data),
    getDeclaration: (mrn) => api.get(`/api/integrations/ncts/declaration/${seg(mrn)}`),
    getDeclarationStatus: (mrn) => api.get(`/api/integrations/ncts/declaration/${seg(mrn)}/status`),
    notifyArrival: (data) => api.post('/api/integrations/ncts/arrival', data),
    queryGuarantee: (grn, accessCode) => api.get(`/api/integrations/ncts/guarantee/${seg(grn)}`, { params: { accessCode } }),
    calculateGuarantee: (data) => api.post('/api/integrations/ncts/guarantee/calculate', data)
  }
}

// AEAT Real Integration (Fase 6.1)
export const aeatRealAPI = {
  // Certificates
  certificates: {
    list: (includeExpired = false) => api.get('/api/aeat-real/certificates', { params: { includeExpired } }),
    get: (alias) => api.get(`/api/aeat-real/certificates/${seg(alias)}`),
    import: (data) => api.post('/api/aeat-real/certificates/import', data),
    verify: (alias) => api.get(`/api/aeat-real/certificates/${seg(alias)}/verify`),
    delete: (alias) => api.delete(`/api/aeat-real/certificates/${seg(alias)}`),
    validateForOperation: (data) => api.post('/api/aeat-real/certificates/validate-for-operation', data)
  },

  // Signature
  signature: {
    sign: (data) => api.post('/api/aeat-real/signature/sign', data),
    verify: (signedXml) => api.post('/api/aeat-real/signature/verify', { signedXml })
  },

  // Declarations
  declarations: {
    submitH1: (data) => api.post('/api/aeat-real/declarations/h1/submit', data),
    submitH7: (data) => api.post('/api/aeat-real/declarations/h7/submit', data),
    submitAES: (data) => api.post('/api/aeat-real/declarations/aes/submit', data),
    submitNCTS: (data) => api.post('/api/aeat-real/declarations/ncts/submit', data),
    submitICS2: (data) => api.post('/api/aeat-real/declarations/ics2/submit', data),
    getStatus: (mrn, certificateAlias, declarationType) =>
      api.get(`/api/aeat-real/declarations/${seg(mrn)}/status`, { params: { certificateAlias, declarationType } }),
    getInbox: (params) => api.get('/api/aeat-real/inbox', { params })
  },

  // Monitoring
  monitoring: {
    track: (data) => api.post('/api/aeat-real/monitoring/track', data),
    getTracked: () => api.get('/api/aeat-real/monitoring/tracked'),
    refresh: (mrn, certificateAlias) => api.post(`/api/aeat-real/monitoring/${seg(mrn)}/refresh`, { certificateAlias }),
    getAlerts: (params) => api.get('/api/aeat-real/monitoring/alerts', { params }),
    acknowledgeAlert: (alertId) => api.post(`/api/aeat-real/monitoring/alerts/${seg(alertId)}/acknowledge`),
    predictChannel: (data) => api.post('/api/aeat-real/monitoring/predict-channel', data)
  },

  // Documents
  documents: {
    submit: (data) => api.post('/api/aeat-real/documents/submit', data)
  },

  // Connectivity & System
  testConnectivity: (certificateAlias, services) =>
    api.post('/api/aeat-real/connectivity/test', { certificateAlias, services }),
  getServiceStatus: () => api.get('/api/aeat-real/service-status'),
  setEnvironment: (environment) => api.post('/api/aeat-real/environment', { environment }),

  // Special taxes (SILICIE/EMCS)
  emcs: {
    submitMovement: (data) => api.post('/api/aeat-real/emcs/movement', data)
  },
  silicie: {
    query: (data) => api.post('/api/aeat-real/silicie/query', data)
  }
}

// Tenant & Multi-Tenancy (Fase 6.3)
export const tenantAPI = {
  // Current tenant
  getCurrent: () => api.get('/api/tenant'),
  getSettings: () => api.get('/api/tenant/settings'),
  updateSettings: (data) => api.put('/api/tenant/settings', data),
  getUsage: () => api.get('/api/tenant/usage'),
  getPlans: () => api.get('/api/tenant/plans'),
  changePlan: (plan, immediate = false) => api.post('/api/tenant/plan', { plan, immediate }),

  // Super Admin - Tenant Management
  admin: {
    list: (params) => api.get('/api/tenants', { params }),
    get: (id) => api.get(`/api/tenants/${seg(id)}`),
    getBySlug: (slug) => api.get(`/api/tenants/slug/${seg(slug)}`),
    create: (data) => api.post('/api/tenants', data),
    update: (id, data) => api.put(`/api/tenants/${seg(id)}`, data),
    delete: (id) => api.delete(`/api/tenants/${seg(id)}`),
    activate: (id) => api.post(`/api/tenants/${seg(id)}/activate`),
    suspend: (id, reason) => api.post(`/api/tenants/${seg(id)}/suspend`, { reason }),
    cancel: (id, reason) => api.post(`/api/tenants/${seg(id)}/cancel`, { reason })
  },

  // RBAC - Roles
  roles: {
    list: () => api.get('/api/tenant/roles'),
    getBuiltIn: () => api.get('/api/tenant/roles/builtin'),
    get: (roleId) => api.get(`/api/tenant/roles/${seg(roleId)}`),
    create: (data) => api.post('/api/tenant/roles', data),
    update: (roleId, data) => api.put(`/api/tenant/roles/${seg(roleId)}`, data),
    delete: (roleId) => api.delete(`/api/tenant/roles/${seg(roleId)}`),
    clone: (roleId, data) => api.post(`/api/tenant/roles/${seg(roleId)}/clone`, data)
  },

  // RBAC - User Roles
  userRoles: {
    get: (userId) => api.get(`/api/tenant/users/${seg(userId)}/roles`),
    set: (userId, roles) => api.put(`/api/tenant/users/${seg(userId)}/roles`, { roles }),
    assign: (userId, roleId) => api.post(`/api/tenant/users/${seg(userId)}/roles/${seg(roleId)}`),
    remove: (userId, roleId) => api.delete(`/api/tenant/users/${seg(userId)}/roles/${seg(roleId)}`)
  },

  // RBAC - Permissions
  permissions: {
    getUser: (userId) => api.get(`/api/tenant/users/${seg(userId)}/permissions`),
    check: (userId, resource, action, scope) =>
      api.get(`/api/tenant/users/${seg(userId)}/permissions/check`, { params: { resource, action, scope } }),
    getInfo: () => api.get('/api/tenant/permissions/info')
  },

  // Billing - Subscription
  billing: {
    getOverview: () => api.get('/api/tenant/billing'),
    getPricing: () => api.get('/api/tenant/billing/pricing'),
    getSubscription: () => api.get('/api/tenant/billing/subscription'),
    updateSubscription: (data) => api.put('/api/tenant/billing/subscription', data),
    changePlan: (plan, immediate) => api.post('/api/tenant/billing/change-plan', { plan, immediate }),
    cancel: (immediate = false) => api.post('/api/tenant/billing/cancel', { immediate }),
    reactivate: () => api.post('/api/tenant/billing/reactivate')
  },

  // Billing - Invoices
  invoices: {
    list: (params) => api.get('/api/tenant/billing/invoices', { params }),
    get: (invoiceId) => api.get(`/api/tenant/billing/invoices/${seg(invoiceId)}`)
  },

  // Billing - Payment Methods
  paymentMethods: {
    list: () => api.get('/api/tenant/billing/payment-methods'),
    add: (data) => api.post('/api/tenant/billing/payment-methods', data),
    remove: (methodId) => api.delete(`/api/tenant/billing/payment-methods/${seg(methodId)}`),
    setDefault: (methodId) => api.put(`/api/tenant/billing/payment-methods/${seg(methodId)}/default`)
  },

  // Billing - Usage
  usage: {
    getSummary: (period) => api.get('/api/tenant/billing/usage', { params: { period } }),
    getStatement: (period) => api.get('/api/tenant/billing/statement', { params: { period } })
  }
}

// Analytics & BI (Fase 6.2)
export const analyticsAPI = {
  // Dashboard & Metrics
  getDashboard: (period) => api.get('/api/analytics/dashboard', { params: { period }, timeout: 120000 }),
  getRealTime: () => api.get('/api/analytics/realtime'),
  getDeclarations: (period) => api.get('/api/analytics/declarations', { params: { period } }),
  getFinancial: (period) => api.get('/api/analytics/financial', { params: { period } }),
  getCompliance: (period) => api.get('/api/analytics/compliance', { params: { period } }),
  getPerformance: (period) => api.get('/api/analytics/performance', { params: { period } }),
  compare: (period1, period2) => api.get('/api/analytics/compare', { params: { period1, period2 } }),
  query: (queryData) => api.post('/api/analytics/query', queryData),

  // Reports
  reports: {
    getTypes: () => api.get('/api/analytics/reports/types'),
    generate: (data) => api.post('/api/analytics/reports/generate', data),
    preview: (data) => api.post('/api/analytics/reports/preview', data),
    schedule: (data) => api.post('/api/analytics/reports/schedule', data),
    list: (params) => api.get('/api/analytics/reports', { params }),
    get: (id) => api.get(`/api/analytics/reports/${seg(id)}`),
    download: (id, format) => api.get(`/api/analytics/reports/${seg(id)}/download`, {
      params: { format },
      responseType: 'blob'
    }),
    delete: (id) => api.delete(`/api/analytics/reports/${seg(id)}`)
  },

  // KPIs
  kpis: {
    getDashboard: () => api.get('/api/analytics/kpis/dashboard'),
    // El analisis de LUCI (Bedrock) tarda mas que el resto: timeout propio, aparte del dashboard
    getAnalysis: () => api.get('/api/analytics/kpis/analysis', { timeout: 90000 }),
    getAll: () => api.get('/api/analytics/kpis'),
    getDefinitions: (category) => api.get('/api/analytics/kpis/definitions', { params: { category } }),
    calculate: (id) => api.get(`/api/analytics/kpis/${seg(id)}`),
    getHistory: (id, period) => api.get(`/api/analytics/kpis/${seg(id)}/history`, { params: { period } }),
    setTarget: (id, target) => api.put(`/api/analytics/kpis/${seg(id)}/target`, { target }),
    compare: (period1, period2) => api.get('/api/analytics/kpis/compare', { params: { period1, period2 } }),
    getAlerts: (filters) => api.get('/api/analytics/kpis/alerts', { params: filters }),
    acknowledgeAlert: (id) => api.post(`/api/analytics/kpis/alerts/${seg(id)}/acknowledge`),
    dismissAlert: (id) => api.delete(`/api/analytics/kpis/alerts/${seg(id)}`)
  },

  // Predictions
  predictions: {
    getModels: () => api.get('/api/analytics/predictions/models'),
    predictVolume: (data) => api.post('/api/analytics/predictions/volume', data),
    predictChannel: (data) => api.post('/api/analytics/predictions/channel', data),
    predictInspection: (data) => api.post('/api/analytics/predictions/inspection', data),
    predictProcessingTime: (data) => api.post('/api/analytics/predictions/processing-time', data),
    predictDuties: (data) => api.post('/api/analytics/predictions/duties', data),
    detectAnomalies: (data) => api.post('/api/analytics/predictions/anomalies', data),
    analyzeTrends: (data) => api.post('/api/analytics/predictions/trends', data)
  },

  // AI-Powered Endpoints - LUCI Integration
  ai: {
    generateInsights: (analyticsData, context) =>
      api.post('/api/analytics/ai/insights', { analyticsData, context }, { timeout: 120000 }),
    detectAnomalies: (data, thresholds) =>
      api.post('/api/analytics/ai/anomalies', { data, thresholds }, { timeout: 120000 }),
    predictTrends: (historicalData, horizon) =>
      api.post('/api/analytics/ai/trends', { historicalData, horizon }, { timeout: 120000 }),
    generateExecutiveReport: (analyticsData, options) =>
      api.post('/api/analytics/ai/executive-report', { analyticsData, options }, { timeout: 180000 }),
    analyzeKPIDeviations: (kpiData, targets) =>
      api.post('/api/analytics/ai/kpi-analysis', { kpiData, targets }, { timeout: 90000 }),
    fullAnalysis: (analyticsData, options) =>
      api.post('/api/analytics/ai/full-analysis', { analyticsData, options }, { timeout: 180000 })
  }
}

// Regulations (BOE & EUR-Lex Search)
export const regulationsAPI = {
  // Search
  search: (query, options = {}) => api.get('/api/regulations/search', { params: { q: query, ...options } }),
  searchBOE: (query, options = {}) => api.get('/api/regulations/boe/search', { params: { q: query, ...options } }),
  searchEURLex: (query, options = {}) => api.get('/api/regulations/eurlex/search', { params: { q: query, ...options } }),

  // Catalogs
  getCAUCatalog: () => api.get('/api/regulations/cau/catalog'),
  getBOECatalog: () => api.get('/api/regulations/boe/catalog'),

  // Document Access
  getDocument: (source, id) => api.get('/api/regulations/document', { params: { source, id }, timeout: 60000 }),
  searchArticle: (celex, article) => api.get('/api/regulations/article', { params: { celex, article }, timeout: 45000 }),

  // LUCI Analysis - Longer timeout for AI processing (120s)
  analyze: (data) => api.post('/api/regulations/analyze', data, { timeout: 120000 }),
  analyzeClassification: (data) => api.post('/api/regulations/analyze-classification', data, { timeout: 120000 }),
  query: (question) => api.post('/api/regulations/query', { question }, { timeout: 120000 })
}

// PUE (Punto Unico de Entrada - ROHS, COM, ECO, CAL)
export const pueAPI = {
  // CRUD
  list: (params) => api.get('/api/pue', { params }),
  get: (id) => api.get(`/api/pue/${seg(id)}`),
  create: (data) => api.post('/api/pue', data),
  update: (id, data) => api.put(`/api/pue/${seg(id)}`, data),

  // Catalog & Info
  getStats: (params) => api.get('/api/pue/stats', { params }),
  getTypes: () => api.get('/api/pue/types'),
  getSoivreOffices: (province) => api.get('/api/pue/soivre-offices', { params: { province } }),
  getRequiredDocuments: (type) => api.get(`/api/pue/required-documents/${seg(type)}`),
  getInfo: () => api.get('/api/pue/info'),
  getDeadlines: (days) => api.get('/api/pue/deadlines', { params: { days } }),

  // Validation
  validate: (data) => api.post('/api/pue/validate', data),
  checkTaric: (taricCodes) => api.post('/api/pue/check-taric', { taricCodes }),
  getRequiredControls: (goods) => api.post('/api/pue/required-controls', { goods }),

  // Batch
  processBatch: (requests, autoSubmit, certificateAlias) =>
    api.post('/api/pue/batch', { requests, autoSubmit, certificateAlias }),

  // Related entities
  getByExpedition: (expeditionId) => api.get(`/api/pue/expedition/${seg(expeditionId)}`),
  getByDeclaration: (mrn) => api.get(`/api/pue/declaration/${seg(mrn)}`),

  // Workflow
  submit: (id, certificateAlias) => api.post(`/api/pue/${seg(id)}/submit`, { certificateAlias }),
  cancel: (id, reason) => api.post(`/api/pue/${seg(id)}/cancel`, { reason }),

  // Documents
  addDocument: (id, data) => api.post(`/api/pue/${seg(id)}/document`, data),

  // Inspection
  scheduleInspection: (id, data) => api.post(`/api/pue/${seg(id)}/inspection/schedule`, data),
  recordInspectionResult: (id, data) => api.post(`/api/pue/${seg(id)}/inspection/result`, data),

  // Certificate
  issueCertificate: (id, data) => api.post(`/api/pue/${seg(id)}/certificate`, data),

  // Integration
  linkToDeclaration: (id, mrn) => api.post(`/api/pue/${seg(id)}/link-declaration`, { mrn }),
  queryStatus: (id) => api.get(`/api/pue/${seg(id)}/status`),
  getXML: (id, regenerate = false) =>
    api.get(`/api/pue/${seg(id)}/xml`, { params: { regenerate }, responseType: 'text' }),

  // Phase 5: SOIVRE Overhaul Endpoints
  getCatalogs: () => api.get('/api/pue/catalogs/all'),
  getSpecificities: (flowType) => api.get(`/api/pue/catalogs/specificities/${seg(flowType)}`),
  getCenters: () => api.get('/api/pue/catalogs/centers'),
  getInspectionPoints: (centerCode) => api.get(`/api/pue/catalogs/inspection-points/${seg(centerCode)}`),
  getUnits: () => api.get('/api/pue/catalogs/units'),
  getCertificateTypes: () => api.get('/api/pue/catalogs/certificate-types'),
  lookupMRN: (mrn, claveZeta) => api.post('/api/pue/lookup-mrn', { mrn, claveZeta }),
  validateRII: (nif) => api.post('/api/pue/validate-rii', { nif }),

  // AI-Powered Endpoints
  aiDetermineType: (goods, context) =>
    api.post('/api/pue/ai/determine-type', { goods, context }, { timeout: 60000 }),
  aiAnalyzeGoods: (description, taricCode) =>
    api.post('/api/pue/ai/analyze-goods', { description, taricCode }, { timeout: 60000 }),
  aiPredictInspection: (id) =>
    api.post(`/api/pue/${seg(id)}/ai/predict-inspection`, {}, { timeout: 60000 }),
  aiSuggestDocuments: (id) =>
    api.post(`/api/pue/${seg(id)}/ai/suggest-documents`, {}, { timeout: 60000 }),
  aiGetRecommendations: (id, inspectionType = 'documental') =>
    api.post(`/api/pue/${seg(id)}/ai/recommendations`, { inspectionType }, { timeout: 60000 }),
  aiFullAnalysis: (id) =>
    api.post(`/api/pue/${seg(id)}/ai/full-analysis`, {}, { timeout: 120000 })
}

// ML Advanced Services (Fase 6.5)
export const mlAPI = {
  // Overall stats
  getStats: () => api.get('/api/ml/stats'),

  // Classification
  classify: (data) => api.post('/api/ml/classify', data),
  classifyFeedback: (data) => api.post('/api/ml/classify/feedback', data),
  getClassificationStats: () => api.get('/api/ml/classify/stats'),
  getClassificationPatterns: () => api.get('/api/ml/classify/patterns'),

  // Channel Prediction
  channel: {
    predict: (data) => api.post('/api/ml/predict-channel', data),
    batchPredict: (declarations) => api.post('/api/ml/predict-channel/batch', { declarations }),
    feedback: (data) => api.post('/api/ml/predict-channel/feedback', data),
    getStats: () => api.get('/api/ml/predict-channel/stats')
  },

  // Fraud Detection
  fraud: {
    analyze: (data) => api.post('/api/ml/fraud/analyze', data),
    quickCheck: (data) => api.post('/api/ml/fraud/quick-check', data),
    feedback: (data) => api.post('/api/ml/fraud/feedback', data),
    getStats: () => api.get('/api/ml/fraud/stats')
  },

  // Recommendations
  recommendations: {
    generate: (data) => api.post('/api/ml/recommendations', data),
    quick: (params) => api.get('/api/ml/recommendations/quick', { params }),
    feedback: (data) => api.post('/api/ml/recommendations/feedback', data),
    getStats: () => api.get('/api/ml/recommendations/stats')
  },

  // Auto-Response
  autoResponse: {
    generate: (data) => api.post('/api/ml/auto-response', data),
    preview: (data) => api.post('/api/ml/auto-response/preview', data),
    listTemplates: () => api.get('/api/ml/auto-response/templates'),
    feedback: (data) => api.post('/api/ml/auto-response/feedback', data),
    getStats: () => api.get('/api/ml/auto-response/stats')
  }
}

// Billing & Subscriptions
export const billingAPI = {
  getSubscription: () => api.get('/api/payments/subscription'),
  createCheckout: (plan, billingCycle = 'monthly') => api.post('/api/payments/create-checkout', { plan, billingCycle }),
  createCustomerPortal: () => api.post('/api/payments/customer-portal'),
  getPayments: (params) => api.get('/api/payments', { params }),
  getStats: () => api.get('/api/payments/stats')
}

// Certificates
export const certificatesAPI = {
  upload: (formData) => api.post('/api/certificates/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  list: () => api.get('/api/certificates'),
  delete: (country) => api.delete(`/api/certificates/${seg(country)}`),
  getStatus: (country) => api.get(`/api/certificates/${seg(country)}/status`)
}

// Netherlands Customs
export const nlCustomsAPI = {
  getHealth: () => api.get('/api/declarations/nl/monitor/health'),
  getStats: () => api.get('/api/declarations/nl/monitor/stats'),
  getPendingCorrections: () => api.get('/api/declarations/corrections/pending'),
  submitCorrection: (expeditionId, correctionId, data) =>
    api.post(`/api/declarations/${seg(expeditionId)}/corrections/${seg(correctionId)}/submit`, data),
  requestCVB: (expeditionId, data) =>
    api.post(`/api/declarations/${seg(expeditionId)}/cvb-request`, data),
  getCVBStatus: (expeditionId) =>
    api.get(`/api/declarations/${seg(expeditionId)}/cvb-status`),
  submitV2: (expeditionId) =>
    api.post(`/api/declarations/${seg(expeditionId)}/submit-v2`),
  validateV2: (expeditionId, declarationType) =>
    api.post(`/api/declarations/${seg(expeditionId)}/validate-v2`, { declarationType })
}

// Manifest (cargo manifest upload + AI classification)
export const manifestAPI = {
  upload: (formData) => api.post('/api/manifest/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  }),
  createBatch: (data) => api.post('/api/manifest/create-h7-batch', data),
  downloadTemplate: () => api.get('/api/manifest/template', { responseType: 'blob' }),
}

// Tenant EORI
export const tenantEoriAPI = {
  get: () => api.get('/api/tenant/eori'),
  update: (eoriNumbers) => api.put('/api/tenant/eori', { eoriNumbers })
}

// Cómo presenta el tenant el H1: servicio, medio de pago, garantía y contacto
export const tenantH1API = {
  get: () => api.get('/api/tenant/h1'),
  update: (datos) => api.put('/api/tenant/h1', datos)
}

export const exciseAPI = {
  detect: (data) => api.post('/api/excise/detect', data),
  calculate: (data) => api.post('/api/excise/calculate', data),
  calculateTotal: (data) => api.post('/api/excise/calculate-total', data),
  getCategories: () => api.get('/api/excise/categories'),
  getRates: () => api.get('/api/excise/rates')
}

export default api
