import { AlertCircle } from 'lucide-react';

interface QuotaExhaustedNoticeProps {
  limit: number;
}

/** Shown instead of UpgradePrompt when the user is already on the top tier of their track — there is no higher plan to upgrade to. */
export default function QuotaExhaustedNotice({ limit }: QuotaExhaustedNoticeProps) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-xl border border-amber-500/30 bg-zinc-900 p-6 text-center shadow-xl">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-400" />
        <h2 className="mt-3 text-lg font-bold text-white">Monthly limit reached</h2>
        <p className="mt-1 text-sm text-zinc-400">
          You've used all {limit} biomechanical analyses included in your plan this month. Your quota resets on the 1st.
        </p>
      </div>
    </div>
  );
}
