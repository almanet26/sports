import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ScoutingPlayerSummary } from '../../lib/api';
import { scoutingApi } from '../../lib/api';

interface PlayerCardProps {
  player: ScoutingPlayerSummary;
  onViewProfile: (player: ScoutingPlayerSummary) => void;
  initialShortlisted?: boolean;
}

function fmt(v: number | null | undefined, unit = '') {
  if (v == null) return '—';
  return `${v.toFixed(1)}${unit}`;
}

const ROLE_LABELS: Record<string, string> = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  all_rounder: 'All-rounder',
  wicket_keeper: 'Wicket-keeper',
};

const ROLE_COLORS: Record<string, string> = {
  batsman: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-300',
  bowler: 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-300',
  all_rounder: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-300',
  wicket_keeper: 'from-amber-500/20 to-amber-600/20 border-amber-500/30 text-amber-300',
};

export default function PlayerCard({ player, onViewProfile, initialShortlisted = false }: PlayerCardProps) {
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  const [loadingShortlist, setLoadingShortlist] = useState(false);

  const roleColor = ROLE_COLORS[player.cricket_role || ''] || 'from-white/10 to-white/5 border-white/20 text-white/70';

  const handleShortlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingShortlist(true);
    try {
      if (shortlisted) {
        await scoutingApi.removeFromShortlist(player.user_id);
        setShortlisted(false);
      } else {
        await scoutingApi.addToShortlist(player.user_id);
        setShortlisted(true);
      }
    } catch {
      // silently fail — UI already shows state
    } finally {
      setLoadingShortlist(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="glass rounded-2xl border border-white/10 overflow-hidden cursor-pointer hover:border-white/25 transition-all"
      onClick={() => onViewProfile(player)}
    >
      {/* Top strip — scouting visible indicator */}
      {player.scouting_visible && (
        <div className="h-0.5 bg-gradient-to-r from-emerald-500 to-blue-500" />
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {player.display_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{player.display_name || 'Unnamed Player'}</p>
            <p className="text-sm text-white/50 truncate">
              {[player.city, player.state].filter(Boolean).join(', ') || 'Location not set'}
            </p>
            {player.cricket_role && (
              <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border bg-gradient-to-r ${roleColor}`}>
                {ROLE_LABELS[player.cricket_role] || player.cricket_role}
              </span>
            )}
          </div>
          {/* Scouting opt-in badge */}
          {player.scouting_visible && (
            <span title="Opted into scouting" className="text-emerald-400 text-xs mt-0.5">
              <i className="fas fa-eye" />
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="glass rounded-xl p-2 border border-white/5 text-center">
            <p className="text-xs text-white/40 mb-0.5">Bat Speed</p>
            <p className="text-sm font-bold text-white">{fmt(player.stats.avg_bat_speed, ' km/h')}</p>
          </div>
          <div className="glass rounded-xl p-2 border border-white/5 text-center">
            <p className="text-xs text-white/40 mb-0.5">Wrist Spd</p>
            <p className="text-sm font-bold text-white">{fmt(player.stats.avg_wrist_speed, ' km/h')}</p>
          </div>
          <div className="glass rounded-xl p-2 border border-white/5 text-center">
            <p className="text-xs text-white/40 mb-0.5">Analyses</p>
            <p className="text-sm font-bold text-white inline-flex items-center justify-center gap-1">
              {player.total_analyses}
              <i className="fas fa-flask text-blue-400" aria-hidden="true" />
            </p>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {player.preferred_format && (
            <span className="px-2 py-0.5 text-xs glass border border-white/10 rounded-full text-white/60">{player.preferred_format}</span>
          )}
          {player.experience_level && (
            <span className="px-2 py-0.5 text-xs glass border border-white/10 rounded-full text-white/60 capitalize">{player.experience_level}</span>
          )}
          {player.bat_style && (
            <span className="px-2 py-0.5 text-xs glass border border-white/10 rounded-full text-white/60">
              {player.bat_style === 'right_hand' ? 'RHB' : 'LHB'}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onViewProfile(player); }}
            className="flex-1 py-2 text-sm font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-white/10 rounded-xl text-white transition-all"
          >
            <i className="fas fa-user mr-1.5" /> View Profile
          </button>
          <button
            onClick={handleShortlist}
            disabled={loadingShortlist}
            className={`px-3 py-2 text-sm font-medium rounded-xl border transition-all ${
              shortlisted
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400'
                : 'glass border-white/10 text-white/60 hover:text-amber-400 hover:border-amber-500/40'
            }`}
          >
            {loadingShortlist
              ? <i className="fas fa-spinner animate-spin" />
              : shortlisted
              ? <><i className="fas fa-star" /> Saved</>
              : <><i className="far fa-star" /> Save</>
            }
          </button>
        </div>
      </div>
    </motion.div>
  );
}
