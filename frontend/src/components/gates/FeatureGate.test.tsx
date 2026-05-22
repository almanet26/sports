import { beforeEach, describe, expect, it } from 'vitest';
import { getFeatureGateOutcome } from './featureGateLogic';

describe('FeatureGate', () => {
  beforeEach(() => {
    // no-op: helper is pure, but keep the hook-shaped test structure explicit
  });

  it('blocks premium access for free-tier users', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'PLAYER',
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      requiredTier: 'basic',
      feature: 'player_submission',
    });

    expect(outcome.decision).toBe('upgrade');
    expect(outcome.effectiveRequiredTier).toBe('basic');
  });
});