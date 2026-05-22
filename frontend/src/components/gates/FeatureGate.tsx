import type { ReactNode } from 'react';
import { useSubscriptionStore } from '../../stores/authStore';
import type { Tier } from '../../types/plans';
import UpgradePrompt from './UpgradePrompt';
import SubscriptionExpiredPrompt from './SubscriptionExpiredPrompt';
import { getFeatureGateOutcome } from './featureGateLogic';

interface FeatureGateProps {
  requiredTier: Tier;
  feature: string;
  children: ReactNode;
}

export default function FeatureGate({ requiredTier, feature, children }: FeatureGateProps) {
  const accountType = useSubscriptionStore((s) => s.accountType);
  const subscriptionTier = useSubscriptionStore((s) => s.subscriptionTier);
  const subscriptionStatus = useSubscriptionStore((s) => s.subscriptionStatus);

  const outcome = getFeatureGateOutcome({
    accountType,
    subscriptionTier,
    subscriptionStatus,
    requiredTier,
    feature,
  });

  if (outcome.decision === 'allow') {
    return <>{children}</>;
  }

  if (outcome.decision === 'expired') {
    return <SubscriptionExpiredPrompt />;
  }

  return <UpgradePrompt requiredTier={outcome.effectiveRequiredTier} />;
}
