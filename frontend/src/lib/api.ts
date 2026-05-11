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
    date_of_birth: string;
    years_of_experience: number;
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

  // Current user's uploads (all visibilities)
  listMine: (page = 1, perPage = 20) =>
    api.get('/videos/mine', { params: { page, per_page: perPage } }),
  
  // Get video details by ID
  getById: (videoId: string) => 
    api.get(`/videos/${videoId}`),
  
  // Get video events with optional filter
  getEvents: (videoId: string, eventType?: 'FOUR' | 'SIX' | 'WICKET') => 
    api.get(`/videos/${videoId}/events`, { params: { event_type: eventType } }),
  
  // Upload video (multipart form data)
  upload: (formData: FormData, onProgress?: (progress: number) => void) => {
    const token = localStorage.getItem('access_token');
    return api.post('/videos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 0,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },
  
  // Upload video from YouTube URL
  uploadYouTube: (data: {
    url: string;
    title?: string;
    description?: string;
    teams?: string;
    venue?: string;
    match_date?: string;
    visibility?: 'public' | 'private';
    transient?: boolean;
  }, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('url', data.url);
    if (data.title) formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.teams) formData.append('teams', data.teams);
    if (data.venue) formData.append('venue', data.venue);
    if (data.match_date) formData.append('match_date', data.match_date);
    formData.append('visibility', data.visibility || 'private');
    if (typeof data.transient === 'boolean') {
      formData.append('transient', String(data.transient));
    }
    
    const token = localStorage.getItem('access_token');

    return api.post('/videos/upload/youtube', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
      timeout: 0,
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

export const annotationsApi = {
  list: (videoId: string) => api.get<VideoAnnotation[]>(`/annotations/${videoId}`),
  create: (payload: {
    video_id: string;
    timestamp_ms: number;
    annotation_type: VideoAnnotation['annotation_type'];
    coordinates: unknown;
    label?: string;
    color?: string;
  }) => api.post<VideoAnnotation>('/annotations', payload),
  update: (annotationId: string, payload: Partial<Pick<VideoAnnotation, 'coordinates' | 'label' | 'color'>>) =>
    api.put<VideoAnnotation>(`/annotations/${annotationId}`, payload),
  delete: (annotationId: string) => api.delete(`/annotations/${annotationId}`),
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

export interface VideoAnnotation {
  id: string;
  video_id: string;
  coach_id: string;
  timestamp_ms: number;
  annotation_type: 'line' | 'circle' | 'arrow' | 'text';
  coordinates: unknown;
  label?: string | null;
  color: string;
}

export interface CoachAthlete {
  id: string; name: string; email: string; team?: string;
  total_submissions: number; published_reports: number; joined_at?: string;
}

export interface PlayerProgress {
  player: { id: string; name: string; email: string; team?: string };
  summary: { total_submissions: number; published_reports: number; batting_submissions: number; bowling_submissions: number; completion_rate: number; days_since_last_submission: number | null; improvement_trend: string };
  flaw_frequency: Array<{ flaw: string; count: number }>;
  flaw_trend: { first_report_flaw_count: number; latest_report_flaw_count: number; delta: number; trend: string } | null;
  submission_timeline: Array<{ id: string; analysis_type: string; status: string; created_at: string; published_at?: string; flaw_count: number; pdf_report_url?: string }>;
}

export interface CoachListItem {
  id: string;
  name: string;
  email: string;
  team?: string;
}

export interface PlayerSubmissionRequest {
  coachId: string;
  note?: string;
  jobId?: string;
}

export interface PlayerSubmissionItem {
  id: string;
  coach_name?: string | null;
  job_id?: string | null;
  status: string;
  note?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export const submissionsApi = {
  /** List available coaches for the player's dropdown */
  listCoaches: () =>
    api.get<{ coaches: CoachListItem[] }>('/coaches'),

  /** Player: Create a submission for a coach */
  createPlayerSubmission: (data: PlayerSubmissionRequest) =>
    api.post<PlayerSubmissionItem>('/submissions', {
      coach_id: data.coachId,
      note: data.note,
      job_id: data.jobId,
    }),

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

  /** Player: Submit an already-uploaded gallery video (no re-upload) */
  submitExistingVideo: (videoId: string, coachId: string, analysisType: string = 'BATTING') => {
    const formData = new FormData();
    formData.append('video_id', videoId);
    formData.append('coach_id', coachId);
    formData.append('analysis_type', analysisType);
    return api.post('/submissions/from-video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    });
  },

  /** Player: My published reports */
  playerReports: (limit = 50, offset = 0) =>
    api.get<{ submissions: SubmissionSummary[]; total: number }>('/submissions/player/me', { params: { limit, offset } }),

  /** Player: All my submissions (all statuses) */
  playerAll: (limit = 50, offset = 0) =>
    api.get<{ submissions: SubmissionSummary[]; total: number }>('/submissions/player/all', { params: { limit, offset } }),

  /** Player: My coach submissions */
  playerMy: () =>
    api.get<{ submissions: PlayerSubmissionItem[]; total: number }>('/submissions/my'),

  /** Coach: Inbox (PENDING + DRAFT_REVIEW) */
  coachInbox: (status?: string, limit = 50, offset = 0) =>
    api.get<{ submissions: SubmissionSummary[]; total: number }>('/submissions/coach/me', { params: { status, limit, offset } }),

  /** Coach: Run AI analysis on a submission */
  analyze: (submissionId: string) =>
    api.post<SubmissionDetail>(`/submissions/${submissionId}/analyze`, null, { timeout: 1800000 }), // 30 min for large videos

  /** Coach: Publish with edited text and sketches */
  publish: (submissionId: string, editedText: string, sketches?: any[]) =>
    api.put<SubmissionDetail>(`/submissions/${submissionId}/publish`, { 
      edited_text: editedText,
      sketches: sketches || [],
    }),

  /** Get single submission detail */
  getById: (submissionId: string) =>
    api.get<SubmissionDetail>(`/submissions/${submissionId}`),

  /** Player: My progress summary (weekly activity, submission timeline) */
  myProgress: () =>
    api.get<PlayerProgress>('/submissions/player/progress'),

  /** Coach: Get a specific player's progress */
  playerProgress: (playerId: string) =>
    api.get<PlayerProgress>(`/submissions/player/${playerId}/progress`),

  /** Coach: Get list of athletes */
  coachAthletes: () =>
    api.get<{ athletes: CoachAthlete[] }>('/submissions/coach/athletes'),
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

// Subscription API
export const subscriptionApi = {
  getMySubscription: () => api.get('/subscriptions/me'),

  // Subscribe current user to a plan
  subscribe: (planKey: string) =>
    api.post('/subscriptions/subscribe', {
      plan_key: planKey,
    }),
};

// Billing API
export const billingApi = {
  /** Create a Razorpay order for the given plan_key */
  createOrder: (planKey: string) =>
    api.post('/billing/create-order', { plan_key: planKey }),

  /** Monthly quota usage for the current user */
  getUsage: () =>
    api.get('/billing/usage'),
};

// Admin API
export const adminApi = {
  // Stats
  getStats: () => api.get('/admin/stats'),

  // Coach verification
  getPendingCoaches: (limit = 20) =>
    api.get('/admin/coaches/pending', { params: { limit } }),
  approveCoach: (coachId: string) =>
    api.post(`/admin/coaches/${coachId}/approve`),
  rejectCoach: (coachId: string) =>
    api.post(`/admin/coaches/${coachId}/reject`),
  getCoachDocument: (coachId: string) =>
    api.get(`/admin/coaches/${coachId}/document`, { responseType: 'blob' }),
  verifyCoach: (coachId: string, action: 'verified' | 'rejected') =>
    api.post(`/admin/coaches/${coachId}/${action === 'verified' ? 'approve' : 'reject'}`),

  // Activity feed
  getActivityFeed: (limit = 20) =>
    api.get('/admin/activity', { params: { limit } }),

  // Plan management
  listPlans: () => api.get<PlanConfig[]>('/admin/plans'),
  updatePlan: (planKey: string, data: {
    display_name?: string;
    price_inr?: number;
    duration_days?: number;
    max_biomech_per_month?: number;
    max_ocr_hours_per_month?: number;
    max_submissions_per_month?: number;
    max_players_in_dashboard?: number;
  }) => api.patch<PlanConfig>(`/admin/plans/${planKey}`, data),

  // User management
  listUsers: (params: {
    page?: number;
    per_page?: number;
    search?: string;
    role?: string;
    subscription_status?: string;
    plan?: string;
    is_active?: boolean;
  }) => api.get('/admin/users', { params }),
  overrideSubscription: (userId: string, data: {
    plan_key: string;
    status: string;
    expires_at?: string;
  }) => api.patch(`/admin/users/${userId}/subscription`, data),
  impersonateUser: (userId: string) =>
    api.post(`/admin/users/${userId}/impersonate`),

  // Audit log
  getAuditLog: (page = 1, perPage = 50) =>
    api.get('/admin/audit-log', { params: { page, per_page: perPage } }),
};

// ── Profile API ───────────────────────────────────────────────────────────────
export const profileApi = {
  /** Create / update the player's own profile (identity fields only) */
  setup: (data: {
    display_name?: string;
    city?: string;
    state?: string;
    bat_style?: string;
    bowl_style?: string;
    age?: number;
    cricket_role?: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper';
    experience_level?: 'beginner' | 'intermediate' | 'advanced' | 'professional';
    preferred_format?: 'T20' | 'ODI' | 'Test' | 'All';
    profile_image_url?: string;
  }) => api.post('/profile/setup', data),

  /** Toggle scouting visibility (Platinum players only) */
  toggleScouting: (visible: boolean) =>
    api.patch('/profile/scouting', { scouting_visible: visible }),

  /** Fetch the player's own profile (use user_id from auth store) */
  getPublic: (userId: string) => api.get(`/profile/${userId}/public`),
};

// ── Scouting API (Academy coaches only) ──────────────────────────────────────
export interface ScoutingPlayerStats {
  avg_bat_speed: number | null;
  peak_bat_speed: number | null;
  avg_wrist_speed: number | null;
  avg_release_height: number | null;
  best_front_knee_angle: number | null;
  best_shoulder_rotation: number | null;
  best_elbow_angle: number | null;
  best_release_consistency: number | null;
}

export interface ScoutingPlayerSummary {
  user_id: string;
  display_name: string | null;
  city: string | null;
  state: string | null;
  cricket_role: string | null;
  experience_level: string | null;
  preferred_format: string | null;
  bat_style: string | null;
  bowl_style: string | null;
  age: number | null;
  profile_image_url: string | null;
  total_analyses: number;
  analyses_last_updated: string | null;
  scouting_visible: boolean;
  stats: ScoutingPlayerStats;
}

export interface ScoutingPlayersResponse {
  players: ScoutingPlayerSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ScoutingPlayerDetail extends ScoutingPlayerSummary {
  recent_batting: Array<{
    id: string;
    date: string;
    metrics: Record<string, number | null>;
  }>;
  recent_bowling: Array<{
    id: string;
    date: string;
    metrics: Record<string, number | null>;
  }>;
  shortlisted: boolean;
  coach_note: string | null;
}

export interface ScoutingFilters {
  page?: number;
  page_size?: number;
  city?: string;
  state?: string;
  cricket_role?: string;
  experience_level?: string;
  preferred_format?: string;
  min_analyses?: number;
  bat_style?: string;
  bowl_style?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export const scoutingApi = {
  /** List all players (academy coaches see everyone) */
  listPlayers: (filters?: ScoutingFilters) =>
    api.get<ScoutingPlayersResponse>('/scouting/players', { params: filters }),

  /** Get a single player's full scouting profile */
  getPlayer: (userId: string) =>
    api.get<ScoutingPlayerDetail>(`/scouting/players/${userId}`),

  /** Add player to coach's shortlist */
  addToShortlist: (playerId: string, note?: string) =>
    api.post('/scouting/shortlist', { player_id: playerId, note }),

  /** Get the coach's full shortlist */
  getShortlist: () => api.get('/scouting/shortlist'),

  /** Update the note on a shortlisted player */
  updateNote: (playerId: string, note: string | null) =>
    api.patch(`/scouting/shortlist/${playerId}`, { note }),

  /** Remove a player from the shortlist */
  removeFromShortlist: (playerId: string) =>
    api.delete(`/scouting/shortlist/${playerId}`),
};

export default api;

export interface PerformanceEntry {
  id: number; player_id: string; opponent: string; match_date: string; match_type: string;
  runs: number; fours: number; sixes: number; balls_faced: number; wickets: number;
  overs_bowled: number; runs_conceded: number; catches: number; run_outs: number;
  result: string; created_at: string;
}

export interface PerformanceStats {
  total_matches: number; total_runs: number; total_fours: number; total_sixes: number;
  total_wickets: number; total_catches: number; total_run_outs: number; highest_score: number;
  batting_average: number; total_balls_faced: number; total_overs_bowled: number;
  total_runs_conceded: number; bowling_average: number; wins: number; losses: number; draws: number;
}

export const performanceApi = {
  log: (data: Omit<PerformanceEntry, 'id' | 'player_id' | 'created_at'>) =>
    api.post<PerformanceEntry>('/performance/', data),
  getStats: () => api.get<PerformanceStats>('/performance/stats'),
  getHistory: () => api.get<PerformanceEntry[]>('/performance/history'),
  deleteEntry: (id: number) => api.delete(`/performance/${id}`),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export interface NotificationItem {
  id: string; title: string; message: string; type: string;
  is_read: boolean; created_at: string;
}

export const notificationsApi = {
  getAll: () =>
    api.get<{ notifications: NotificationItem[]; unread_count: number }>('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

// ── Gamification ──────────────────────────────────────────────────────────────

export interface GamificationBadge {
  key: string; label: string; icon: string; color: string;
  rarity: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  description: string; earned: boolean; progress_current: number;
  progress_target: number; progress_pct: number; earned_at: string | null;
}

export interface GamificationData {
  level: { name: string; icon: string; color: string; xp_pct: number; next_level: string | null; badges_to_next: number };
  streak: { current: number; longest: number; last_activity: string | null; week_activity: { date: string; active: boolean }[] };
  badges: { earned: GamificationBadge[]; locked: GamificationBadge[]; total_earned: number; total: number; next_badge: GamificationBadge | null };
}

export const gamificationApi = {
  getMyData: () => api.get<GamificationData>('/gamification/me'),
};

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface MyCoach {
  id: string; name: string; email: string; specialization?: string[];
  existing_review?: { rating: number; comment?: string } | null;
}

export const reviewsApi = {
  getMyCoaches: () => api.get<{ coaches: MyCoach[] }>('/reviews/player/my-coaches'),
  submitReview: (data: { coach_id: string; rating: number; comment?: string }) =>
    api.post('/reviews', data),
};

// ── Earnings ──────────────────────────────────────────────────────────────────

export interface TransactionItem {
  id: string;
  player_name: string;
  player_email: string;
  transaction_type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface EarningsStats {
  total_earned: number;
  pending: number;
  this_month: number;
  total_transactions: number;
}

export interface MonthlyEarnings {
  month: string;
  earnings: number;
}

export const earningsApi = {
  getStats: () => api.get<EarningsStats>('/coach/earnings/stats'),
  getMonthly: () => api.get<MonthlyEarnings[]>('/coach/earnings/monthly'),
  getTransactions: () => api.get<TransactionItem[]>('/coach/earnings/transactions'),
};

// ── Coach Reviews ─────────────────────────────────────────────────────────────

export interface CoachReviewItem {
  id: string;
  player_id: string;
  player_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface CoachReviewsResponse {
  reviews: CoachReviewItem[];
  total: number;
  average_rating: number;
}

export const coachReviewsApi = {
  getMyReviews: () => api.get<CoachReviewsResponse>('/reviews/coach/me'),
  getCoachReviews: (coachId: string) => api.get<CoachReviewsResponse>(`/reviews/coach/${coachId}`),
};

// ── Training Plans ────────────────────────────────────────────────────────────

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

