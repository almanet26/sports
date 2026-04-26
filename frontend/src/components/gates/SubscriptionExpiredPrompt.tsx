import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useSubscriptionStore } from '../../stores/authStore';
import { PLAN_DISPLAY_CONFIG } from '../../types/plans';

const DISMISS_KEY = 'sub_expired_dismissed_at';

function wasDismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  return Date.now() - parseInt(raw, 10) < 24 * 60 * 60 * 1000;
}

export default function SubscriptionExpiredPrompt() {
  const navigate = useNavigate();
  const role = useSubscriptionStore((s) => s.role);
  const expiresAt = useSubscriptionStore((s) => s.expiresAt);
  const [dismissed, setDismissed] = useState(wasDismissedRecently);

  if (dismissed) return null;

  const planName = PLAN_DISPLAY_CONFIG[role]?.displayName ?? 'Paid';
  const expiryDisplay = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'an earlier date';

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-xl border border-red-500/30 bg-zinc-900 p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-sm font-semibold text-red-400">Subscription Expired</span>
        </div>

        <p className="mt-3 text-sm text-zinc-300">
          Your{' '}
          <span className="font-semibold text-white">{planName}</span> plan expired on{' '}
          <span className="font-semibold text-white">{expiryDisplay}</span>.
        </p>

        <p className="mt-1 text-xs text-zinc-500">
          Renew to restore full access to premium features.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => navigate('/billing')}
            className="w-full rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold
                       text-white transition-colors hover:bg-red-400 active:bg-red-600
                       focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2
                       focus:ring-offset-zinc-900"
          >
            Renew Plan
          </button>
          <button
            onClick={dismiss}
            className="w-full rounded-lg border border-zinc-700 px-4 py-2.5 text-sm
                       text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-300
                       focus:outline-none"
          >
            Continue with Free
          </button>
        </div>
      </div>
    </div>
  );
}
