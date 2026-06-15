import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getFeatureGateOutcome } from './featureGateLogic';
import type { AccountType, Tier, SubscriptionStatus, Entitlements } from '../../types/subscriptionPlans';
import FeatureGate from './FeatureGate';

vi.mock('./UpgradePrompt', () => ({
  default: ({ requiredTier }: { requiredTier: string }) => (
    <div data-testid="upgrade-prompt" data-tier={requiredTier} />
  ),
}));
vi.mock('./SubscriptionExpiredPrompt', () => ({
  default: () => <div data-testid="expired-prompt" />,
}));

const mockAuthState = vi.hoisted(() => ({
  accountType: 'PLAYER' as AccountType,
  subscriptionTier: 'bronze' as Tier,
  subscriptionStatus: 'inactive' as SubscriptionStatus,
  entitlements: {} as Entitlements,
}));

vi.mock('../../stores/authStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSubscriptionStore: (selector: any) => selector(mockAuthState),
}));

// ─── Pure logic (entitlement-driven) ──────────────────────────────────────────

describe('getFeatureGateOutcome', () => {
  it('allows when the entitlement grants the feature (boolean true)', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'PLAYER',
      subscriptionTier: 'silver',
      subscriptionStatus: 'active',
      requiredTier: 'silver',
      feature: 'pdf_report',
      entitlements: { pdf_report: true },
    });
    expect(outcome.decision).toBe('allow');
  });

  it('upgrades when the feature is absent from the entitlement map', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'PLAYER',
      subscriptionTier: 'bronze',
      subscriptionStatus: 'active',
      requiredTier: 'silver',
      feature: 'pdf_report',
      entitlements: { biomechanics_analysis: 3 },
    });
    expect(outcome.decision).toBe('upgrade');
  });

  it('upgrades when a numeric entitlement is zero', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'PLAYER',
      subscriptionTier: 'bronze',
      subscriptionStatus: 'active',
      requiredTier: 'silver',
      feature: 'player_submission',
      entitlements: { player_submission: 0 },
    });
    expect(outcome.decision).toBe('upgrade');
  });

  it('allows when a numeric entitlement is unlimited (-1) or positive', () => {
    expect(getFeatureGateOutcome({
      accountType: 'PLAYER', subscriptionTier: 'gold', subscriptionStatus: 'active',
      requiredTier: 'gold', feature: 'player_submission', entitlements: { player_submission: -1 },
    }).decision).toBe('allow');
    expect(getFeatureGateOutcome({
      accountType: 'PLAYER', subscriptionTier: 'bronze', subscriptionStatus: 'active',
      requiredTier: 'bronze', feature: 'biomechanics_analysis', entitlements: { biomechanics_analysis: 3 },
    }).decision).toBe('allow');
  });

  it('returns expired when a formerly paid subscriber has lapsed and lost the feature', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'PLAYER',
      subscriptionTier: 'silver',
      subscriptionStatus: 'expired',
      requiredTier: 'silver',
      feature: 'pdf_report',
      entitlements: { biomechanics_analysis: 3 }, // fell back to bronze grants
    });
    expect(outcome.decision).toBe('expired');
  });

  it('always allows ADMIN regardless of entitlements', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'ADMIN',
      subscriptionTier: 'bronze',
      subscriptionStatus: 'inactive',
      requiredTier: 'coach_platinum',
      feature: 'white_label_reports',
      entitlements: {},
    });
    expect(outcome.decision).toBe('allow');
  });

  it('falls back to tier comparison when entitlements are not loaded', () => {
    const outcome = getFeatureGateOutcome({
      accountType: 'PLAYER',
      subscriptionTier: 'bronze',
      subscriptionStatus: 'inactive',
      requiredTier: 'bronze',
      feature: 'biomechanics_analysis',
      entitlements: {},
    });
    expect(outcome.decision).toBe('allow');
  });
});

// ─── Component (route protection) ────────────────────────────────────────────

describe('FeatureGate component', () => {
  beforeEach(() => {
    mockAuthState.accountType = 'PLAYER';
    mockAuthState.subscriptionTier = 'bronze';
    mockAuthState.subscriptionStatus = 'inactive';
    mockAuthState.entitlements = {};
  });

  it('renders children when the entitlement grants the feature', () => {
    mockAuthState.subscriptionTier = 'silver';
    mockAuthState.subscriptionStatus = 'active';
    mockAuthState.entitlements = { pdf_report: true };

    render(
      <FeatureGate requiredTier="silver" feature="pdf_report">
        <div data-testid="premium-content" />
      </FeatureGate>
    );

    expect(screen.getByTestId('premium-content')).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-prompt')).not.toBeInTheDocument();
  });

  it('shows UpgradePrompt when the feature is not entitled', () => {
    mockAuthState.subscriptionStatus = 'active';
    mockAuthState.entitlements = { biomechanics_analysis: 3 };

    render(
      <FeatureGate requiredTier="silver" feature="pdf_report">
        <div data-testid="premium-content" />
      </FeatureGate>
    );

    expect(screen.queryByTestId('premium-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
  });

  it('shows SubscriptionExpiredPrompt when a formerly paid subscription has lapsed', () => {
    mockAuthState.subscriptionTier = 'silver';
    mockAuthState.subscriptionStatus = 'expired';
    mockAuthState.entitlements = { biomechanics_analysis: 3 };

    render(
      <FeatureGate requiredTier="silver" feature="pdf_report">
        <div data-testid="premium-content" />
      </FeatureGate>
    );

    expect(screen.queryByTestId('premium-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('expired-prompt')).toBeInTheDocument();
  });

  it('always renders children for ADMIN users', () => {
    mockAuthState.accountType = 'ADMIN';

    render(
      <FeatureGate requiredTier="coach_platinum" feature="white_label_reports">
        <div data-testid="admin-content" />
      </FeatureGate>
    );

    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
  });
});
