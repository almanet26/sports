import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';


/* ================== AXIOS INSTANCE ================== */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/* ================== INTERCEPTORS ================== */

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/* ================== AUTH API ================== */

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
    jersey_number?: number;
  }>) => api.put('/auth/me', data),
};

/* ================== VIDEOS API ================== */

export const videosApi = {
  listAll: (params?: {
    page?: number;
    per_page?: number;
    visibility?: 'PUBLIC' | 'PRIVATE';
  }) => api.get('/videos/all', { params }),

  listPublic: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    event_type?: 'FOUR' | 'SIX' | 'WICKET';
  }) => api.get('/videos/public', { params }),

  listPrivate: (page = 1, perPage = 20) =>
    api.get('/videos/private', { params: { page, per_page: perPage } }),

  getById: (videoId: string) =>
    api.get(`/videos/${videoId}`),

  getEvents: (videoId: string, eventType?: 'FOUR' | 'SIX' | 'WICKET') =>
    api.get(`/videos/${videoId}/events`, {
      params: { event_type: eventType },
    }),

  upload: (formData: FormData, onProgress?: (p: number) => void) =>
    api.post('/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.total && onProgress) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }),

  uploadYouTube: (
    data: {
      url: string;
      title?: string;
      description?: string;
      teams?: string;
      venue?: string;
      match_date?: string;
      visibility?: 'public' | 'private';
    },
    onProgress?: (p: number) => void
  ) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => v && fd.append(k, v));

    return api.post('/videos/upload/youtube', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 900000,
      onUploadProgress: (e) => {
        if (e.total && onProgress) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },

  publish: (videoId: string) =>
    api.post(`/videos/${videoId}/publish`),

  delete: (videoId: string) =>
    api.delete(`/videos/${videoId}`),

  getStreamUrl: (videoId: string) =>
    `${API_BASE_URL}/api/v1/videos/${videoId}/stream`,

  getSupercutUrl: (videoId: string) =>
    `${API_BASE_URL}/api/v1/videos/${videoId}/supercut`,
};

/* ================== JOBS API ================== */

export const jobsApi = {
  trigger: (videoId: string) =>
    api.post('/jobs/trigger', { video_id: videoId }),

  getStatus: (videoId: string) =>
    api.get(`/jobs/${videoId}/status/poll`),

  getFullStatus: (videoId: string) =>
    api.get(`/jobs/${videoId}/status`),

  getResult: (videoId: string) =>
    api.get(`/jobs/${videoId}/result`),

  retry: (videoId: string) =>
    api.post(`/jobs/${videoId}/retry`),
};

/* ================== REQUESTS API ================== */

export const requestsApi = {
  create: (data: {
    youtube_url: string;
    match_title?: string;
    match_description?: string;
  }) => api.post('/requests/', data),

  list: (page = 1, perPage = 20, status?: string) =>
    api.get('/requests/', {
      params: { page, per_page: perPage, status_filter: status },
    }),

  vote: (requestId: string, voteType: 'up' | 'down') =>
    api.post(`/requests/${requestId}/vote`, { vote_type: voteType }),

  removeVote: (requestId: string) =>
    api.delete(`/requests/${requestId}/vote`),

  adminDashboard: (page = 1, perPage = 50) =>
    api.get('/requests/admin/dashboard', {
      params: { page, per_page: perPage },
    }),

  approve: (requestId: string) =>
    api.patch(`/requests/${requestId}/status`, null, {
      params: { new_status: 'approved' },
    }),

  reject: (requestId: string) =>
    api.patch(`/requests/${requestId}/status`, null, {
      params: { new_status: 'rejected' },
    }),

  updateStatus: (requestId: string, status: string, videoId?: string) =>
    api.patch(`/requests/${requestId}/status`, null, {
      params: { new_status: status, fulfilled_video_id: videoId },
    }),
};

export default api;
