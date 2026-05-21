import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminApi } from '../lib/api';

interface PlanRow {
  plan_key: string;
  role: string;
  display_name: string;
  price_inr: number;
  duration_days: number;
  max_biomech_per_month: number;
  max_ocr_hours_per_month: number;
  max_submissions_per_month: number;
  max_players_in_dashboard: number;
}

interface EditState {
  display_name: string;
  price_rupees: string;
  duration_days: string;
  max_biomech_per_month: string;
  max_ocr_hours_per_month: string;
  max_submissions_per_month: string;
  max_players_in_dashboard: string;
}

function toEditState(p: PlanRow): EditState {
  return {
    display_name: p.display_name,
    price_rupees: (p.price_inr / 100).toFixed(0),
    duration_days: String(p.duration_days),
    max_biomech_per_month: String(p.max_biomech_per_month),
    max_ocr_hours_per_month: String(p.max_ocr_hours_per_month),
    max_submissions_per_month: String(p.max_submissions_per_month),
    max_players_in_dashboard: String(p.max_players_in_dashboard),
  };
}

function validateEdit(e: EditState): string | null {
  if (Number(e.price_rupees) < 0) return 'Price cannot be negative';
  if (Number(e.duration_days) < 0) return 'Duration cannot be negative';
  return null;
}

function limitLabel(v: number): string {
  return v === -1 ? '∞' : String(v);
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      const { data } = await adminApi.listPlans();
      setPlans(data);
    } catch {
      showToast('Failed to load plans', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function startEdit(plan: PlanRow) {
    setEditingKey(plan.plan_key);
    setEditState(toEditState(plan));
    setValidationError(null);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditState(null);
    setValidationError(null);
  }

  async function saveEdit(planKey: string) {
    if (!editState) return;
    const err = validateEdit(editState);
    if (err) { setValidationError(err); return; }

    setSaving(true);
    try {
      await adminApi.updatePlan(planKey, {
        display_name: editState.display_name,
        price_inr: Math.round(Number(editState.price_rupees) * 100),
        duration_days: Number(editState.duration_days),
        max_biomech_per_month: Number(editState.max_biomech_per_month),
        max_ocr_hours_per_month: Number(editState.max_ocr_hours_per_month),
        max_submissions_per_month: Number(editState.max_submissions_per_month),
        max_players_in_dashboard: Number(editState.max_players_in_dashboard),
      });
      await fetchPlans();
      cancelEdit();
      showToast('Plan updated successfully', true);
    } catch (err: unknown) {
      const detail =
        typeof err === 'object' && err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : undefined;
      showToast(typeof detail === 'string' ? detail : 'Save failed', false);
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof EditState, hint?: string) {
    if (!editState) return null;
    return (
      <div>
        <label className="block text-xs text-white/50 mb-1">{label}{hint && <span className="text-white/30 ml-1">{hint}</span>}</label>
        <input
          type="number"
          value={editState[key]}
          onChange={(e) => setEditState({ ...editState, [key]: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white"
        />
      </div>
    );
  }

  return (
    <div className="text-white">
      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.ok ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <i className={`fas ${toast.ok ? 'fa-check' : 'fa-times'}`} aria-hidden="true" />
            {toast.msg}
          </span>
        </motion.div>
      )}

      {/* Warning banner */}
      <div className="mb-6 px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-3">
        <i className="fas fa-exclamation-triangle mt-0.5 flex-shrink-0"></i>
        <span>
          <strong>Changes to plan limits take effect immediately</strong> for all users on that plan.
          Existing subscribers are not grandfathered.
        </span>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20"
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-tags text-yellow-400"></i>
          Plan Management
        </h1>
        <p className="text-white/60 mt-1 text-sm">
          Edit plan limits and pricing directly from the platform.
        </p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.plan_key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl border border-white/10 overflow-hidden"
            >
              {/* Plan header row */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-semibold text-white">{plan.display_name}</span>
                    <span className="ml-2 text-xs text-white/40 font-mono">{plan.plan_key}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-mono">
                    {plan.role}
                  </span>
                </div>
                {editingKey !== plan.plan_key ? (
                  <button
                    onClick={() => startEdit(plan)}
                    className="px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium border border-blue-500/30 transition-all"
                  >
                    <i className="fas fa-pencil mr-2"></i>Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(plan.plan_key)}
                      disabled={saving}
                      className="px-4 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium border border-green-500/30 transition-all disabled:opacity-50"
                    >
                      {saving ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-check mr-1"></i>}
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm font-medium border border-white/10 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Read-only summary or edit form */}
              {editingKey !== plan.plan_key ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 px-6 py-4 text-sm">
                  <div>
                    <p className="text-white/40 text-xs mb-1">Price</p>
                    <p className="font-medium">₹{(plan.price_inr / 100).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs mb-1">Duration</p>
                    <p className="font-medium">{plan.duration_days === 0 ? 'Forever' : `${plan.duration_days}d`}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs mb-1">Biomech/mo</p>
                    <p className="font-medium">{limitLabel(plan.max_biomech_per_month)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs mb-1">OCR hrs/mo</p>
                    <p className="font-medium">{limitLabel(plan.max_ocr_hours_per_month)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs mb-1">Submissions/mo</p>
                    <p className="font-medium">{limitLabel(plan.max_submissions_per_month)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs mb-1">Max players</p>
                    <p className="font-medium">{limitLabel(plan.max_players_in_dashboard)}</p>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-5 space-y-4">
                  {validationError && (
                    <p className="text-red-400 text-sm flex items-center gap-2">
                      <i className="fas fa-exclamation-circle"></i> {validationError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-white/50 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={editState!.display_name}
                        onChange={(e) => setEditState({ ...editState!, display_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white"
                      />
                    </div>
                    {field('Price (₹)', 'price_rupees', '— shown in rupees, stored as paise')}
                    {field('Duration (days)', 'duration_days', '— 0 = forever')}
                    {field('Biomech / month', 'max_biomech_per_month', '— −1 = unlimited')}
                    {field('OCR hours / month', 'max_ocr_hours_per_month', '— −1 = unlimited')}
                    {field('Submissions / month', 'max_submissions_per_month', '— −1 = unlimited')}
                    {field('Max players in dashboard', 'max_players_in_dashboard', '— −1 = unlimited')}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
