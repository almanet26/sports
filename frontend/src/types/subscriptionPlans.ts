// Canonical subscription tier model (2026-06-15)
//
// Players (monthly billing):  bronze → silver → gold
// Coaches (annual billing):   coach_basic → coach_platinum

export type Tier =
  | 'bronze'
  | 'coach_basic'
  | 'silver'
  | 'gold'
  | 'coach_platinum';

export const TIER_HIERARCHY: Record<Tier, number> = {
  bronze:         0,
  coach_basic:    0,
  silver:         1,
  gold:           2,
  coach_platinum: 3,
};

// The next paid tier up from `currentTier`, staying on the same track (player: bronze → silver → gold; coach: coach_basic → coach_platinum). Returns null once already on the top tier of that track, or if `currentTier` isn't one of the known static tiers (e.g. a custom plan key from the entitlement engine).
export function getNextTier(currentTier: Tier): Tier | null {
  const track = PLAN_DISPLAY_CONFIG[currentTier]?.account_type;
  if (!track) return null;
  const higher = (Object.keys(PLAN_DISPLAY_CONFIG) as Tier[])
    .filter((t) => PLAN_DISPLAY_CONFIG[t].account_type === track && TIER_HIERARCHY[t] > TIER_HIERARCHY[currentTier])
    .sort((a, b) => TIER_HIERARCHY[a] - TIER_HIERARCHY[b]);
  return higher[0] ?? null;
}

// Safe accessor for PLAN_DISPLAY_CONFIG: `subscriptionTier` is typed as `Tier` but at runtime can be any plan key created via the admin entitlement-engine panel, which won't have a static entry here. Falls back to a generic display using the raw key instead of letting `PLAN_DISPLAY_CONFIG[tier]` be `undefined`.
export function getPlanDisplay(tier: string): PlanDisplayInfo {
  return (
    PLAN_DISPLAY_CONFIG[tier as Tier] ?? {
      displayName:  tier,
      priceInr:     0,
      billingCycle: '',
      topFeatures:  ['', '', ''],
      planKey:      tier,
      account_type: 'PLAYER',
    }
  );
}

export type FeatureKey =
  // Player features
  | 'biomechanics_analysis'
  | 'pdf_report'
  | 'ad_free'
  | 'streak_counters'
  | 'player_submission'
  | 'ai_chat'
  | 'pro_benchmarking'
  | 'injury_risk_alerts'
  | 'scouting_visibility'
  // Coach features
  | 'coach_submission_inbox'
  | 'ocr_highlights'
  | 'video_annotation'
  | 'player_dashboard'
  | 'csv_export'
  | 'white_label_reports'
  | 'training_plans'
  | 'training_calendar'
  | 'leaderboard';

export const FEATURE_MAP: Record<FeatureKey, Tier> = {
  // ── Player: Bronze (free) ──────────────────────────────────────────────────
  biomechanics_analysis:   'bronze',
  streak_counters:         'bronze',
  // ── Player: Silver (₹200/mo) ──────────────────────────────────────────────
  pdf_report:              'silver',
  ad_free:                 'silver',
  player_submission:       'silver',
  ai_chat:                 'silver',
  // ── Player: Gold (₹500/mo) ────────────────────────────────────────────────
  pro_benchmarking:        'gold',
  injury_risk_alerts:      'gold',
  scouting_visibility:     'gold',
  // ── Coach: Basic (free) ───────────────────────────────────────────────────
  coach_submission_inbox:  'coach_basic',
  ocr_highlights:          'coach_basic',
  player_dashboard:        'coach_basic',
  // ── Coach: Platinum (₹1,200/yr) ───────────────────────────────────────────
  video_annotation:        'coach_platinum',
  csv_export:              'coach_platinum',
  white_label_reports:     'coach_platinum',
  training_plans:          'coach_platinum',
  training_calendar:       'coach_platinum',
  leaderboard:             'coach_platinum',
};

export type SubscriptionStatus = 'active' | 'inactive' | 'past_due' | 'expired';

export interface QuotaUsage {
  biomech:     { used: number; limit: number };
  ocr_hours:   { used: number; limit: number };
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
  billingCycle: string;
  topFeatures: [string, string, string];
  planKey: string;
  account_type: AccountType;
}

export const PLAN_DISPLAY_CONFIG: Record<Tier, PlanDisplayInfo> = {
  bronze: {
    displayName:  'Bronze',
    priceInr:     0,
    billingCycle: 'Free forever',
    topFeatures:  ['3 Biomechanical Analyses/mo', 'Basic performance stats', 'Public library access'],
    planKey:      'bronze',
    account_type: 'PLAYER',
  },
  silver: {
    displayName:  'Silver',
    priceInr:     200,
    billingCycle: 'per month',
    topFeatures:  ['15 Biomechanical Analyses/mo', '5 Coach Submissions/mo', 'PDF Performance Reports'],
    planKey:      'silver',
    account_type: 'PLAYER',
  },
  gold: {
    displayName:  'Gold',
    priceInr:     500,
    billingCycle: 'per month',
    topFeatures:  ['50 Biomechanical Analyses/mo', 'AI Coach Chat + Injury Alerts', 'Verified Scouting Profile'],
    planKey:      'gold',
    account_type: 'PLAYER',
  },
  coach_basic: {
    displayName:  'Coach Basic',
    priceInr:     0,
    billingCycle: 'Free forever',
    topFeatures:  ['Submission inbox', 'Up to 5 athletes', 'Basic dashboard & availability'],
    planKey:      'coach_basic',
    account_type: 'COACH',
  },
  coach_platinum: {
    displayName:  'Coach Platinum',
    priceInr:     1200,
    billingCycle: 'per year',
    topFeatures:  ['Up to 25 athletes + 50 OCR hrs', 'OCR Match Highlights + Video Annotation', 'CSV Exports + White-Label Reports'],
    planKey:      'coach_platinum',
    account_type: 'COACH',
  },
};

// price_inr values here are the display price (₹), not paise.
// The backend plan_config stores paise; PLANS_FULL_CONFIG uses the same unit for consistency.
export const PLANS_FULL_CONFIG: PlanConfig[] = [
  {
    plan_key:                  'bronze',
    role:                      'bronze',
    display_name:              'Bronze',
    price_inr:                 0,
    duration_days:             36500,
    max_biomech_per_month:     3,
    max_ocr_hours_per_month:   0,
    max_submissions_per_month: 0,
    max_players_in_dashboard:  0,
  },
  {
    plan_key:                  'silver',
    role:                      'silver',
    display_name:              'Silver',
    price_inr:                 200,
    duration_days:             30,
    max_biomech_per_month:     15,
    max_ocr_hours_per_month:   0,
    max_submissions_per_month: 5,
    max_players_in_dashboard:  0,
  },
  {
    plan_key:                  'gold',
    role:                      'gold',
    display_name:              'Gold',
    price_inr:                 500,
    duration_days:             30,
    max_biomech_per_month:     50,
    max_ocr_hours_per_month:   0,
    max_submissions_per_month: 15,  
    max_players_in_dashboard:  0,
  },
  {
    plan_key:                  'coach_basic',
    role:                      'coach_basic',
    display_name:              'Coach Basic',
    price_inr:                 0,
    duration_days:             36500,
    max_biomech_per_month:     0,
    max_ocr_hours_per_month:   10,  
    max_submissions_per_month: 5,   
    max_players_in_dashboard:  5,
  },
  {
    plan_key:                  'coach_platinum',
    role:                      'coach_platinum',
    display_name:              'Coach Platinum',
    price_inr:                 1200,
    duration_days:             365,
    max_biomech_per_month:     0,    
    max_ocr_hours_per_month:   50,   
    max_submissions_per_month: 100,  
    max_players_in_dashboard:  25,   
  },
];

// ─── Dynamic entitlement engine ───────────────────────────────────────────────
// The server is the source of truth.  A user's resolved entitlements are a flat map of feature key → granted value (boolean for capabilities, number for quotas where -1 = unlimited, 0 = none).  Populated from GET /billing/usage.
export type Entitlements = Record<string, number | boolean>;

export type FeatureType = 'boolean' | 'numeric';
export type PlanUserType = 'player' | 'coach';
export type BillingPeriod = 'monthly' | 'annual';

// Feature catalog row (admin control panel).
export interface AdminFeature {
  id: number;
  key: string;
  display_name: string;
  description?: string | null;
  type: FeatureType;
}

// One plan × feature entitlement as returned by the admin API.
export interface AdminEntitlement {
  feature_id: number;
  feature_key: string;
  feature_type: FeatureType;
  value: string; // "true"/"false" or a numeric string; "-1" = unlimited
}

// Full plan record for the admin matrix / builder.
export interface AdminPlan {
  id: number;
  key: string;
  display_name: string;
  user_type: PlanUserType;
  price_inr: number; // paise
  billing_period: BillingPeriod;
  razorpay_plan_id?: string | null;
  is_active: boolean;
  sort_order: number;
  subscriber_count: number;
  entitlements: AdminEntitlement[];
}

// Payload for creating/updating entitlements on a plan.
export interface EntitlementInput {
  feature_id: number;
  value: string;
}
