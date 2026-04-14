import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { plansApi } from '../lib/api';

interface Plan {
  id: number;
  name: string;
  monthly_price: number;
  yearly_price: number;
  features: string;
}

const EMPTY_FORM = { name: '', monthly_price: '', yearly_price: '', features: '' };

function getPlanStyle(index: number) {
  const styles = [
    { gradient: 'from-blue-500 to-cyan-500', icon: 'fa-bolt' },
    { gradient: 'from-purple-500 to-pink-500', icon: 'fa-crown' },
    { gradient: 'from-yellow-500 to-orange-500', icon: 'fa-gem' },
    { gradient: 'from-green-500 to-emerald-500', icon: 'fa-shield-alt' },
  ];
  return styles[index % styles.length];
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPlans = () => plansApi.list().then((res: any) => setPlans(res.data || []));

  useEffect(() => { fetchPlans(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.monthly_price || !form.yearly_price || !form.features.trim()) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await plansApi.create({
        name: form.name,
        monthly_price: Number(form.monthly_price),
        yearly_price: Number(form.yearly_price),
        features: form.features,
      });
      setForm(EMPTY_FORM);
      fetchPlans();
    } catch { setError('Failed to create plan.'); }
    finally { setSaving(false); }
  };

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditForm({
      name: plan.name,
      monthly_price: String(plan.monthly_price),
      yearly_price: String(plan.yearly_price),
      features: plan.features,
    });
  };

  const handleUpdate = async (id: number) => {
    setSaving(true);
    try {
      await plansApi.update(id, {
        name: editForm.name,
        monthly_price: Number(editForm.monthly_price),
        yearly_price: Number(editForm.yearly_price),
        features: editForm.features,
      });
      setEditingId(null);
      fetchPlans();
    } catch { setError('Failed to update plan.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this plan?')) return;
    await plansApi.delete(id);
    fetchPlans();
  };

  const parseFeatures = (f: string) => f.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <div className="text-white max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20">
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-crown text-yellow-400"></i>
          Subscription Plans
        </h1>
        <p className="text-white/60 mt-1 text-sm">Create and manage subscription tiers shown to players</p>
      </motion.div>

      {/* Create form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-plus-circle text-green-400"></i>
          Create New Plan
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Plan Name</label>
            <input
              placeholder="e.g. Gold"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Monthly Price (₹)</label>
            <input
              type="number" min="0"
              placeholder="e.g. 299"
              value={form.monthly_price}
              onChange={e => setForm({ ...form, monthly_price: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Yearly Price (₹)</label>
            <input
              type="number" min="0"
              placeholder="e.g. 2999"
              value={form.yearly_price}
              onChange={e => setForm({ ...form, yearly_price: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Features (comma-separated)</label>
            <input
              placeholder="e.g. HD Videos, Analytics, ..."
              value={form.features}
              onChange={e => setForm({ ...form, features: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Feature preview */}
        {form.features && (
          <div className="mb-4 flex flex-wrap gap-2">
            {parseFeatures(form.features).map((f, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">
                <i className="fas fa-check mr-1"></i>{f}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <i className="fas fa-plus"></i>}
          Create Plan
        </button>
      </motion.div>

      {/* Plans list */}
      {plans.length === 0 ? (
        <div className="glass rounded-3xl p-16 border border-white/20 text-center">
          <i className="fas fa-inbox text-5xl text-white/20 mb-4"></i>
          <p className="text-white/60">No plans yet — create your first one above</p>
        </div>
      ) : (
        <div className={`grid gap-6 ${plans.length === 1 ? 'max-w-sm' : plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {plans.map((plan, index) => {
            const style = getPlanStyle(index);
            const isEditing = editingId === plan.id;

            return (
              <motion.div key={plan.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-3xl p-6 border border-white/20 hover:border-white/30 transition-all flex flex-col"
              >
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="space-y-3 flex-1">
                      <p className="text-sm font-semibold text-white/60 mb-2">Editing Plan</p>
                      {[
                        { label: 'Name', key: 'name', type: 'text' },
                        { label: 'Monthly Price (₹)', key: 'monthly_price', type: 'number' },
                        { label: 'Yearly Price (₹)', key: 'yearly_price', type: 'number' },
                        { label: 'Features (comma-separated)', key: 'features', type: 'text' },
                      ].map(({ label, key, type }) => (
                        <div key={key}>
                          <label className="block text-xs text-white/40 mb-1">{label}</label>
                          <input
                            type={type}
                            value={editForm[key as keyof typeof editForm]}
                            onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-sm transition-colors"
                          />
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => handleUpdate(plan.id)} disabled={saving}
                          className="flex-1 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-sm font-semibold disabled:opacity-50">
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="flex-1 py-2 rounded-xl glass border border-white/20 text-sm">
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex flex-col flex-1">
                      {/* Plan header */}
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold gradient-text">{plan.name}</h3>
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${style.gradient} flex items-center justify-center`}>
                          <i className={`fas ${style.icon} text-white`}></i>
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between glass rounded-xl px-4 py-2 border border-white/10">
                          <span className="text-sm text-white/60">Monthly</span>
                          <span className="font-bold text-green-400">₹{plan.monthly_price}</span>
                        </div>
                        <div className="flex items-center justify-between glass rounded-xl px-4 py-2 border border-white/10">
                          <span className="text-sm text-white/60">Yearly</span>
                          <span className="font-bold text-blue-400">₹{plan.yearly_price}</span>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="flex-1 mb-6">
                        <p className="text-xs text-white/40 mb-2">Features</p>
                        <ul className="space-y-1">
                          {parseFeatures(plan.features).map((f, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                              <i className="fas fa-check-circle text-green-400 text-xs flex-shrink-0"></i>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <button onClick={() => startEdit(plan)}
                          className="flex-1 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                          <i className="fas fa-edit"></i>Edit
                        </button>
                        <button onClick={() => handleDelete(plan.id)}
                          className="flex-1 py-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                          <i className="fas fa-trash"></i>Delete
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
