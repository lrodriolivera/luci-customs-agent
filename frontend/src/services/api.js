import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// API Methods

// Auth
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (data) => api.post('/api/auth/register', data),
  profile: () => api.get('/api/auth/profile')
}

// Expeditions
export const expeditionsAPI = {
  list: (params) => api.get('/api/expeditions', { params }),
  get: (id) => api.get(`/api/expeditions/${id}`),
  create: (data) => api.post('/api/expeditions', data),
  update: (id, data) => api.put(`/api/expeditions/${id}`, data),
  delete: (id) => api.delete(`/api/expeditions/${id}`),
  getChecklist: (id) => api.get(`/api/expeditions/${id}/checklist`),
  sendPortalLink: (id) => api.post(`/api/expeditions/${id}/send-portal-link`)
}

// Documents
export const documentsAPI = {
  upload: (expeditionId, formData) => api.post(
    `/api/expeditions/${expeditionId}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ),
  validate: (docId) => api.post(`/api/documents/${docId}/validate`),
  extract: (docId) => api.post(`/api/documents/${docId}/extract`)
}

// Classification
export const classificationAPI = {
  classify: (data) => api.post('/ai/classify', data),
  validate: (taricCode, description, origin) =>
    api.post('/ai/validate-classification', null, {
      params: { taric_code: taricCode, description, origin }
    }),
  search: (query) => api.get('/api/classification/search', { params: { query } })
}

// Declarations
export const declarationsAPI = {
  generateH1: (data) => api.post('/api/declarations/h1/generate-direct', data),
  generateAES: (data) => api.post('/api/declarations/aes/generate', data),
  getXML: (expeditionId) => api.get(`/api/declarations/${expeditionId}/xml`, { responseType: 'text' }),
  exportXML: (expeditionId, type) =>
    api.get(`/api/declarations/${expeditionId}/xml`, {
      params: { type },
      responseType: 'blob'
    }),
  submit: (expeditionId) => api.post(`/api/declarations/${expeditionId}/submit`),
  getSummary: (expeditionId) => api.get(`/api/declarations/${expeditionId}/summary`)
}

// Calculations
export const calculationsAPI = {
  calculateDuties: (params) => api.post('/ai/calculate-duties', null, { params })
}

// Portal
export const portalAPI = {
  access: (token) => api.get(`/api/portal/${token}`),
  uploadDocument: (token, formData) => api.post(
    `/api/portal/${token}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ),
  getMessages: (token) => api.get(`/api/portal/${token}/messages`),
  sendMessage: (token, message) => api.post(`/api/portal/${token}/messages`, { message }),
  getStatus: (token) => api.get(`/api/portal/${token}/status`)
}

// Chat/AI
export const chatAPI = {
  send: (data) => api.post('/ai/chat', data),
  ask: (question) => api.post('/ai/ask', null, { params: { question } })
}

// Knowledge
export const knowledgeAPI = {
  search: (query) => api.get('/ai/knowledge/search', { params: { query } }),
  categories: () => api.get('/ai/knowledge/categories'),
  h1Guidance: (field) => api.get(`/ai/knowledge/h1-guidance/${field}`),
  documentRequirements: (params) => api.get('/ai/knowledge/document-requirements', { params }),
  regimeInfo: (code) => api.get(`/ai/knowledge/regime/${code}`),
  incotermInfo: (incoterm) => api.get(`/ai/knowledge/incoterm/${incoterm}`)
}

// Requirements (AEAT/Paraduanero)
export const requirementsAPI = {
  list: (params) => api.get('/api/requirements', { params }),
  get: (id) => api.get(`/api/requirements/${id}`),
  getByExpedition: (expeditionId) => api.get(`/api/requirements/expedition/${expeditionId}`),
  getStats: (params) => api.get('/api/requirements/stats', { params }),
  create: (data) => api.post('/api/requirements', data),
  update: (id, data) => api.put(`/api/requirements/${id}`, data),
  addResponse: (id, data) => api.post(`/api/requirements/${id}/response`, data),
  submitToAEAT: (id, responseIndex) => api.post(`/api/requirements/${id}/submit`, { responseIndex }),
  markItemProvided: (id, itemId, documentId) =>
    api.put(`/api/requirements/${id}/items/${itemId}/provided`, { documentId }),
  scheduleInspection: (id, data) => api.post(`/api/requirements/${id}/inspection/schedule`, data),
  recordInspectionResult: (id, data) => api.post(`/api/requirements/${id}/inspection/result`, data),
  resolve: (id, data) => api.post(`/api/requirements/${id}/resolve`, data),
  generateAIResponse: (id) => api.post(`/api/requirements/${id}/ai-response`)
}

// Channels (Circuitos de control)
export const channelsAPI = {
  getConfig: () => api.get('/api/channels/config'),
  getStats: (params) => api.get('/api/channels/stats', { params }),
  getStatus: (expeditionId) => api.get(`/api/channels/${expeditionId}/status`),
  getLevante: (expeditionId) => api.get(`/api/channels/${expeditionId}/levante`),
  reevaluate: (expeditionId) => api.post(`/api/channels/${expeditionId}/reevaluate`),
  processManually: (expeditionId, channel) =>
    api.post(`/api/channels/${expeditionId}/process`, { channel })
}

// Paraduanero (Controles paraduaneros: SOIVRE, MAPA, Sanidad, MITERD)
export const paraduaneroAPI = {
  list: (params) => api.get('/api/paraduanero', { params }),
  getStats: (params) => api.get('/api/paraduanero/stats', { params }),
  analyze: (expeditionId) => api.get(`/api/paraduanero/analyze/${expeditionId}`),
  createControls: (expeditionId) => api.post(`/api/paraduanero/create/${expeditionId}`),
  getByExpedition: (expeditionId) => api.get(`/api/paraduanero/expedition/${expeditionId}`),
  get: (id) => api.get(`/api/paraduanero/${id}`),
  update: (id, data) => api.put(`/api/paraduanero/${id}`, data),
  provideDocument: (id, code, data) => api.post(`/api/paraduanero/${id}/document/${code}/provide`, data),
  scheduleInspection: (id, data) => api.post(`/api/paraduanero/${id}/inspection/schedule`, data),
  recordResult: (id, data) => api.post(`/api/paraduanero/${id}/inspection/result`, data),
  issueCertificate: (id, data) => api.post(`/api/paraduanero/${id}/certificate`, data),
  changeStatus: (id, data) => api.post(`/api/paraduanero/${id}/status`, data)
}

export default api
