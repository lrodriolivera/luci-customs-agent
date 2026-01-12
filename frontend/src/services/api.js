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

export default api
