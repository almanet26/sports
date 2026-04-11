import { motion } from 'framer-motion';
import { CloudUpload } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import HeavyVideoUploader from '../components/features/HeavyVideoUploader';
import { jobsApi, videosApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

type ToastLevel = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  level: ToastLevel;
  text: string;
}

interface UploadJobCard {
  videoId: string;
  title: string;
  status: string;
  progressPercent: number;
  errorMessage?: string;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeBusy, setYoutubeBusy] = useState(false);
  const [youtubeMessage, setYoutubeMessage] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<UploadJobCard | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const notifiedJobs = useRef<Record<string, boolean>>({});

  const pushToast = (text: string, level: ToastLevel = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, level, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  };

  useEffect(() => {
    if (!activeJob?.videoId) {
      return;
    }

    const isTerminal = activeJob.status === 'completed' || activeJob.status === 'failed';
    if (isTerminal) {
      return;
    }

    const poll = async () => {
      try {
        const response = await jobsApi.getStatus(activeJob.videoId);
        const rawStatus = String(response?.data?.status || '').toLowerCase();
        const status = rawStatus || 'pending';
        const progressRaw = Number(response?.data?.progress_percent ?? 0);
        const progressPercent = Number.isFinite(progressRaw)
          ? Math.max(0, Math.min(100, progressRaw))
          : (status === 'completed' ? 100 : status === 'processing' ? 50 : 0);
        const errorMessage =
          typeof response?.data?.error_message === 'string' && response.data.error_message.trim()
            ? response.data.error_message.trim()
            : undefined;

        setActiveJob((prev) => {
          if (!prev || prev.videoId !== activeJob.videoId) {
            return prev;
          }
          return {
            ...prev,
            status,
            progressPercent,
            errorMessage,
          };
        });

        if (status === 'completed' && !notifiedJobs.current[activeJob.videoId]) {
          notifiedJobs.current[activeJob.videoId] = true;
          setYoutubeMessage('Highlights are ready. Open progress page or library to view them.');
          pushToast('Highlights ready for this YouTube upload.', 'success');
        }

        if (status === 'failed' && !notifiedJobs.current[`${activeJob.videoId}:failed`]) {
          notifiedJobs.current[`${activeJob.videoId}:failed`] = true;
          pushToast(errorMessage || 'OCR processing failed for this upload.', 'error');
        }
      } catch {
        // Ignore transient poll errors; next poll tick will retry.
      }
    };

    poll();
    const timer = setInterval(poll, 4000);
    return () => clearInterval(timer);
  }, [activeJob?.videoId, activeJob?.status]);

  const onSubmitYoutube = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedUrl = youtubeUrl.trim();
    if (!trimmedUrl) {
      setYoutubeMessage('Please enter a YouTube URL.');
      return;
    }

    try {
      setYoutubeBusy(true);
      setYoutubeMessage('Downloading from YouTube and preparing OCR...');

      const uploadRes = await videosApi.uploadYouTube({
        url: trimmedUrl,
        title: youtubeTitle.trim() || undefined,
        visibility: user?.role === 'ADMIN' ? 'public' : 'private',
        transient: true,
      });

      const videoId = String(uploadRes?.data?.id || '');
      if (!videoId) {
        throw new Error('YouTube upload did not return a video id.');
      }

      setYoutubeMessage('Starting OCR highlight generation...');
      await jobsApi.trigger(videoId, { delete_source_after_processing: true });

      setActiveJob({
        videoId,
        title: youtubeTitle.trim() || 'YouTube upload',
        status: 'pending',
        progressPercent: 5,
      });
      setYoutubeMessage('OCR started in background. You can continue using this page.');
      pushToast('YouTube upload queued. Processing started.', 'info');
      setYoutubeUrl('');
      setYoutubeTitle('');
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = typeof detail === 'string' && detail
        ? detail
        : (error?.message || 'Failed to process YouTube URL.');
      setYoutubeMessage(message);
    } finally {
      setYoutubeBusy(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-6 px-4 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-white/10 bg-slate-900/40 p-5"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <CloudUpload className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Highlights Upload</h1>
            <p className="text-sm text-slate-400">
              Upload a full match file or paste a YouTube link for OCR highlight generation. Batting and bowling biomechanics run from their dedicated pages.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="rounded-2xl border border-white/10 bg-slate-900/40 p-5"
      >
        <h2 className="text-base font-semibold text-white">Process From YouTube URL</h2>
        <p className="mt-1 text-sm text-slate-400">
          Source video is temporary and deleted after OCR. Processed highlights are kept.
        </p>

        <form className="mt-4 space-y-3" onSubmit={onSubmitYoutube}>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            disabled={youtubeBusy}
            required
          />
          <input
            type="text"
            value={youtubeTitle}
            onChange={(e) => setYoutubeTitle(e.target.value)}
            placeholder="Optional title override"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            disabled={youtubeBusy}
          />
          <button
            type="submit"
            disabled={youtubeBusy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {youtubeBusy ? 'Processing...' : 'Start OCR From YouTube'}
          </button>
        </form>

        {youtubeMessage && (
          <p className="mt-3 text-sm text-slate-300">{youtubeMessage}</p>
        )}

        {activeJob && (
          <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-950/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-blue-200">Background Job</p>
                <h3 className="text-sm font-semibold text-white">{activeJob.title}</h3>
                <p className="mt-1 text-xs text-slate-300">
                  Status: {activeJob.status.toUpperCase()}
                </p>
                {activeJob.errorMessage && (
                  <p className="mt-1 text-xs text-red-300">{activeJob.errorMessage}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate(`/video/${activeJob.videoId}`)}
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
              >
                Open progress page
              </button>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${activeJob.progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </motion.div>

      <HeavyVideoUploader analysisType="FULL_MATCH" />

      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`min-w-[260px] max-w-[360px] rounded-lg border px-3 py-2 text-sm text-white shadow-lg ${
                toast.level === 'success'
                  ? 'border-emerald-400/40 bg-emerald-900/90'
                  : toast.level === 'error'
                  ? 'border-red-400/40 bg-red-900/90'
                  : 'border-blue-400/40 bg-blue-900/90'
              }`}
            >
              {toast.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
