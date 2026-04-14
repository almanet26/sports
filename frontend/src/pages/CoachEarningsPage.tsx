import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TRANSACTIONS = [
  { id: '1', player: 'Alex Rodriguez', type: 'Session', amount: 80, date: '2024-03-12', status: 'paid' },
  { id: '2', player: 'Maya Patel', type: 'Training Plan', amount: 150, date: '2024-03-10', status: 'paid' },
  { id: '3', player: 'Sofia Chen', type: 'Session', amount: 80, date: '2024-03-08', status: 'paid' },
  { id: '4', player: 'James Wilson', type: 'Session', amount: 80, date: '2024-03-05', status: 'pending' },
  { id: '5', player: 'Rahul Sharma', type: 'Training Plan', amount: 150, date: '2024-03-01', status: 'paid' },
  { id: '6', player: 'Alex Rodriguez', type: 'Session', amount: 80, date: '2024-02-28', status: 'paid' },
];

export default function CoachEarningsPage() {
  const { theme } = useThemeStore();
  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const tooltipStyle = { backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: 'white' };

  const chartData = useMemo(() => [
    { month: 'Oct', earnings: 1200 }, { month: 'Nov', earnings: 1800 },
    { month: 'Dec', earnings: 1500 }, { month: 'Jan', earnings: 2200 },
    { month: 'Feb', earnings: 2800 }, { month: 'Mar', earnings: 3200 },
  ], []);

  const totalEarned = TRANSACTIONS.filter(t => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const pending = TRANSACTIONS.filter(t => t.status === 'pending').reduce((s, t) => s + t.amount, 0);

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><i className="fas fa-wallet text-green-400"></i>Earnings</h1>
        <p className={`mt-1 text-sm ${sub}`}>Track your coaching revenue and payments</p>
      </motion.div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Earned', value: `$${totalEarned}`, icon: 'fas fa-dollar-sign', color: 'from-green-500 to-emerald-500' },
          { label: 'Pending', value: `$${pending}`, icon: 'fas fa-clock', color: 'from-yellow-500 to-orange-500' },
          { label: 'This Month', value: '$620', icon: 'fas fa-calendar', color: 'from-blue-500 to-cyan-500' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`rounded-2xl border p-5 ${cardBg} flex items-center gap-4`}>
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center flex-shrink-0`}>
              <i className={`${s.icon} text-white`}></i>
            </div>
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className={`text-xs ${sub}`}>{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className={`rounded-3xl border p-6 mb-6 ${glass}`}>
        <p className="font-semibold mb-1">Earnings Over Time</p>
        <p className={`text-xs mb-4 ${sub}`}>Monthly revenue for the last 6 months</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v}`, 'Earnings']} />
              <Area type="monotone" dataKey="earnings" stroke="#10B981" strokeWidth={2} fill="url(#earningsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Transactions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className={`rounded-3xl border overflow-hidden ${glass}`}>
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <p className="font-semibold">Recent Transactions</p>
        </div>
        <div className="divide-y divide-white/5">
          {TRANSACTIONS.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              className={`flex items-center justify-between p-4 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-all`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {t.player.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-sm">{t.player}</p>
                  <p className={`text-xs ${sub}`}>{t.type} · {new Date(t.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-400">+${t.amount}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${t.status === 'paid' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                  {t.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
