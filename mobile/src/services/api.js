/**
 * API Service for LUCI Mobile
 * Connects to the backend API
 */

import axios from 'axios';
import Constants from 'expo-constants';

// API Base URL - configurable through app.json extra or environment
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.100:5001';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth token management
let authToken = null;

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      authToken = null;
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

// API Service
const api = {
  // Set auth token
  setAuthToken: (token) => {
    authToken = token;
  },

  // ==================== AUTH ====================
  login: async (email, password) => {
    return apiClient.post('/api/auth/login', { email, password });
  },

  // ==================== EXPEDITIONS ====================
  expeditions: {
    list: async (params = {}) => {
      return apiClient.get('/api/expeditions', { params });
    },

    get: async (id) => {
      return apiClient.get(`/api/expeditions/${id}`);
    },

    create: async (data) => {
      return apiClient.post('/api/expeditions', data);
    },

    update: async (id, data) => {
      return apiClient.put(`/api/expeditions/${id}`, data);
    },

    getDocuments: async (id) => {
      return apiClient.get(`/api/expeditions/${id}/documents`);
    },

    uploadDocument: async (id, formData) => {
      return apiClient.post(`/api/expeditions/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },

    getTimeline: async (id) => {
      return apiClient.get(`/api/expeditions/${id}/timeline`);
    },
  },

  // ==================== DECLARATIONS ====================
  declarations: {
    list: async (expeditionId) => {
      return apiClient.get(`/api/declarations`, { params: { expeditionId } });
    },

    get: async (id) => {
      return apiClient.get(`/api/declarations/${id}`);
    },

    generate: async (data) => {
      return apiClient.post('/api/declarations/generate', data);
    },
  },

  // ==================== CHANNELS ====================
  channels: {
    getStatus: async (expeditionId) => {
      return apiClient.get(`/api/channels/expedition/${expeditionId}`);
    },

    getDashboard: async () => {
      return apiClient.get('/api/channels/dashboard');
    },
  },

  // ==================== REQUIREMENTS ====================
  requirements: {
    list: async (params = {}) => {
      return apiClient.get('/api/requirements', { params });
    },

    respond: async (id, response) => {
      return apiClient.post(`/api/requirements/${id}/respond`, response);
    },
  },

  // ==================== DEADLINES ====================
  deadlines: {
    list: async (params = {}) => {
      return apiClient.get('/api/deadlines', { params });
    },

    getUpcoming: async () => {
      return apiClient.get('/api/deadlines/upcoming');
    },
  },

  // ==================== CHAT / AI ====================
  chat: {
    send: async (message, context = {}) => {
      return apiClient.post('/api/chat', { message, context });
    },

    getHistory: async (expeditionId) => {
      return apiClient.get('/api/chat/history', { params: { expeditionId } });
    },
  },

  // ==================== CLASSIFICATION ====================
  classification: {
    classify: async (description, details = {}) => {
      return apiClient.post('/api/classification/classify', { description, ...details });
    },
  },

  // ==================== NOTIFICATIONS ====================
  notifications: {
    list: async () => {
      return apiClient.get('/api/notifications');
    },

    markRead: async (id) => {
      return apiClient.put(`/api/notifications/${id}/read`);
    },

    markAllRead: async () => {
      return apiClient.put('/api/notifications/read-all');
    },

    registerPushToken: async (token) => {
      return apiClient.post('/api/notifications/push-token', { token });
    },
  },

  // ==================== ANALYTICS ====================
  analytics: {
    getDashboard: async () => {
      return apiClient.get('/api/analytics/dashboard');
    },

    getKPIs: async () => {
      return apiClient.get('/api/analytics/kpis');
    },
  },

  // ==================== DOCUMENT SCANNING ====================
  documents: {
    scan: async (imageBase64) => {
      return apiClient.post('/api/documents/scan', { image: imageBase64 });
    },

    extract: async (documentId) => {
      return apiClient.post(`/api/documents/${documentId}/extract`);
    },
  },

  // ==================== USER / PROFILE ====================
  user: {
    getProfile: async () => {
      return apiClient.get('/api/user/profile');
    },

    updateProfile: async (data) => {
      return apiClient.put('/api/user/profile', data);
    },

    changePassword: async (currentPassword, newPassword) => {
      return apiClient.put('/api/user/password', { currentPassword, newPassword });
    },
  },
};

export default api;
