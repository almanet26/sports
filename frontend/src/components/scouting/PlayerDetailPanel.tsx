import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScoutingPlayerSummary, ScoutingPlayerDetail } from '../../lib/api';
import { scoutingApi } from '../../lib/api';

interface PlayerDetailPanelProps {
  player: ScoutingPlayerSummary | null;
  onClose: () => void;
  onShortlistChange?: (playerId: string, shortlisted: boolean) => void;
}

function StatRow({ label, value, unit }: { label: string; value: number | null | undefined; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-sm font-semibold text-white">
        {value != null ? `${value.toFixed(1)}${unit ?? ''}` : <span className="text-white/20">No data</span>}
      </span>
    </div>
  );
}

function TimelineItem({ date, metrics, type }: { date: string; metrics: Record<string, number | null>; type: 'batting' | 'bowling' }) {
  const d = new Date(date);
  const relDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const entries = Object.entries(metrics).filter(([, v]) => v != null).slice(0, 2);

  return (
    <div className="flex gap-3 py-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        type === 'batting' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
      }`}>
        <i className={`fas ${type === 'batting' ? 'fa-baseball-bat-ball' : 'fa-bowling-ball'} text-xs`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/40">{relDate}</p>
        <div className="flex flex-wrap gap-x-4 mt-0.5">
          {entries.map(([k, v]) => (
            <span key={k} className="text-xs text-white/60">
              {k.replace(/_/g, ' ')}: <span className="text-white font-medium">{(v as number).toFixed(1)}</span>
            </span>
          ))}
          {entries.length === 0 && <span className="text-xs text-white/30">No metrics recorded</span>}
        </div>
      </div>
    </div>
  );
}

export default function PlayerDetailPanel({ player, onClose, onShortlistChange }: PlayerDetailPanelProps) {
  const [detail, setDetail] = useState<ScoutingPlayerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [shortlisted, setShortlisted] = useState(false);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [noteToast, setNoteToast] = useState('');

  useEffect(() => {
    if (!player) { setDetail(null); return; }
    setLoading(true);
    scoutingApi.getPlayer(player.user_id)
      .then(({ data }) => {
        setDetail(data);
        setShortlisted(data.shortlisted);
        setNote(data.coach_note || '');
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [player?.user_id]);

  const handleShortlistToggle = async () => {
    if (!detail) return;
    setShortlistLoading(true);
    try {
      if (shortlisted) {
        await scoutingApi.removeFromShortlist(detail.user_id);
        setShortlisted(false);
        onShortlistChange?.(detail.user_id, false);
      } else {
        await scoutingApi.addToShortlist(detail.user_id, note || undefined);
        setShortlisted(true);
        onShortlistChange?.(detail.user_id, true);
      }
    } catch { /* ignore */ }
    finally { setShortlistLoading(false); }
  };

  const handleSaveNote = async () => {
    if (!detail) return;
    setSavingNote(true);
    try {
      await scoutingApi.updateNote(detail.user_id, note);
      if (!shortlisted) {
        await scoutingApi.addToShortlist(detail.user_id, note);
        setShortlisted(true);
      }
      setNoteToast('Note saved');
      setTimeout(() => setNoteToast(''), 2500);
    } catch { setNoteToast('Failed to save note'); }
    finally { setSavingNote(false); }
  };

  const ROLE_LABELS: Record<string, string> = {
    batsman: 'Batsman', bowler: 'Bowler',
    all_rounder: 'All-rounder', wicket_keeper: 'Wicket-keeper',
  };
  const EXP_LABELS: Record<string, string> = {
    beginner: 'Beginner', intermediate: 'Intermediate',
    advanced: 'Advanced', professional: 'Professional',
  };

  return (
    <AnimatePresence>
      {player && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Slide-over panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed top-0 right-0 z-50 h-screen w-full max-w-lg bg-[#0A0F1C] border-l border-white/10 overflow-y-auto shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0A0F1C]/95 backdrop-blur border-b border-white/10 p-5 flex items-center gap-3">
              <button onClick={onClose}
                className="w-9 h-9 rounded-xl glass border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all">
                <i className="fas fa-times text-sm" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{player.display_name || 'Player Profile'}</p>
                <p className="text-xs text-white/40">
                  {[player.city, player.state].filter(Boolean).join(', ') || 'Location not set'}
                </p>
              </div>
              <button
                onClick={handleShortlistToggle}
                disabled={shortlistLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  shortlisted
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'glass border-white/10 text-white/60 hover:text-amber-400'
                }`}
              >
                {shortlistLoading
                  ? <i className="fas fa-spinner animate-spin" />
                  : <i className={`${shortlisted ? 'fas' : 'far'} fa-star`} />
                }
                {shortlisted ? 'Shortlisted' : 'Shortlist'}
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center h-64 text-white/40">
                <i className="fas fa-spinner animate-spin text-2xl" />
              </div>
            )}

            {!loading && detail && (
              <div className="p-5 space-y-6">

                {/* ── Profile header ── */}
                <div className="glass rounded-2xl p-4 border border-white/10 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                    {detail.display_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{detail.display_name || 'Unnamed'}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {detail.cricket_role && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300">
                          {ROLE_LABELS[detail.cricket_role] || detail.cricket_role}
                        </span>
                      )}
                      {detail.experience_level && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300">
                          {EXP_LABELS[detail.experience_level] || detail.experience_level}
                        </span>
                      )}
                      {detail.preferred_format && (
                        <span className="px-2 py-0.5 text-xs rounded-full glass border border-white/10 text-white/50">
                          {detail.preferred_format}
                        </span>
                      )}
                      {detail.scouting_visible && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                          <i className="fas fa-eye mr-1" />Opted in
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-1">
                      {detail.age ? `Age ${detail.age} · ` : ''}{[detail.city, detail.state].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>

                {/* ── Batting Stats ── */}
                <div className="glass rounded-2xl p-4 border border-white/10">
                  <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                    <i className="fas fa-baseball-bat-ball" /> Batting Stats
                  </h3>
                  <StatRow label="Avg Bat Speed" value={detail.stats.avg_bat_speed} unit=" km/h" />
                  <StatRow label="Peak Bat Speed" value={detail.stats.peak_bat_speed} unit=" km/h" />
                  <StatRow label="Avg Wrist Speed" value={detail.stats.avg_wrist_speed} unit=" km/h" />
                  <StatRow label="Best Shoulder Rotation" value={detail.stats.best_shoulder_rotation} unit="°" />
                  <StatRow label="Best Front Knee Angle" value={detail.stats.best_front_knee_angle} unit="°" />
                </div>

                {/* ── Bowling Stats ── */}
                <div className="glass rounded-2xl p-4 border border-white/10">
                  <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                    <i className="fas fa-bowling-ball" /> Bowling Stats
                  </h3>
                  <StatRow label="Avg Release Height" value={detail.stats.avg_release_height} unit=" m" />
                  <StatRow label="Best Elbow Angle" value={detail.stats.best_elbow_angle} unit="°" />
                  <StatRow label="Release Consistency" value={detail.stats.best_release_consistency} unit="%" />
                </div>

                {/* ── Analyses summary ── */}
                <p className="text-xs text-white/30 text-center">
                  Based on {detail.total_analyses} {detail.total_analyses === 1 ? 'analysis' : 'analyses'}
                  {detail.analyses_last_updated
                    ? ` · Last updated ${new Date(detail.analyses_last_updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : ''}
                </p>

                {/* ── Recent Batting Analyses ── */}
                {detail.recent_batting.length > 0 && (
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <h3 className="text-sm font-semibold text-white/70 mb-2">Recent Batting Analyses</h3>
                    {detail.recent_batting.map((a: { id: string; date: string; metrics: Record<string, number | null> }) => (
                      <TimelineItem key={a.id} date={a.date} metrics={a.metrics} type="batting" />
                    ))}
                  </div>
                )}

                {/* ── Recent Bowling Analyses ── */}
                {detail.recent_bowling.length > 0 && (
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <h3 className="text-sm font-semibold text-white/70 mb-2">Recent Bowling Analyses</h3>
                    {detail.recent_bowling.map((a: { id: string; date: string; metrics: Record<string, number | null> }) => (
                      <TimelineItem key={a.id} date={a.date} metrics={a.metrics} type="bowling" />
                    ))}
                  </div>
                )}

                {/* ── Private Note ── */}
                <div className="glass rounded-2xl p-4 border border-white/10">
                  <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                    <i className="fas fa-lock text-amber-400" /> Private Note
                    <span className="text-white/30 font-normal text-xs">(Only you can see this)</span>
                  </h3>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Add a private note about this player…"
                    className="w-full px-3 py-2 glass border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 bg-transparent resize-none placeholder:text-white/20"
                  />
                  <div className="flex items-center justify-between mt-2">
                    {noteToast && <p className="text-xs text-emerald-400">{noteToast}</p>}
                    {!noteToast && <span />}
                    <button
                      onClick={handleSaveNote}
                      disabled={savingNote}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 rounded-lg transition-all"
                    >
                      {savingNote ? <i className="fas fa-spinner animate-spin" /> : 'Save Note'}
                    </button>
                  </div>
                </div>

              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
