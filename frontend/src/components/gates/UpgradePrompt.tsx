import { CheckCircle, Zap } from 'lucide-react';
import { billingApi } from '../../lib/api';
import { PLAN_DISPLAY_CONFIG, type Tier } from '../../types/plans';

interface UpgradePromptProps {
  requiredTier: Tier;
}

export default function UpgradePrompt({ requiredTier }: UpgradePromptProps) {
  const config = PLAN_DISPLAY_CONFIG[requiredTier];

  const priceLabel =
    config.priceInr === 0
      ? 'Free'
      : `₹${config.priceInr.toLocaleString('en-IN')}`;

  const handleUpgrade = async () => {
    try {
      const res = await billingApi.createOrder(config.planKey);
      console.log('[Billing] Order created:', res.data);
      // TODO: Razorpay checkout integration
    } catch (err) {
      console.error('[Billing] Failed to create order:', err);
    }
  };

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
            <span className="text-sm text-zinc-400">/ {config.duration}</span>
          )}
        </div>

        <ul className="mt-4 space-y-2.5">
          {config.topFeatures.map((feat) => (
            <li key={feat} className="flex items-start gap-2 text-sm text-zinc-300">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              {feat}
            </li>
          ))}
        </ul>

        <button
          onClick={handleUpgrade}
          className="mt-6 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold
                     text-zinc-900 transition-colors hover:bg-amber-400 active:bg-amber-600
                     focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
                     focus:ring-offset-zinc-900"
        >
          Upgrade to {config.displayName}
        </button>
      </div>
    </div>
  );
}
