import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function CoachAnalyticsPage() {
  const { theme } = useThemeStore();
  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const tooltipStyle = { backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: 'white' };

  const monthlyData = useMemo(() => [
    { month: 'Oct', sessions: 12, players: 8, revenue: 2400 },
    { month: 'Nov', sessions: 18, players: 11, revenue: 3600 },
    { month: 'Dec', sessions: 15, players: 10, revenue: 3000 },
    { month: 'Jan', sessions: 22, players: 14, revenue: 4400 },
    { month: 'Feb', sessions: 28, players: 18, revenue: 5600 },
    { month: 'Mar', sessions: 32, players: 22, revenue: 6400 },
  ], []);

  const skillData = useMemo(() => [
    { skill: 'Batting', improvement: 22 },
    { skill: 'Bowling', improvement: 18 },
    { skill: 'Fielding', improvement: 15 },
    { skill: 'Fitness', improvement: 20 },
    { skill: 'Mental', improvement: 16 },
  ], []);

  const stats = [
    { label: 'Total Sessions', value: '127', icon: 'fas fa-calendar-check', color: 'from-blue-500 to-cyan-500', change: '+12%' },
    { label: 'Active Players', value: '24', icon: 'fas fa-users', color: 'from-green-500 to-emerald-500', change: '+3' },
    { label: 'Avg Improvement', value: '18%', icon: 'fas fa-chart-line', color: 'from-purple-500 to-pink-500', change: '+5%' },
    { label: 'Completion Rate', value: '94%', icon: 'fas fa-trophy', color: 'from-orange-500 to-red-500', change: '+2%' },
  ];

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><i className="fas fa-chart-line text-blue-400"></i>Analytics</h1>
        <p className={`mt-1 text-sm ${sub}`}>Performance insights and coaching metrics</p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`rounded-2xl border p-5 ${theme === 'dark' ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-md'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center`}>
                <i className={`${s.icon} text-white text-sm`}></i>
              </div>
              <span className="text-xs text-green-400 font-medium">{s.change}</span>
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className={`text-xs mt-1 ${sub}`}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`rounded-3xl border p-6 ${glass}`}>
          <p className="font-semibold mb-1">Sessions & Players Growth</p>
          <p className={`text-xs mb-4 ${sub}`}>Monthly trend over 6 months</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} name="Sessions" dot={false} />
                <Line type="monotone" dataKey="players" stroke="#10B981" strokeWidth={2} name="Players" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`rounded-3xl border p-6 ${glass}`}>
          <p className="font-semibold mb-1">Skill Improvement Rates</p>
          <p className={`text-xs mb-4 ${sub}`}>Average % improvement by skill area</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="skill" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="improvement" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Improvement %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl border p-6 ${glass}`}>
        <p className="font-semibold mb-4">Monthly Revenue</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
