
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// Base URL from environment or default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Resolve a media URL for display in the browser.
 * - Already-absolute URLs (signed GCS URLs etc.) pass through unchanged.
 * - Relative paths (e.g. /static/...) get the API base prepended.
 */
export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
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

// Bowling Analysis endpoints
export const bowlingApi = {
  /** Upload video and run biomechanics analysis */
  analyze: (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/bowling/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 1800000, // 30 min — large videos (900MB+) need time for frame-by-frame MediaPipe processing
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
  },

  /** List current user's past analyses */
  history: (limit = 20, offset = 0) =>
    api.get('/bowling/history', { params: { limit, offset } }),

  /** Fetch single analysis by ID */
  getById: (analysisId: string) =>
    api.get(`/bowling/${analysisId}`),
};

// Batting Analysis endpoints
export const battingApi = {
  /** Upload video and run batting biomechanics analysis */
  analyze: (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/batting/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 1800000, // 30 min — large videos (900MB+) need time for frame-by-frame MediaPipe processing
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
  },

  /** List current user's past batting analyses */
  history: (limit = 20, offset = 0) =>
    api.get('/batting/history', { params: { limit, offset } }),

  /** Fetch single batting analysis by ID */
  getById: (analysisId: string) =>
    api.get(`/batting/${analysisId}`),
};

// Submissions Pipeline
export interface SubmissionSummary {
  id: string;
  player_id: string;
  coach_id: string;
  player_name?: string;
  coach_name?: string;
  original_filename: string;
  analysis_type: string;
  status: 'PENDING' | 'PROCESSING' | 'DRAFT_REVIEW' | 'PUBLISHED';
  created_at: string;
  analyzed_at?: string;
  published_at?: string;
  pdf_report_url?: string;
}

export interface SubmissionDetail extends SubmissionSummary {
  video_url: string;
  raw_biometrics?: {
    records: Record<string, number>[];
    summary: Record<string, Record<string, number>>;
  };
  phase_info?: Record<string, number | null>;
  annotated_video_url?: string;
  key_frame_url?: string;
  ai_draft_text?: string;
  coach_final_text?: string;
  detected_flaws?: Array<{
    flaw_name: string;
    description: string;
    rating?: number;
    timestamp?: string;
  }>;
  drill_recommendations?: Array<{
    query: string;
    title: string;
    link: string;
    reason: string;
  }>;
}

export interface CoachListItem {
  id: string;
  name: string;
  email: string;
  team?: string;
}

export const submissionsApi = {
  /** List available coaches for the player's dropdown */
  listCoaches: () =>
    api.get<{ coaches: CoachListItem[] }>('/submissions/coaches'),

  /** Player: Upload video to a coach */
  upload: (file: File, coachId: string, analysisType: string = 'BATTING', onProgress?: (p: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('coach_id', coachId);
    formData.append('analysis_type', analysisType);
    return api.post<SubmissionDetail>('/submissions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: (e) => {
        if (e.total && onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
  },

  /** Player: My published reports */
  playerReports: (limit = 50, offset = 0) =>
    api.get<{ submissions: SubmissionSummary[]; total: number }>('/submissions/player/me', { params: { limit, offset } }),

  /** Player: All my submissions (all statuses) */
  playerAll: (limit = 50, offset = 0) =>
    api.get<{ submissions: SubmissionSummary[]; total: number }>('/submissions/player/all', { params: { limit, offset } }),

  /** Coach: Inbox (PENDING + DRAFT_REVIEW) */
  coachInbox: (status?: string, limit = 50, offset = 0) =>
    api.get<{ submissions: SubmissionSummary[]; total: number }>('/submissions/coach/me', { params: { status, limit, offset } }),

  /** Coach: Run AI analysis on a submission */
  analyze: (submissionId: string) =>
    api.post<SubmissionDetail>(`/submissions/${submissionId}/analyze`, null, { timeout: 1800000 }), // 30 min for large videos

  /** Coach: Publish with edited text */
  publish: (submissionId: string, editedText: string) =>
    api.put<SubmissionDetail>(`/submissions/${submissionId}/publish`, { edited_text: editedText }),

  /** Get single submission detail */
  getById: (submissionId: string) =>
    api.get<SubmissionDetail>(`/submissions/${submissionId}`),
};

// Cloud Storage — Direct-to-GCS Upload
export interface SignedUrlResponse {
  signed_url: string;
  blob_name: string;
  submission_id: string;
}

export interface ConfirmUploadResponse {
  submission_id: string;
  status: string;
  blob_name: string;
}

export const storageApi = {
  /** Get a V4 Signed URL for direct PUT to GCS */
  getUploadUrl: (filename: string, contentType: string, analysisType: string = 'BATTING') =>
    api.get<SignedUrlResponse>('/storage/upload-url', {
      params: { filename, content_type: contentType, analysis_type: analysisType },
    }),

  /** Confirm the upload after the direct GCS PUT succeeds */
  confirmUpload: (submissionId: string) =>
    api.post<ConfirmUploadResponse>('/storage/confirm-upload', null, {
      params: { submission_id: submissionId },
    }),

  /** Trigger background ML processing via Cloud Tasks */
  startProcessing: (submissionId: string) =>
    api.post<{ submission_id: string; status: string; task_name: string | null }>(
      '/storage/start-processing',
      null,
      { params: { submission_id: submissionId }, timeout: 30000 },
    ),

  /** Fetch submission detail (used for polling) */
  getSubmission: (submissionId: string) =>
    api.get<SubmissionDetail>(`/submissions/${submissionId}`),
};

// Cloud Analysis — GCS upload + Cloud Tasks + polling
/**
 * Upload a video file to GCS and queue it for ML processing.
 * Returns the submission ID once the task is queued.
 */
export async function cloudUploadAndProcess(
  file: File,
  analysisType: 'BATTING' | 'BOWLING',
  onProgress?: (progress: number) => void,
): Promise<string> {
  // 1. Get signed URL
  const { data: urlData } = await storageApi.getUploadUrl(file.name, file.type, analysisType);
  const { signed_url, submission_id } = urlData;

  // 2. Upload file directly to GCS
  await axios.put(signed_url, file, {
    headers: { 'Content-Type': file.type },
    onUploadProgress: (evt) => {
      if (evt.total && onProgress) {
        onProgress(Math.round((evt.loaded * 100) / evt.total));
      }
    },
  });

  // 3. Confirm the upload landed
  await storageApi.confirmUpload(submission_id);

  // 4. Queue ML processing
  await storageApi.startProcessing(submission_id);

  return submission_id;
}

/**
 * Poll a submission until processing completes (DRAFT_REVIEW / PUBLISHED).
 * Resolves with the full SubmissionDetail once results are available.
 */
export async function pollSubmissionResult(
  submissionId: string,
  intervalMs = 8000,
  maxWaitMs = 1200000, // 20 min
): Promise<SubmissionDetail> {
  const maxAttempts = Math.ceil(maxWaitMs / intervalMs);
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const { data } = await storageApi.getSubmission(submissionId);

    if (data.status === 'DRAFT_REVIEW' || data.status === 'PUBLISHED') {
      return data;
    }
    // If status rolled back to PENDING after being PROCESSING → processing failed
    if (data.status === 'PENDING' && i > 2) {
      throw new Error('Processing failed on the server. Please try again.');
    }
  }
  throw new Error('Processing timed out. Your results will appear in History when ready.');
}
// Plans API (Admin)
export const plansApi = {
  // Create new plan
  create: (data: {
    name: string;
    monthly_price: number;
    yearly_price: number;
    features: string;
  }) => api.post('/plans', data),

  // Get all plans
  list: () => api.get('/plans'),

  // Update plan
  update: (
    planId: number,
    data: {
      name: string;
      monthly_price: number;
      yearly_price: number;
      features: string;
    }
  ) => api.put(`/plans/${planId}`, data),

  // Delete plan
  delete: (planId: number) => api.delete(`/plans/${planId}`),
};
// Subscription API
export const subscriptionApi = {

  // Subscribe user to a plan
  subscribe: (userId: string, planId: number) =>
    api.post("/subscriptions/subscribe", {
      user_id: userId,
      plan_id: planId
    }),

  // Get subscription of a user
  getUserSubscription: (userId: string) =>
    api.get(`/subscriptions/user/${userId}`)

};

export default api;