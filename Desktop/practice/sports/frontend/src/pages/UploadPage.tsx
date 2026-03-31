import { motion } from 'framer-motion';
import { CloudUpload } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import HeavyVideoUploader from '../components/features/HeavyVideoUploader';
import { jobsApi, videosApi } from '../lib/api';

export default function UploadPage() {
  const navigate = useNavigate();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeBusy, setYoutubeBusy] = useState(false);
  const [youtubeMessage, setYoutubeMessage] = useState<string | null>(null);

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
        visibility: 'private',
        transient: true,
      });

      const videoId = String(uploadRes?.data?.id || '');
      if (!videoId) {
        throw new Error('YouTube upload did not return a video id.');
      }

      setYoutubeMessage('Starting OCR highlight generation...');
      await jobsApi.trigger(videoId, { delete_source_after_processing: true });

      setYoutubeMessage('OCR started. Opening video detail page...');
      navigate(`/video/${videoId}`);
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
          The source is treated as transient and cleaned after OCR processing.
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
      </motion.div>

      <HeavyVideoUploader analysisType="FULL_MATCH" />
    </div>
  );
}
