import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getFeatureGateOutcome } from './featureGateLogic';
import type { AccountType, Tier, SubscriptionStatus } from '../../types/subscriptionPlans';
import FeatureGate from './FeatureGate';

vi.mock('./UpgradePrompt', () => ({
  default: ({ requiredTier }: { requiredTier: string }) => (
    <div data-testid="upgrade-prompt" data-tier={requiredTier} />
  ),
}));
vi.mock('./SubscriptionExpiredPrompt', () => ({
  default: () => <div data-testid="expired-prompt" />,
}));

// Hoisted so the factory function can close over a mutable object, allowing
// per-test state changes without re-importing the module.
const mockAuthState = vi.hoisted(() => ({
  accountType: 'PLAYER' as AccountType,
  subscriptionTier: 'free' as Tier,
  subscriptionStatus: 'inactive' as SubscriptionStatus,
}));

vi.mock('../../stores/authStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSubscriptionStore: (selector: any) => selector(mockAuthState),
}));

// ─── Pure logic ───────────────────────────────────────────────────────────────

describe('getFeatureGateOutcome', () => {
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

  it('allows access when the user tier meets the requirement', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'PLAYER',
      subscriptionTier: 'platinum',
      subscriptionStatus: 'active',
      requiredTier: 'basic',
      feature: 'player_submission',
    });

    expect(outcome.decision).toBe('allow');
  });

  it('returns expired when a formerly paid subscriber has a lapsed status', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'PLAYER',
      subscriptionTier: 'basic',
      subscriptionStatus: 'expired',
      requiredTier: 'basic',
      feature: 'player_submission',
    });

    expect(outcome.decision).toBe('expired');
  });

  it('always allows ADMIN regardless of tier or required tier', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'ADMIN',
      subscriptionTier: 'free',
      subscriptionStatus: 'inactive',
      requiredTier: 'academy',
      feature: 'white_label_reports',
    });

    expect(outcome.decision).toBe('allow');
  });

  it('always allows access when requiredTier is free', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'PLAYER',
      subscriptionTier: 'free',
      subscriptionStatus: 'inactive',
      requiredTier: 'free',
      feature: 'biomechanics_analysis',
    });

    expect(outcome.decision).toBe('allow');
  });
});

// ─── Component (route protection) ────────────────────────────────────────────

describe('FeatureGate component', () => {
  beforeEach(() => {
    mockAuthState.accountType = 'PLAYER';
    mockAuthState.subscriptionTier = 'free';
    mockAuthState.subscriptionStatus = 'inactive';
  });

  it('renders children for an active paid subscriber who meets the required tier', () => {
    mockAuthState.subscriptionTier = 'basic';
    mockAuthState.subscriptionStatus = 'active';

    render(
      <FeatureGate requiredTier="basic" feature="player_submission">
        <div data-testid="premium-content" />
      </FeatureGate>
    );

    expect(screen.getByTestId('premium-content')).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-prompt')).not.toBeInTheDocument();
    expect(screen.queryByTestId('expired-prompt')).not.toBeInTheDocument();
  });

  it('unmounts premium content and shows UpgradePrompt for a free-tier user', () => {
    render(
      <FeatureGate requiredTier="basic" feature="player_submission">
        <div data-testid="premium-content" />
      </FeatureGate>
    );

    expect(screen.queryByTestId('premium-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
  });

  it('shows SubscriptionExpiredPrompt when a formerly paid subscription has lapsed', () => {
    mockAuthState.subscriptionTier = 'basic';
    mockAuthState.subscriptionStatus = 'expired';

    render(
      <FeatureGate requiredTier="basic" feature="player_submission">
        <div data-testid="premium-content" />
      </FeatureGate>
    );

    expect(screen.queryByTestId('premium-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('expired-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-prompt')).not.toBeInTheDocument();
  });

  it('always renders children for ADMIN users regardless of tier', () => {
    mockAuthState.accountType = 'ADMIN';
    mockAuthState.subscriptionTier = 'free';

    render(
      <FeatureGate requiredTier="academy" feature="white_label_reports">
        <div data-testid="admin-content" />
      </FeatureGate>
    );

    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-prompt')).not.toBeInTheDocument();
  });
});
