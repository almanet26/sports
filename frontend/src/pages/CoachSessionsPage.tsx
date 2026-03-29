import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Session {
  id: string;
  player_name: string;
  player_email: string;
  date: string;
  time: string;
  duration: number;
  type: 'Batting' | 'Bowling' | 'Fielding' | 'Fitness';
  status: 'scheduled' | 'completed' | 'cancelled';
  location?: string;
}

export default function CoachSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');

  const handleEditSession = (sessionId: string) => {
    alert(`Edit session ${sessionId} - Feature coming soon!`);
  };

  const handleCancelSession = (sessionId: string) => {
    if (confirm('Are you sure you want to cancel this session?')) {
      setSessions(sessions.map(s => s.id === sessionId ? {...s, status: 'cancelled' as const} : s));
    }
  };

  const handleViewDetails = (sessionId: string) => {
    alert(`View details for session ${sessionId}`);
  };

  useEffect(() => {
    // Mock data
    setTimeout(() => {
      setSessions([
        {
          id: '1',
          player_name: 'John Doe',
          player_email: 'john@example.com',
          date: '2024-01-20',
          time: '10:00 AM',
          duration: 60,
          type: 'Batting',
          status: 'scheduled',
          location: 'Main Ground',
        },
        {
          id: '2',
          player_name: 'Jane Smith',
          player_email: 'jane@example.com',
          date: '2024-01-21',
          time: '2:00 PM',
          duration: 90,
          type: 'Bowling',
          status: 'scheduled',
          location: 'Practice Nets',
        },
        {
          id: '3',
          player_name: 'Mike Johnson',
          player_email: 'mike@example.com',
          date: '2024-01-15',
          time: '9:00 AM',
          duration: 60,
          type: 'Fitness',
          status: 'completed',
          location: 'Gym',
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const upcomingSessions = sessions.filter(s => s.status === 'scheduled');
  const pastSessions = sessions.filter(s => s.status === 'completed' || s.status === 'cancelled');
  const displaySessions = view === 'upcoming' ? upcomingSessions : pastSessions;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Batting': return 'fa-baseball-bat-ball';
      case 'Bowling': return 'fa-bowling-ball';
      case 'Fielding': return 'fa-running';
      case 'Fitness': return 'fa-dumbbell';
      default: return 'fa-calendar';
    }
  };

  return (
    <div className="text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 mb-6 border border-white/20"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-calendar-alt text-purple-400"></i>
              Sessions
            </h1>
            <p className="text-white/70 mt-2">Schedule and manage your training sessions</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => alert('New Session feature coming soon!')}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-medium"
          >
            <i className="fas fa-plus mr-2"></i>
            New Session
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Sessions</p>
              <p className="text-3xl font-bold mt-2">{sessions.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <i className="fas fa-calendar text-purple-400 text-xl"></i>
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
              <p className="text-white/60 text-sm">Upcoming</p>
              <p className="text-3xl font-bold mt-2">{upcomingSessions.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <i className="fas fa-clock text-blue-400 text-xl"></i>
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
              <p className="text-white/60 text-sm">Completed</p>
              <p className="text-3xl font-bold mt-2">{pastSessions.filter(s => s.status === 'completed').length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <i className="fas fa-check-circle text-green-400 text-xl"></i>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">This Week</p>
              <p className="text-3xl font-bold mt-2">{upcomingSessions.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <i className="fas fa-calendar-week text-orange-400 text-xl"></i>
            </div>
          </div>
        </motion.div>
      </div>

      {/* View Toggle */}
      <div className="glass rounded-2xl p-2 mb-6 border border-white/20 inline-flex">
        <button
          onClick={() => setView('upcoming')}
          className={`px-6 py-2 rounded-xl font-medium transition-all ${
            view === 'upcoming'
              ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Upcoming ({upcomingSessions.length})
        </button>
        <button
          onClick={() => setView('past')}
          className={`px-6 py-2 rounded-xl font-medium transition-all ${
            view === 'past'
              ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Past ({pastSessions.length})
        </button>
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="glass rounded-2xl p-12 border border-white/20 text-center">
          <i className="fas fa-spinner animate-spin text-4xl text-purple-400 mb-4"></i>
          <p className="text-white/60">Loading sessions...</p>
        </div>
      ) : displaySessions.length === 0 ? (
        <div className="glass rounded-2xl p-12 border border-white/20 text-center">
          <i className="fas fa-calendar-times text-4xl text-white/20 mb-4"></i>
          <p className="text-white/60">No {view} sessions</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displaySessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl p-6 border border-white/20 hover:border-purple-500/50 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <i className={`fas ${getTypeIcon(session.type)} text-white`}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{session.player_name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs border ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm mb-2">{session.player_email}</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="text-white/60">
                        <i className="fas fa-calendar mr-1 text-purple-400"></i>
                        {session.date}
                      </span>
                      <span className="text-white/60">
                        <i className="fas fa-clock mr-1 text-blue-400"></i>
                        {session.time}
                      </span>
                      <span className="text-white/60">
                        <i className="fas fa-hourglass-half mr-1 text-green-400"></i>
                        {session.duration} min
                      </span>
                      {session.location && (
                        <span className="text-white/60">
                          <i className="fas fa-map-marker-alt mr-1 text-red-400"></i>
                          {session.location}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs">
                        {session.type}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {session.status === 'scheduled' && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleEditSession(session.id)}
                        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all"
                      >
                        <i className="fas fa-edit mr-1"></i>
                        Edit
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCancelSession(session.id)}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all"
                      >
                        <i className="fas fa-times mr-1"></i>
                        Cancel
                      </motion.button>
                    </>
                  )}
                  {session.status === 'completed' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleViewDetails(session.id)}
                      className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-all"
                    >
                      <i className="fas fa-eye mr-1"></i>
                      View Details
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
