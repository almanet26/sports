/**
 * CoachInbox — Data table of pending & draft submissions
 * Actions: "Run AI Analysis" or "Review Draft"
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../store/themeStore';
import { submissionsApi, storageApi, resolveMediaUrl, type SubmissionSummary } from '../../lib/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-yellow-400', icon: 'fas fa-clock', bg: 'bg-yellow-500/10' },
  PROCESSING: { label: 'Processing…', color: 'text-blue-400', icon: 'fas fa-cog fa-spin', bg: 'bg-blue-500/10' },
  DRAFT_REVIEW: { label: 'Draft Ready', color: 'text-purple-400', icon: 'fas fa-edit', bg: 'bg-purple-500/10' },
  PUBLISHED: { label: 'Published', color: 'text-green-400', icon: 'fas fa-check-circle', bg: 'bg-green-500/10' },
};

export default function CoachInbox() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await submissionsApi.coachInbox(filter);
      setSubmissions(data.submissions);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Run AI analysis
  const handleAnalyze = async (id: string) => {
    setAnalyzing(id);
    setError('');
    try {
      await storageApi.startProcessing(id);
      await fetchInbox();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Analysis failed';
      setError(msg);
    } finally {
      setAnalyzing(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
          <i className="fas fa-inbox mr-3 text-purple-500"></i>
          Analysis Inbox
        </h1>
        <p className={`mt-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
          Review player-submitted videos, run AI analysis, and publish reports
        </p>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: undefined, label: 'Active (Pending & Drafts)', icon: 'fas fa-filter' },
          { key: 'PENDING', label: 'Pending', icon: 'fas fa-clock' },
          { key: 'DRAFT_REVIEW', label: 'Drafts', icon: 'fas fa-edit' },
          { key: 'PUBLISHED', label: 'Published', icon: 'fas fa-check-circle' },
        ].map((f) => (
          <button
            key={f.key ?? 'all'}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-purple-500 text-white shadow-lg'
                : dark
                  ? 'text-white/60 hover:text-white hover:bg-white/10'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <i className={`${f.icon} mr-2`}></i>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          <i className="fas fa-exclamation-circle mr-2"></i>{error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="fas fa-spinner fa-spin text-3xl text-purple-400"></i>
        </div>
      ) : submissions.length === 0 ? (
        <div className={`text-center py-20 rounded-2xl border ${dark ? 'glass border-white/10' : 'bg-white border-gray-200'}`}>
          <i className={`fas fa-inbox text-5xl mb-4 ${dark ? 'text-white/20' : 'text-gray-300'}`}></i>
          <p className={dark ? 'text-white/50' : 'text-gray-500'}>No submissions in this category.</p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${dark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={dark ? 'bg-white/5' : 'bg-gray-50'}>
                <tr>
                  {['Player', 'File', 'Type', 'Status', 'Submitted', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-left font-semibold ${dark ? 'text-white/60' : 'text-gray-600'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? 'divide-white/5' : 'divide-gray-100'}`}>
                {submissions.map((sub) => {
                  const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.PENDING;
                  return (
                    <motion.tr
                      key={sub.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    >
                      <td className={`px-5 py-4 ${dark ? 'text-white' : 'text-gray-800'}`}>
                        {sub.player_name || 'Unknown'}
                      </td>
                      <td className={`px-5 py-4 truncate max-w-[200px] ${dark ? 'text-white/70' : 'text-gray-600'}`}>
                        {sub.original_filename}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          sub.analysis_type === 'BATTING'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {sub.analysis_type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                          <i className={cfg.icon}></i>
                          {cfg.label}
                        </span>
                      </td>
                      <td className={`px-5 py-4 text-xs ${dark ? 'text-white/40' : 'text-gray-500'}`}>
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          {sub.status === 'PENDING' && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={analyzing === sub.id}
                              onClick={() => handleAnalyze(sub.id)}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-medium shadow hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              {analyzing === sub.id ? (
                                <><i className="fas fa-spinner fa-spin mr-1"></i>Running…</>
                              ) : (
                                <><i className="fas fa-robot mr-1"></i>Run AI</>
                              )}
                            </motion.button>
                          )}
                          {sub.status === 'DRAFT_REVIEW' && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => navigate(`/coach/submissions/${sub.id}/review`)}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium shadow hover:shadow-lg transition-all"
                            >
                              <i className="fas fa-pen mr-1"></i>Review Draft
                            </motion.button>
                          )}
                          {sub.status === 'PUBLISHED' && sub.pdf_report_url && (
                            <a
                              href={resolveMediaUrl(sub.pdf_report_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-medium shadow hover:shadow-lg transition-all"
                            >
                              <i className="fas fa-file-pdf mr-1"></i>View PDF
                            </a>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
