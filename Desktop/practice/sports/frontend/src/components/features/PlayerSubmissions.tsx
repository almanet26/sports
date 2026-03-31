/**
 * PlayerSubmissions — Upload Widget + Report Gallery
 *
 * Upload: Drag-and-drop + coach selector dropdown
 * Gallery: Grid of PUBLISHED reports with PDF download
 * Status tracker for all submissions
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../../store/themeStore';
import {
  submissionsApi,
  resolveMediaUrl,
  type SubmissionSummary,
  type CoachListItem,
} from '../../lib/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Pending Review', color: 'yellow', icon: 'fas fa-clock' },
  PROCESSING: { label: 'AI Processing', color: 'blue', icon: 'fas fa-cog fa-spin' },
  DRAFT_REVIEW: { label: 'Coach Reviewing', color: 'purple', icon: 'fas fa-edit' },
  PUBLISHED: { label: 'Published', color: 'green', icon: 'fas fa-check-circle' },
};

export default function PlayerSubmissions() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  // State
  const [coaches, setCoaches] = useState<CoachListItem[]>([]);
  const [selectedCoach, setSelectedCoach] = useState('');
  const [analysisType, setAnalysisType] = useState<'BATTING' | 'BOWLING'>('BATTING');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeTab, setActiveTab] = useState<'upload' | 'all' | 'published'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch coaches + submissions
  const fetchCoaches = useCallback(async () => {
    try {
      const { data } = await submissionsApi.listCoaches();
      setCoaches(data.coaches);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchSubmissions = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data } =
        activeTab === 'published'
          ? await submissionsApi.playerReports()
          : await submissionsApi.playerAll();
      setSubmissions(data.submissions);
    } catch {
      /* ignore */
    } finally {
      setLoadingList(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  useEffect(() => {
    if (activeTab !== 'upload') fetchSubmissions();
  }, [activeTab, fetchSubmissions]);

  // Upload handler
  const handleUpload = async () => {
    if (!file || !selectedCoach) return;
    setUploading(true);
    setUploadError('');
    setUploadProgress(0);
    try {
      await submissionsApi.upload(file, selectedCoach, analysisType, setUploadProgress);
      setFile(null);
      setSelectedCoach('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setActiveTab('all');
      fetchSubmissions();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Upload failed';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  // Drag & drop
  const [dragOver, setDragOver] = useState(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && /\.(mp4|mov|avi)$/i.test(dropped.name)) setFile(dropped);
  };

  // Status badge renderer
  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
    const bg = dark
      ? `bg-${cfg.color}-500/20 text-${cfg.color}-400 border-${cfg.color}-500/30`
      : `bg-${cfg.color}-100 text-${cfg.color}-700 border-${cfg.color}-300`;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${bg}`}>
        <i className={cfg.icon}></i>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
          <i className="fas fa-paper-plane mr-3 text-blue-500"></i>
          My Submissions
        </h1>
        <p className={`mt-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
          Upload videos for your coach to review with AI-powered analysis
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['upload', 'all', 'published'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-blue-500 text-white shadow-lg'
                : dark
                  ? 'text-white/60 hover:text-white hover:bg-white/10'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            {tab === 'upload' && <><i className="fas fa-upload mr-2"></i>Upload</>}
            {tab === 'all' && <><i className="fas fa-list mr-2"></i>All Submissions</>}
            {tab === 'published' && <><i className="fas fa-file-pdf mr-2"></i>Published Reports</>}
          </button>
        ))}
      </div>

      {/* Upload Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`rounded-2xl p-6 border ${
              dark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-lg'
            }`}
          >
            <h2 className={`text-xl font-semibold mb-6 ${dark ? 'text-white' : 'text-gray-800'}`}>
              <i className="fas fa-cloud-upload-alt mr-2 text-blue-400"></i>
              Submit Video for Review
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: File drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all ${
                  dragOver
                    ? 'border-blue-500 bg-blue-500/10'
                    : file
                      ? dark ? 'border-green-500/50 bg-green-500/5' : 'border-green-400 bg-green-50'
                      : dark ? 'border-white/20 hover:border-white/40' : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.mov,.avi"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFile(f);
                  }}
                />
                {file ? (
                  <>
                    <i className="fas fa-check-circle text-4xl text-green-500 mb-3"></i>
                    <p className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{file.name}</p>
                    <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-500'}`}>
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <i className={`fas fa-video text-5xl mb-4 ${dark ? 'text-white/30' : 'text-gray-300'}`}></i>
                    <p className={`font-medium ${dark ? 'text-white/70' : 'text-gray-600'}`}>
                      Drop video here or click to browse
                    </p>
                    <p className={`text-xs mt-1 ${dark ? 'text-white/30' : 'text-gray-400'}`}>
                      MP4, MOV, or AVI
                    </p>
                  </>
                )}
              </div>

              {/* Right: Coach selection + type + submit */}
              <div className="space-y-5">
                {/* Coach dropdown */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dark ? 'text-white/70' : 'text-gray-700'}`}>
                    Select Coach
                  </label>
                  <select
                    value={selectedCoach}
                    onChange={(e) => setSelectedCoach(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 border transition-all focus:ring-2 focus:ring-blue-500 ${
                      dark
                        ? 'bg-white/5 border-white/20 text-white'
                        : 'bg-gray-50 border-gray-300 text-gray-800'
                    }`}
                  >
                    <option value="">-- Choose a coach --</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.team ? `(${c.team})` : ''} — {c.email}
                      </option>
                    ))}
                  </select>
                  {coaches.length === 0 && (
                    <p className="text-xs text-yellow-500 mt-1">
                      <i className="fas fa-exclamation-triangle mr-1"></i>
                      No coaches available. Ask your coach to register first.
                    </p>
                  )}
                </div>

                {/* Analysis type */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dark ? 'text-white/70' : 'text-gray-700'}`}>
                    Analysis Type
                  </label>
                  <div className="flex gap-3">
                    {(['BATTING', 'BOWLING'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setAnalysisType(t)}
                        className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          analysisType === t
                            ? t === 'BATTING'
                              ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                              : 'border-blue-500 bg-blue-500/20 text-blue-400'
                            : dark
                              ? 'border-white/10 text-white/50 hover:border-white/30'
                              : 'border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        <i className={`fas ${t === 'BATTING' ? 'fa-baseball-bat-ball' : 'fa-bowling-ball'} mr-2`}></i>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!file || !selectedCoach || uploading}
                  onClick={handleUpload}
                  className={`w-full py-4 rounded-xl text-white font-semibold text-lg transition-all ${
                    !file || !selectedCoach || uploading
                      ? 'bg-gray-500 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-lg hover:shadow-blue-500/25'
                  }`}
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="fas fa-spinner fa-spin"></i>
                      Uploading… {uploadProgress}%
                    </span>
                  ) : (
                    <span>
                      <i className="fas fa-paper-plane mr-2"></i>
                      Submit to Coach
                    </span>
                  )}
                </motion.button>

                {/* Upload progress bar */}
                {uploading && (
                  <div className={`h-2 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-200'}`}>
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}

                {uploadError && (
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <i className="fas fa-exclamation-circle"></i>
                    {uploadError}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* All Submissions / Published Tab */}
        {activeTab !== 'upload' && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {loadingList ? (
              <div className="flex items-center justify-center py-20">
                <i className="fas fa-spinner fa-spin text-3xl text-blue-400"></i>
              </div>
            ) : submissions.length === 0 ? (
              <div className={`text-center py-20 rounded-2xl border ${dark ? 'glass border-white/10' : 'bg-white border-gray-200'}`}>
                <i className={`fas fa-inbox text-5xl mb-4 ${dark ? 'text-white/20' : 'text-gray-300'}`}></i>
                <p className={dark ? 'text-white/50' : 'text-gray-500'}>
                  {activeTab === 'published' ? 'No published reports yet.' : 'No submissions yet.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {submissions.map((sub) => (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-2xl p-5 border transition-all hover:shadow-lg ${
                      dark ? 'glass border-white/10 hover:border-white/20' : 'bg-white border-gray-200 hover:border-blue-300 shadow-sm'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className={`font-medium text-sm truncate ${dark ? 'text-white' : 'text-gray-800'}`}>
                          {sub.original_filename}
                        </p>
                        <p className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>
                          {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={sub.status} />
                    </div>

                    {/* Info */}
                    <div className={`text-xs space-y-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                      <p><i className="fas fa-user-tie mr-1.5"></i>Coach: {sub.coach_name || 'Unknown'}</p>
                      <p>
                        <i className={`fas ${sub.analysis_type === 'BATTING' ? 'fa-baseball-bat-ball' : 'fa-bowling-ball'} mr-1.5`}></i>
                        {sub.analysis_type}
                      </p>
                    </div>

                    {/* PDF download if published */}
                    {sub.status === 'PUBLISHED' && sub.pdf_report_url && (
                      <motion.a
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        href={resolveMediaUrl(sub.pdf_report_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all"
                      >
                        <i className="fas fa-file-pdf"></i>
                        Download Report
                      </motion.a>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
