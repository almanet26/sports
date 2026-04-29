export {
  type Tier,
  type FeatureKey,
  type SubscriptionStatus,
  type QuotaUsage,
  type PlanConfig,
  type AccountType,
  type PlanDisplayInfo,
  TIER_HIERARCHY,
  FEATURE_MAP,
  PLAN_DISPLAY_CONFIG,
  PLANS_FULL_CONFIG,
} from './subscriptionPlans';

import { FEATURE_MAP, type AccountType, type FeatureKey, type Tier } from './subscriptionPlans';

export const PLAN_CUMULATIVE_FEATURES: Record<Tier, string[]> = {
  free: [
    '3 biomechanics analyses/month',
    'Public library access',
    'Community voting',
  ],
  coach_free: [
    'Public library access',
    'Basic coach profile',
  ],
  basic: [
    '15 biomechanics analyses/month',
    '5 coach submissions/month',
    'AI Chat assistant',
    'Ad-free experience',
    'Public library access',
  ],
  platinum: [
    '50 biomechanics analyses/month',
    '15 coach submissions/month',
    'AI Chat assistant',
    'Professional PDF reports',
    'Pro benchmarking',
    'Scouting visibility (opt-in)',
    'Ad-free experience',
  ],
  coach_starter: [
    '50 OCR match hours/month',
    '150 player submissions/month',
    'Player dashboard (up to 10 players)',
    'Video annotation tools',
    'Upload match videos',
    'AI Chat assistant',
    'Public library access',
  ],
  coach_pro: [
    '150 OCR match hours/month',
    '600 player submissions/month',
    '100 players in dashboard',
    'Priority OCR processing',
    'CSV data export',
    'Video annotation tools',
    'AI Chat assistant',
    'Upload match videos',
  ],
  academy: [
    '500 OCR match hours/month',
    '1,500 player submissions/month',
    'White-label reports',
    'Multi-seat role controls',
    'Recruitment desk',
    'Unlimited players in dashboard',
    'Priority OCR processing',
    'CSV data export',
    'AI Chat assistant',
    'Upload match videos',
  ],
};

export function getFeatureRequiredTier(feature: FeatureKey, accountType: AccountType): Tier {
  if (feature === 'ai_chat') {
    return accountType === 'COACH' ? 'coach_starter' : 'basic';
  }
  return FEATURE_MAP[feature];
}

export function getUpgradeFeatureDelta(currentTier: Tier, targetTier: Tier): string[] {
  const current = new Set(PLAN_CUMULATIVE_FEATURES[currentTier] ?? []);
  return (PLAN_CUMULATIVE_FEATURES[targetTier] ?? []).filter((feature) => !current.has(feature));
}