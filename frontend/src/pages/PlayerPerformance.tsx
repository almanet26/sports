import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { performanceApi, type PerformanceEntry, type PerformanceStats } from '../lib/api';

const EMPTY_FORM = {
  opponent: '', match_date: '', match_type: 'Practice',
  runs: '' as string | number, fours: '' as string | number, sixes: '' as string | number, balls_faced: '' as string | number,
  wickets: '' as string | number, overs_bowled: '' as string | number, runs_conceded: '' as string | number,
  catches: '' as string | number, run_outs: '' as string | number, result: 'Won',
};

const STAT_CARDS = (s: PerformanceStats) => [
  { label: 'Matches Played', value: s.total_matches,      icon: 'fas fa-calendar-check', color: 'from-blue-500 to-cyan-500' },
  { label: 'Total Runs',     value: s.total_runs,         icon: 'fas fa-running',        color: 'from-green-500 to-emerald-500' },
  { label: 'Total Fours',    value: s.total_fours,        icon: 'fas fa-bolt',           color: 'from-yellow-400 to-amber-500' },
  { label: 'Total Sixes',    value: s.total_sixes,        icon: 'fas fa-rocket',         color: 'from-purple-500 to-pink-500' },
  { label: 'Highest Score',  value: s.highest_score,      icon: 'fas fa-star',           color: 'from-orange-400 to-red-500' },
  { label: 'Batting Avg',    value: s.batting_average,    icon: 'fas fa-chart-line',     color: 'from-indigo-500 to-blue-500' },
  { label: 'Wickets',        value: s.total_wickets,      icon: 'fas fa-crosshairs',     color: 'from-red-500 to-rose-600' },
  { label: 'Bowling Avg',    value: s.bowling_average,    icon: 'fas fa-wind',           color: 'from-teal-500 to-cyan-500' },
  { label: 'Catches',        value: s.total_catches,      icon: 'fas fa-hands',          color: 'from-fuchsia-500 to-pink-500' },
  { label: 'Run Outs',       value: s.total_run_outs,     icon: 'fas fa-person-running', color: 'from-lime-500 to-green-500' },
  { label: 'Wins',           value: s.wins,               icon: 'fas fa-trophy',         color: 'from-emerald-400 to-green-600' },
  { label: 'Losses',         value: s.losses,             icon: 'fas fa-times-circle',   color: 'from-red-400 to-red-600' },
];

export default function PlayerPerformance() {
  const [stats, setStats]         = useState<PerformanceStats | null>(null);
  const [history, setHistory]     = useState<PerformanceEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const load = async () => {
    try {
      const [s, h] = await Promise.all([
        performanceApi.getStats(),
        performanceApi.getHistory(),
      ]);
      setStats(s.data);
      setHistory(h.data);
    } catch {
      setError('Failed to load performance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.opponent || !form.match_date) return;
    setSaving(true);
    try {
      await performanceApi.log({
        ...form,
        runs: Number(form.runs) || 0,
        fours: Number(form.fours) || 0,
        sixes: Number(form.sixes) || 0,
        balls_faced: Number(form.balls_faced) || 0,
        wickets: Number(form.wickets) || 0,
        overs_bowled: Number(form.overs_bowled) || 0,
        runs_conceded: Number(form.runs_conceded) || 0,
        catches: Number(form.catches) || 0,
        run_outs: Number(form.run_outs) || 0,
      });
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this entry?')) return;
    await performanceApi.deleteEntry(id);
    await load();
  };

  const field = (key: keyof typeof form, label: string, type = 'number') => (
    <div key={key}>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input
        type={type}
        min={type === 'number' ? 0 : undefined}
        value={form[key] as string | number}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder="0"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-blue-400/50 focus:outline-none placeholder:text-white/30"
      />
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <i className="fas fa-spinner fa-spin text-4xl text-blue-400"></i>
    </div>
  );

  if (error) return (
    <div className="text-center py-32 text-white/60">
      <i className="fas fa-exclamation-circle text-4xl text-red-400 mb-4 block"></i>
      {error}
    </div>
  );

  return (
    <div className="text-white space-y-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold gradient-text">My Performance</h1>
          <p className="text-white/60 text-sm mt-1">Your cricket stats across all logged matches</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 font-semibold text-sm"
        >
          <i className="fas fa-plus"></i> Log Match
        </motion.button>
      </motion.div>

      {/* Stat Cards */}
      {stats && stats.total_matches > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {STAT_CARDS(stats).map((card, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="glass rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all"
            >
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-r ${card.color} flex items-center justify-center mb-3`}>
                <i className={`${card.icon} text-white text-sm`}></i>
              </div>
              <p className="text-xs text-white/50 mb-1">{card.label}</p>
              <p className="text-xl font-bold">{card.value}</p>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-3xl p-12 border border-white/10 text-center"
        >
          <i className="fas fa-cricket-bat-ball text-5xl text-white/20 mb-4 block"></i>
          <p className="text-white/50 text-lg">No matches logged yet</p>
          <p className="text-white/30 text-sm mt-1">Click "Log Match" to add your first match stats</p>
        </motion.div>
      )}

      {/* Match History Table */}
      {history.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-6 border border-white/20"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
              <i className="fas fa-history text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Match History</p>
              <p className="text-xs text-white/50">{history.length} matches logged</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-white/5">
                <tr>
                  {['Date', 'Opponent', 'Type', 'Runs', '4s', '6s', 'Wkts', 'Catches', 'Result', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white/60">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((entry, i) => (
                  <motion.tr key={entry.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="hover:bg-white/5"
                  >
                    <td className="px-4 py-3 text-white/70">{new Date(entry.match_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium">{entry.opponent}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/70">{entry.match_type}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-green-400">{entry.runs}</td>
                    <td className="px-4 py-3 text-yellow-400">{entry.fours}</td>
                    <td className="px-4 py-3 text-purple-400">{entry.sixes}</td>
                    <td className="px-4 py-3 text-red-400">{entry.wickets}</td>
                    <td className="px-4 py-3 text-cyan-400">{entry.catches}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        entry.result === 'Won' ? 'bg-emerald-500/20 text-emerald-400' :
                        entry.result === 'Lost' ? 'bg-red-500/20 text-red-400' :
                        'bg-white/10 text-white/50'
                      }`}>{entry.result}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(entry.id)}
                        className="text-white/30 hover:text-red-400 transition-colors"
                      >
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Log Match Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[28px] border border-white/15 bg-[linear-gradient(180deg,rgba(10,17,34,0.98),rgba(8,12,24,0.96))] shadow-[0_30px_120px_rgba(3,7,18,0.75)]"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-white/10 bg-[rgba(10,17,34,0.95)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <i className="fas fa-plus text-white"></i>
                  </div>
                  <div>
                    <p className="font-semibold">Log Match Performance</p>
                    <p className="text-xs text-white/50">Enter your stats for this match</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white transition-colors">
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Match Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    {field('opponent', 'Opponent', 'text')}
                    {field('match_date', 'Match Date', 'date')}
                    <div>
                      <label className="block text-xs text-white/60 mb-1">Match Type</label>
                      <select value={form.match_type}
                        onChange={e => setForm(p => ({ ...p, match_type: e.target.value }))}
                        className="w-full rounded-xl border border-white/10 bg-[#0f1729] px-3 py-2 text-white text-sm focus:border-blue-400/50 focus:outline-none"
                      >
                        <option>Practice</option>
                        <option>Tournament</option>
                        <option>Friendly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/60 mb-1">Result</label>
                      <div className="flex gap-2">
                        {(['Won', 'Lost', 'Draw'] as const).map(r => (
                          <button key={r} onClick={() => setForm(p => ({ ...p, result: r }))}
                            className={`flex-1 rounded-xl py-2 text-xs font-medium border transition-all ${
                              form.result === r
                                ? r === 'Won' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                  : r === 'Lost' ? 'bg-red-500/20 border-red-400/40 text-red-300'
                                  : 'bg-white/10 border-white/20 text-white'
                                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                            }`}
                          >{r}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Batting</p>
                  <div className="grid grid-cols-2 gap-3">
                    {field('runs', 'Runs Scored')}
                    {field('balls_faced', 'Balls Faced')}
                    {field('fours', 'Fours (4s)')}
                    {field('sixes', 'Sixes (6s)')}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Bowling</p>
                  <div className="grid grid-cols-3 gap-3">
                    {field('wickets', 'Wickets')}
                    {field('overs_bowled', 'Overs')}
                    {field('runs_conceded', 'Runs Given')}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Fielding</p>
                  <div className="grid grid-cols-2 gap-3">
                    {field('catches', 'Catches')}
                    {field('run_outs', 'Run Outs')}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 flex gap-3 p-6 border-t border-white/10 bg-[rgba(8,12,24,0.95)] backdrop-blur-xl">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !form.opponent || !form.match_date}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : 'Save Match'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
