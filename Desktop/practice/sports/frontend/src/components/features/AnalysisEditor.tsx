/**
 * AnalysisEditor — Coach's core review dashboard
 *
 * Left column:  Video player + biometrics line charts
 * Right column: Rich text editor (initialized with ai_draft_text)
 * Action:       "Publish to Player" button (PUT request)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useThemeStore } from '../../store/themeStore';
import { submissionsApi, resolveMediaUrl, type SubmissionDetail } from '../../lib/api';

// Metric colors for charts
const METRIC_COLORS: Record<string, string> = {
  head_alignment: '#3b82f6',
  stride_length: '#10b981',
  backlift_height: '#f59e0b',
  front_knee_angle: '#ef4444',
  back_knee_angle: '#8b5cf6',
  shoulder_rotation: '#06b6d4',
  wrist_height: '#ec4899',
  hip_rotation: '#f97316',
  r_elbow_angle: '#3b82f6',
  r_shoulder_angle: '#10b981',
  stride_length_norm: '#f59e0b',
  r_wrist_y: '#ef4444',
};

export default function AnalysisEditor() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editedText, setEditedText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Fetch submission detail
  const fetchDetail = useCallback(async () => {
    if (!submissionId) return;
    setLoading(true);
    try {
      const { data } = await submissionsApi.getById(submissionId);
      setSubmission(data);
      // Initialize editor with AI draft text
      setEditedText(data.ai_draft_text || '');
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Parse biometrics records for charts
  const chartData = useMemo(() => {
    if (!submission?.raw_biometrics?.records) return [];
    return submission.raw_biometrics.records;
  }, [submission]);

  const metricKeys = useMemo(() => {
    if (chartData.length === 0) return [];
    return Object.keys(chartData[0]).filter(
      (k) => k !== 'frame' && k !== 'timestamp'
    );
  }, [chartData]);

  // Publish handler
  const handlePublish = async () => {
    if (!submissionId || !editedText.trim()) return;
    setPublishing(true);
    setPublishError('');
    try {
      const { data } = await submissionsApi.publish(submissionId, editedText);
      setSubmission(data);
      setPublishSuccess(true);
      setTimeout(() => navigate('/coach/submissions'), 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Publish failed';
      setPublishError(msg);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <i className="fas fa-spinner fa-spin text-4xl text-purple-400"></i>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-20">
        <i className="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
        <p className={dark ? 'text-white/50' : 'text-gray-500'}>Submission not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <button
            onClick={() => navigate('/coach/submissions')}
            className={`text-sm mb-2 ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <i className="fas fa-arrow-left mr-2"></i>Back to Inbox
          </button>
          <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
            <i className="fas fa-edit mr-3 text-purple-500"></i>
            Review: {submission.original_filename}
          </h1>
          <p className={`text-sm mt-1 ${dark ? 'text-white/40' : 'text-gray-500'}`}>
            Player: {submission.player_name || 'Unknown'} · {submission.analysis_type} ·
            Status: {submission.status}
          </p>
        </div>

        {submission.status === 'PUBLISHED' && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-2 rounded-xl text-sm font-medium">
            <i className="fas fa-check-circle mr-2"></i>Already Published
          </div>
        )}
      </motion.div>

      {publishSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm"
        >
          <i className="fas fa-check-circle mr-2"></i>
          Report published successfully! Redirecting to inbox…
        </motion.div>
      )}

      {publishError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          <i className="fas fa-exclamation-circle mr-2"></i>{publishError}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ══ LEFT: Video + Charts ══ */}
        <div className="space-y-6">
          {/* Video Player */}
          <div className={`rounded-2xl overflow-hidden border ${dark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
            <div className={`px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-gray-200'}`}>
              <h2 className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>
                <i className="fas fa-video mr-2 text-blue-400"></i>Video
              </h2>
            </div>
            <div className="aspect-video bg-black">
              {submission.annotated_video_url ? (
                <video
                  controls
                  className="w-full h-full"
                  src={resolveMediaUrl(submission.annotated_video_url)}
                />
              ) : (
                <video
                  controls
                  className="w-full h-full"
                  src={resolveMediaUrl(submission.video_url)}
                />
              )}
            </div>
          </div>

          {/* Key Frame */}
          {submission.key_frame_url && (
            <div className={`rounded-2xl overflow-hidden border ${dark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
              <div className={`px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-gray-200'}`}>
                <h2 className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>
                  <i className="fas fa-camera mr-2 text-amber-400"></i>Key Frame
                </h2>
              </div>
              <img
                src={resolveMediaUrl(submission.key_frame_url)}
                alt="Key frame"
                className="w-full"
              />
            </div>
          )}

          {/* Biometrics Charts */}
          {chartData.length > 0 && (
            <div className={`rounded-2xl border p-5 ${dark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
              <h2 className={`font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-800'}`}>
                <i className="fas fa-chart-line mr-2 text-cyan-400"></i>Biometrics Over Time
              </h2>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#ffffff15' : '#e5e7eb'} />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fill: dark ? '#ffffff60' : '#6b7280', fontSize: 11 }}
                      label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fill: dark ? '#ffffff40' : '#9ca3af' }}
                    />
                    <YAxis tick={{ fill: dark ? '#ffffff60' : '#6b7280', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: dark ? '#1a1a2e' : '#ffffff',
                        border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                        borderRadius: '12px',
                        color: dark ? '#ffffff' : '#111827',
                      }}
                    />
                    <Legend />
                    {metricKeys.slice(0, 6).map((key) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={key.replace(/_/g, ' ')}
                        stroke={METRIC_COLORS[key] || '#888888'}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Phase Detection */}
          {submission.phase_info && Object.keys(submission.phase_info).length > 0 && (
            <div className={`rounded-2xl border p-5 ${dark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
              <h2 className={`font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-800'}`}>
                <i className="fas fa-flag-checkered mr-2 text-green-400"></i>Phase Detection
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(submission.phase_info).map(([name, frame]) => (
                  <div
                    key={name}
                    className={`p-3 rounded-xl border ${dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <p className={`text-xs font-medium capitalize ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                      {name.replace(/_/g, ' ')}
                    </p>
                    <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>
                      {frame !== null ? `Frame ${frame}` : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ══ RIGHT: Rich Text Editor + Publish ══ */}
        <div className="space-y-6">
          <div className={`rounded-2xl border ${dark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
            <div className={`px-5 py-3 border-b flex items-center justify-between ${dark ? 'border-white/10' : 'border-gray-200'}`}>
              <h2 className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>
                <i className="fas fa-pen-fancy mr-2 text-purple-400"></i>
                {submission.status === 'PUBLISHED' ? 'Published Feedback' : 'Edit AI Feedback'}
              </h2>
              {submission.status === 'DRAFT_REVIEW' && (
                <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
                  Editable
                </span>
              )}
            </div>

            {/* Toolbar hint */}
            {submission.status === 'DRAFT_REVIEW' && (
              <div className={`px-5 py-2 text-xs border-b ${dark ? 'border-white/5 text-white/30' : 'border-gray-100 text-gray-400'}`}>
                <i className="fas fa-info-circle mr-1"></i>
                Use Markdown formatting: **bold**, ## headings, - bullets
              </div>
            )}

            {/* Text area (acts as the Rich Text Editor) */}
            <textarea
              value={submission.status === 'PUBLISHED' ? (submission.coach_final_text || '') : editedText}
              onChange={(e) => setEditedText(e.target.value)}
              readOnly={submission.status === 'PUBLISHED'}
              rows={30}
              className={`w-full px-5 py-4 font-mono text-sm leading-relaxed resize-none focus:outline-none ${
                dark
                  ? 'bg-transparent text-white/90 placeholder-white/20'
                  : 'bg-transparent text-gray-800 placeholder-gray-300'
              } ${submission.status === 'PUBLISHED' ? 'cursor-default' : ''}`}
              placeholder="AI feedback will appear here after analysis…"
            />
          </div>

          {/* Summary Stats from raw_biometrics.summary */}
          {submission.raw_biometrics?.summary && Object.keys(submission.raw_biometrics.summary).length > 0 && (
            <div className={`rounded-2xl border p-5 ${dark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
              <h2 className={`font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-800'}`}>
                <i className="fas fa-table mr-2 text-blue-400"></i>Metrics Summary
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={dark ? 'text-white/50' : 'text-gray-500'}>
                      <th className="text-left py-2 px-3">Metric</th>
                      <th className="text-right py-2 px-3">Mean</th>
                      <th className="text-right py-2 px-3">Min</th>
                      <th className="text-right py-2 px-3">Max</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${dark ? 'divide-white/5' : 'divide-gray-100'}`}>
                    {Object.entries(submission.raw_biometrics.summary).map(([metric, stats]) => (
                      <tr key={metric} className={dark ? 'text-white/70' : 'text-gray-700'}>
                        <td className="py-2 px-3 capitalize">{metric.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {typeof stats.mean === 'number' ? stats.mean.toFixed(2) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {typeof stats.min === 'number' ? stats.min.toFixed(2) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {typeof stats.max === 'number' ? stats.max.toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Publish Button */}
          {submission.status === 'DRAFT_REVIEW' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={publishing || !editedText.trim()}
              onClick={handlePublish}
              className={`w-full py-5 rounded-2xl text-white font-bold text-xl transition-all shadow-xl ${
                publishing || !editedText.trim()
                  ? 'bg-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:shadow-2xl hover:shadow-green-500/30'
              }`}
            >
              {publishing ? (
                <span className="flex items-center justify-center gap-3">
                  <i className="fas fa-spinner fa-spin text-2xl"></i>
                  Generating PDF & Publishing…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  <i className="fas fa-paper-plane text-2xl"></i>
                  Publish to Player
                </span>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
