import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Configurar mocks antes de importar api.js
let mockApi
let requestInterceptor
let responseInterceptor
let mockCognitoService
let mockSentry

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks()

  // mockApi necesita ser callable (para el retry en línea 56 de api.js: return api(originalRequest))
  // pero también tener métodos y propiedades
  const apiCallable = vi.fn()
  mockApi = Object.assign(apiCallable, {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn((onFulfilled, onRejected) => {
          requestInterceptor = { onFulfilled, onRejected }
          return 0
        })
      },
      response: {
        use: vi.fn((onFulfilled, onRejected) => {
          responseInterceptor = { onFulfilled, onRejected }
          return 0
        })
      }
    }
  })

  mockCognitoService = {
    isConfigured: vi.fn(),
    getAccessToken: vi.fn()
  }

  mockSentry = {
    addBreadcrumb: vi.fn(),
    captureException: vi.fn()
  }

  // Mock localStorage
  global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }

  // Mock window.location
  delete window.location
  window.location = { href: '' }

  // Mock axios
  vi.doMock('axios', () => ({
    default: {
      create: vi.fn(() => mockApi)
    }
  }))

  // Mock Sentry
  vi.doMock('@sentry/react', () => mockSentry)

  // Mock i18n
  vi.doMock('../i18n/i18n', () => ({ default: { language: 'es' } }))

  // Mock cognitoService
  vi.doMock('./cognitoService', () => mockCognitoService)
})

afterEach(() => {
  vi.resetModules()
})

describe('api.js — Request Interceptor', () => {
  it('añade token de Cognito cuando está configurado y getAccessToken funciona', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(true)
    mockCognitoService.getAccessToken.mockResolvedValue('cognito-token-123')

    const config = { headers: {}, method: 'get', url: '/test' }
    const result = await requestInterceptor.onFulfilled(config)

    expect(mockCognitoService.isConfigured).toHaveBeenCalled()
    expect(mockCognitoService.getAccessToken).toHaveBeenCalled()
    expect(result.headers.Authorization).toBe('Bearer cognito-token-123')
  })

  it('cae a localStorage cuando Cognito configurado pero getAccessToken rechaza (con token)', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(true)
    mockCognitoService.getAccessToken.mockRejectedValue(new Error('expired'))
    global.localStorage.getItem.mockReturnValue('legacy-token-456')

    const config = { headers: {}, method: 'post', url: '/test' }
    const result = await requestInterceptor.onFulfilled(config)

    expect(mockCognitoService.getAccessToken).toHaveBeenCalled()
    expect(global.localStorage.getItem).toHaveBeenCalledWith('token')
    expect(result.headers.Authorization).toBe('Bearer legacy-token-456')
  })

  it('cae a localStorage cuando Cognito configurado pero getAccessToken rechaza (sin token)', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(true)
    mockCognitoService.getAccessToken.mockRejectedValue(new Error('expired'))
    global.localStorage.getItem.mockReturnValue(null)

    const config = { headers: {}, method: 'get', url: '/test' }
    const result = await requestInterceptor.onFulfilled(config)

    expect(result.headers.Authorization).toBeUndefined()
  })

  it('usa localStorage directamente cuando Cognito NO está configurado (con token)', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(false)
    global.localStorage.getItem.mockReturnValue('local-token-789')

    const config = { headers: {}, method: 'delete', url: '/test' }
    const result = await requestInterceptor.onFulfilled(config)

    expect(mockCognitoService.isConfigured).toHaveBeenCalled()
    expect(mockCognitoService.getAccessToken).not.toHaveBeenCalled()
    expect(global.localStorage.getItem).toHaveBeenCalledWith('token')
    expect(result.headers.Authorization).toBe('Bearer local-token-789')
  })

  it('usa localStorage directamente cuando Cognito NO está configurado (sin token)', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(false)
    global.localStorage.getItem.mockReturnValue(null)

    const config = { headers: {}, method: 'patch', url: '/test' }
    const result = await requestInterceptor.onFulfilled(config)

    expect(result.headers.Authorization).toBeUndefined()
  })

  it('NO añade Authorization si ya existe en el config', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(true)

    const config = { headers: { Authorization: 'Bearer manual-token' }, method: 'get', url: '/test' }
    const result = await requestInterceptor.onFulfilled(config)

    expect(mockCognitoService.isConfigured).not.toHaveBeenCalled()
    expect(result.headers.Authorization).toBe('Bearer manual-token')
  })

  it('añade breadcrumb de Sentry correctamente', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(false)
    global.localStorage.getItem.mockReturnValue(null)

    const config = { headers: {}, method: 'POST', url: '/api/test' }
    await requestInterceptor.onFulfilled(config)

    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'http',
      message: 'POST /api/test',
      level: 'info'
    })
  })

  it('maneja error en Sentry.addBreadcrumb sin romper el interceptor', async () => {
    const api = await import('./api.js')

    mockSentry.addBreadcrumb.mockImplementation(() => {
      throw new Error('Sentry error')
    })
    mockCognitoService.isConfigured.mockReturnValue(false)
    global.localStorage.getItem.mockReturnValue('token-ok')

    const config = { headers: {}, method: 'get', url: '/test' }
    const result = await requestInterceptor.onFulfilled(config)

    expect(result.headers.Authorization).toBe('Bearer token-ok')
  })

  it('rechaza correctamente en caso de error en el interceptor de request', async () => {
    const api = await import('./api.js')

    const testError = new Error('request error')
    await expect(requestInterceptor.onRejected(testError)).rejects.toThrow('request error')
  })
})

describe('api.js — Response Interceptor', () => {
  it('pasa respuestas exitosas sin modificar', async () => {
    const api = await import('./api.js')

    const response = { status: 200, data: { ok: true } }
    const result = await responseInterceptor.onFulfilled(response)

    expect(result).toEqual(response)
  })

  it('maneja 401 con Cognito configurado, reintentar con nuevo token exitoso', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(true)
    mockCognitoService.getAccessToken.mockResolvedValue('new-cognito-token')
    mockApi.mockResolvedValue({ status: 200, data: { success: true } })

    const error = {
      response: { status: 401 },
      config: { url: '/api/test', headers: {} }
    }

    const result = await responseInterceptor.onRejected(error)

    expect(mockCognitoService.getAccessToken).toHaveBeenCalled()
    expect(error.config._retry).toBe(true)
    expect(error.config.headers.Authorization).toBe('Bearer new-cognito-token')
    expect(mockApi).toHaveBeenCalledWith(error.config)
    expect(result).toEqual({ status: 200, data: { success: true } })
  })

  it('maneja 401 con Cognito configurado pero getAccessToken falla, redirige a login', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(true)
    mockCognitoService.getAccessToken.mockRejectedValue(new Error('session expired'))

    const error = {
      response: { status: 401 },
      config: { url: '/api/test', headers: {} }
    }

    await expect(responseInterceptor.onRejected(error)).rejects.toEqual(error)

    expect(global.localStorage.removeItem).toHaveBeenCalledWith('token')
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('user')
    expect(window.location.href).toBe('/login')
  })

  it('maneja 401 sin Cognito configurado, redirige a login', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(false)

    const error = {
      response: { status: 401 },
      config: { url: '/api/test', headers: {} }
    }

    await expect(responseInterceptor.onRejected(error)).rejects.toEqual(error)

    expect(global.localStorage.removeItem).toHaveBeenCalledWith('token')
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('user')
    expect(window.location.href).toBe('/login')
  })

  it('NO maneja 401 si ya hay _retry marcado (evita loop infinito)', async () => {
    const api = await import('./api.js')

    mockCognitoService.isConfigured.mockReturnValue(true)

    const error = {
      response: { status: 401 },
      config: { url: '/api/test', headers: {}, _retry: true }
    }

    await expect(responseInterceptor.onRejected(error)).rejects.toEqual(error)

    expect(mockCognitoService.getAccessToken).not.toHaveBeenCalled()
    expect(global.localStorage.removeItem).not.toHaveBeenCalled()
  })

  it('NO maneja 401 si la URL incluye /session', async () => {
    const api = await import('./api.js')

    const error = {
      response: { status: 401 },
      config: { url: '/api/auth/session', headers: {} }
    }

    await expect(responseInterceptor.onRejected(error)).rejects.toEqual(error)

    expect(mockCognitoService.isConfigured).not.toHaveBeenCalled()
    expect(global.localStorage.removeItem).not.toHaveBeenCalled()
  })

  it('maneja status >= 500 enviando error a Sentry', async () => {
    const api = await import('./api.js')

    const error = {
      response: { status: 500 },
      config: { url: '/api/test' }
    }

    await expect(responseInterceptor.onRejected(error)).rejects.toEqual(error)

    expect(mockSentry.captureException).toHaveBeenCalledWith(error, {
      tags: { type: 'api_error', status: 500, url: '/api/test' }
    })
  })

  it('maneja status 503 enviando error a Sentry', async () => {
    const api = await import('./api.js')

    const error = {
      response: { status: 503 },
      config: { url: '/api/health' }
    }

    await expect(responseInterceptor.onRejected(error)).rejects.toEqual(error)

    expect(mockSentry.captureException).toHaveBeenCalledWith(error, {
      tags: { type: 'api_error', status: 503, url: '/api/health' }
    })
  })

  it('maneja error en Sentry.captureException sin romper el interceptor', async () => {
    const api = await import('./api.js')

    mockSentry.captureException.mockImplementation(() => {
      throw new Error('Sentry error')
    })

    const error = {
      response: { status: 500 },
      config: { url: '/api/test' }
    }

    await expect(responseInterceptor.onRejected(error)).rejects.toEqual(error)
  })

  it('rechaza error sin response (network error)', async () => {
    const api = await import('./api.js')

    const error = new Error('Network Error')

    await expect(responseInterceptor.onRejected(error)).rejects.toThrow('Network Error')
  })

  it('rechaza error con status 400 sin interceptarlo', async () => {
    const api = await import('./api.js')

    const error = {
      response: { status: 400 },
      config: { url: '/api/test' }
    }

    await expect(responseInterceptor.onRejected(error)).rejects.toEqual(error)

    expect(mockSentry.captureException).not.toHaveBeenCalled()
    expect(global.localStorage.removeItem).not.toHaveBeenCalled()
  })
})

describe('api.js — authAPI', () => {
  it('authAPI.login llama a POST /api/auth/login', async () => {
    const api = await import('./api.js')

    const credentials = { email: 'test@test.com', password: '123456' }
    await api.authAPI.login(credentials)

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/login', credentials)
  })

  it('authAPI.register llama a POST /api/auth/register', async () => {
    const api = await import('./api.js')

    const data = { email: 'new@test.com', password: 'pass123', name: 'Test User' }
    await api.authAPI.register(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/register', data)
  })

  it('authAPI.profile llama a GET /api/auth/me', async () => {
    const api = await import('./api.js')

    await api.authAPI.profile()

    expect(mockApi.get).toHaveBeenCalledWith('/api/auth/me')
  })

  it('authAPI.forgotPassword llama a POST /api/auth/forgot-password', async () => {
    const api = await import('./api.js')

    await api.authAPI.forgotPassword('user@test.com')

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/forgot-password', { email: 'user@test.com' })
  })

  it('authAPI.resetPassword llama a POST /api/auth/reset-password/:token', async () => {
    const api = await import('./api.js')

    await api.authAPI.resetPassword('token123', 'newpassword')

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/reset-password/token123', { password: 'newpassword' })
  })
})

describe('api.js — expeditionsAPI', () => {
  it('expeditionsAPI.list llama a GET /api/expeditions con params', async () => {
    const api = await import('./api.js')

    const params = { status: 'pending', limit: 10 }
    await api.expeditionsAPI.list(params)

    expect(mockApi.get).toHaveBeenCalledWith('/api/expeditions', { params })
  })

  it('expeditionsAPI.get llama a GET /api/expeditions/:id', async () => {
    const api = await import('./api.js')

    await api.expeditionsAPI.get('exp123')

    expect(mockApi.get).toHaveBeenCalledWith('/api/expeditions/exp123')
  })

  it('expeditionsAPI.create llama a POST /api/expeditions', async () => {
    const api = await import('./api.js')

    const data = { name: 'New Expedition' }
    await api.expeditionsAPI.create(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/expeditions', data)
  })

  it('expeditionsAPI.update llama a PUT /api/expeditions/:id', async () => {
    const api = await import('./api.js')

    const data = { status: 'completed' }
    await api.expeditionsAPI.update('exp123', data)

    expect(mockApi.put).toHaveBeenCalledWith('/api/expeditions/exp123', data)
  })

  it('expeditionsAPI.delete llama a DELETE /api/expeditions/:id', async () => {
    const api = await import('./api.js')

    await api.expeditionsAPI.delete('exp123')

    expect(mockApi.delete).toHaveBeenCalledWith('/api/expeditions/exp123')
  })

  it('expeditionsAPI.getChecklist llama a GET /api/expeditions/:id/checklist', async () => {
    const api = await import('./api.js')

    await api.expeditionsAPI.getChecklist('exp123')

    expect(mockApi.get).toHaveBeenCalledWith('/api/expeditions/exp123/checklist')
  })

  it('expeditionsAPI.sendPortalLink llama a POST /api/expeditions/:id/send-portal-link', async () => {
    const api = await import('./api.js')

    await api.expeditionsAPI.sendPortalLink('exp123', 'client@test.com')

    expect(mockApi.post).toHaveBeenCalledWith('/api/expeditions/exp123/send-portal-link', { email: 'client@test.com' })
  })

  it('expeditionsAPI.getStats llama a GET /api/expeditions/stats', async () => {
    const api = await import('./api.js')

    await api.expeditionsAPI.getStats()

    expect(mockApi.get).toHaveBeenCalledWith('/api/expeditions/stats')
  })

  it('expeditionsAPI.aiSuggestDocuments llama a POST con timeout 60s', async () => {
    const api = await import('./api.js')

    await api.expeditionsAPI.aiSuggestDocuments('exp123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/expeditions/exp123/ai/suggest-documents', {}, { timeout: 60000 })
  })

  it('expeditionsAPI.aiAnalyzeRisk llama a POST con timeout 90s', async () => {
    const api = await import('./api.js')

    await api.expeditionsAPI.aiAnalyzeRisk('exp123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/expeditions/exp123/ai/analyze-risk', {}, { timeout: 90000 })
  })

  it('expeditionsAPI.aiSuggestTaric llama a POST con timeout 120s', async () => {
    const api = await import('./api.js')

    await api.expeditionsAPI.aiSuggestTaric('exp123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/expeditions/exp123/ai/suggest-taric', {}, { timeout: 120000 })
  })

  it('expeditionsAPI.applyTaricSuggestion llama a POST con códigos TARIC', async () => {
    const api = await import('./api.js')

    await api.expeditionsAPI.applyTaricSuggestion('exp123', 0, '0901210000', '0901')

    expect(mockApi.post).toHaveBeenCalledWith('/api/expeditions/exp123/ai/apply-taric/0', {
      taricCode: '0901210000',
      hsCode: '0901'
    })
  })
})

describe('api.js — documentsAPI', () => {
  it('documentsAPI.upload llama a POST con multipart/form-data', async () => {
    const api = await import('./api.js')

    const formData = new FormData()
    formData.append('file', new Blob(['test']), 'test.pdf')

    await api.documentsAPI.upload('exp123', formData)

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/expeditions/exp123/documents',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  })

  it('documentsAPI.validate llama a POST /api/documents/:docId/validate', async () => {
    const api = await import('./api.js')

    await api.documentsAPI.validate('doc123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/documents/doc123/validate')
  })

  it('documentsAPI.extract llama a POST /api/documents/:docId/extract', async () => {
    const api = await import('./api.js')

    await api.documentsAPI.extract('doc123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/documents/doc123/extract')
  })
})

describe('api.js — classificationAPI', () => {
  it('classificationAPI.classify llama a POST /api/classification/suggest', async () => {
    // Antes apuntaba a /ai/classify, que no existe en el backend y devolvia 405.
    const api = await import('./api.js')

    const data = { description: 'Café tostado' }
    await api.classificationAPI.classify(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/classification/suggest', data, { timeout: 90000 })
  })

  it('classificationAPI.validate llama a POST /api/classification/validate con el cuerpo', async () => {
    // Antes /ai/validate-classification (405) y con params en query; el backend
    // lee el cuerpo en camelCase.
    const api = await import('./api.js')

    await api.classificationAPI.validate('0901210000', 'Café', 'CO')

    expect(mockApi.post).toHaveBeenCalledWith('/api/classification/validate', {
      taricCode: '0901210000', description: 'Café', origin: 'CO'
    })
  })

  it('classificationAPI.search llama a GET con query', async () => {
    const api = await import('./api.js')

    await api.classificationAPI.search('café')

    expect(mockApi.get).toHaveBeenCalledWith('/api/classification/search', { params: { q: 'café' } })
  })

  it('classificationAPI.searchByChapter llama a GET con chapter', async () => {
    const api = await import('./api.js')

    await api.classificationAPI.searchByChapter('09')

    expect(mockApi.get).toHaveBeenCalledWith('/api/classification/search', { params: { chapter: '09' } })
  })

  it('classificationAPI.suggest llama a POST con timeout 90s', async () => {
    const api = await import('./api.js')

    const data = { description: 'Portátil' }
    await api.classificationAPI.suggest(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/classification/suggest', data, { timeout: 90000 })
  })

  it('classificationAPI.getTaricInfo llama a GET /api/classification/taric/:code', async () => {
    const api = await import('./api.js')

    await api.classificationAPI.getTaricInfo('8471300000')

    expect(mockApi.get).toHaveBeenCalledWith('/api/classification/taric/8471300000')
  })

  it('classificationAPI.calculateDuties llama a POST /api/classification/calculate-duties', async () => {
    const api = await import('./api.js')

    const data = { taricCode: '2204210000', value: 1000, origin: 'FR' }
    await api.classificationAPI.calculateDuties(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/classification/calculate-duties', data)
  })
})

describe('api.js — declarationsAPI', () => {
  it('declarationsAPI.generateH1 llama a POST /api/declarations/h1/generate-direct', async () => {
    const api = await import('./api.js')

    const data = { expeditionId: 'exp123' }
    await api.declarationsAPI.generateH1(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/declarations/h1/generate-direct', data)
  })

  it('declarationsAPI.generateAES llama a POST /api/declarations/aes/generate', async () => {
    const api = await import('./api.js')

    const data = { expeditionId: 'exp123' }
    await api.declarationsAPI.generateAES(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/declarations/aes/generate', data)
  })

  it('declarationsAPI.checkH7Eligibility llama a GET con expeditionId', async () => {
    const api = await import('./api.js')

    await api.declarationsAPI.checkH7Eligibility('exp123')

    expect(mockApi.get).toHaveBeenCalledWith('/api/declarations/h7/check-eligibility/exp123')
  })

  it('declarationsAPI.generateH7 llama a POST /api/declarations/h7/generate', async () => {
    const api = await import('./api.js')

    const data = { expeditionId: 'exp123', value: 100 }
    await api.declarationsAPI.generateH7(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/declarations/h7/generate', data)
  })

  it('declarationsAPI.downloadPDF llama a GET con responseType blob', async () => {
    const api = await import('./api.js')

    await api.declarationsAPI.downloadPDF('exp123', false)

    expect(mockApi.get).toHaveBeenCalledWith('/api/declarations/exp123/pdf', { responseType: 'blob' })
  })

  it('declarationsAPI.downloadPDF con preview llama con query param', async () => {
    const api = await import('./api.js')

    await api.declarationsAPI.downloadPDF('exp123', true)

    expect(mockApi.get).toHaveBeenCalledWith('/api/declarations/exp123/pdf?preview=true', { responseType: 'blob' })
  })

  it('declarationsAPI.exportXML llama a GET con type en params y responseType blob', async () => {
    const api = await import('./api.js')

    await api.declarationsAPI.exportXML('exp123', 'H1')

    expect(mockApi.get).toHaveBeenCalledWith('/api/declarations/exp123/xml', {
      params: { type: 'H1' },
      responseType: 'blob'
    })
  })
})

describe('api.js — calculationsAPI', () => {
  it('calculationsAPI.calculateDuties llama a POST con timeout 60s', async () => {
    const api = await import('./api.js')

    const data = { taricCode: '0901210000', value: 5000 }
    await api.calculationsAPI.calculateDuties(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/calculation/duties', data, { timeout: 60000 })
  })

  it('calculationsAPI.calculateVat llama a POST /api/calculation/vat', async () => {
    const api = await import('./api.js')

    const data = { value: 1000 }
    await api.calculationsAPI.calculateVat(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/calculation/vat', data)
  })

  it('calculationsAPI.getExchangeRate llama a GET con currency en params', async () => {
    const api = await import('./api.js')

    await api.calculationsAPI.getExchangeRate('USD')

    expect(mockApi.get).toHaveBeenCalledWith('/api/calculation/exchange-rate', { params: { currency: 'USD' } })
  })

  it('calculationsAPI.getDutyInfo llama a GET con origin en params', async () => {
    const api = await import('./api.js')

    await api.calculationsAPI.getDutyInfo('8471300000', 'CN')

    expect(mockApi.get).toHaveBeenCalledWith('/api/calculation/duty-info/8471300000', {
      params: { origin: 'CN' },
      timeout: 60000
    })
  })

  it('calculationsAPI.getDutyInfo sin origin llama con params vacíos', async () => {
    const api = await import('./api.js')

    await api.calculationsAPI.getDutyInfo('8471300000', null)

    expect(mockApi.get).toHaveBeenCalledWith('/api/calculation/duty-info/8471300000', {
      params: {},
      timeout: 60000
    })
  })
})

describe('api.js — portalAPI', () => {
  it('portalAPI.access llama a GET /api/portal/:token', async () => {
    const api = await import('./api.js')

    await api.portalAPI.access('token123')

    expect(mockApi.get).toHaveBeenCalledWith('/api/portal/token123')
  })

  it('portalAPI.uploadDocument llama a POST con multipart', async () => {
    const api = await import('./api.js')

    const formData = new FormData()
    await api.portalAPI.uploadDocument('token123', formData)

    expect(mockApi.post).toHaveBeenCalledWith('/api/portal/token123/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  })

  it('portalAPI.sendMessage llama a POST /api/portal/:token/chat', async () => {
    const api = await import('./api.js')

    await api.portalAPI.sendMessage('token123', 'Hola')

    expect(mockApi.post).toHaveBeenCalledWith('/api/portal/token123/chat', { content: 'Hola' })
  })

  it('portalAPI.createCheckoutSession llama a POST con paymentId', async () => {
    const api = await import('./api.js')

    await api.portalAPI.createCheckoutSession('token123', 'pay456')

    expect(mockApi.post).toHaveBeenCalledWith('/api/portal/token123/payments/pay456/checkout')
  })

  it('portalAPI.aiEnhancedChat incluye language de i18n', async () => {
    const api = await import('./api.js')

    await api.portalAPI.aiEnhancedChat('token123', 'mensaje')

    expect(mockApi.post).toHaveBeenCalledWith('/api/portal/token123/ai/chat', {
      message: 'mensaje',
      language: 'es'
    }, { timeout: 60000 })
  })
})

describe('api.js — chatAPI', () => {
  it('chatAPI.send incluye language de i18n', async () => {
    const api = await import('./api.js')

    const data = { message: 'Hola' }
    await api.chatAPI.send(data)

    expect(mockApi.post).toHaveBeenCalledWith('/ai/chat', { message: 'Hola', language: 'es' })
  })

  it('chatAPI.ask incluye language de i18n', async () => {
    const api = await import('./api.js')

    await api.chatAPI.ask('¿Qué es TARIC?')

    expect(mockApi.post).toHaveBeenCalledWith('/ai/ask', { question: '¿Qué es TARIC?', language: 'es' })
  })
})

describe('api.js — requirementsAPI', () => {
  it('requirementsAPI.list llama a GET /api/requirements con params', async () => {
    const api = await import('./api.js')

    const params = { status: 'pending' }
    await api.requirementsAPI.list(params)

    expect(mockApi.get).toHaveBeenCalledWith('/api/requirements', { params })
  })

  it('requirementsAPI.submitToAEAT llama a POST con responseIndex', async () => {
    const api = await import('./api.js')

    await api.requirementsAPI.submitToAEAT('req123', 0)

    expect(mockApi.post).toHaveBeenCalledWith('/api/requirements/req123/submit', { responseIndex: 0 })
  })

  it('requirementsAPI.generateAIResponse llama a POST con timeout 120s', async () => {
    const api = await import('./api.js')

    await api.requirementsAPI.generateAIResponse('req123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/requirements/req123/ai-response', {}, { timeout: 120000 })
  })
})

describe('api.js — ensAPI', () => {
  it('ensAPI.list llama a GET /api/ens con params', async () => {
    const api = await import('./api.js')

    const params = { status: 'submitted' }
    await api.ensAPI.list(params)

    expect(mockApi.get).toHaveBeenCalledWith('/api/ens', { params })
  })

  it('ensAPI.submit llama a POST con certificateAlias', async () => {
    const api = await import('./api.js')

    await api.ensAPI.submit('ens123', 'cert-fnmt')

    expect(mockApi.post).toHaveBeenCalledWith('/api/ens/ens123/submit', { certificateAlias: 'cert-fnmt' })
  })

  it('ensAPI.cancel llama a POST con reason', async () => {
    const api = await import('./api.js')

    await api.ensAPI.cancel('ens123', 'Error in data')

    expect(mockApi.post).toHaveBeenCalledWith('/api/ens/ens123/cancel', { reason: 'Error in data' })
  })

  it('ensAPI.getXML llama a GET con responseType text', async () => {
    const api = await import('./api.js')

    await api.ensAPI.getXML('ens123')

    expect(mockApi.get).toHaveBeenCalledWith('/api/ens/ens123/xml', { responseType: 'text' })
  })

  it('ensAPI.searchByContainer llama a GET con container', async () => {
    const api = await import('./api.js')

    await api.ensAPI.searchByContainer('MSCU1234567')

    expect(mockApi.get).toHaveBeenCalledWith('/api/ens/search/container/MSCU1234567')
  })
})

describe('api.js — h7API', () => {
  it('h7API.list llama a GET /api/h7 con params', async () => {
    const api = await import('./api.js')

    const params = { limit: 20 }
    await api.h7API.list(params)

    expect(mockApi.get).toHaveBeenCalledWith('/api/h7', { params })
  })

  it('h7API.validateIOSS llama a GET con iossNumber', async () => {
    const api = await import('./api.js')

    await api.h7API.validateIOSS('IM1234567890')

    expect(mockApi.get).toHaveBeenCalledWith('/api/h7/validate-ioss/IM1234567890')
  })

  it('h7API.fraudCheck llama a GET /api/h7/:id/fraud-check', async () => {
    const api = await import('./api.js')

    await api.h7API.fraudCheck('h7-123')

    expect(mockApi.get).toHaveBeenCalledWith('/api/h7/h7-123/fraud-check')
  })

  it('h7API.importCSV llama a POST con csv y autoSubmit', async () => {
    const api = await import('./api.js')

    await api.h7API.importCSV('csv-data', true)

    expect(mockApi.post).toHaveBeenCalledWith('/api/h7/import-csv', { csv: 'csv-data', autoSubmit: true })
  })
})

describe('api.js — guaranteesAPI', () => {
  it('guaranteesAPI.list llama a GET /api/guarantees con params', async () => {
    const api = await import('./api.js')

    const params = { status: 'active' }
    await api.guaranteesAPI.list(params)

    expect(mockApi.get).toHaveBeenCalledWith('/api/guarantees', { params })
  })

  it('guaranteesAPI.activate llama a POST con data', async () => {
    const api = await import('./api.js')

    const data = { activationDate: '2026-08-06' }
    await api.guaranteesAPI.activate('guar123', data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/guarantees/guar123/activate', data)
  })

  it('guaranteesAPI.consume llama a POST con data', async () => {
    const api = await import('./api.js')

    const data = { amount: 1000, reference: 'exp123' }
    await api.guaranteesAPI.consume('guar123', data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/guarantees/guar123/consume', data)
  })

  it('guaranteesAPI.aiAnalyzeNeeds llama a POST con timeout 90s', async () => {
    const api = await import('./api.js')

    const operation = { type: 'import', value: 50000 }
    await api.guaranteesAPI.aiAnalyzeNeeds(operation)

    expect(mockApi.post).toHaveBeenCalledWith('/api/guarantees/ai/analyze-needs', { operation }, { timeout: 90000 })
  })
})

describe('api.js — transitAPI', () => {
  it('transitAPI.list llama a GET /api/transit con params', async () => {
    const api = await import('./api.js')

    const params = { status: 'in_transit' }
    await api.transitAPI.list(params)

    expect(mockApi.get).toHaveBeenCalledWith('/api/transit', { params })
  })

  it('transitAPI.submit llama a POST /api/transit/:id/submit', async () => {
    const api = await import('./api.js')

    await api.transitAPI.submit('trans123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/transit/trans123/submit')
  })

  it('transitAPI.notifyArrival llama a POST con data', async () => {
    const api = await import('./api.js')

    const data = { arrivalDate: '2026-08-06', location: 'BCN' }
    await api.transitAPI.notifyArrival('trans123', data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/transit/trans123/arrival', data)
  })

  it('transitAPI.aiAutoComplete llama a POST con timeout 90s', async () => {
    const api = await import('./api.js')

    const transitDraft = { type: 'T1' }
    await api.transitAPI.aiAutoComplete(transitDraft, 'exp123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/transit/ai/auto-complete', {
      transitDraft,
      expeditionId: 'exp123'
    }, { timeout: 90000 })
  })
})

describe('api.js — oeaAPI', () => {
  it('oeaAPI.getByEORI llama a GET /api/oea/eori/:eori', async () => {
    const api = await import('./api.js')

    await api.oeaAPI.getByEORI('ESB22477020')

    expect(mockApi.get).toHaveBeenCalledWith('/api/oea/eori/ESB22477020')
  })

  it('oeaAPI.getByNIF llama a GET /api/oea/nif/:nif', async () => {
    const api = await import('./api.js')

    await api.oeaAPI.getByNIF('B22477020')

    expect(mockApi.get).toHaveBeenCalledWith('/api/oea/nif/B22477020')
  })

  it('oeaAPI.approve llama a POST con data', async () => {
    const api = await import('./api.js')

    const data = { approvedBy: 'admin123', date: '2026-08-06' }
    await api.oeaAPI.approve('oea123', data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/oea/oea123/approve', data)
  })

  it('oeaAPI.calculateGuaranteeReduction llama a POST con data', async () => {
    const api = await import('./api.js')

    const data = { guaranteeAmount: 100000 }
    await api.oeaAPI.calculateGuaranteeReduction('oea123', data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/oea/oea123/guarantee-reduction', data)
  })
})

describe('api.js — pueAPI', () => {
  it('pueAPI.list llama a GET /api/pue con params', async () => {
    const api = await import('./api.js')

    const params = { type: 'ROHS' }
    await api.pueAPI.list(params)

    expect(mockApi.get).toHaveBeenCalledWith('/api/pue', { params })
  })

  it('pueAPI.submit llama a POST con certificateAlias', async () => {
    const api = await import('./api.js')

    await api.pueAPI.submit('pue123', 'cert-fnmt')

    expect(mockApi.post).toHaveBeenCalledWith('/api/pue/pue123/submit', { certificateAlias: 'cert-fnmt' })
  })

  it('pueAPI.checkTaric llama a POST con taricCodes', async () => {
    const api = await import('./api.js')

    const codes = ['0901210000', '8471300000']
    await api.pueAPI.checkTaric(codes)

    expect(mockApi.post).toHaveBeenCalledWith('/api/pue/check-taric', { taricCodes: codes })
  })

  it('pueAPI.getXML llama a GET con regenerate en params', async () => {
    const api = await import('./api.js')

    await api.pueAPI.getXML('pue123', true)

    expect(mockApi.get).toHaveBeenCalledWith('/api/pue/pue123/xml', {
      params: { regenerate: true },
      responseType: 'text'
    })
  })

  it('pueAPI.lookupMRN llama a POST con mrn y claveZeta', async () => {
    const api = await import('./api.js')

    await api.pueAPI.lookupMRN('26ES000000000F000001', 'ABC123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/pue/lookup-mrn', {
      mrn: '26ES000000000F000001',
      claveZeta: 'ABC123'
    })
  })
})

describe('api.js — analyticsAPI', () => {
  it('analyticsAPI.getDashboard llama a GET con timeout 120s', async () => {
    const api = await import('./api.js')

    await api.analyticsAPI.getDashboard('30d')

    expect(mockApi.get).toHaveBeenCalledWith('/api/analytics/dashboard', {
      params: { period: '30d' },
      timeout: 120000
    })
  })

  it('analyticsAPI.compare llama a GET con period1 y period2', async () => {
    const api = await import('./api.js')

    await api.analyticsAPI.compare('2026-07', '2026-08')

    expect(mockApi.get).toHaveBeenCalledWith('/api/analytics/compare', {
      params: { period1: '2026-07', period2: '2026-08' }
    })
  })

  it('analyticsAPI.reports.download llama a GET con format y responseType blob', async () => {
    const api = await import('./api.js')

    await api.analyticsAPI.reports.download('rep123', 'xlsx')

    expect(mockApi.get).toHaveBeenCalledWith('/api/analytics/reports/rep123/download', {
      params: { format: 'xlsx' },
      responseType: 'blob'
    })
  })

  it('analyticsAPI.ai.generateInsights llama a POST con timeout 120s', async () => {
    const api = await import('./api.js')

    const analyticsData = { metrics: [] }
    const context = { period: '30d' }
    await api.analyticsAPI.ai.generateInsights(analyticsData, context)

    expect(mockApi.post).toHaveBeenCalledWith('/api/analytics/ai/insights', {
      analyticsData,
      context
    }, { timeout: 120000 })
  })
})

describe('api.js — aeatRealAPI', () => {
  it('aeatRealAPI.certificates.list llama a GET con includeExpired', async () => {
    const api = await import('./api.js')

    await api.aeatRealAPI.certificates.list(true)

    expect(mockApi.get).toHaveBeenCalledWith('/api/aeat-real/certificates', {
      params: { includeExpired: true }
    })
  })

  it('aeatRealAPI.certificates.import llama a POST', async () => {
    const api = await import('./api.js')

    const data = { p12Data: 'base64...', password: 'pass' }
    await api.aeatRealAPI.certificates.import(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/aeat-real/certificates/import', data)
  })

  it('aeatRealAPI.declarations.submitH7 llama a POST', async () => {
    const api = await import('./api.js')

    const data = { expeditionId: 'exp123', certificateAlias: 'cert-fnmt' }
    await api.aeatRealAPI.declarations.submitH7(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/aeat-real/declarations/h7/submit', data)
  })

  it('aeatRealAPI.declarations.getStatus llama a GET con params', async () => {
    const api = await import('./api.js')

    await api.aeatRealAPI.declarations.getStatus('26ES000000000F000001', 'cert-fnmt', 'H7')

    expect(mockApi.get).toHaveBeenCalledWith('/api/aeat-real/declarations/26ES000000000F000001/status', {
      params: { certificateAlias: 'cert-fnmt', declarationType: 'H7' }
    })
  })

  it('aeatRealAPI.monitoring.acknowledgeAlert llama a POST', async () => {
    const api = await import('./api.js')

    await api.aeatRealAPI.monitoring.acknowledgeAlert('alert123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/aeat-real/monitoring/alerts/alert123/acknowledge')
  })
})

describe('api.js — tenantAPI', () => {
  it('tenantAPI.getCurrent llama a GET /api/tenant', async () => {
    const api = await import('./api.js')

    await api.tenantAPI.getCurrent()

    expect(mockApi.get).toHaveBeenCalledWith('/api/tenant')
  })

  it('tenantAPI.changePlan llama a POST con plan e immediate', async () => {
    const api = await import('./api.js')

    await api.tenantAPI.changePlan('professional', true)

    expect(mockApi.post).toHaveBeenCalledWith('/api/tenant/plan', { plan: 'professional', immediate: true })
  })

  it('tenantAPI.admin.suspend llama a POST con reason', async () => {
    const api = await import('./api.js')

    await api.tenantAPI.admin.suspend('tenant123', 'Payment overdue')

    expect(mockApi.post).toHaveBeenCalledWith('/api/tenants/tenant123/suspend', { reason: 'Payment overdue' })
  })

  it('tenantAPI.roles.clone llama a POST', async () => {
    const api = await import('./api.js')

    const data = { name: 'Custom Admin' }
    await api.tenantAPI.roles.clone('role123', data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/tenant/roles/role123/clone', data)
  })

  it('tenantAPI.billing.changePlan llama a POST', async () => {
    const api = await import('./api.js')

    await api.tenantAPI.billing.changePlan('enterprise', false)

    expect(mockApi.post).toHaveBeenCalledWith('/api/tenant/billing/change-plan', {
      plan: 'enterprise',
      immediate: false
    })
  })
})

describe('api.js — mlAPI', () => {
  it('mlAPI.classify llama a POST /api/ml/classify', async () => {
    const api = await import('./api.js')

    const data = { description: 'Vino tinto' }
    await api.mlAPI.classify(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/ml/classify', data)
  })

  it('mlAPI.channel.predict llama a POST', async () => {
    const api = await import('./api.js')

    const data = { declarationData: {} }
    await api.mlAPI.channel.predict(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/ml/predict-channel', data)
  })

  it('mlAPI.fraud.analyze llama a POST', async () => {
    const api = await import('./api.js')

    const data = { expeditionId: 'exp123' }
    await api.mlAPI.fraud.analyze(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/ml/fraud/analyze', data)
  })

  it('mlAPI.autoResponse.generate llama a POST', async () => {
    const api = await import('./api.js')

    const data = { requirementId: 'req123' }
    await api.mlAPI.autoResponse.generate(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/ml/auto-response', data)
  })
})

describe('api.js — billingAPI', () => {
  it('billingAPI.getSubscription llama a GET /api/payments/subscription', async () => {
    const api = await import('./api.js')

    await api.billingAPI.getSubscription()

    expect(mockApi.get).toHaveBeenCalledWith('/api/payments/subscription')
  })

  it('billingAPI.createCheckout llama a POST con plan y billingCycle', async () => {
    const api = await import('./api.js')

    await api.billingAPI.createCheckout('professional', 'annual')

    expect(mockApi.post).toHaveBeenCalledWith('/api/payments/create-checkout', {
      plan: 'professional',
      billingCycle: 'annual'
    })
  })
})

describe('api.js — certificatesAPI', () => {
  it('certificatesAPI.upload llama a POST con multipart', async () => {
    const api = await import('./api.js')

    const formData = new FormData()
    await api.certificatesAPI.upload(formData)

    expect(mockApi.post).toHaveBeenCalledWith('/api/certificates/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  })

  it('certificatesAPI.delete llama a DELETE /api/certificates/:country', async () => {
    const api = await import('./api.js')

    await api.certificatesAPI.delete('ES')

    expect(mockApi.delete).toHaveBeenCalledWith('/api/certificates/ES')
  })
})

describe('api.js — nlCustomsAPI', () => {
  it('nlCustomsAPI.getHealth llama a GET', async () => {
    const api = await import('./api.js')

    await api.nlCustomsAPI.getHealth()

    expect(mockApi.get).toHaveBeenCalledWith('/api/declarations/nl/monitor/health')
  })

  it('nlCustomsAPI.submitCorrection llama a POST', async () => {
    const api = await import('./api.js')

    const data = { correction: 'update value' }
    await api.nlCustomsAPI.submitCorrection('exp123', 'corr456', data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/declarations/exp123/corrections/corr456/submit', data)
  })
})

describe('api.js — manifestAPI', () => {
  it('manifestAPI.upload llama a POST con multipart y timeout 120s', async () => {
    const api = await import('./api.js')

    const formData = new FormData()
    await api.manifestAPI.upload(formData)

    expect(mockApi.post).toHaveBeenCalledWith('/api/manifest/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    })
  })

  it('manifestAPI.downloadTemplate llama a GET con responseType blob', async () => {
    const api = await import('./api.js')

    await api.manifestAPI.downloadTemplate()

    expect(mockApi.get).toHaveBeenCalledWith('/api/manifest/template', { responseType: 'blob' })
  })
})

describe('api.js — tenantEoriAPI', () => {
  it('tenantEoriAPI.get llama a GET /api/tenant/eori', async () => {
    const api = await import('./api.js')

    await api.tenantEoriAPI.get()

    expect(mockApi.get).toHaveBeenCalledWith('/api/tenant/eori')
  })

  it('tenantEoriAPI.update llama a PUT con eoriNumbers', async () => {
    const api = await import('./api.js')

    const eoriNumbers = ['ESB22477020', 'ESB22477021']
    await api.tenantEoriAPI.update(eoriNumbers)

    expect(mockApi.put).toHaveBeenCalledWith('/api/tenant/eori', { eoriNumbers })
  })
})

describe('api.js — exciseAPI', () => {
  it('exciseAPI.detect llama a POST /api/excise/detect', async () => {
    const api = await import('./api.js')

    const data = { taricCode: '2204210000' }
    await api.exciseAPI.detect(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/excise/detect', data)
  })

  it('exciseAPI.calculate llama a POST /api/excise/calculate', async () => {
    const api = await import('./api.js')

    const data = { category: 'alcohol', volume: 10 }
    await api.exciseAPI.calculate(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/excise/calculate', data)
  })
})

describe('api.js — regulationsAPI', () => {
  it('regulationsAPI.search llama a GET con query y options', async () => {
    const api = await import('./api.js')

    await api.regulationsAPI.search('arancel', { source: 'BOE' })

    expect(mockApi.get).toHaveBeenCalledWith('/api/regulations/search', {
      params: { q: 'arancel', source: 'BOE' }
    })
  })

  it('regulationsAPI.analyze llama a POST con timeout 120s', async () => {
    const api = await import('./api.js')

    const data = { text: 'Normativa aduanera' }
    await api.regulationsAPI.analyze(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/regulations/analyze', data, { timeout: 120000 })
  })
})

describe('api.js — specialRegimesAPI', () => {
  it('specialRegimesAPI.list llama a GET /api/special-regimes con params', async () => {
    const api = await import('./api.js')

    const params = { regime: '51' }
    await api.specialRegimesAPI.list(params)

    expect(mockApi.get).toHaveBeenCalledWith('/api/special-regimes', { params })
  })

  it('specialRegimesAPI.discharge llama a POST con data', async () => {
    const api = await import('./api.js')

    const data = { dischargeDate: '2026-08-06' }
    await api.specialRegimesAPI.discharge('regime123', data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/special-regimes/regime123/discharge', data)
  })
})

describe('api.js — deadlinesAPI', () => {
  it('deadlinesAPI.getOverdue llama a GET /api/deadlines/overdue', async () => {
    const api = await import('./api.js')

    await api.deadlinesAPI.getOverdue()

    expect(mockApi.get).toHaveBeenCalledWith('/api/deadlines/overdue')
  })

  it('deadlinesAPI.extend llama a POST con newDate y reason', async () => {
    const api = await import('./api.js')

    await api.deadlinesAPI.extend('deadline123', '2026-08-20', 'Need more time')

    expect(mockApi.post).toHaveBeenCalledWith('/api/deadlines/deadline123/extend', {
      newDate: '2026-08-20',
      reason: 'Need more time'
    })
  })
})

describe('api.js — inspectionsAPI', () => {
  it('inspectionsAPI.getToday llama a GET /api/inspections/today', async () => {
    const api = await import('./api.js')

    await api.inspectionsAPI.getToday()

    expect(mockApi.get).toHaveBeenCalledWith('/api/inspections/today')
  })

  it('inspectionsAPI.complete llama a POST con data', async () => {
    const api = await import('./api.js')

    const data = { result: 'APTO', notes: 'OK' }
    await api.inspectionsAPI.complete('insp123', data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/inspections/insp123/complete', data)
  })
})

describe('api.js — communicationsAPI', () => {
  it('communicationsAPI.createAllegation llama a POST', async () => {
    const api = await import('./api.js')

    const data = { requirementId: 'req123', argument: 'Alegación' }
    await api.communicationsAPI.createAllegation(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/communications/allegation', data)
  })

  it('communicationsAPI.submit llama a POST', async () => {
    const api = await import('./api.js')

    await api.communicationsAPI.submit('comm123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/communications/comm123/submit')
  })
})

describe('api.js — integrationsAPI', () => {
  it('integrationsAPI.getStatus llama a GET /api/integrations/status', async () => {
    const api = await import('./api.js')

    await api.integrationsAPI.getStatus()

    expect(mockApi.get).toHaveBeenCalledWith('/api/integrations/status')
  })

  it('integrationsAPI.vua.submitDocument llama a POST', async () => {
    const api = await import('./api.js')

    const data = { document: 'doc123' }
    await api.integrationsAPI.vua.submitDocument(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/integrations/vua/submit', data)
  })

  it('integrationsAPI.traces.createCHED llama a POST', async () => {
    const api = await import('./api.js')

    const data = { type: 'CHED-P' }
    await api.integrationsAPI.traces.createCHED(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/integrations/traces/ched', data)
  })

  it('integrationsAPI.ncts.createDeclaration llama a POST', async () => {
    const api = await import('./api.js')

    const data = { transitType: 'T1' }
    await api.integrationsAPI.ncts.createDeclaration(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/integrations/ncts/declaration', data)
  })
})

describe('api.js — knowledgeAPI', () => {
  it('knowledgeAPI.search llama a GET /api/knowledge/search', async () => {
    const api = await import('./api.js')

    await api.knowledgeAPI.search('TARIC')

    expect(mockApi.get).toHaveBeenCalledWith('/api/knowledge/search', { params: { query: 'TARIC' } })
  })

  it('knowledgeAPI.h1Guidance llama a GET /api/knowledge/h1-guidance/:field', async () => {
    const api = await import('./api.js')

    await api.knowledgeAPI.h1Guidance('incoterm')

    expect(mockApi.get).toHaveBeenCalledWith('/api/knowledge/h1-guidance/incoterm')
  })

  it('knowledgeAPI.regimeInfo llama a GET /api/knowledge/regime/:code', async () => {
    // Antes apuntaba a /ai/knowledge/regime/:code, que no existe en el backend
    // y caia al fallback de la SPA (index.html con 200), panel vacio.
    const api = await import('./api.js')

    await api.knowledgeAPI.regimeInfo('42')

    expect(mockApi.get).toHaveBeenCalledWith('/api/knowledge/regime/42')
  })

  it('knowledgeAPI.incotermInfo llama a GET /api/knowledge/incoterm/:code', async () => {
    const api = await import('./api.js')

    await api.knowledgeAPI.incotermInfo('CIF')

    expect(mockApi.get).toHaveBeenCalledWith('/api/knowledge/incoterm/CIF')
  })
})

describe('api.js — channelsAPI', () => {
  it('channelsAPI.getConfig llama a GET /api/channels/config', async () => {
    const api = await import('./api.js')

    await api.channelsAPI.getConfig()

    expect(mockApi.get).toHaveBeenCalledWith('/api/channels/config')
  })

  it('channelsAPI.reevaluate llama a POST', async () => {
    const api = await import('./api.js')

    await api.channelsAPI.reevaluate('exp123')

    expect(mockApi.post).toHaveBeenCalledWith('/api/channels/exp123/reevaluate')
  })
})

describe('api.js — paraduaneroAPI', () => {
  it('paraduaneroAPI.analyze llama a GET con expeditionId', async () => {
    const api = await import('./api.js')

    await api.paraduaneroAPI.analyze('exp123')

    expect(mockApi.get).toHaveBeenCalledWith('/api/paraduanero/analyze/exp123')
  })

  it('paraduaneroAPI.issueCertificate llama a POST con data', async () => {
    const api = await import('./api.js')

    const data = { certificateType: 'SOIVRE' }
    await api.paraduaneroAPI.issueCertificate('para123', data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/paraduanero/para123/certificate', data)
  })
})

describe('api.js — queryAPI', () => {
  it('queryAPI.byMRN llama a POST /api/queries/mrn', async () => {
    const api = await import('./api.js')

    const data = { mrn: '26ES000000000F000001' }
    await api.queryAPI.byMRN(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/queries/mrn', data)
  })

  it('queryAPI.byEORI llama a POST /api/queries/eori', async () => {
    const api = await import('./api.js')

    const data = { eori: 'ESB22477020' }
    await api.queryAPI.byEORI(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/queries/eori', data)
  })
})

describe('api.js — dashboardAPI', () => {
  it('dashboardAPI.getAlerts llama a GET /api/dashboard/alerts', async () => {
    const api = await import('./api.js')

    await api.dashboardAPI.getAlerts()

    expect(mockApi.get).toHaveBeenCalledWith('/api/dashboard/alerts')
  })

  it('dashboardAPI.getStats llama a GET /api/dashboard/stats', async () => {
    const api = await import('./api.js')

    await api.dashboardAPI.getStats()

    expect(mockApi.get).toHaveBeenCalledWith('/api/dashboard/stats')
  })
})

describe('api.js — preferencesAPI', () => {
  it('preferencesAPI.checkEligibility llama a POST', async () => {
    const api = await import('./api.js')

    const data = { origin: 'CO', taricCode: '0901210000' }
    await api.preferencesAPI.checkEligibility(data)

    expect(mockApi.post).toHaveBeenCalledWith('/api/preferences/eligibility', data)
  })

  it('preferencesAPI.getByCountry llama a GET con code', async () => {
    const api = await import('./api.js')

    await api.preferencesAPI.getByCountry('CO')

    expect(mockApi.get).toHaveBeenCalledWith('/api/preferences/country/CO')
  })
})

describe('api.js — initTokenRefresh', () => {
  it('initTokenRefresh es una función vacía', async () => {
    const api = await import('./api.js')

    expect(api.initTokenRefresh).toBeTypeOf('function')
    expect(api.initTokenRefresh()).toBeUndefined()
  })
})
