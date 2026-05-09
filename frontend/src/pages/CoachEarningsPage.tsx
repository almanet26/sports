import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { earningsApi, type TransactionItem, type EarningsStats, type MonthlyEarnings } from '../lib/api';

export default function CoachEarningsPage() {
  const { theme } = useThemeStore();
  const [stats, setStats] = useState<EarningsStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyEarnings[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const tooltipStyle = { backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: 'white' };

  useEffect(() => {
    Promise.all([
      earningsApi.getStats().then(r => setStats(r.data)),
      earningsApi.getMonthly().then(r => setMonthly(r.data)),
      earningsApi.getTransactions().then(r => setTransactions(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><i className="fas fa-wallet text-green-400"></i>Earnings</h1>
        <p className={`mt-1 text-sm ${sub}`}>Track your coaching revenue and payments</p>
      </motion.div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Earned', value: `$${stats?.total_earned || 0}`, icon: 'fas fa-dollar-sign', color: 'from-green-500 to-emerald-500' },
          { label: 'Pending', value: `$${stats?.pending || 0}`, icon: 'fas fa-clock', color: 'from-yellow-500 to-orange-500' },
          { label: 'This Month', value: `$${stats?.this_month || 0}`, icon: 'fas fa-calendar', color: 'from-blue-500 to-cyan-500' },
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
      {monthly.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={`rounded-3xl border p-6 mb-6 ${glass}`}>
          <p className="font-semibold mb-1">Earnings Over Time</p>
          <p className={`text-xs mb-4 ${sub}`}>Monthly revenue for the last 6 months</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
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
      )}

      {/* Transactions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className={`rounded-3xl border overflow-hidden ${glass}`}>
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <p className="font-semibold">Recent Transactions</p>
        </div>
        {transactions.length === 0 ? (
          <div className="p-16 text-center">
            <i className={`fas fa-receipt text-5xl mb-4 ${sub}`}></i>
            <p className="font-semibold text-lg mb-1">No transactions yet</p>
            <p className={`text-sm ${sub}`}>Your earnings will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {transactions.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className={`flex items-center justify-between p-4 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-all`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {t.player_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t.player_name}</p>
                    <p className={`text-xs ${sub}`}>{t.transaction_type} · {new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
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
        )}
      </motion.div>
    </div>
  );
}
