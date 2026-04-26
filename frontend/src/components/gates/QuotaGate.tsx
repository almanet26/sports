import type { ReactNode } from 'react';
import { useSubscriptionStore } from '../../stores/authStore';
import type { QuotaUsage } from '../../types/plans';

export interface QuotaProps {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
}

type QuotaKey = keyof QuotaUsage;

const FEATURE_TO_QUOTA: Record<string, QuotaKey | undefined> = {
  biomechanics_analysis: 'biomech',
  ocr_highlights: 'ocr_hours',
  player_submission: 'submissions',
};

function nextMonthFirst(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface QuotaGateProps {
  feature: string;
  children: (props: QuotaProps) => ReactNode;
}

export default function QuotaGate({ feature, children }: QuotaGateProps) {
  const platformRole = useSubscriptionStore((s) => s.user?.platform_role);
  const quotaUsage = useSubscriptionStore((s) => s.quotaUsage);

  // ADMIN sees unlimited quota on all features
  if (platformRole === 'ADMIN') {
    return <>{children({ used: 0, limit: 999999, remaining: 999999, exhausted: false })}</>;
  }

  const quotaKey = FEATURE_TO_QUOTA[feature];

  let qp: QuotaProps;

  if (!quotaKey) {
    qp = { used: 0, limit: Infinity, remaining: Infinity, exhausted: false };
  } else {
    const { used, limit } = quotaUsage[quotaKey];
    const remaining = Math.max(0, limit - used);
    qp = { used, limit, remaining, exhausted: limit > 0 && remaining <= 0 };
  }

  if (!qp.exhausted) {
    return <>{children(qp)}</>;
  }

  return (
    <span className="relative inline-block group">
      <span className="pointer-events-none select-none opacity-40">{children(qp)}</span>
      <span
        role="tooltip"
        className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap
                   rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs
                   text-zinc-200 shadow-lg opacity-0 transition-opacity group-hover:opacity-100
                   pointer-events-none"
      >
        Monthly limit reached. Resets on {nextMonthFirst()}.
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
      </span>
    </span>
  );
}
