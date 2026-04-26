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

export default function FeatureGate({ requiredTier, children }: FeatureGateProps) {
  const platformRole = useSubscriptionStore((s) => s.user?.platform_role);
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
  const wasSubscribed = role !== 'free';
  if (subscriptionStatus !== 'active' && wasSubscribed) {
    return <SubscriptionExpiredPrompt />;
  }

  // Current tier is below the required tier
  if (TIER_HIERARCHY[role] < TIER_HIERARCHY[requiredTier]) {
    return <UpgradePrompt requiredTier={requiredTier} />;
  }

  return <>{children}</>;
}
