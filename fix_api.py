import sys

raw = open('frontend/src/lib/api.ts', 'rb').read()

# Find the start of the appended block
marker = b'\nexport interface CoachAthlete {'
idx = raw.find(marker)
if idx == -1:
    sys.exit('marker not found')

base = raw[:idx]

new_block = b'''
export interface CoachAthlete {
  id: string;
  name: string;
  email: string;
  team?: string;
  total_submissions: number;
  published_reports: number;
  joined_at?: string;
}

export interface PlayerProgress {
  player: { id: string; name: string; email: string; team?: string };
  summary: {
    total_submissions: number;
    published_reports: number;
    batting_submissions: number;
    bowling_submissions: number;
    completion_rate: number;
    days_since_last_submission?: number | null;
    improvement_trend: string;
  };
  flaw_frequency: Array<{ flaw: string; count: number }>;
  flaw_trend?: {
    first_report_flaw_count: number;
    latest_report_flaw_count: number;
    delta: number;
    trend: string;
  } | null;
  submission_timeline: Array<{
    id: string;
    analysis_type: string;
    status: string;
    created_at?: string;
    published_at?: string;
    flaw_count: number;
    pdf_report_url?: string;
  }>;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface EarningsData {
  total_earned: number;
  pending: number;
  this_month: number;
  chart_data: Array<{ month: string; earnings: number }>;
  transactions: Array<{
    id: string;
    amount: number;
    date: string;
    description: string;
    player: string;
    type: string;
    status: string;
  }>;
}

export interface ReviewItem {
  id: string;
  player_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface MyCoach {
  id: string;
  name: string;
  email: string;
  profile_image_url?: string;
  specialization?: string[];
  coach_category?: string;
  existing_review?: { rating: number; comment?: string } | null;
}

export interface TrainingSession {
  id: string;
  topic: string;
  description?: string;
  prerequisites?: string;
  session_date: string;
  session_time: string;
  duration_minutes: string;
  session_type: 'virtual' | 'in_person';
  status: string;
}

export interface TrainingPlanData {
  id: string;
  title: string;
  description?: string;
  analysis_type: string;
  plan_type: string;
  is_public: boolean;
  drills: string[];
  created_at: string;
}

export interface TrainingPlanCreate {
  title: string;
  description?: string;
  analysis_type: string;
  plan_type: string;
  is_public: boolean;
  drills: string[];
}

export interface GamificationBadge {
  key: string;
  name: string;
  label: string;
  description: string;
  rarity: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  earned: boolean;
  earned_at?: string;
  color: string;
  icon: string;
  progress_current: number;
  progress_target: number;
  progress_pct: number;
}

export interface GamificationData {
  level: {
    name: string;
    color: string;
    icon: string;
    xp_pct: number;
    next_level?: string;
    badges_to_next?: number;
  };
  streak: {
    current: number;
    longest: number;
    week_activity: Array<{ date: string; active: boolean }>;
  };
  badges: {
    earned: GamificationBadge[];
    locked: GamificationBadge[];
    total: number;
    total_earned: number;
    next_badge?: GamificationBadge | null;
  };
}

export interface PerformanceEntry {
  id: number;
  match_date: string;
  opponent: string;
  match_type: string;
  runs: number;
  fours: number;
  sixes: number;
  wickets: number;
  catches: number;
  result: string;
}

export interface PerformanceStats {
  total_matches: number;
  total_runs: number;
  total_fours: number;
  total_sixes: number;
  highest_score: number;
  batting_average: number;
  total_wickets: number;
  bowling_average: number;
  total_catches: number;
  total_run_outs: number;
  wins: number;
  losses: number;
}

export const notificationsApi = {
  list: (limit = 20) => api.get<{ notifications: NotificationItem[]; unread_count: number }>('/notifications', { params: { limit } }),
  getAll: (limit = 20) => api.get<{ notifications: NotificationItem[]; unread_count: number }>('/notifications', { params: { limit } }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export const earningsApi = {
  get: () => api.get<EarningsData>('/coach/earnings'),
  getMyEarnings: () => api.get<EarningsData>('/coach/earnings'),
};

export const reviewsApi = {
  myCoaches: () => api.get<{ coaches: MyCoach[] }>('/coach/my-coaches'),
  getMyCoaches: () => api.get<{ coaches: MyCoach[] }>('/coach/my-coaches'),
  coachReviews: () => api.get<{ reviews: ReviewItem[] }>('/coach/reviews'),
  getCoachReviews: () => api.get<{ reviews: ReviewItem[] }>('/coach/reviews'),
  submitReview: (coachId: string, rating: number, comment?: string) =>
    api.post('/coach/reviews', { coach_id: coachId, rating, comment }),
};

export const sessionsApi = {
  list: () => api.get<{ sessions: TrainingSession[] }>('/sessions'),
  create: (data: Omit<TrainingSession, 'id'>) => api.post<TrainingSession>('/sessions', data),
  update: (id: string, data: Partial<TrainingSession>) => api.put<TrainingSession>(`/sessions/${id}`, data),
  delete: (id: string) => api.delete(`/sessions/${id}`),
};

export const trainingPlansApi = {
  list: () => api.get<{ plans: TrainingPlanData[] }>('/sessions/training-plans'),
  create: (data: TrainingPlanCreate) => api.post<TrainingPlanData>('/sessions/training-plans', data),
  update: (id: string, data: Partial<TrainingPlanCreate>) => api.put<TrainingPlanData>(`/sessions/training-plans/${id}`, data),
  delete: (id: string) => api.delete(`/sessions/training-plans/${id}`),
};

export const gamificationApi = {
  get: () => api.get<GamificationData>('/gamification/me'),
  getMyData: () => api.get<GamificationData>('/gamification/me'),
};

export const performanceApi = {
  getStats: () => api.get<PerformanceStats>('/performance/stats'),
  getHistory: () => api.get<PerformanceEntry[]>('/performance/me'),
  log: (data: Omit<PerformanceEntry, 'id'>) => api.post<PerformanceEntry>('/performance/me', data),
  deleteEntry: (id: number) => api.delete(`/performance/me/${id}`),
};

// Extend submissionsApi with coachAthletes + progress helpers used by pages
Object.assign(submissionsApi, {
  coachAthletes: () => api.get<{ athletes: CoachAthlete[]; total: number }>('/submissions/coach/athletes'),
  playerProgress: (playerId: string) =>
    api.get<PlayerProgress>(`/submissions/coach/player/${playerId}/progress`),
  myProgress: () => api.get<PlayerProgress>('/submissions/player/progress'),
});
'''

result = base + new_block
open('frontend/src/lib/api.ts', 'wb').write(result)
print('Done. New length:', len(result))
