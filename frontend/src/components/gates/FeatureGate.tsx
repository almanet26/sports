import type { ReactNode } from 'react';
import { useSubscriptionStore } from '../../stores/authStore';
import { TIER_HIERARCHY, type Tier } from '../../types/plans';
import UpgradePrompt from './UpgradePrompt';
import SubscriptionExpiredPrompt from './SubscriptionExpiredPrompt';

interface FeatureGateProps {
  requiredTier: Tier;
  feature: string;
  children: ReactNode;
}

export default function FeatureGate({ requiredTier, feature, children }: FeatureGateProps) {
  const platformRole = useSubscriptionStore((s) => s.user?.platform_role);
  const accountType = useSubscriptionStore((s) => s.accountType);
  const role = useSubscriptionStore((s) => s.role);
  const subscriptionStatus = useSubscriptionStore((s) => s.subscriptionStatus);

  // ADMIN bypasses every gate unconditionally
  if (platformRole === 'ADMIN') {
    return <>{children}</>;
  }

  // Free features are always accessible regardless of subscription state
  if (requiredTier === 'free') {
    return <>{children}</>;
  }

  // User had a paid plan that lapsed — show renewal prompt rather than upgrade
  const wasSubscribed = role !== 'free' && role !== 'coach_free';
  if (subscriptionStatus !== 'active' && wasSubscribed) {
    return <SubscriptionExpiredPrompt />;
  }

  // Determine the effective required tier based on account type and feature.
  // For ai_chat: coach minimum is coach_starter, player minimum is basic.
  let effectiveRequiredTier: Tier = requiredTier;
  if (feature === 'ai_chat' && accountType === 'COACH') {
    effectiveRequiredTier = 'coach_starter';
  }

  // Current tier is below the required tier
  if (TIER_HIERARCHY[role] < TIER_HIERARCHY[effectiveRequiredTier]) {
    return <UpgradePrompt requiredTier={effectiveRequiredTier} />;
  }

  return <>{children}</>;
}
