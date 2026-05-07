import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api } from '../lib/api';

interface TrainingPlanData {
  id: string;
  title: string;
  description?: string;
  analysis_type: string;
  plan_type: string;
  is_public: boolean;
  drills?: string[];
}

interface TrainingPlanCreate {
  title: string;
  description?: string;
  analysis_type: string;
  plan_type: 'group_all' | 'individual' | 'age_group';
  is_public: boolean;
  drills?: string[];
}

export default function CoachTrainingPlansPage() {
  const { theme } = useThemeStore();
  const [plans, setPlans] = useState<TrainingPlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TrainingPlanCreate>({ title: '', description: '', analysis_type: 'BATTING', plan_type: 'group_all', is_public: true, drills: [] });
  const [drillInput, setDrillInput] = useState('');

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const inputCls = `w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${theme === 'dark' ? 'glass border-white/10 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-400'}`;

  useEffect(() => {
    api.get('/training-plans').then((r: {data: {plans: TrainingPlanData[]}}) => setPlans(r.data.plans)).catch(() => setPlans([])).finally(() => setLoading(false));
  }, []);

  const openCreate = () => { setForm({ title: '', description: '', analysis_type: 'BATTING', plan_type: 'group_all', is_public: true, drills: [] }); setDrillInput(''); setShowModal(true); };

  const addDrill = () => { if (!drillInput.trim()) return; setForm((f: TrainingPlanCreate) => ({ ...f, drills: [...(f.drills || []), drillInput.trim()] })); setDrillInput(''); };
  const removeDrill = (i: number) => setForm((f: TrainingPlanCreate) => ({ ...f, drills: (f.drills || []).filter((_: string, idx: number) => idx !== i) }));

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const r = await api.post('/training-plans', form);
      setPlans((prev: TrainingPlanData[]) => [r.data, ...prev]);
      setShowModal(false);
    } catch { alert('Failed to save plan.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    await api.delete(`/training-plans/${id}`);
    setPlans((prev: TrainingPlanData[]) => prev.filter((p: TrainingPlanData) => p.id !== id));
  };

  const typeColor: Record<string, string> = { BATTING: 'from-blue-500 to-cyan-500', BOWLING: 'from-green-500 to-emerald-500', FIELDING: 'from-orange-500 to-red-500', FITNESS: 'from-purple-500 to-pink-500' };

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><i className="fas fa-clipboard-list text-orange-400"></i>Training Plans</h1>
            <p className={`mt-1 text-sm ${sub}`}>Create and manage training programs for your players</p>
          </div>
          <button onClick={openCreate} className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold hover:opacity-90 flex items-center gap-2">
            <i className="fas fa-plus"></i>New Plan
          </button>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" /></div>
      ) : plans.length === 0 ? (
        <div className={`rounded-3xl border p-16 text-center ${glass}`}>
          <i className={`fas fa-clipboard-list text-5xl mb-4 ${sub}`}></i>
          <p className="font-semibold text-lg mb-1">No training plans yet</p>
          <p className={`text-sm ${sub}`}>Create your first training plan</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border p-5 ${cardBg}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${typeColor[p.analysis_type] || 'from-gray-500 to-gray-600'} flex items-center justify-center flex-shrink-0`}>
                  <i className="fas fa-clipboard-list text-white text-sm"></i>
                </div>
                <div className="flex gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${p.is_public ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                    {p.is_public ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>
              <p className="font-semibold mb-1 truncate">{p.title}</p>
              {p.description && <p className={`text-xs mb-2 line-clamp-2 ${sub}`}>{p.description}</p>}
              <div className={`flex items-center gap-2 text-xs mb-3 ${sub}`}>
                <span className={`px-2 py-0.5 rounded-full bg-gradient-to-r ${typeColor[p.analysis_type] || 'from-gray-500 to-gray-600'} text-white`}>{p.analysis_type}</span>
                <span>{p.plan_type.replace('_', ' ')}</span>
              </div>
              {p.drills && p.drills.length > 0 && (
                <div className="mb-3 space-y-1">
                  {p.drills.slice(0, 3).map((d: string, idx: number) => (
                    <p key={idx} className={`text-xs flex items-center gap-1 ${sub}`}><i className="fas fa-check-circle text-green-400 text-[10px]"></i>{d}</p>
                  ))}
                  {p.drills.length > 3 && <p className={`text-xs ${sub}`}>+{p.drills.length - 3} more</p>}
                </div>
              )}
              <button onClick={() => handleDelete(p.id)} className="w-full py-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                <i className="fas fa-trash-alt mr-1"></i>Delete
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className={`relative w-full max-w-md rounded-3xl border p-6 max-h-[85vh] overflow-y-auto ${theme === 'dark' ? 'glass border-white/20 text-white' : 'bg-white border-gray-200 shadow-2xl text-gray-900'}`}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">New Training Plan</h2>
                <button onClick={() => setShowModal(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><i className="fas fa-times text-sm"></i></button>
              </div>
              <div className="space-y-3">
                <div><label className={`block text-xs mb-1 ${sub}`}>Title *</label><input value={form.title} onChange={e => setForm((f: TrainingPlanCreate) => ({ ...f, title: e.target.value }))} className={inputCls} /></div>
                <div><label className={`block text-xs mb-1 ${sub}`}>Description</label><textarea value={form.description} onChange={e => setForm((f: TrainingPlanCreate) => ({ ...f, description: e.target.value }))} rows={2} className={inputCls + ' resize-none'} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={`block text-xs mb-1 ${sub}`}>Type</label>
                    <select value={form.analysis_type} onChange={e => setForm((f: TrainingPlanCreate) => ({ ...f, analysis_type: e.target.value }))} className={inputCls}>
                      {['BATTING', 'BOWLING', 'FIELDING', 'FITNESS'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className={`block text-xs mb-1 ${sub}`}>Plan For</label>
                    <select value={form.plan_type} onChange={e => setForm((f: TrainingPlanCreate) => ({ ...f, plan_type: e.target.value as TrainingPlanCreate['plan_type'] }))} className={inputCls}>
                      <option value="group_all">All Players</option>
                      <option value="individual">Individual</option>
                      <option value="age_group">Age Group</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>Drills</label>
                  <div className="flex gap-2 mb-2">
                    <input value={drillInput} onChange={e => setDrillInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDrill()} placeholder="Add a drill..." className={inputCls} />
                    <button onClick={addDrill} className="px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm"><i className="fas fa-plus"></i></button>
                  </div>
                  {(form.drills || []).map((d: string, i: number) => (
                    <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg mb-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                      <span className="text-xs">{d}</span>
                      <button onClick={() => removeDrill(i)} className="text-red-400 text-xs ml-2"><i className="fas fa-times"></i></button>
                    </div>
                  ))}
                </div>
                <div className={`flex items-center justify-between p-3 rounded-xl border ${theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-sm font-medium">Public</p>
                  <button onClick={() => setForm((f: TrainingPlanCreate) => ({ ...f, is_public: !f.is_public }))}
                    className={`relative w-11 h-6 rounded-full transition-all ${form.is_public ? 'bg-blue-500' : theme === 'dark' ? 'bg-white/20' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.is_public ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} className={`flex-1 py-2.5 rounded-xl border text-sm font-medium ${theme === 'dark' ? 'glass border-white/20 hover:bg-white/10' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="fas fa-save"></i>}
                  {saving ? 'Saving...' : 'Create Plan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
