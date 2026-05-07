import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useThemeStore } from '../store/themeStore';
import { submissionsApi, resolveMediaUrl, type PlayerProgress } from '../lib/api';

const TREND_CONFIG = {
  improving:         { label: 'Improving',         color: 'text-green-400',  bg: 'bg-green-500/20',  border: 'border-green-500/30',  icon: 'fas fa-arrow-up' },
  declining:         { label: 'Needs Attention',   color: 'text-red-400',    bg: 'bg-red-500/20',    border: 'border-red-500/30',    icon: 'fas fa-arrow-down' },
  stable:            { label: 'Stable',             color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', icon: 'fas fa-minus' },
  insufficient_data: { label: 'Not Enough Data',   color: 'text-white/50',   bg: 'bg-white/10',      border: 'border-white/20',      icon: 'fas fa-question' },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:      'bg-yellow-500/20 text-yellow-400',
  ACCEPTED:     'bg-teal-500/20 text-teal-400',
  PROCESSING:   'bg-blue-500/20 text-blue-400',
  DRAFT_REVIEW: 'bg-purple-500/20 text-purple-400',
  PUBLISHED:    'bg-green-500/20 text-green-400',
};

export default function PlayerPerformance() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const isSelfView = !id; // no id param = player viewing own performance

  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    const fetch = isSelfView
      ? submissionsApi.myProgress()
      : submissionsApi.playerProgress(id!);

    fetch
      .then(({ data }) => setProgress(data))
      .catch((err) => {
        const msg = err?.response?.data?.detail || 'Failed to load performance data.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [id, isSelfView]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <i className="fas fa-spinner fa-spin text-4xl text-blue-400"></i>
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="text-center py-32">
        <i className="fas fa-exclamation-circle text-4xl text-red-400 mb-4 block"></i>
        <p className={dark ? 'text-white/60' : 'text-gray-500'}>{error || 'Player not found.'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm">
          Go Back
        </button>
      </div>
    );
  }

  const { player, summary, flaw_frequency, flaw_trend, submission_timeline } = progress;
  const trend = TREND_CONFIG[summary.improvement_trend] ?? TREND_CONFIG.insufficient_data;

  // Timeline chart data — inverted so higher score = fewer flaws = better
  const publishedTimeline = submission_timeline.filter(s => s.status === 'PUBLISHED');
  const maxFlaws = Math.max(...publishedTimeline.map(s => s.flaw_count), 1);
  const timelineChartData = publishedTimeline.map((s, i) => ({
    label: `Report ${i + 1}`,
    score: maxFlaws - s.flaw_count,
    flaws: s.flaw_count,
    date:  s.created_at ? new Date(s.created_at).toLocaleDateString() : '',
  }));

  const summaryCards = [
    { label: 'Total Submissions', value: summary.total_submissions,  icon: 'fas fa-video',        color: 'from-blue-500 to-cyan-500' },
    { label: 'Published Reports', value: summary.published_reports,  icon: 'fas fa-file-pdf',     color: 'from-green-500 to-emerald-500' },
    { label: 'Completion Rate',   value: `${summary.completion_rate}%`, icon: 'fas fa-chart-pie', color: 'from-purple-500 to-pink-500' },
    {
      label: 'Last Active',
      value: summary.days_since_last_submission === 0
        ? 'Today'
        : summary.days_since_last_submission === 1
          ? 'Yesterday'
          : summary.days_since_last_submission !== null
            ? `${summary.days_since_last_submission}d ago`
            : 'N/A',
      icon: 'fas fa-clock',
      color: 'from-orange-500 to-red-500',
    },
  ];

  const typeData = [
    { type: 'Batting', count: summary.batting_submissions },
    { type: 'Bowling', count: summary.bowling_submissions },
  ];

  return (
    <div className={dark ? 'text-white' : 'text-gray-900'}>

      {/* Header */}
      {isSelfView ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-6 mb-6 border ${dark ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
        >
          <h1 className="text-3xl font-bold gradient-text">My Performance</h1>
          <p className={`mt-1 text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>
            Your biomechanics analysis history and improvement trends
          </p>
        </motion.div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className={`mb-6 px-4 py-2 rounded-xl border transition-all flex items-center gap-2 text-sm ${
            dark ? 'glass border-white/20 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50 shadow-sm'
          }`}
        >
          <i className="fas fa-arrow-left"></i> Back
        </motion.button>
      )}

      {/* Player Header — only shown in coach view */}
      {!isSelfView && (
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 mb-8 border ${dark ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold gradient-text">{player.name}</h1>
            <p className={`mt-1 text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>
              {player.email}{player.team ? ` • ${player.team}` : ''}
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              <span className={`px-3 py-1 rounded-full text-xs border ${trend.bg} ${trend.color} ${trend.border}`}>
                <i className={`${trend.icon} mr-1`}></i>{trend.label}
              </span>
              {flaw_trend && (
                <span className={`px-3 py-1 rounded-full text-xs border ${
                  flaw_trend.delta < 0
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : flaw_trend.delta > 0
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-white/10 text-white/50 border-white/20'
                }`}>
                  {flaw_trend.delta < 0
                    ? `${Math.abs(flaw_trend.delta)} fewer flaws`
                    : flaw_trend.delta > 0
                      ? `${flaw_trend.delta} more flaws`
                      : 'No change in flaws'}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
      )}

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {summaryCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-2xl p-6 border ${dark ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-md'}`}
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${card.color} flex items-center justify-center mb-4`}>
              <i className={`${card.icon} text-white`}></i>
            </div>
            <p className={`text-sm mb-1 ${dark ? 'text-white/60' : 'text-gray-500'}`}>{card.label}</p>
            <p className="text-2xl font-bold">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">

        {/* Flaw Count Trend */}
        <motion.div
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className={`rounded-3xl p-6 border ${dark ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
              <i className="fas fa-chart-line text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Performance Over Time</p>
              <p className={`text-xs ${dark ? 'text-white/50' : 'text-gray-500'}`}>Higher is better</p>
            </div>
          </div>
          {timelineChartData.length < 2 ? (
            <div className={`flex items-center justify-center h-48 rounded-xl border border-dashed ${dark ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-400'}`}>
              <p className="text-sm">Need at least 2 published reports</p>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineChartData}>
                  <defs>
                    <linearGradient id="perfGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="rgba(255,255,255,0.5)" tick={false} axisLine={false} tickLine={false} domain={[0, maxFlaws]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', color: 'white' }}
                    formatter={(_v, _n, props) => [`${props.payload.flaws} flaws`, 'Flaws']}
                    labelFormatter={(l, p) => p?.[0]?.payload?.date || l}
                  />
                  <Line type="monotone" dataKey="score" stroke="url(#perfGradient)" strokeWidth={3} dot={{ r: 5, fill: '#10B981' }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* Flaw Frequency */}
        <motion.div
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className={`rounded-3xl p-6 border ${dark ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Most Frequent Flaws</p>
              <p className={`text-xs ${dark ? 'text-white/50' : 'text-gray-500'}`}>Across all published reports</p>
            </div>
          </div>
          {flaw_frequency.length === 0 ? (
            <div className={`flex items-center justify-center h-48 rounded-xl border border-dashed ${dark ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-400'}`}>
              <p className="text-sm">No flaws detected yet</p>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flaw_frequency} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="flaw" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', color: 'white' }}
                    formatter={(v) => [`${v} times`, 'Occurrences']}
                  />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </div>

      {/* Analysis Type Split + Flaw Trend */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">

        {/* Batting vs Bowling */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-6 border ${dark ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
              <i className="fas fa-chart-bar text-white"></i>
            </div>
            <p className="font-semibold">Analysis Type Split</p>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="type" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', color: 'white' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}
                  fill="url(#typeGrad)"
                />
                <defs>
                  <linearGradient id="typeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#EF4444" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Flaw Trend Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-6 border ${dark ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <i className="fas fa-trophy text-white"></i>
            </div>
            <p className="font-semibold">Improvement Summary</p>
          </div>
          {flaw_trend ? (
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 rounded-xl ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
                <span className={`text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>First Report Flaws</span>
                <span className="text-xl font-bold text-red-400">{flaw_trend.first_report_flaw_count}</span>
              </div>
              <div className={`flex items-center justify-between p-4 rounded-xl ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
                <span className={`text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>Latest Report Flaws</span>
                <span className="text-xl font-bold text-green-400">{flaw_trend.latest_report_flaw_count}</span>
              </div>
              <div className={`flex items-center justify-between p-4 rounded-xl border ${
                flaw_trend.delta < 0
                  ? 'bg-green-500/10 border-green-500/30'
                  : flaw_trend.delta > 0
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-white/5 border-white/10'
              }`}>
                <span className={`text-sm font-medium ${dark ? 'text-white/80' : 'text-gray-700'}`}>Overall Change</span>
                <span className={`text-xl font-bold ${flaw_trend.delta < 0 ? 'text-green-400' : flaw_trend.delta > 0 ? 'text-red-400' : 'text-white/50'}`}>
                  {flaw_trend.delta > 0 ? '+' : ''}{flaw_trend.delta} flaws
                </span>
              </div>
            </div>
          ) : (
            <div className={`flex items-center justify-center h-32 rounded-xl border border-dashed ${dark ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-400'}`}>
              <p className="text-sm">Need at least 2 published reports</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Submission Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 border ${dark ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
            <i className="fas fa-history text-white"></i>
          </div>
          <div>
            <p className="font-semibold">Submission History</p>
            <p className={`text-xs ${dark ? 'text-white/50' : 'text-gray-500'}`}>{submission_timeline.length} total submissions</p>
          </div>
        </div>

        <div className={`rounded-xl border overflow-hidden ${dark ? 'border-white/10' : 'border-gray-200'}`}>
          <table className="w-full text-sm">
            <thead className={dark ? 'bg-white/5' : 'bg-gray-50'}>
              <tr>
                {['Date', 'Type', 'Status', 'Flaws', 'Report'].map(h => (
                  <th key={h} className={`px-4 py-3 text-left font-semibold ${dark ? 'text-white/60' : 'text-gray-600'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${dark ? 'divide-white/5' : 'divide-gray-100'}`}>
              {submission_timeline.map((sub, i) => (
                <motion.tr
                  key={sub.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className={dark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}
                >
                  <td className={`px-4 py-3 ${dark ? 'text-white/70' : 'text-gray-600'}`}>
                    {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      sub.analysis_type === 'BATTING' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {sub.analysis_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-white/10 text-white/50'}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-medium ${
                    sub.status === 'PUBLISHED'
                      ? sub.flaw_count === 0 ? 'text-green-400' : 'text-red-400'
                      : dark ? 'text-white/30' : 'text-gray-400'
                  }`}>
                    {sub.status === 'PUBLISHED' ? sub.flaw_count : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {sub.pdf_report_url ? (
                      <a
                        href={resolveMediaUrl(sub.pdf_report_url)}
                        target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-medium hover:shadow-lg transition-all"
                      >
                        <i className="fas fa-file-pdf mr-1"></i>PDF
                      </a>
                    ) : (
                      <span className={`text-xs ${dark ? 'text-white/30' : 'text-gray-400'}`}>—</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
