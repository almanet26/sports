import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api } from '../lib/api';

interface TrainingSession {
  id: string;
  topic: string;
  description?: string;
  prerequisites?: string;
  session_date: string;
  session_time: string;
  duration_minutes: string;
  session_type: string;
}

export default function CoachSessionsPage() {
  const { theme } = useThemeStore();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TrainingSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ topic: '', description: '', prerequisites: '', session_date: '', session_time: '', duration_minutes: '60', session_type: 'virtual' as 'virtual' | 'in_person' });

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const inputCls = `w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${theme === 'dark' ? 'glass border-white/10 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-400'}`;

  useEffect(() => {
    api.get('/sessions/').then((r: {data: {sessions: TrainingSession[]}}) => setSessions(r.data.sessions)).catch(() => setSessions([])).finally(() => setLoading(false));
  }, []);

  const openCreate = () => { setEditing(null); setFormError(''); setForm({ topic: '', description: '', prerequisites: '', session_date: '', session_time: '', duration_minutes: '60', session_type: 'virtual' }); setShowModal(true); };
  const openEdit = (s: TrainingSession) => { setEditing(s); setFormError(''); setForm({ topic: s.topic, description: s.description || '', prerequisites: s.prerequisites || '', session_date: s.session_date, session_time: s.session_time, duration_minutes: s.duration_minutes, session_type: s.session_type as 'virtual' | 'in_person' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.topic || !form.session_date || !form.session_time) {
      setFormError('Topic, date, and time are required.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      if (editing) {
        const r = await api.put(`/sessions/${editing.id}`, form);
        setSessions((prev: TrainingSession[]) => prev.map((s: TrainingSession) => s.id === editing.id ? r.data : s));
      } else {
        const r = await api.post('/sessions/', form);
        setSessions((prev: TrainingSession[]) => [r.data, ...prev]);
      }
      setShowModal(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail || 'Failed to save session. Please try again.');
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    await api.delete(`/sessions/${id}`);
    setSessions((prev: TrainingSession[]) => prev.filter((s: TrainingSession) => s.id !== id));
  };

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><i className="fas fa-calendar-alt text-cyan-400"></i>Sessions</h1>
            <p className={`mt-1 text-sm ${sub}`}>Schedule and manage your training sessions</p>
          </div>
          <button onClick={openCreate} className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
            <i className="fas fa-plus"></i>New Session
          </button>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
      ) : sessions.length === 0 ? (
        <div className={`rounded-3xl border p-16 text-center ${glass}`}>
          <i className={`fas fa-calendar-alt text-5xl mb-4 ${sub}`}></i>
          <p className="font-semibold text-lg mb-1">No sessions yet</p>
          <p className={`text-sm ${sub}`}>Create your first training session</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sessions.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border p-5 ${cardBg}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-calendar-check text-white text-sm"></i>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${s.session_type === 'virtual' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'}`}>
                  {s.session_type === 'virtual' ? 'Virtual' : 'In Person'}
                </span>
              </div>
              <p className="font-semibold mb-1 truncate">{s.topic}</p>
              {s.description && <p className={`text-xs mb-3 line-clamp-2 ${sub}`}>{s.description}</p>}
              <div className={`flex items-center gap-3 text-xs ${sub} mb-4`}>
                <span><i className="fas fa-calendar mr-1"></i>{s.session_date}</span>
                <span><i className="fas fa-clock mr-1"></i>{s.session_time}</span>
                <span><i className="fas fa-hourglass-half mr-1"></i>{s.duration_minutes}m</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${theme === 'dark' ? 'glass border-white/10 hover:border-blue-500/40 hover:text-blue-400' : 'bg-white border-gray-200 hover:border-blue-400 hover:text-blue-500'}`}>
                  <i className="fas fa-edit mr-1"></i>Edit
                </button>
                <button onClick={() => handleDelete(s.id)} className="px-3 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
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
              className={`relative w-full max-w-md rounded-3xl border p-6 ${theme === 'dark' ? 'glass border-white/20 text-white' : 'bg-white border-gray-200 shadow-2xl text-gray-900'}`}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">{editing ? 'Edit Session' : 'New Session'}</h2>
                <button onClick={() => setShowModal(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><i className="fas fa-times text-sm"></i></button>
              </div>
              <div className="space-y-3">
                {[['topic', 'Topic *', 'text'], ['description', 'Description', 'text'], ['prerequisites', 'Prerequisites', 'text']].map(([key, label]) => (
                  <div key={key}>
                    <label className={`block text-xs mb-1 ${sub}`}>{label}</label>
                    <input value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className={inputCls} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={`block text-xs mb-1 ${sub}`}>Date *</label><input type="date" value={form.session_date} onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))} className={inputCls} /></div>
                  <div><label className={`block text-xs mb-1 ${sub}`}>Time *</label><input type="time" value={form.session_time} onChange={e => setForm(f => ({ ...f, session_time: e.target.value }))} className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={`block text-xs mb-1 ${sub}`}>Duration (min)</label><input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} className={inputCls} /></div>
                  <div><label className={`block text-xs mb-1 ${sub}`}>Type</label>
                    <select value={form.session_type} onChange={e => setForm(f => ({ ...f, session_type: e.target.value as 'virtual' | 'in_person' }))} className={inputCls}>
                      <option value="virtual">Virtual</option>
                      <option value="in_person">In Person</option>
                    </select>
                  </div>
                </div>
              </div>
              {formError && (
                <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
                  <i className="fas fa-exclamation-circle"></i>{formError}
                </p>
              )}
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} className={`flex-1 py-2.5 rounded-xl border text-sm font-medium ${theme === 'dark' ? 'glass border-white/20 hover:bg-white/10' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="fas fa-save"></i>}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
