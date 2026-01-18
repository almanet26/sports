/**
 * API Client with Axios Interceptors
 * 
 * Features:
 * - Automatic JWT token attachment
 * - 401 response handling with redirect
 * - Request/response logging in dev mode
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// Base URL from environment or default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (!token) {
      console.warn(`⚠️ [API] No token found for ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`🚀 [API] ${config.method?.toUpperCase()} ${config.url} ${token ? '(with token)' : '(NO TOKEN)'}`);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 errors
api.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (import.meta.env.DEV) {
      console.log(`✅ [API] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    // Log errors in development
    if (import.meta.env.DEV) {
      const url = originalRequest?.url || 'unknown';
      const status = error.response?.status || 'no response';
      console.error(`❌ [API] ${status} ${url}`);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
      });
    }
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Clear auth data
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_profile');
      
      // Redirect to login (only if not already on login page)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?session_expired=true';
      }
    }
    
    return Promise.reject(error);
  }
);

// ============ API Endpoints ============

// Auth endpoints
export const authApi = {
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  
  register: (data: {
    name: string;
    email: string;
    password: string;
    role: 'PLAYER' | 'COACH';
    phone?: string;
    team?: string;
  }) => api.post('/auth/register', data),
  
  logout: () => api.post('/auth/logout'),
  
  getProfile: () => api.get('/auth/me'),
  
  updateProfile: (data: Partial<{
    name: string;
    phone: string;
    team: string;
    profile_bio: string;
  }>) => api.put('/auth/me', data),
};

// Video endpoints
export const videosApi = {
  // Admin only: list ALL videos
  listAll: (params?: { 
    page?: number; 
    per_page?: number; 
    visibility?: 'PUBLIC' | 'PRIVATE';
  }) => api.get('/videos/all', { params }),
  
  // Public library with search
  listPublic: (params?: { 
    page?: number; 
    per_page?: number; 
    search?: string;
    event_type?: 'FOUR' | 'SIX' | 'WICKET';
  }) => api.get('/videos/public', { params }),
  
  // Private dashboard (Premium)
  listPrivate: (page = 1, perPage = 20) => 
    api.get('/videos/private', { params: { page, per_page: perPage } }),
  
  // Get video details by ID
  getById: (videoId: string) => 
    api.get(`/videos/${videoId}`),
  
  // Get video events with optional filter
  getEvents: (videoId: string, eventType?: 'FOUR' | 'SIX' | 'WICKET') => 
    api.get(`/videos/${videoId}/events`, { params: { event_type: eventType } }),
  
  // Upload video (multipart form data)
  upload: (formData: FormData, onProgress?: (progress: number) => void) => 
    api.post('/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    }),
  
  // Upload video from YouTube URL
  uploadYouTube: (data: {
    url: string;
    title?: string;
    description?: string;
    teams?: string;
    venue?: string;
    match_date?: string;
    visibility?: 'public' | 'private';
  }, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('url', data.url);
    if (data.title) formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.teams) formData.append('teams', data.teams);
    if (data.venue) formData.append('venue', data.venue);
    if (data.match_date) formData.append('match_date', data.match_date);
    formData.append('visibility', data.visibility || 'private');
    
    return api.post('/videos/upload/youtube', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
      timeout: 900000, // 15 minutes for YouTube download
    });
  },
  
  // Publish private video to public
  publish: (videoId: string) => 
    api.post(`/videos/${videoId}/publish`),
  
  // Delete video
  delete: (videoId: string) => 
    api.delete(`/videos/${videoId}`),
  
  // Get video stream URL (for original video)
  getStreamUrl: (videoId: string) => 
    `${API_BASE_URL}/api/v1/videos/${videoId}/stream`,
  
  // Get supercut stream URL (for highlight reel)
  getSupercutUrl: (videoId: string) => 
    `${API_BASE_URL}/api/v1/videos/${videoId}/supercut`,
};

// Jobs endpoints (OCR processing)
export const jobsApi = {
  // Trigger OCR processing
  trigger: (videoId: string, config?: Record<string, unknown>) => 
    api.post('/jobs/trigger', { video_id: videoId, config }),
  
  // Get job status (lightweight polling - no auth required)
  getStatus: (videoId: string) => 
    api.get(`/jobs/${videoId}/status/poll`),
  
  // Get full job status (requires auth)
  getFullStatus: (videoId: string) => 
    api.get(`/jobs/${videoId}/status`),
  
  // Get job results
  getResult: (videoId: string) => 
    api.get(`/jobs/${videoId}/result`),
  
  // Retry failed job
  retry: (videoId: string) => 
    api.post(`/jobs/${videoId}/retry`),
  
  // Admin: list pending jobs
  listPending: () => 
    api.get('/jobs/pending'),
};

// Match requests endpoints (voting system)
export const requestsApi = {
  // Create new request
  create: (data: {
    youtube_url: string;
    match_title?: string;
    match_description?: string;
  }) => api.post('/requests/', data),
  
  // List all requests
  list: (page = 1, perPage = 20, status?: string) => 
    api.get('/requests/', { params: { page, per_page: perPage, status_filter: status } }),
  
  // Vote up/down for request
  vote: (requestId: string, voteType: 'up' | 'down') => 
    api.post(`/requests/${requestId}/vote`, { vote_type: voteType }),
  
  // Remove vote
  removeVote: (requestId: string) => 
    api.delete(`/requests/${requestId}/vote`),
  
  // Admin: get dashboard
  adminDashboard: (page = 1, perPage = 50) => 
    api.get('/requests/admin/dashboard', { params: { page, per_page: perPage } }),
  
  // Admin: approve request
  approve: (requestId: string) => 
    api.patch(`/requests/${requestId}/status`, null, { 
      params: { new_status: 'approved' } 
    }),
  
  // Admin: reject request
  reject: (requestId: string) => 
    api.patch(`/requests/${requestId}/status`, null, { 
      params: { new_status: 'rejected' } 
    }),
  
  // Admin: update status (general)
  updateStatus: (requestId: string, status: string, videoId?: string) => 
    api.patch(`/requests/${requestId}/status`, null, { 
      params: { new_status: status, fulfilled_video_id: videoId } 
    }),
};

export default api;


