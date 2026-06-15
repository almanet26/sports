export {
  type Tier,
  type FeatureKey,
  type SubscriptionStatus,
  type QuotaUsage,
  type PlanConfig,
  type AccountType,
  type PlanDisplayInfo,
  type Entitlements,
  type FeatureType,
  type PlanUserType,
  type BillingPeriod,
  type AdminFeature,
  type AdminEntitlement,
  type AdminPlan,
  type EntitlementInput,
  TIER_HIERARCHY,
  FEATURE_MAP,
  PLAN_DISPLAY_CONFIG,
  PLANS_FULL_CONFIG,
} from './subscriptionPlans';

import { FEATURE_MAP, type AccountType, type FeatureKey, type Tier } from './subscriptionPlans';

// ─── Cumulative feature lists for UpgradePrompt delta display ─────────────────

const BRONZE_FEATURES = [
  '3 Biomechanical Analyses / month',
  'Basic performance stats & match history',
  'Public library & community voting',
  'Streak counters & milestone badges',
];

const SILVER_FEATURES = [
  ...BRONZE_FEATURES,
  '15 Biomechanical Analyses / month',
  '5 Coach Submissions / month',
  'Ad-free experience',
  'Professional PDF performance reports',
  'Advanced stats history',
  'AI Coach Chat (24/7 technique queries)',
];

const GOLD_FEATURES = [
  ...SILVER_FEATURES.filter(
    (f) => !f.includes('15 Biomechanical') && !f.includes('5 Coach Submissions'),
  ),
  '50 Biomechanical Analyses / month',
  '15 Coach Submissions / month',
  'Weekly AI skill-building tips',
  'Pro-Benchmarking vs professional pose data',
  'Injury Risk Alerts',
  'Verified Scouting Profile (visible to scouts & franchises)',
];

const COACH_BASIC_FEATURES = [
  'Coach Dashboard, Profile & Verification',
  'Submission inbox (review & earnings)',
  '10 OCR match-hours / month',
  'Athlete roster (up to 5 players)',
  '5 player submissions / month',
  'Basic session & availability management',
];

const COACH_PLATINUM_FEATURES = [
  ...COACH_BASIC_FEATURES.filter(
    (f) => !f.includes('10 OCR') && !f.includes('up to 5 players') && !f.includes('5 player submissions'),
  ),
  '50 OCR match-hours / month',
  '100 player submissions / month',
  'Multi-player dashboard (up to 25 players)',
  'Training Schedule Calendar with attendance tracking',
  'Athlete Training Plans & development programs',
  'Video Annotation Tools for remote feedback',
  'Match Highlight Generation + priority processing',
  'AI Coach Chat (24/7 technique queries)',
  'CSV data exports',
  'Leaderboard & content management',
  'White-Label Reporting',
];

export const PLAN_CUMULATIVE_FEATURES: Record<Tier, string[]> = {
  bronze:         BRONZE_FEATURES,
  silver:         SILVER_FEATURES,
  gold:           GOLD_FEATURES,
  coach_basic:    COACH_BASIC_FEATURES,
  coach_platinum: COACH_PLATINUM_FEATURES,
};


export function getFeatureRequiredTier(feature: FeatureKey, _accountType: AccountType): Tier {
  return FEATURE_MAP[feature];
}

export function getUpgradeFeatureDelta(currentTier: Tier, targetTier: Tier): string[] {
  const current = new Set(PLAN_CUMULATIVE_FEATURES[currentTier] ?? []);
  return (PLAN_CUMULATIVE_FEATURES[targetTier] ?? []).filter((f) => !current.has(f));
}
