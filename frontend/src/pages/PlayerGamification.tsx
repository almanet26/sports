import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gamificationApi, type GamificationData, type GamificationBadge } from '../lib/api';

// ── Rarity config ────────────────────────────────────────────────────────────
const RARITY_CONFIG = {
  BRONZE:   { label: 'Bronze',   ring: 'ring-amber-700/60',   glow: 'shadow-amber-900/40',   pill: 'bg-amber-900/30 text-amber-400 border-amber-700/40' },
  SILVER:   { label: 'Silver',   ring: 'ring-slate-400/60',   glow: 'shadow-slate-400/20',   pill: 'bg-slate-700/30 text-slate-300 border-slate-500/40' },
  GOLD:     { label: 'Gold',     ring: 'ring-yellow-400/70',  glow: 'shadow-yellow-400/30',  pill: 'bg-yellow-900/30 text-yellow-300 border-yellow-500/40' },
  PLATINUM: { label: 'Platinum', ring: 'ring-purple-400/70',  glow: 'shadow-purple-400/30',  pill: 'bg-purple-900/30 text-purple-300 border-purple-500/40' },
} as const;

type FilterTab = 'ALL' | 'EARNED' | 'LOCKED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

// ── Badge Card ───────────────────────────────────────────────────────────────
function BadgeCard({ badge, index }: { badge: GamificationBadge; index: number }) {
  const [hovered, setHovered] = useState(false);
  const rc = RARITY_CONFIG[badge.rarity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.035, type: 'spring', stiffness: 260, damping: 22 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative glass rounded-2xl p-5 border flex flex-col items-center text-center gap-3 transition-all duration-300 cursor-default
        ${badge.earned
          ? `border-white/20 hover:border-white/35 ring-2 ${rc.ring} shadow-lg ${rc.glow}`
          : 'border-white/5 opacity-50'
        }`}
    >
      {/* Shimmer overlay on earned */}
      {badge.earned && (
        <motion.div
          animate={{ x: hovered ? '200%' : '-100%' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent skew-x-12" />
        </motion.div>
      )}

      {/* Icon */}
      <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center
        ${badge.earned ? `bg-gradient-to-br ${badge.color} shadow-lg` : 'bg-white/8'}`}
      >
        <i className={`${badge.icon} text-white text-2xl ${!badge.earned ? 'opacity-40' : ''}`}></i>
        {!badge.earned && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <i className="fas fa-lock text-white/40 text-[9px]"></i>
          </div>
        )}
      </div>

      {/* Text */}
      <div className="space-y-1">
        <p className={`font-semibold text-sm leading-tight ${badge.earned ? 'text-white' : 'text-white/40'}`}>
          {badge.label}
        </p>
        <p className={`text-xs leading-snug ${badge.earned ? 'text-white/55' : 'text-white/25'}`}>
          {badge.description}
        </p>
      </div>

      {/* Rarity pill */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rc.pill}`}>
        {rc.label}
      </span>

      {/* Progress bar (locked only) */}
      {!badge.earned && badge.progress_target > 0 && (
        <div className="w-full space-y-1">
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500/60 to-purple-500/60"
              initial={{ width: 0 }}
              animate={{ width: `${badge.progress_pct}%` }}
              transition={{ duration: 0.8, delay: index * 0.035 }}
            />
          </div>
          <p className="text-[10px] text-white/25">
            {badge.progress_current}/{badge.progress_target}
          </p>
        </div>
      )}

      {/* Earned date */}
      {badge.earned && badge.earned_at && (
        <p className="text-[10px] text-white/30">
          {new Date(badge.earned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PlayerGamification() {
  const [data, setData] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterTab>('ALL');

  useEffect(() => {
    gamificationApi
      .getMyData()
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load achievements.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <i className="fas fa-medal text-4xl text-purple-400"></i>
        </motion.div>
        <p className="text-white/40 text-sm">Loading achievements…</p>
      </div>
    );

  if (error)
    return (
      <div className="text-center py-40 text-white/50">
        <i className="fas fa-exclamation-circle text-4xl text-red-400 mb-4 block"></i>
        {error}
      </div>
    );

  const { level, streak, badges } = data!;
  const allBadges = [...badges.earned, ...badges.locked];

  const filtered = allBadges.filter(b => {
    if (filter === 'ALL') return true;
    if (filter === 'EARNED') return b.earned;
    if (filter === 'LOCKED') return !b.earned;
    return b.rarity === filter;
  });

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'ALL',      label: `All (${badges.total})` },
    { key: 'EARNED',   label: `Earned (${badges.total_earned})` },
    { key: 'LOCKED',   label: `Locked (${badges.locked.length})` },
    { key: 'BRONZE',   label: 'Bronze' },
    { key: 'SILVER',   label: 'Silver' },
    { key: 'GOLD',     label: 'Gold' },
    { key: 'PLATINUM', label: 'Platinum' },
  ];

  return (
    <div className="text-white space-y-8">

      {/* ── Hero: Level + XP ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/20 overflow-hidden relative"
      >
        {/* Background glow */}
        <div className={`absolute -top-16 -right-16 w-64 h-64 rounded-full bg-gradient-to-br ${level.color} opacity-10 blur-3xl pointer-events-none`} />

        <div className="flex flex-col sm:flex-row sm:items-center gap-6 relative">
          {/* Level badge */}
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${level.color} flex flex-col items-center justify-center shadow-xl flex-shrink-0`}>
            <i className={`${level.icon} text-white text-2xl`}></i>
            <p className="text-white text-[10px] font-bold mt-1 uppercase tracking-wider">{level.name}</p>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-bold gradient-text">Achievements</h1>
              <p className="text-white/50 text-sm mt-0.5">
                {level.next_level
                  ? `${level.badges_to_next} more badge${level.badges_to_next !== 1 ? 's' : ''} to reach ${level.next_level}`
                  : 'Maximum level reached — Legend!'}
              </p>
            </div>

            {/* XP bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>{level.name}</span>
                {level.next_level && <span>{level.next_level}</span>}
              </div>
              <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${level.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${level.xp_pct}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs text-white/30">{level.xp_pct}% to next level</p>
            </div>
          </div>

          {/* Badge count pill */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <p className="text-4xl font-bold gradient-text">{badges.total_earned}</p>
            <p className="text-xs text-white/40">of {badges.total} badges</p>
          </div>
        </div>
      </motion.div>

      {/* ── Streak + Week Calendar ── */}
      <div className="grid sm:grid-cols-3 gap-5">
        {/* Current streak */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-6 border border-white/20 flex flex-col items-center text-center gap-2 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 pointer-events-none" />
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <i className="fas fa-fire text-white text-2xl"></i>
          </div>
          <p className="text-5xl font-bold">{streak.current}</p>
          <p className="text-white/50 text-sm font-medium">Day Streak</p>
          {streak.current > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
              🔥 Active
            </span>
          )}
        </motion.div>

        {/* Longest streak */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 border border-white/20 flex flex-col items-center text-center gap-2 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 pointer-events-none" />
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <i className="fas fa-medal text-white text-2xl"></i>
          </div>
          <p className="text-5xl font-bold">{streak.longest}</p>
          <p className="text-white/50 text-sm font-medium">Best Streak</p>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25">
            Personal Best
          </span>
        </motion.div>

        {/* 7-day activity calendar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-6 border border-white/20 flex flex-col gap-4"
        >
          <div>
            <p className="font-semibold text-sm">This Week</p>
            <p className="text-xs text-white/40 mt-0.5">Match activity last 7 days</p>
          </div>
          <div className="flex items-end gap-2 flex-1">
            {streak.week_activity.map((day, i) => {
              const d = new Date(day.date);
              const label = d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.15 + i * 0.06, type: 'spring' }}
                    style={{ originY: 1 }}
                    className={`w-full rounded-lg transition-all duration-300 ${
                      day.active
                        ? 'bg-gradient-to-t from-orange-500 to-amber-400 shadow-sm shadow-orange-500/30 h-10'
                        : 'bg-white/8 h-5'
                    }`}
                  />
                  <p className={`text-[10px] font-medium ${day.active ? 'text-orange-400' : 'text-white/25'}`}>
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── Next Badge Spotlight ── */}
      <AnimatePresence>
        {badges.next_badge && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-5 border border-blue-500/25 bg-gradient-to-r from-blue-500/5 to-purple-500/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${badges.next_badge.color} opacity-70 flex items-center justify-center flex-shrink-0`}>
                <i className={`${badges.next_badge.icon} text-white text-xl`}></i>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Next to Unlock</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${RARITY_CONFIG[badges.next_badge.rarity].pill}`}>
                    {RARITY_CONFIG[badges.next_badge.rarity].label}
                  </span>
                </div>
                <p className="font-bold text-white">{badges.next_badge.label}</p>
                <p className="text-xs text-white/50">{badges.next_badge.description}</p>
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${badges.next_badge.progress_pct}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-white/35">
                    {badges.next_badge.progress_current} / {badges.next_badge.progress_target} — {badges.next_badge.progress_pct}% there
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filter Tabs + Badge Grid ── */}
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                filter === tab.key
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-transparent text-white shadow-lg shadow-blue-500/20'
                  : 'glass border-white/10 text-white/50 hover:text-white hover:border-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <AnimatePresence mode="wait">
          {filtered.length > 0 ? (
            <motion.div
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            >
              {filtered.map((b, i) => (
                <BadgeCard key={b.key} badge={b} index={i} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass rounded-3xl p-16 border border-white/10 text-center"
            >
              <i className="fas fa-search text-4xl text-white/15 mb-4 block"></i>
              <p className="text-white/40">No badges in this category yet</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Empty state (zero matches) ── */}
      {badges.total_earned === 0 && filter === 'ALL' && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-3xl p-16 border border-white/10 text-center space-y-3"
        >
          <i className="fas fa-medal text-5xl text-white/15 block"></i>
          <p className="text-white/50 text-lg font-semibold">No badges yet</p>
          <p className="text-white/30 text-sm">Go to My Performance → Log Match to start earning</p>
        </motion.div>
      )}
    </div>
  );
}
