import { useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { adminApi } from '../../lib/api';
import type { AdminFeature } from '../../types/plans';

interface FeatureManagerProps {
  features: AdminFeature[];
  onClose: () => void;
  onChanged: () => void;
}

export default function FeatureManager({ features, onClose, onChanged }: FeatureManagerProps) {
  const [key, setKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState<'boolean' | 'numeric'>('boolean');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createFeature() {
    if (!/^[a-z0-9_]+$/.test(key.trim())) { setError('Key must be a lowercase slug (a-z, 0-9, _)'); return; }
    if (!displayName.trim()) { setError('Display name is required'); return; }
    setError(null);
    setBusy(true);
    try {
      await adminApi.createFeature({ key: key.trim().toLowerCase(), display_name: displayName, type, description: description || undefined });
      setKey(''); setDisplayName(''); setDescription(''); setType('boolean');
      onChanged();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteFeature(f: AdminFeature) {
    if (!window.confirm(`Delete feature "${f.display_name}"? This removes it from every plan.`)) return;
    setBusy(true);
    try {
      await adminApi.deleteFeature(f.id);
      onChanged();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-6 text-white shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">Feature Catalog</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>

        {error && <p className="mb-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>}

        {/* Create form */}
        <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white/80">New feature</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key (e.g. ai_chat)" className={inputCls} />
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className={inputCls} />
            <select value={type} onChange={(e) => setType(e.target.value as 'boolean' | 'numeric')} className={inputCls}>
              <option value="boolean">Boolean (on/off)</option>
              <option value="numeric">Numeric (quota)</option>
            </select>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className={inputCls} />
          </div>
          <button
            onClick={createFeature}
            disabled={busy}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add feature
          </button>
        </div>

        {/* Feature list */}
        <div className="space-y-2">
          {features.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div>
                <span className="text-sm font-medium">{f.display_name}</span>
                <span className="ml-2 font-mono text-xs text-white/40">{f.key}</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${f.type === 'numeric' ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {f.type}
                </span>
              </div>
              <button onClick={() => deleteFeature(f)} className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none';
