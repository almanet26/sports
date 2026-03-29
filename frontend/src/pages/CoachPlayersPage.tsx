import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { authService } from '../utils/auth';

interface Player {
  id: string;
  name: string;
  email: string;
  phone?: string;
  team?: string;
  profile_image_url?: string;
  last_session?: string;
  total_sessions: number;
  progress: number;
}

export default function CoachPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    // TODO: Fetch players from API
    // Mock data for now
    setTimeout(() => {
      setPlayers([
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          team: 'Team A',
          last_session: '2024-01-15',
          total_sessions: 24,
          progress: 85,
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+1234567891',
          team: 'Team B',
          last_session: '2024-01-14',
          total_sessions: 18,
          progress: 72,
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         player.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 mb-6 border border-white/20"
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-users text-blue-400"></i>
          My Players
        </h1>
        <p className="text-white/70 mt-2">Manage your students and track their progress</p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Players</p>
              <p className="text-3xl font-bold mt-2">{players.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <i className="fas fa-users text-blue-400 text-xl"></i>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Active This Week</p>
              <p className="text-3xl font-bold mt-2">{players.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <i className="fas fa-chart-line text-green-400 text-xl"></i>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Avg Progress</p>
              <p className="text-3xl font-bold mt-2">78%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <i className="fas fa-trophy text-purple-400 text-xl"></i>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Search and Filter */}
      <div className="glass rounded-2xl p-4 mb-6 border border-white/20">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-white/40"></i>
              <input
                type="text"
                placeholder="Search players by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
              />
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => alert('Add Player feature coming soon!')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-medium"
          >
            <i className="fas fa-user-plus mr-2"></i>
            Add Player
          </motion.button>
        </div>
      </div>

      {/* Players List */}
      {loading ? (
        <div className="glass rounded-2xl p-12 border border-white/20 text-center">
          <i className="fas fa-spinner animate-spin text-4xl text-blue-400 mb-4"></i>
          <p className="text-white/60">Loading players...</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="glass rounded-2xl p-12 border border-white/20 text-center">
          <i className="fas fa-user-slash text-4xl text-white/20 mb-4"></i>
          <p className="text-white/60">No players found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlayers.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl p-6 border border-white/20 hover:border-blue-500/50 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-4 mb-4">
                {player.profile_image_url ? (
                  <img
                    src={player.profile_image_url}
                    alt={player.name}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
                    {player.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{player.name}</h3>
                  <p className="text-white/60 text-sm">{player.email}</p>
                  {player.team && (
                    <span className="inline-block mt-1 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                      {player.team}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/60">Progress</span>
                    <span className="font-semibold">{player.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                      style={{ width: `${player.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">
                    <i className="fas fa-calendar mr-1"></i>
                    Last Session
                  </span>
                  <span>{player.last_session}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">
                    <i className="fas fa-dumbbell mr-1"></i>
                    Total Sessions
                  </span>
                  <span className="font-semibold">{player.total_sessions}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Link to="/coach/players">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all"
                  >
                    <i className="fas fa-eye mr-1"></i>
                    View
                  </motion.button>
                </Link>
                <Link to="/coach/inbox">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-all"
                  >
                    <i className="fas fa-comment mr-1"></i>
                    Message
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
