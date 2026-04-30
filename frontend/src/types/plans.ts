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

const FREE_PLAYER_FEATURES = [
  '3 biomechanics analyses/month',
  'Public library access',
  'Community voting',
];

const COACH_FREE_FEATURES = [
  'Public library access',
  'Basic coach profile',
];

const BASIC_PLAYER_FEATURES = [
  ...FREE_PLAYER_FEATURES,
  '15 biomechanics analyses/month',
  '5 coach submissions/month',
  'AI Chat assistant',
  'Ad-free experience',
];

const COACH_STARTER_FEATURES = [
  ...COACH_FREE_FEATURES,
  '50 OCR match hours/month',
  '150 player submissions/month',
  'Player dashboard (up to 10 players)',
  'Video annotation tools',
  'Upload match videos',
  'AI Chat assistant',
];

const COACH_PRO_FEATURES = [
  ...COACH_STARTER_FEATURES,
  '150 OCR match hours/month',
  '600 player submissions/month',
  '100 players in dashboard',
  'Priority OCR processing',
  'CSV data export',
];

export const PLAN_CUMULATIVE_FEATURES: Record<Tier, string[]> = {
  free: [
    ...FREE_PLAYER_FEATURES,
  ],
  basic: [
    ...BASIC_PLAYER_FEATURES,
  ],
  platinum: [
    ...BASIC_PLAYER_FEATURES,
    '50 biomechanics analyses/month',
    '15 coach submissions/month',
    'Professional PDF reports',
    'Pro benchmarking',
    'Scouting visibility (opt-in)',
  ],
  coach_free: [
    ...COACH_FREE_FEATURES,
  ],
  coach_starter: [
    ...COACH_STARTER_FEATURES,
  ],
  coach_pro: [
    ...COACH_PRO_FEATURES,
  ],
  academy: [
    ...COACH_PRO_FEATURES,
    '500 OCR match hours/month',
    '1,500 player submissions/month',
    'White-label reports',
    'Multi-seat role controls',
    'Recruitment desk',
    'Unlimited players in dashboard',
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