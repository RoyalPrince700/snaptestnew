import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token and log request start
api.interceptors.request.use(
  (config) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    config.metadata = { startTime: new Date(), requestId }
    console.debug('[API] →', config.method?.toUpperCase(), config.url, {
      requestId,
      baseURL: config.baseURL,
      headers: { hasAuth: !!config.headers.Authorization },
      params: config.params,
      data: config.data
    })
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to log completion and handle common errors
api.interceptors.response.use(
  (response) => {
    const start = response.config.metadata?.startTime
    const requestId = response.config.metadata?.requestId
    const ms = start ? new Date() - start : undefined
    console.debug('[API] ←', response.config.method?.toUpperCase(), response.config.url, {
      requestId,
      status: response.status,
      durationMs: ms
    })
    return response
  },
  (error) => {
    const cfg = error.config || {}
    const start = cfg.metadata?.startTime
    const requestId = cfg.metadata?.requestId
    const ms = start ? new Date() - start : undefined
    console.error('[API] ×', cfg.method?.toUpperCase?.() || 'UNKNOWN', cfg.url, {
      requestId,
      durationMs: ms,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    })
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Upload specific functions
export const uploadService = {
  // Upload course form with OCR processing
  uploadCourseForm: async (file) => {
    const formData = new FormData();
    formData.append('courseForm', file);

    const response = await api.post('/upload/course-form', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  },

  // Get user's courses
  getUserCourses: async () => {
    const response = await api.get('/upload/courses');
    return response.data;
  },

  // Update course information
  updateCourse: async (courseId, courseData) => {
    const response = await api.put(`/upload/courses/${courseId}`, courseData);
    return response.data;
  },

  // Delete course
  deleteCourse: async (courseId) => {
    const response = await api.delete(`/upload/courses/${courseId}`);
    return response.data;
  },

  // Complete onboarding
  completeOnboarding: async () => {
    const response = await api.post('/upload/complete-onboarding');
    return response.data;
  }
};

// Memory management functions
export const memoryService = {
  // List memories with optional kind and search query
  getMemories: async (kind, search) => {
    const params = {};
    if (kind) params.kind = kind;
    if (search) params.search = search;
    const response = await api.get('/memories', { params });
    return response.data;
  },

  // Create a new memory
  createMemory: async (content, kind, metadata) => {
    const response = await api.post('/memories', { content, kind, metadata });
    return response.data;
  },

  // Update an existing memory
  updateMemory: async (id, content, kind) => {
    const response = await api.put(`/memories/${id}`, { content, kind });
    return response.data;
  },

  // Delete a memory
  deleteMemory: async (id) => {
    const response = await api.delete(`/memories/${id}`);
    return response.data;
  },

  // Get memory analytics/stats
  getMemoryStats: async () => {
    const response = await api.get('/memories/stats');
    return response.data;
  }
};

// Document ingestion management functions
export const ingestService = {
  // Ingest a file for content analysis and AI explanation
  ingestFile: async (file, docId, course = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docId', docId);
    if (course) {
      formData.append('course', course);
    }

    const response = await api.post('/ingest/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  },

  // Get all user documents with ingestion status
  getDocuments: async () => {
    const response = await api.get('/documents');
    return response.data;
  },

  // Get detailed status for a specific document
  getDocumentStatus: async (docId) => {
    const response = await api.get(`/documents/${docId}/status`);
    return response.data;
  },

  // Retry ingestion for a failed document
  retryIngestion: async (docId) => {
    const response = await api.post(`/documents/${docId}/retry`);
    return response.data;
  },

  // Delete a document and all its chunks
  deleteDocument: async (docId) => {
    const response = await api.delete(`/documents/${docId}`);
    return response.data;
  },

  // Get user's ingestion analytics and statistics
  getIngestionStats: async () => {
    const response = await api.get('/documents/stats');
    return response.data;
  }
};

export default api;
