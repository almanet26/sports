import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { PlanConfig } from '../types/subscriptionPlans';

// Base URL from environment or default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Resolve a media URL for display in the browser.
 * - Already-absolute URLs (signed GCS URLs etc.) pass through unchanged.
 * - Relative paths (e.g. /static/...) get the API base prepended.
 */
export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const absolute = new URL(path);
      if (absolute.pathname.startsWith('/storage/')) {
        absolute.pathname = absolute.pathname.replace('/storage/', '/static/');
        return absolute.toString();
      }
    } catch {
      // Fall back to original path when URL parsing fails.
    }
    return path;
  }
  // Legacy DB rows may store /storage/... paths; backend serves these under /static/...
  const normalizedPath = path.startsWith('/storage/')
    ? path.replace('/storage/', '/static/')
    : path;
  return `${API_BASE_URL}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
}

// Create axios instance
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 300000, // 5 min default, overridden per-endpoint for long operations
  headers: {
    'Content-Type': 'application/json',
  },
});


// Request interceptor - attach JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    
    // Public routes that don't need authentication
    const publicRoutes = ['/auth/login', '/auth/register', '/health'];
    const isPublicRoute = publicRoutes.some(route => config.url?.includes(route));
    
    // Only attach token if available AND not a public route
    if (token && config.headers && !isPublicRoute) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Only warn about missing token for protected routes
    if (!token && !isPublicRoute) {
      console.warn(`⚠️ [API] No token found for ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`🚀 [API] ${config.method?.toUpperCase()} ${config.url} ${token && !isPublicRoute ? '(with token)' : isPublicRoute ? '(public)' : '(NO TOKEN)'}`);
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

  registerMultipart: (formData: FormData) =>
    api.post('/auth/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  logout: () => api.post('/auth/logout'),
  
  getProfile: () => api.get('/auth/me'),
  
  updateProfile: (data: Partial<{
    name: string;
    phone: string;
    team: string;
    profile_bio: string;
    gender: string;
    certifications: Array<{name: string; issuer: string; year: string}>;
    specialization: string[];
    coach_category: string;
  }>) => api.put('/auth/me', data),
};

// ============ Coach Dashboard APIs ============

export interface TrainingSession {
  id: string;
  topic: string;
  description?: string;
  prerequisites?: string;
  session_date: string;
  session_time: string;
  duration_minutes: string;
  session_type: string;
  created_at?: string;
}

export const sessionsApi = {
  list: () => api.get<{ sessions: TrainingSession[] }>('/sessions'),
  create: (data: Omit<TrainingSession, 'id' | 'created_at'>) => api.post<TrainingSession>('/sessions', data),
  update: (id: string, data: Partial<TrainingSession>) => api.put<TrainingSession>(`/sessions/${id}`, data),
  delete: (id: string) => api.delete(`/sessions/${id}`),
};

export interface AvailabilitySlot {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export const availabilityApi = {
  list: () => api.get<{ slots: AvailabilitySlot[] }>('/sessions/availability'),
  save: (slots: Omit<AvailabilitySlot, 'id'>[]) => api.post('/sessions/availability', { slots }),
};

export interface TrainingPlanData {
  id: string;
  title: string;
  description?: string;
  analysis_type: string;
  plan_type: string;
  is_public: boolean;
  drills?: string[];
  created_at?: string;
}

export interface TrainingPlanCreate {
  title: string;
  description?: string;
  analysis_type: string;
  plan_type: 'group_all' | 'individual' | 'age_group';
  is_public: boolean;
  drills?: string[];
}

export const trainingPlansApi = {
  list: () => api.get<{ plans: TrainingPlanData[] }>('/sessions/training-plans'),
  create: (data: TrainingPlanCreate) => api.post<TrainingPlanData>('/sessions/training-plans', data),
  update: (id: string, data: Partial<TrainingPlanCreate>) => api.put<TrainingPlanData>(`/sessions/training-plans/${id}`, data),
  delete: (id: string) => api.delete(`/sessions/training-plans/${id}`),
};

export default api;