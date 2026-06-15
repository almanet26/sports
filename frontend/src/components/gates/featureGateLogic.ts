import type { AccountType, Tier, SubscriptionStatus, Entitlements } from '../../types/plans';
import { TIER_HIERARCHY } from '../../types/plans';

export type FeatureGateDecision = 'allow' | 'upgrade' | 'expired';

export interface FeatureGateInput {
  accountType: AccountType;
  subscriptionTier: Tier;
  subscriptionStatus: SubscriptionStatus;
  requiredTier: Tier;
  feature: string;
  // Server-resolved entitlements (feature key → granted value). When presentand non-empty, this is authoritative - the feature's value decides access. When empty (not yet loaded), the gate falls back to static tier comparison.
  entitlements?: Entitlements;
}

export interface FeatureGateOutcome {
  decision: FeatureGateDecision;
  effectiveRequiredTier: Tier;
}

function isGranted(value: number | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === -1 || value > 0;
  return false;
}

export function getFeatureGateOutcome({
  accountType,
  subscriptionTier,
  subscriptionStatus,
  requiredTier,
  feature,
  entitlements,
}: FeatureGateInput): FeatureGateOutcome {
  // Admins always pass.
  if (accountType === 'ADMIN') {
    return { decision: 'allow', effectiveRequiredTier: requiredTier };
  }

  const wasPaid = subscriptionTier !== 'bronze' && subscriptionTier !== 'coach_basic';

  // ── Entitlement-driven path (authoritative when loaded) ───────────────────
  if (entitlements && Object.keys(entitlements).length > 0) {
    if (isGranted(entitlements[feature])) {
      return { decision: 'allow', effectiveRequiredTier: requiredTier };
    }
    // Not granted: a lapsed paid plan shows "renew", otherwise "upgrade".
    if (subscriptionStatus !== 'active' && wasPaid) {
      return { decision: 'expired', effectiveRequiredTier: requiredTier };
    }
    return { decision: 'upgrade', effectiveRequiredTier: requiredTier };
  }

  // ── Fallback: static tier comparison (entitlements not yet loaded) ────────
  if (requiredTier === 'bronze') {
    return { decision: 'allow', effectiveRequiredTier: requiredTier };
  }
  if (subscriptionStatus !== 'active' && wasPaid) {
    return { decision: 'expired', effectiveRequiredTier: requiredTier };
  }
  if (TIER_HIERARCHY[subscriptionTier] < TIER_HIERARCHY[requiredTier]) {
    return { decision: 'upgrade', effectiveRequiredTier: requiredTier };
  }
  return { decision: 'allow', effectiveRequiredTier: requiredTier };
}
