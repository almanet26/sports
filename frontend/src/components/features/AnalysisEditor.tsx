/**
 * AnalysisEditor — Coach's core review dashboard
 *
 * Left column:  Video player + biometrics line charts
 * Right column: Rich text editor (initialized with ai_draft_text)
 * Action:       "Publish to Player" button (PUT request)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useThemeStore } from '../../store/themeStore';
import { submissionsApi, resolveMediaUrl, type SubmissionDetail } from '../../lib/api';
import { useSubscriptionStore } from '../../stores/authStore';

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

type Point = { x: number; y: number };
type SavedSketch = {
  coordinates: Point[];
  color: string;
  timestamp: number;
  snapshot_data_url?: string;
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
  const [videoError, setVideoError] = useState(false);
  const [keyFrameError, setKeyFrameError] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [annotationLabel, setAnnotationLabel] = useState('');
  const [annotationColor, setAnnotationColor] = useState('#f59e0b');
  const [savedSketches, setSavedSketches] = useState<SavedSketch[]>([]);
  const [annotationError, setAnnotationError] = useState('');
  const reviewVideoRef = useRef<HTMLDivElement | null>(null);
  const reviewPlayerRef = useRef<HTMLVideoElement | null>(null);
  const reviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const accountType = useSubscriptionStore((s) => s.accountType);
  const subscriptionTier = useSubscriptionStore((s) => s.subscriptionTier);
  const canAnnotate = accountType === 'ADMIN' || (accountType === 'COACH' && subscriptionTier !== 'coach_free');

  // Fetch submission detail
  const fetchDetail = useCallback(async () => {
    if (!submissionId) return;
    setLoading(true);
    // Reset media error states when loading a new submission
    setVideoError(false);
    setKeyFrameError(false);
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

  useEffect(() => {
    if (!submissionId || !canAnnotate) return;
    try {
      const raw = localStorage.getItem(`coach-sketch:${submissionId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedSketch[];
      if (Array.isArray(parsed)) {
        setSavedSketches(
          parsed.filter(
            (sketch) => sketch && typeof sketch === 'object' && Array.isArray(sketch.coordinates) && sketch.coordinates.length > 1
          )
        );
      }
    } catch {
      // Ignore malformed local drafts.
    }
  }, [canAnnotate, submissionId]);

  useEffect(() => {
    if (!submissionId || !canAnnotate) return;
    localStorage.setItem(`coach-sketch:${submissionId}`, JSON.stringify(savedSketches));
  }, [canAnnotate, savedSketches, submissionId]);

  const syncReviewCanvas = useCallback(() => {
    const canvas = reviewCanvasRef.current;
    const container = reviewVideoRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const drawSketchPath = useCallback((context: CanvasRenderingContext2D, path: Point[], color: string) => {
    if (path.length < 2) return;
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i += 1) {
      context.lineTo(path[i].x, path[i].y);
    }
    context.stroke();
  }, []);

  const redrawReviewCanvas = useCallback(() => {
    const canvas = reviewCanvasRef.current;
    const container = reviewVideoRef.current;
    if (!canvas || !container) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = container.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);
    savedSketches.forEach((sketch) => drawSketchPath(context, sketch.coordinates, sketch.color));
    if (draftPoints.length > 0) drawSketchPath(context, draftPoints, annotationColor);
  }, [annotationColor, draftPoints, drawSketchPath, savedSketches]);

  const getReviewPoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = reviewCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  useEffect(() => {
    syncReviewCanvas();
    redrawReviewCanvas();
    const handleResize = () => {
      syncReviewCanvas();
      redrawReviewCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawReviewCanvas, syncReviewCanvas]);

  const handleSketchPointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawMode || !canAnnotate) return;
    const point = getReviewPoint(event);
    if (!point) return;
    setIsDrawing(true);
    setDraftPoints([point]);
  }, [canAnnotate, drawMode, getReviewPoint]);

  const handleSketchPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawMode || !canAnnotate) return;
    const point = getReviewPoint(event);
    if (!point) return;
    setDraftPoints((current) => [...current, point]);
  }, [canAnnotate, drawMode, getReviewPoint, isDrawing]);

  const stopSketch = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
  }, [isDrawing]);

  const saveSketch = useCallback(() => {
    if (draftPoints.length < 2) return;
    // Capture the video playback position in seconds (not Unix epoch ms).
    const videoTimeSec = reviewPlayerRef.current?.currentTime ?? 0;
    let snapshotDataUrl: string | undefined;
    try {
      const video = reviewPlayerRef.current;
      const container = reviewVideoRef.current;
      if (video && container && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const rect = container.getBoundingClientRect();
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = Math.max(1, Math.round(rect.width));
        frameCanvas.height = Math.max(1, Math.round(rect.height));
        const ctx = frameCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);
          // Overlay the video timestamp on the snapshot so the PDF shows it.
          ctx.font = 'bold 14px sans-serif';
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(6, 4, 90, 22);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`@ ${videoTimeSec.toFixed(2)}s`, 10, 20);
          snapshotDataUrl = frameCanvas.toDataURL('image/jpeg', 0.9);
        }
      }
    } catch {
      // Snapshot is optional; sketches still save without it.
    }
    setSavedSketches((current) => [
      ...current,
      {
        coordinates: draftPoints,
        color: annotationColor,
        timestamp: videoTimeSec,   // video time in seconds, not Unix ms
        snapshot_data_url: snapshotDataUrl,
      },
    ]);
    setDraftPoints([]);
    setAnnotationError('');
  }, [draftPoints, annotationColor]);


  const clearSketch = useCallback(() => {
    setDraftPoints([]);
    setAnnotationError('');
  }, []);

  // Publish handler
  const handlePublish = async () => {
    if (!submissionId || !editedText.trim()) return;
    setPublishing(true);
    setPublishError('');
    try {
      const { data } = await submissionsApi.publish(
        submissionId,
        editedText,
        savedSketches
      );
      setSubmission(data);
      setPublishSuccess(true);
      // Clear sketches from localStorage after successful publish
      if (submissionId) {
        localStorage.removeItem(`coach-sketch:${submissionId}`);
      }
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
            <div ref={reviewVideoRef} className="aspect-video bg-black relative overflow-hidden">
              {videoError ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-white/50">
                  <i className="fas fa-exclamation-triangle text-yellow-400 text-3xl"></i>
                  <p className="text-sm">Video file unavailable</p>
                </div>
              ) : submission.annotated_video_url ? (
                <video
                  ref={reviewPlayerRef}
                  controls
                  crossOrigin="anonymous"
                  className="w-full h-full relative z-10"
                  src={resolveMediaUrl(submission.annotated_video_url)}
                  onError={() => setVideoError(true)}
                />
              ) : (
                <video
                  ref={reviewPlayerRef}
                  controls
                  crossOrigin="anonymous"
                  className="w-full h-full relative z-10"
                  src={resolveMediaUrl(submission.video_url)}
                  onError={() => setVideoError(true)}
                />
              )}

              {canAnnotate && (
                <>
                  <canvas
                    ref={reviewCanvasRef}
                    className={`absolute inset-0 z-20 ${drawMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
                    onPointerDown={handleSketchPointerDown}
                    onPointerMove={handleSketchPointerMove}
                    onPointerUp={stopSketch}
                    onPointerLeave={stopSketch}
                  />
                  <div className="absolute top-3 right-3 z-30 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur">
                    <button
                      type="button"
                      onClick={() => setDrawMode((current) => !current)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${drawMode ? 'bg-amber-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                      {drawMode ? 'Stop drawing' : 'Draw'}
                    </button>
                    <label className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-xs text-white/70">
                      Color
                      <input
                        type="color"
                        value={annotationColor}
                        onChange={(event) => setAnnotationColor(event.target.value)}
                        className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
            {canAnnotate && (
              <div className={`border-t px-5 py-4 ${dark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={annotationLabel}
                    onChange={(event) => setAnnotationLabel(event.target.value)}
                    placeholder="Optional note for this sketch"
                    className={`min-w-[220px] flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'border-white/10 bg-white/5 text-white placeholder-white/30' : 'border-gray-300 bg-white text-gray-800 placeholder-gray-400'}`}
                  />
                  <button
                    type="button"
                    onClick={clearSketch}
                    className={`rounded-xl px-4 py-3 text-sm font-medium ${dark ? 'bg-white/5 text-white/80 hover:bg-white/10' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (draftPoints.length < 2) {
                        setAnnotationError('Draw on the video first.');
                        return;
                      }
                      saveSketch();
                    }}
                    className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-400"
                  >
                    Save sketch
                  </button>
                </div>
                {annotationError && <p className="mt-2 text-sm text-red-400">{annotationError}</p>}
                {savedSketches.length > 0 && (
                  <div className={`mt-2 text-xs ${dark ? 'text-white/40' : 'text-gray-500'}`}>
                    <span className="font-medium">{savedSketches.length} sketch{savedSketches.length > 1 ? 'es' : ''} saved: </span>
                    {savedSketches.map((s, i) => (
                      <span key={i} className="mr-2">
                        #{i + 1} @ {typeof s.timestamp === 'number' ? `${s.timestamp.toFixed(1)}s` : '?'}
                      </span>
                    ))}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Key Frame */}
          {submission.key_frame_url && (
            <div className={`rounded-2xl overflow-hidden border ${dark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
              <div className={`px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-gray-200'}`}>
                <h2 className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>
                  <i className="fas fa-camera mr-2 text-amber-400"></i>Key Frame
                </h2>
              </div>
              {keyFrameError ? (
                <div className={`flex flex-col items-center justify-center py-10 gap-2 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
                  <i className="fas fa-image text-2xl"></i>
                  <p className="text-sm">Key frame unavailable</p>
                </div>
              ) : (
                <img
                  src={resolveMediaUrl(submission.key_frame_url)}
                  alt="Key frame"
                  className="w-full"
                  onError={() => setKeyFrameError(true)}
                />
              )}
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
