import type { AccountType, Tier, SubscriptionStatus } from '../../types/plans';
import { TIER_HIERARCHY, getFeatureRequiredTier, type FeatureKey } from '../../types/plans';

export type FeatureGateDecision = 'allow' | 'upgrade' | 'expired';

export interface FeatureGateInput {
  accountType: AccountType;
  subscriptionTier: Tier;
  subscriptionStatus: SubscriptionStatus;
  requiredTier: Tier;
  feature: string;
}

export interface FeatureGateOutcome {
  decision: FeatureGateDecision;
  effectiveRequiredTier: Tier;
}

export function getFeatureGateOutcome({
  accountType,
  subscriptionTier,
  subscriptionStatus,
  requiredTier,
  feature,
}: FeatureGateInput): FeatureGateOutcome {
  if (accountType === 'ADMIN' || requiredTier === 'free') {
    return {
      decision: 'allow',
      effectiveRequiredTier: requiredTier,
    };
  }

  const wasSubscribed = subscriptionTier !== 'free' && subscriptionTier !== 'coach_free';
  if (subscriptionStatus !== 'active' && wasSubscribed) {
    return {
      decision: 'expired',
      effectiveRequiredTier: requiredTier,
    };
  }

  const effectiveRequiredTier: Tier = feature === 'ai_chat'
    ? getFeatureRequiredTier(feature as FeatureKey, accountType)
    : requiredTier;

  if (TIER_HIERARCHY[subscriptionTier] < TIER_HIERARCHY[effectiveRequiredTier]) {
    return {
      decision: 'upgrade',
      effectiveRequiredTier,
    };
  }

  return {
    decision: 'allow',
    effectiveRequiredTier,
  };
}