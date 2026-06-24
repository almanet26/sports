import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { useSubscriptionStore } from '../stores/authStore';
import {
  PLAN_CUMULATIVE_FEATURES,
  PLAN_DISPLAY_CONFIG,
  PLANS_FULL_CONFIG,
  TIER_HIERARCHY,
  type PlanConfig,
  type SubscriptionStatus,
} from '../types/plans';
import { startPlanCheckout } from '../lib/razorpayCheckout';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const styles: Record<SubscriptionStatus, { label: string; cls: string }> = {
    active:   { label: 'Active',   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    inactive: { label: 'Inactive', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
    past_due: { label: 'Past Due', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    expired:  { label: 'Expired',  cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
  };
  const { label, cls } = styles[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  if (limit === 0) return null;

  const unlimited = limit < 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const warn = pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className={`font-mono text-xs ${warn ? 'text-amber-400' : 'text-zinc-400'}`}>
          {unlimited ? `${used} / ∞` : `${used} / ${limit} used`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        {unlimited ? (
          <div className="h-full w-full rounded-full bg-emerald-500/30" />
        ) : (
          <div
            style={{ width: `${pct}%` }}
            className={`h-full rounded-full transition-all duration-500 ${warn ? 'bg-amber-500' : 'bg-emerald-500'}`}
          />
        )}
      </div>
    </div>
  );
}

// ─── Comparison table helpers ─────────────────────────────────────────────────

function fmt(n: number, zero = '—'): string {
  if (n < 0) return '∞';
  if (n === 0) return zero;
  return String(n);
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const navigate = useNavigate();
  const subscriptionTier = useSubscriptionStore((s) => s.subscriptionTier);
  const accountType      = useSubscriptionStore((s) => s.accountType);
  const subscriptionStatus = useSubscriptionStore((s) => s.subscriptionStatus);
  const expiresAt        = useSubscriptionStore((s) => s.expiresAt);
  const quotaUsage       = useSubscriptionStore((s) => s.quotaUsage);
  const fetchMe          = useSubscriptionStore((s) => s.fetchMe);
  const user             = useSubscriptionStore((s) => s.user);
  const [now] = useState(() => Date.now());

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const safeQuotaUsage = quotaUsage && typeof quotaUsage === 'object' && 'biomech' in quotaUsage
    ? quotaUsage
    : {
        biomech: { used: 0, limit: 0 },
        ocr_hours: { used: 0, limit: 0 },
        submissions: { used: 0, limit: 0 },
      };

  const isAdmin      = accountType === 'ADMIN';
  // Filter plans by account_type declared in PLAN_DISPLAY_CONFIG.
  // Admins see all plans with an informational note instead of upgrade CTAs.
  const visiblePlans = PLANS_FULL_CONFIG.filter(
    (p) => isAdmin || PLAN_DISPLAY_CONFIG[p.role].account_type === accountType,
  );
  const colCount     = visiblePlans.length + 1; // +1 for the label column

  const planDisplay  = PLAN_DISPLAY_CONFIG[subscriptionTier];
  const isPlayerTier = accountType === 'PLAYER';
  const isForeverTier = subscriptionTier === 'bronze' || subscriptionTier === 'coach_basic';

  const daysRemaining = !isForeverTier && expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000))
    : null;

  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);
  const [upgradingKey, setUpgradingKey] = useState<string | null>(null);

  const handleUpgrade = async (plan: PlanConfig) => {
    setNotice(null);
    setUpgradingKey(plan.plan_key);
    await startPlanCheckout({
      planKey: plan.plan_key,
      isFree: plan.price_inr === 0,
      displayName: plan.display_name,
      userEmail: user?.email,
      onSuccess: async () => {
        await fetchMe();
        setNotice({ msg: `${plan.display_name} is now active.`, ok: true });
        setUpgradingKey(null);
      },
      onError: (msg) => {
        setNotice({ msg, ok: false });
        setUpgradingKey(null);
      },
      onDismiss: () => setUpgradingKey(null),
    });
  };

  // ── Comparison table row definitions
  type Row = { label: string; render: (p: PlanConfig) => ReactNode };
  const rows: Row[] = [
    {
      label: 'Price',
      render: (p) =>
        p.price_inr === 0 ? 'Free' : `₹${p.price_inr.toLocaleString('en-IN')}`,
    },
    {
      label: 'Duration',
      render: (p) => (p.duration_days === 0 ? 'Forever' : `${p.duration_days} days`),
    },
    {
      label: 'Biomech / mo',
      render: (p) => fmt(p.max_biomech_per_month, '3'),
    },
    {
      label: 'OCR hours / mo',
      render: (p) => fmt(p.max_ocr_hours_per_month),
    },
    {
      label: 'Submissions / mo',
      render: (p) => fmt(p.max_submissions_per_month),
    },
    {
      label: 'Max players',
      render: (p) => fmt(p.max_players_in_dashboard),
    },
    {
      label: 'Key features',
      render: (p) => (
        <ul className="space-y-1 text-left">
          {PLAN_CUMULATIVE_FEATURES[p.role].map((f) => (
            <li key={f} className="flex items-start gap-1">
              <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
              <span className="text-xs text-zinc-300">{f}</span>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-2xl font-bold text-white">Billing &amp; Plans</h1>

      {notice && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {notice.msg}
        </div>
      )}

      {/* ── Current plan card ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Current Plan
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{planDisplay.displayName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={subscriptionStatus} />
              {!isForeverTier && expiresAt && (
                <span className="text-xs text-zinc-500">
                  Expires{' '}
                  {new Date(expiresAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>

          {daysRemaining !== null && (
            <div
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${
                daysRemaining < 14
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {daysRemaining < 14 && <AlertCircle className="h-4 w-4" />}
              {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expired'}
            </div>
          )}
        </div>
      </div>

      {/* ── Usage bars ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-300">Monthly Usage</h3>
        </div>
        <UsageBar
          label="Biomech analyses"
          used={safeQuotaUsage.biomech.used}
          limit={safeQuotaUsage.biomech.limit}
        />
        {!isPlayerTier && (
          <>
            <UsageBar
              label="OCR match hours"
              used={safeQuotaUsage.ocr_hours.used}
              limit={safeQuotaUsage.ocr_hours.limit}
            />
            <UsageBar
              label="Player submissions"
              used={safeQuotaUsage.submissions.used}
              limit={safeQuotaUsage.submissions.limit}
            />
          </>
        )}
      </div>

      {/* ── Plan comparison table ────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-x-auto">
        <div className="min-w-[560px]">

          {/* Header row */}
          <div className={`grid border-b border-zinc-700`} style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
            <div className="p-4" />
            {visiblePlans.map((plan) => {
              const isCurrent = plan.role === subscriptionTier;
              return (
                <div
                  key={plan.role}
                  className={`p-4 text-center ${
                    isCurrent ? 'border-x border-t border-amber-500/40 bg-amber-500/5' : ''
                  }`}
                >
                  <p className="text-sm font-bold text-white">{plan.display_name}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {plan.price_inr === 0
                      ? 'Free'
                      : `₹${plan.price_inr.toLocaleString('en-IN')}`}
                  </p>
                  {isCurrent && (
                    <span className="mt-1 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                      Current
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Data rows */}
          {rows.map(({ label, render }) => (
            <div key={label} className="grid border-b border-zinc-800 last:border-0" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
              <div className="p-4 text-xs text-zinc-500 flex items-start pt-5">{label}</div>
              {visiblePlans.map((plan) => {
                const isCurrent = plan.role === subscriptionTier;
                return (
                  <div
                    key={plan.role}
                    className={`p-4 text-center text-sm ${
                      isCurrent
                        ? 'border-x border-amber-500/20 bg-amber-500/5 font-semibold text-white'
                        : 'text-zinc-400'
                    }`}
                  >
                    {render(plan)}
                  </div>
                );
              })}
            </div>
          ))}

          {/* CTA row */}
          <div className="grid border-t border-zinc-700 bg-zinc-950/60" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
            <div className="p-4" />
            {visiblePlans.map((plan) => {
              const isCurrent = plan.role === subscriptionTier;
              const isHigher  = TIER_HIERARCHY[plan.role] > TIER_HIERARCHY[subscriptionTier];

              return (
                <div
                  key={plan.role}
                  className={`p-4 text-center ${
                    isCurrent ? 'border-x border-b border-amber-500/20 bg-amber-500/5' : ''
                  }`}
                >
                  {isCurrent ? (
                    <span className="text-xs text-zinc-500">Your plan</span>
                  ) : isHigher ? (
                    <button
                      onClick={() => handleUpgrade(plan)}
                      disabled={upgradingKey === plan.plan_key}
                      className="flex w-full items-center justify-center gap-1 rounded-lg
                                 bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-900
                                 transition-colors hover:bg-amber-400 disabled:opacity-60"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {upgradingKey === plan.plan_key ? 'Processing…' : 'Upgrade'}
                    </button>
                  ) : (
                    <button
                      disabled
                      onClick={() => navigate('/billing')}
                      className="w-full rounded-lg border border-zinc-800 px-3 py-2
                                 text-xs text-zinc-600 cursor-not-allowed"
                    >
                      Downgrade
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
