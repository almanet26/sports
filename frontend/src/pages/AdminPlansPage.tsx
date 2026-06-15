import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, Settings2, Loader2, AlertTriangle } from 'lucide-react';
import { adminApi } from '../lib/api';
import type { AdminPlan, AdminFeature } from '../types/plans';
import PlanBuilderForm from '../components/admin/PlanBuilderForm';
import FeatureManager from '../components/admin/FeatureManager';

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [features, setFeatures] = useState<AdminFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<AdminPlan | null>(null);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminPlan | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([adminApi.listPlans(), adminApi.listFeatures()]);
      setPlans(p.data);
      setFeatures(f.data);
    } catch {
      showToast('Failed to load plans', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(plan: AdminPlan) {
    try {
      await adminApi.updatePlan(plan.id, { is_active: !plan.is_active });
      await load();
    } catch {
      showToast('Failed to update plan', false);
    }
  }

  function openNew() { setEditPlan(null); setBuilderOpen(true); }
  function openEdit(plan: AdminPlan) { setEditPlan(plan); setBuilderOpen(true); }

  return (
    <div className="text-white">
      {toast && (
        <div className={`fixed top-6 right-6 z-[60] rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Plan Management</h1>
          <p className="mt-1 text-sm text-white/60">Create plans, adjust pricing and quotas, and assign feature entitlements — changes take effect live.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFeaturesOpen(true)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10">
            <Settings2 className="h-4 w-4" /> Manage Features
          </button>
          <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold hover:bg-blue-400">
            <Plus className="h-4 w-4" /> New Plan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Subscribers</th>
                <th className="px-4 py-3">Entitlements</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{plan.display_name}</div>
                    <div className="font-mono text-xs text-white/40">{plan.key}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{plan.user_type}</td>
                  <td className="px-4 py-3">{plan.price_inr === 0 ? 'Free' : rupees(plan.price_inr)}</td>
                  <td className="px-4 py-3 capitalize">{plan.billing_period}</td>
                  <td className="px-4 py-3">
                    <span className={plan.subscriber_count > 0 ? 'font-semibold text-amber-300' : 'text-white/50'}>
                      {plan.subscriber_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60">{plan.entitlements.length}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(plan)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${plan.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-600/30 text-zinc-400'}`}
                    >
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openEdit(plan)} className="rounded-lg p-2 text-blue-400 hover:bg-blue-500/10" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(plan)} className="rounded-lg p-2 text-red-400 hover:bg-red-500/10" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {builderOpen && (
        <PlanBuilderForm
          features={features}
          plan={editPlan}
          onClose={() => setBuilderOpen(false)}
          onSaved={() => { setBuilderOpen(false); showToast('Plan saved', true); load(); }}
        />
      )}

      {featuresOpen && (
        <FeatureManager
          features={features}
          onClose={() => setFeaturesOpen(false)}
          onChanged={() => { showToast('Feature catalog updated', true); load(); }}
        />
      )}

      {deleteTarget && (
        <DeletePlanDialog
          plan={deleteTarget}
          allPlans={plans}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); showToast('Plan deleted', true); load(); }}
          onError={(m) => showToast(m, false)}
        />
      )}
    </div>
  );
}

// ─── Delete dialog with the active-subscriber migration safeguard ─────────────

function DeletePlanDialog({
  plan, allPlans, onClose, onDeleted, onError,
}: {
  plan: AdminPlan;
  allPlans: AdminPlan[];
  onClose: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const hasSubscribers = plan.subscriber_count > 0;
  const migrationTargets = allPlans.filter((p) => p.id !== plan.id && p.user_type === plan.user_type);
  const [migrateTo, setMigrateTo] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (hasSubscribers && migrateTo === '') {
      onError('Choose a plan to migrate subscribers to');
      return;
    }
    setBusy(true);
    try {
      await adminApi.deletePlan(plan.id, hasSubscribers ? Number(migrateTo) : undefined);
      onDeleted();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: { message?: string } | string } } })?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.message ?? 'Delete failed';
      onError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 text-white shadow-2xl">
        <div className="mb-3 flex items-center gap-2 text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-lg font-bold">Delete {plan.display_name}</h2>
        </div>

        {hasSubscribers ? (
          <>
            <p className="text-sm text-white/70">
              This plan has <strong className="text-amber-300">{plan.subscriber_count}</strong> active
              subscriber{plan.subscriber_count === 1 ? '' : 's'}. Choose a plan to migrate them to before deleting.
            </p>
            {migrationTargets.length === 0 ? (
              <p className="mt-3 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">
                No other {plan.user_type} plan exists to migrate subscribers to. Create one first.
              </p>
            ) : (
              <select
                value={migrateTo}
                onChange={(e) => setMigrateTo(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              >
                <option value="">Select migration target…</option>
                {migrationTargets.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name} ({p.key})</option>
                ))}
              </select>
            )}
          </>
        ) : (
          <p className="text-sm text-white/70">This plan has no active subscribers and can be deleted safely.</p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5">Cancel</button>
          <button
            onClick={confirmDelete}
            disabled={busy || (hasSubscribers && migrationTargets.length === 0)}
            className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {hasSubscribers ? 'Migrate & Delete' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
