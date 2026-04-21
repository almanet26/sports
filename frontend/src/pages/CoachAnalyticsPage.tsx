import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api } from '../lib/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Stats {
  total_sessions: number;
  active_players: number;
  completion_rate: number;
  avg_improvement: number;
  session_change: string;
  player_change: string;
  improvement_change: string;
  completion_change: string;
}

interface MonthlyData {
  month: string;
  sessions: number;
  players: number;
  revenue: number;
}

interface SkillData {
  skill: string;
  improvement: number;
}

export default function CoachAnalyticsPage() {
  const { theme } = useThemeStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [skillData, setSkillData] = useState<SkillData[]>([]);
  const [loading, setLoading] = useState(true);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const tooltipStyle = { backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: 'white' };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [statsRes, monthlyRes, skillRes] = await Promise.all([
        api.get('/analytics/coach/stats'),
        api.get('/analytics/coach/monthly-trend'),
        api.get('/analytics/coach/skill-improvement')
      ]);
      
      setStats(statsRes.data);
      setMonthlyData(monthlyRes.data);
      setSkillData(skillRes.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
        <div className="flex items-center justify-center h-96">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Sessions', value: stats?.total_sessions || 0, icon: 'fas fa-calendar-check', color: 'from-blue-500 to-cyan-500', change: stats?.session_change || '+0' },
    { label: 'Active Players', value: stats?.active_players || 0, icon: 'fas fa-users', color: 'from-green-500 to-emerald-500', change: stats?.player_change || '+0' },
    { label: 'Avg Improvement', value: `${stats?.avg_improvement || 0}%`, icon: 'fas fa-chart-line', color: 'from-purple-500 to-pink-500', change: stats?.improvement_change || '+0%' },
    { label: 'Completion Rate', value: `${stats?.completion_rate || 0}%`, icon: 'fas fa-trophy', color: 'from-orange-500 to-red-500', change: stats?.completion_change || '+0%' },
  ];

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><i className="fas fa-chart-line text-blue-400"></i>Analytics</h1>
        <p className={`mt-1 text-sm ${sub}`}>Performance insights and coaching metrics</p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`rounded-2xl border p-5 ${theme === 'dark' ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-md'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center`}>
                <i className={`${s.icon} text-white text-sm`}></i>
              </div>
              <span className={`text-xs font-medium ${s.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{s.change}</span>
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
          {monthlyData.length > 0 ? (
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
          ) : (
            <div className="h-56 flex items-center justify-center">
              <p className={`text-sm ${sub}`}>No data available</p>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`rounded-3xl border p-6 ${glass}`}>
          <p className="font-semibold mb-1">Skill Improvement Rates</p>
          <p className={`text-xs mb-4 ${sub}`}>Average % improvement by skill area</p>
          {skillData.length > 0 ? (
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
          ) : (
            <div className="h-56 flex items-center justify-center">
              <p className={`text-sm ${sub}`}>No data available</p>
            </div>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl border p-6 ${glass}`}>
        <p className="font-semibold mb-4">Monthly Revenue</p>
        {monthlyData.length > 0 ? (
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
        ) : (
          <div className="h-48 flex items-center justify-center">
            <p className={`text-sm ${sub}`}>No revenue data available</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
