import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { submissionsApi } from '../lib/api';

interface Player {
  id: string;
  name: string;
  email: string;
  submissions: number;
  lastActive: string;
  type: string;
}

export default function CoachMyPlayersPage() {
  const { theme } = useThemeStore();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';

  useEffect(() => {
    submissionsApi.coachInbox().then(r => {
      // Deduplicate players from submissions
      const map = new Map<string, Player>();
      r.data.submissions.forEach((s) => {
        if (!map.has(s.player_id)) {
          map.set(s.player_id, {
            id: s.player_id,
            name: s.player_name || 'Unknown Player',
            email: '',
            submissions: 1,
            lastActive: s.created_at?.slice(0, 10) || '',
            type: s.analysis_type,
          });
        } else {
          map.get(s.player_id)!.submissions += 1;
        }
      });
      setPlayers(Array.from(map.values()));
    }).catch(() => setPlayers([])).finally(() => setLoading(false));
  }, []);

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-users text-blue-400"></i>My Players
            </h1>
            <p className={`mt-1 text-sm ${sub}`}>Athletes who have submitted videos to you</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${cardBg}`}>
            <i className={`fas fa-search text-xs ${sub}`}></i>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search players..."
              className={`bg-transparent text-sm outline-none w-40 ${theme === 'dark' ? 'text-white placeholder-white/30' : 'text-gray-700 placeholder-gray-400'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5">
          {[
            { label: 'Total Players', value: players.length, icon: 'fas fa-users', color: 'from-blue-500 to-cyan-500' },
            { label: 'Total Submissions', value: players.reduce((a, p) => a + p.submissions, 0), icon: 'fas fa-video', color: 'from-purple-500 to-pink-500' },
            { label: 'Active This Week', value: players.filter(p => p.lastActive >= new Date(Date.now() - 7*86400000).toISOString().slice(0,10)).length, icon: 'fas fa-fire', color: 'from-orange-500 to-red-500' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${cardBg}`}>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center mb-2`}>
                <i className={`${s.icon} text-white text-sm`}></i>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className={`text-xs ${sub}`}>{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-3xl border p-16 text-center ${glass}`}>
          <i className={`fas fa-users text-5xl mb-4 ${sub}`}></i>
          <p className="font-semibold text-lg mb-1">{search ? 'No players found' : 'No players yet'}</p>
          <p className={`text-sm ${sub}`}>Players will appear here once they submit videos to you</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((player, i) => (
            <motion.div key={player.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border p-5 ${cardBg}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{player.name}</p>
                  <p className={`text-xs truncate ${sub}`}>{player.email || 'Player'}</p>
                </div>
              </div>
              <div className={`flex items-center gap-4 text-xs ${sub} mb-4`}>
                <span><i className="fas fa-video mr-1"></i>{player.submissions} submissions</span>
                <span><i className="fas fa-calendar mr-1"></i>{player.lastActive || 'N/A'}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                player.type === 'BATTING'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-green-500/20 text-green-400 border-green-500/30'
              }`}>{player.type}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
