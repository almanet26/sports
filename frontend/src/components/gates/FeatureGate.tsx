import type { ReactNode } from 'react';
import { useSubscriptionStore } from '../../stores/authStore';
import { TIER_HIERARCHY, getFeatureRequiredTier, type FeatureKey, type Tier } from '../../types/plans';
import UpgradePrompt from './UpgradePrompt';
import SubscriptionExpiredPrompt from './SubscriptionExpiredPrompt';

interface FeatureGateProps {
  requiredTier: Tier;
  feature: string;
  children: ReactNode;
}

export default function FeatureGate({ requiredTier, feature, children }: FeatureGateProps) {
  const accountType = useSubscriptionStore((s) => s.accountType);
  const subscriptionTier = useSubscriptionStore((s) => s.subscriptionTier);
  const subscriptionStatus = useSubscriptionStore((s) => s.subscriptionStatus);

  // ADMIN bypasses every gate unconditionally
  if (accountType === 'ADMIN') {
    return <>{children}</>;
  }

  // Free features are always accessible regardless of subscription state
  if (requiredTier === 'free') {
    return <>{children}</>;
  }

  // User had a paid plan that lapsed — show renewal prompt rather than upgrade
  const wasSubscribed = subscriptionTier !== 'free' && subscriptionTier !== 'coach_free';
  if (subscriptionStatus !== 'active' && wasSubscribed) {
    return <SubscriptionExpiredPrompt />;
  }

  const effectiveRequiredTier: Tier = feature === 'ai_chat'
    ? getFeatureRequiredTier(feature as FeatureKey, accountType)
    : requiredTier;

  // Current tier is below the required tier
  if (TIER_HIERARCHY[subscriptionTier] < TIER_HIERARCHY[effectiveRequiredTier]) {
    return <UpgradePrompt requiredTier={effectiveRequiredTier} />;
  }

  return <>{children}</>;
}
