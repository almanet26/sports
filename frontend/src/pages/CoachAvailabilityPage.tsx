import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api } from '../lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOTS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

export default function CoachAvailabilityPage() {
  const { theme } = useThemeStore();
  const [availability, setAvailability] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(DAYS.map(d => [d, []]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';

  // Load saved availability on mount
  useEffect(() => {
    api.get('/sessions/availability')
      .then(r => {
        const map: Record<string, string[]> = Object.fromEntries(DAYS.map(d => [d, []]));
        for (const slot of r.data.slots) {
          if (slot.is_available && map[slot.day_of_week]) {
            map[slot.day_of_week].push(slot.slot_time);
          }
        }
        setAvailability(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (day: string, slot: string) => {
    setAvailability(prev => {
      const slots = prev[day];
      return { ...prev, [day]: slots.includes(slot) ? slots.filter(s => s !== slot) : [...slots, slot] };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const slots = DAYS.flatMap(day =>
        availability[day].map(slot_time => ({ day_of_week: day, slot_time, is_available: true }))
      );
      await api.post('/sessions/availability', { slots });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const totalSlots = Object.values(availability).reduce((s, slots) => s + slots.length, 0);

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><i className="fas fa-clock text-purple-400"></i>Availability</h1>
            <p className={`mt-1 text-sm ${sub}`}>{totalSlots} slots selected across the week</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50 ${saved ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:opacity-90'}`}>
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <i className={`fas ${saved ? 'fa-check' : 'fa-save'}`}></i>}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400"><i className="fas fa-exclamation-circle mr-1"></i>{error}</p>}
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Header */}
            <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '100px repeat(7, 1fr)' }}>
              <div />
              {DAYS.map(d => (
                <div key={d} className={`text-center text-xs font-semibold py-2 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                  {d.slice(0, 3)}
                </div>
              ))}
            </div>

            {/* Slots */}
            {SLOTS.map(slot => (
              <div key={slot} className="grid gap-2 mb-1.5" style={{ gridTemplateColumns: '100px repeat(7, 1fr)' }}>
                <div className={`text-xs flex items-center justify-end pr-3 ${sub}`}>{slot}</div>
                {DAYS.map(day => {
                  const active = availability[day].includes(slot);
                  return (
                    <button key={day} onClick={() => toggle(day, slot)}
                      className={`h-9 rounded-lg text-xs font-medium transition-all ${
                        active
                          ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/20'
                          : theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/30' : 'bg-gray-100 hover:bg-gray-200 text-gray-400'
                      }`}>
                      {active ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`mt-6 p-4 rounded-2xl border ${theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200'}`}>
        <p className={`text-xs ${sub}`}><i className="fas fa-info-circle mr-1"></i>Click slots to toggle availability. Players will see your available times when booking sessions.</p>
      </div>
    </div>
  );
}
