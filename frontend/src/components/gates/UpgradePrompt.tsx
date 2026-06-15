import { useState } from 'react';
import { CheckCircle, Zap, Loader2 } from 'lucide-react';
import { billingApi } from '../../lib/api';
import { PLAN_CUMULATIVE_FEATURES, PLAN_DISPLAY_CONFIG, getUpgradeFeatureDelta } from '../../types/plans';
import type { Tier } from '../../types/plans';
import { useSubscriptionStore } from '../../stores/authStore';

// Razorpay checkout.js is loaded via index.html <script> tag.
// Declare the global so TypeScript is happy.
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

interface UpgradePromptProps {
  requiredTier: Tier;
}

export default function UpgradePrompt({ requiredTier }: UpgradePromptProps) {
  const config = PLAN_DISPLAY_CONFIG[requiredTier];
  const currentTier = useSubscriptionStore((s) => s.subscriptionTier);
  const user = useSubscriptionStore((s) => s.user);
  const fetchMe = useSubscriptionStore((s) => s.fetchMe);
  const deltaFeatures = getUpgradeFeatureDelta(currentTier, requiredTier);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const priceLabel =
    config.priceInr === 0
      ? 'Free'
      : `₹${config.priceInr.toLocaleString('en-IN')}`;

  const handleUpgrade = async () => {
    setError(null);

    // Free plan — direct subscribe without payment
    if (config.priceInr === 0) {
      setLoading(true);
      try {
        const { subscriptionApi } = await import('../../lib/api');
        await subscriptionApi.subscribe(config.planKey);
        await fetchMe();
        setSuccess(true);
      } catch {
        setError('Could not activate free plan. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const { data: order } = await billingApi.createOrder(config.planKey);

      if (!window.Razorpay) {
        setError('Payment system is unavailable. Please refresh and try again.');
        return;
      }

      const rzp = new window.Razorpay({
        key: order.razorpay_key,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: 'PitchVision',
        description: `${config.displayName} Subscription`,
        prefill: { email: user?.email ?? '' },
        theme: { color: '#F59E0B' },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await billingApi.verifyPayment({
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              plan_key: config.planKey,
            });
            await fetchMe();
            setSuccess(true);
          } catch {
            setError('Payment succeeded but activation failed. Contact support with your payment ID: ' + response.razorpay_payment_id);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rzp.open();
    } catch {
      setError('Could not initiate payment. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm rounded-xl border border-emerald-500/30 bg-zinc-900 p-6 text-center shadow-xl">
          <CheckCircle className="mx-auto h-10 w-10 text-emerald-400" />
          <h2 className="mt-3 text-xl font-bold text-white">You're upgraded!</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {config.displayName} is now active. Enjoy your new features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-xl border border-amber-500/30 bg-zinc-900 p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            Upgrade Required
          </span>
        </div>

        <h2 className="mt-3 text-xl font-bold text-white">{config.displayName}</h2>

        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold text-white">{priceLabel}</span>
          {config.priceInr > 0 && (
            <span className="text-sm text-zinc-400">/ {config.billingCycle}</span>
          )}
        </div>

        <ul className="mt-4 space-y-2.5">
          {(deltaFeatures.length > 0 ? deltaFeatures : PLAN_CUMULATIVE_FEATURES[requiredTier]).map(
            (feat) => (
              <li key={feat} className="flex items-start gap-2 text-sm text-zinc-300">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {feat}
              </li>
            ),
          )}
        </ul>

        {error && (
          <p className="mt-3 rounded-md bg-red-950 px-3 py-2 text-xs text-red-300">{error}</p>
        )}

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500
                     px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors
                     hover:bg-amber-400 active:bg-amber-600 disabled:cursor-not-allowed
                     disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-400
                     focus:ring-offset-2 focus:ring-offset-zinc-900"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Processing…' : `Upgrade to ${config.displayName}`}
        </button>
      </div>
    </div>
  );
}
