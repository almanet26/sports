import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function PlayerPerformance() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock player data (replace with API call later)
  const playersData: Record<string, any> = {
    "1": {
      id: "1",
      name: "Alex Rodriguez",
      sport: "Batsman",
      level: "Advanced",
      progress: 85,
      battingAvg: 45.8,
      strikeRate: 142.5,
      highScore: 98,
      matches: 24,
      runs: 1099,
      fours: 89,
      sixes: 42
    },
    "2": {
      id: "2",
      name: "Maya Patel",
      sport: "Bowler",
      level: "Intermediate",
      progress: 72,
      battingAvg: 28.3,
      strikeRate: 118.5,
      highScore: 67,
      matches: 22,
      runs: 623,
      fours: 52,
      sixes: 18
    },
    "3": {
      id: "3",
      name: "James Wilson",
      sport: "All-rounder",
      level: "Beginner",
      progress: 58,
      battingAvg: 32.5,
      strikeRate: 125.8,
      highScore: 78,
      matches: 18,
      runs: 585,
      fours: 48,
      sixes: 22
    },
    "4": {
      id: "4",
      name: "Sofia Chen",
      sport: "Wicketkeeper",
      level: "Advanced",
      progress: 91,
      battingAvg: 52.3,
      strikeRate: 155.2,
      highScore: 112,
      matches: 26,
      runs: 1460,
      fours: 118,
      sixes: 58
    }
  };

  const player = playersData[id || "1"];

  const performanceData = [
    { match: "Match 1", runs: 45, strikeRate: 135 },
    { match: "Match 2", runs: 67, strikeRate: 148 },
    { match: "Match 3", runs: 23, strikeRate: 115 },
    { match: "Match 4", runs: 89, strikeRate: 165 },
    { match: "Match 5", runs: 56, strikeRate: 142 },
  ];

  const skillsData = [
    { skill: "Batting", score: 85 },
    { skill: "Fielding", score: 72 },
    { skill: "Fitness", score: 88 },
    { skill: "Mental", score: 78 },
  ];

  return (
    <div className="text-white">
      {/* Back Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate(-1)}
        className="mb-6 px-4 py-2 rounded-xl glass border border-white/20 hover:bg-white/10 transition-all flex items-center gap-2"
      >
        <i className="fas fa-arrow-left"></i>
        Back to Dashboard
      </motion.button>

      {/* Player Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20"
      >
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-4xl">
            {player.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold gradient-text">{player.name}</h1>
            <p className="text-white/60 mt-1">{player.sport} • {player.level}</p>
            <div className="flex gap-4 mt-3">
              <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm border border-green-500/30">
                Progress: {player.progress}%
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm border border-blue-500/30">
                {player.matches} Matches
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Batting Average", value: player.battingAvg, icon: "fas fa-chart-line", color: "from-blue-500 to-cyan-500" },
          { label: "Strike Rate", value: player.strikeRate, icon: "fas fa-bolt", color: "from-green-500 to-emerald-500" },
          { label: "High Score", value: player.highScore, icon: "fas fa-trophy", color: "from-purple-500 to-pink-500" },
          { label: "Total Runs", value: player.runs, icon: "fas fa-running", color: "from-orange-500 to-red-500" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-2xl p-6 border border-white/20"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${stat.color} flex items-center justify-center mb-4`}>
              <i className={`${stat.icon} text-white`}></i>
            </div>
            <p className="text-sm text-white/60 mb-1">{stat.label}</p>
            <p className="text-3xl font-bold">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Performance Trend */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass rounded-3xl p-6 border border-white/20"
        >
          <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
            <i className="fas fa-chart-line text-blue-400"></i>
            Recent Performance
          </h3>
          <div className="h-64" style={{ minHeight: '256px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="match" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    color: 'white'
                  }}
                />
                <Line type="monotone" dataKey="runs" stroke="#3B82F6" strokeWidth={3} />
                <Line type="monotone" dataKey="strikeRate" stroke="#10B981" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Skills Breakdown */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass rounded-3xl p-6 border border-white/20"
        >
          <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
            <i className="fas fa-star text-purple-400"></i>
            Skills Breakdown
          </h3>
          <div className="h-64" style={{ minHeight: '256px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="skill" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    color: 'white'
                  }}
                />
                <Bar dataKey="score" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Additional Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/20"
      >
        <h3 className="text-xl font-bold mb-4">Detailed Statistics</h3>
        <div className="grid sm:grid-cols-3 gap-6">
          <div>
            <p className="text-white/60 text-sm mb-2">Boundaries</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-400">{player.fours}</span>
                <span className="text-sm text-white/60">4s</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-400">{player.sixes}</span>
                <span className="text-sm text-white/60">6s</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-2">Consistency</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500" style={{ width: '85%' }}></div>
              </div>
              <span className="text-sm font-bold">85%</span>
            </div>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-2">Form</p>
            <span className="px-4 py-2 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 inline-block">
              <i className="fas fa-arrow-up mr-2"></i>
              Excellent
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
