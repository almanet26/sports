export type Tier = 'free' | 'coach_free' | 'basic' | 'platinum' | 'coach_starter' | 'coach_pro' | 'academy';

export const TIER_HIERARCHY: Record<Tier, number> = {
  free: 0,
  coach_free: 0,
  basic: 1,
  platinum: 2,
  coach_starter: 3,
  coach_pro: 4,
  academy: 5,
};

export type FeatureKey =
  | 'biomechanics_analysis'
  | 'pdf_report'
  | 'ai_chat'
  | 'pro_benchmarking'
  | 'injury_risk_alerts'
  | 'ocr_highlights'
  | 'video_annotation'
  | 'player_dashboard'
  | 'player_submission'
  | 'coach_submission_inbox'
  | 'csv_export'
  | 'priority_processing'
  | 'white_label_reports'
  | 'multi_seat_roles'
  | 'recruitment_desk'
  | 'scouting_visibility'
  | 'scouting_access';

export const FEATURE_MAP: Record<FeatureKey, Tier> = {
  biomechanics_analysis: 'free',
  pdf_report: 'platinum',
  ai_chat: 'basic',
  pro_benchmarking: 'platinum',
  injury_risk_alerts: 'platinum',
  ocr_highlights: 'coach_starter',
  video_annotation: 'coach_starter',
  player_dashboard: 'coach_starter',
  player_submission: 'basic',
  coach_submission_inbox: 'coach_starter',
  csv_export: 'coach_pro',
  priority_processing: 'coach_pro',
  white_label_reports: 'academy',
  multi_seat_roles: 'academy',
  recruitment_desk: 'academy',
  scouting_visibility: 'platinum',
  scouting_access: 'academy',
};

export type SubscriptionStatus = 'active' | 'inactive' | 'past_due' | 'expired';

export interface QuotaUsage {
  biomech: { used: number; limit: number };
  ocr_hours: { used: number; limit: number };
  submissions: { used: number; limit: number };
}

export interface PlanConfig {
  plan_key: string;
  role: Tier;
  display_name: string;
  price_inr: number;
  duration_days: number;
  max_biomech_per_month: number;
  max_ocr_hours_per_month: number;
  max_submissions_per_month: number;
  max_players_in_dashboard: number;
}

export type AccountType = 'PLAYER' | 'COACH' | 'ADMIN';

export interface PlanDisplayInfo {
  displayName: string;
  priceInr: number;
  duration: string;
  topFeatures: [string, string, string];
  planKey: string;
  account_type: AccountType;
}

export const PLAN_DISPLAY_CONFIG: Record<Tier, PlanDisplayInfo> = {
  free: {
    displayName: 'Free',
    priceInr: 0,
    duration: 'Forever',
    topFeatures: ['Biomechanics analysis', 'Basic pose detection', 'Standard processing'],
    planKey: 'free',
    account_type: 'PLAYER',
  },
  coach_free: {
    displayName: 'Coach Free',
    priceInr: 0,
    duration: 'Forever',
    topFeatures: ['Coach profile setup', 'Public library access', 'No monthly OCR quota'],
    planKey: 'coach_free',
    account_type: 'COACH',
  },
  basic: {
    displayName: 'Basic',
    priceInr: 499,
    duration: '90 days',
    topFeatures: ['AI Chat assistant', 'Unlimited biomechanics', 'Full match history'],
    planKey: 'basic_90d',
    account_type: 'PLAYER',
  },
  platinum: {
    displayName: 'Platinum',
    priceInr: 1499,
    duration: '180 days',
    topFeatures: ['PDF performance reports', 'Pro benchmarking', 'Public library access'],
    planKey: 'platinum_180d',
    account_type: 'PLAYER',
  },
  coach_starter: {
    displayName: 'Coach Starter',
    priceInr: 1999,
    duration: '90 days',
    topFeatures: ['OCR highlight generation', 'Video annotation tools', 'Player dashboard (10 players)'],
    planKey: 'coach_starter',
    account_type: 'COACH',
  },
  coach_pro: {
    displayName: 'Coach Pro',
    priceInr: 4999,
    duration: '180 days',
    topFeatures: ['CSV data export', 'Priority processing queue', 'Unlimited player dashboard'],
    planKey: 'coach_pro',
    account_type: 'COACH',
  },
  academy: {
    displayName: 'Academy',
    priceInr: 14999,
    duration: '365 days',
    topFeatures: ['White-label PDF reports', 'Multi-seat admin roles', 'Recruitment desk'],
    planKey: 'academy',
    account_type: 'COACH',
  },
};

export const PLANS_FULL_CONFIG: PlanConfig[] = [
  {
    plan_key: 'free',
    role: 'free',
    display_name: 'Free',
    price_inr: 0,
    duration_days: 0,
    max_biomech_per_month: 3,
    max_ocr_hours_per_month: 0,
    max_submissions_per_month: 0,
    max_players_in_dashboard: 0,
  },
  {
    plan_key: 'coach_free',
    role: 'coach_free',
    display_name: 'Coach Free',
    price_inr: 0,
    duration_days: 0,
    max_biomech_per_month: 0,
    max_ocr_hours_per_month: 0,
    max_submissions_per_month: 0,
    max_players_in_dashboard: 0,
  },
  {
    plan_key: 'basic_90d',
    role: 'basic',
    display_name: 'Basic',
    price_inr: 499,
    duration_days: 90,
    max_biomech_per_month: 15,
    max_ocr_hours_per_month: 0,
    max_submissions_per_month: 5,
    max_players_in_dashboard: 0,
  },
  {
    plan_key: 'platinum_180d',
    role: 'platinum',
    display_name: 'Platinum',
    price_inr: 1499,
    duration_days: 180,
    max_biomech_per_month: 50,
    max_ocr_hours_per_month: 0,
    max_submissions_per_month: 15,
    max_players_in_dashboard: 0,
  },
  {
    plan_key: 'coach_starter',
    role: 'coach_starter',
    display_name: 'Coach Starter',
    price_inr: 1999,
    duration_days: 90,
    max_biomech_per_month: 999,
    max_ocr_hours_per_month: 50,
    max_submissions_per_month: 150,
    max_players_in_dashboard: 10,
  },
  {
    plan_key: 'coach_pro',
    role: 'coach_pro',
    display_name: 'Coach Pro',
    price_inr: 4999,
    duration_days: 180,
    max_biomech_per_month: 999,
    max_ocr_hours_per_month: 150,
    max_submissions_per_month: 600,
    max_players_in_dashboard: 100,
  },
  {
    plan_key: 'academy',
    role: 'academy',
    display_name: 'Academy',
    price_inr: 14999,
    duration_days: 365,
    max_biomech_per_month: 999,
    max_ocr_hours_per_month: 500,
    max_submissions_per_month: 1500,
    max_players_in_dashboard: -1,
  },
];
