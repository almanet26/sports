import { useMemo, useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { adminApi } from '../../lib/api';
import type { AdminFeature, AdminPlan, EntitlementInput } from '../../types/plans';

interface EntitlementRow {
  feature_id: number;
  value: string;
}

interface PlanBuilderFormProps {
  features: AdminFeature[];
  plan?: AdminPlan | null; // present → edit mode
  onClose: () => void;
  onSaved: () => void;
}

export default function PlanBuilderForm({ features, plan, onClose, onSaved }: PlanBuilderFormProps) {
  const isEdit = !!plan;

  const [key, setKey] = useState(plan?.key ?? '');
  const [displayName, setDisplayName] = useState(plan?.display_name ?? '');
  const [userType, setUserType] = useState<'player' | 'coach'>(plan?.user_type ?? 'player');
  const [priceRupees, setPriceRupees] = useState(plan ? String(plan.price_inr / 100) : '0');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>(plan?.billing_period ?? 'monthly');
  const [sortOrder, setSortOrder] = useState(String(plan?.sort_order ?? 0));
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);
  const [rows, setRows] = useState<EntitlementRow[]>(
    plan ? plan.entitlements.map((e) => ({ feature_id: e.feature_id, value: e.value })) : [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const featureById = useMemo(() => {
    const m = new Map<number, AdminFeature>();
    features.forEach((f) => m.set(f.id, f));
    return m;
  }, [features]);

  const usedFeatureIds = new Set(rows.map((r) => r.feature_id));
  const availableFeatures = features.filter((f) => !usedFeatureIds.has(f.id));

  function addRow() {
    const next = availableFeatures[0];
    if (!next) return;
    setRows([...rows, { feature_id: next.id, value: next.type === 'boolean' ? 'true' : '0' }]);
  }

  function removeRow(featureId: number) {
    setRows(rows.filter((r) => r.feature_id !== featureId));
  }

  function setRowFeature(index: number, newFeatureId: number) {
    const f = featureById.get(newFeatureId);
    const copy = [...rows];
    copy[index] = { feature_id: newFeatureId, value: f?.type === 'boolean' ? 'true' : '0' };
    setRows(copy);
  }

  function setRowValue(index: number, value: string) {
    const copy = [...rows];
    copy[index] = { ...copy[index], value };
    setRows(copy);
  }

  function validate(): string | null {
    if (!displayName.trim()) return 'Display name is required';
    if (!isEdit && !/^[a-z0-9_]+$/.test(key.trim())) return 'Key must be a lowercase slug (a-z, 0-9, _)';
    if (Number(priceRupees) < 0) return 'Price cannot be negative';
    const ids = rows.map((r) => r.feature_id);
    if (new Set(ids).size !== ids.length) return 'Duplicate features in entitlements';
    for (const r of rows) {
      const f = featureById.get(r.feature_id);
      if (f?.type === 'numeric' && r.value.trim() !== '' && Number.isNaN(Number(r.value))) {
        return `Entitlement for ${f.display_name} must be a number`;
      }
    }
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSaving(true);

    const entitlements: EntitlementInput[] = rows.map((r) => ({ feature_id: r.feature_id, value: r.value }));
    const priceInr = Math.round(Number(priceRupees) * 100);

    try {
      if (isEdit && plan) {
        await adminApi.updatePlan(plan.id, {
          display_name: displayName,
          price_inr: priceInr,
          billing_period: billingPeriod,
          sort_order: Number(sortOrder),
          is_active: isActive,
        });
        await adminApi.setPlanEntitlements(plan.id, entitlements);
      } else {
        await adminApi.createPlan({
          key: key.trim().toLowerCase(),
          display_name: displayName,
          user_type: userType,
          price_inr: priceInr,
          billing_period: billingPeriod,
          sort_order: Number(sortOrder),
          is_active: isActive,
          entitlements,
        });
      }
      onSaved();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-6 text-white shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isEdit ? `Edit ${plan?.display_name}` : 'New Plan'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>

        {error && <p className="mb-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Display Name">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} />
          </Field>
          <Field label={isEdit ? 'Key (immutable)' : 'Key (slug)'}>
            <input
              value={key}
              disabled={isEdit}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. diamond"
              className={`${inputCls} ${isEdit ? 'opacity-50' : ''}`}
            />
          </Field>
          <Field label="Audience">
            <select
              value={userType}
              disabled={isEdit}
              onChange={(e) => setUserType(e.target.value as 'player' | 'coach')}
              className={`${inputCls} ${isEdit ? 'opacity-50' : ''}`}
            >
              <option value="player">Player</option>
              <option value="coach">Coach</option>
            </select>
          </Field>
          <Field label="Billing Period">
            <select value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value as 'monthly' | 'annual')} className={inputCls}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </Field>
          <Field label="Price (₹)">
            <input type="number" min={0} value={priceRupees} onChange={(e) => setPriceRupees(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Sort Order">
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
          Active (visible to users)
        </label>

        {/* Entitlements */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/80">Entitlements</h3>
            <button
              onClick={addRow}
              disabled={availableFeatures.length === 0}
              className="flex items-center gap-1 rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/30 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Add feature
            </button>
          </div>

          {rows.length === 0 && <p className="text-xs text-white/40">No entitlements yet. Add features this plan should grant.</p>}

          <div className="space-y-2">
            {rows.map((row, i) => {
              const feature = featureById.get(row.feature_id);
              return (
                <div key={row.feature_id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                  <select
                    value={row.feature_id}
                    onChange={(e) => setRowFeature(i, Number(e.target.value))}
                    className="flex-1 rounded-md bg-zinc-800 px-2 py-1.5 text-sm"
                  >
                    {/* Current feature + others not yet used */}
                    {feature && <option value={feature.id}>{feature.display_name} ({feature.type})</option>}
                    {availableFeatures.map((f) => (
                      <option key={f.id} value={f.id}>{f.display_name} ({f.type})</option>
                    ))}
                  </select>

                  {feature?.type === 'boolean' ? (
                    <label className="flex items-center gap-1.5 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={row.value === 'true'}
                        onChange={(e) => setRowValue(i, e.target.checked ? 'true' : 'false')}
                        className="h-4 w-4"
                      />
                      Enabled
                    </label>
                  ) : (
                    <input
                      type="number"
                      value={row.value}
                      onChange={(e) => setRowValue(i, e.target.value)}
                      title="-1 = unlimited, 0 = none"
                      className="w-28 rounded-md bg-zinc-800 px-2 py-1.5 text-sm"
                      placeholder="limit"
                    />
                  )}

                  <button onClick={() => removeRow(row.feature_id)} className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-white/30">Numeric limits: −1 = unlimited, 0 = none.</p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-white/50">{label}</label>
      {children}
    </div>
  );
}
