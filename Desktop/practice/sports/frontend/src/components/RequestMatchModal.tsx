import { useState } from 'react';
import { X, Loader2, Link2, Calendar, FileText } from 'lucide-react';
import { requestsApi } from '../lib/api';

interface RequestMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RequestMatchModal({ isOpen, onClose, onSuccess }: RequestMatchModalProps) {
  const [formData, setFormData] = useState({
    youtube_url: '',
    match_title: '',
    match_description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate YouTube URL
    if (!formData.youtube_url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/;
    if (!youtubeRegex.test(formData.youtube_url)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setSubmitting(true);
    try {
      await requestsApi.create({
        youtube_url: formData.youtube_url,
        match_title: formData.match_title || undefined,
        match_description: formData.match_description || undefined,
      });
      
      // Reset form and close
      setFormData({ youtube_url: '', match_title: '', match_description: '' });
      onSuccess();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      const message = error.response?.data?.detail || 'Failed to submit request. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setFormData({ youtube_url: '', match_title: '', match_description: '' });
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Request a Match</h2>
            <p className="text-sm text-slate-400 mt-1">
              Submit a YouTube video for highlight generation
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* YouTube URL */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Link2 size={16} className="inline mr-2" />
              YouTube URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={formData.youtube_url}
              onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              disabled={submitting}
              required
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Paste the full YouTube URL of the cricket match
            </p>
          </div>

          {/* Match Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Calendar size={16} className="inline mr-2" />
              Match Title
            </label>
            <input
              type="text"
              value={formData.match_title}
              onChange={(e) => setFormData({ ...formData, match_title: e.target.value })}
              placeholder="e.g., IND vs AUS - ODI World Cup 2023"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              disabled={submitting}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <FileText size={16} className="inline mr-2" />
              Description / Notes
            </label>
            <textarea
              value={formData.match_description}
              onChange={(e) => setFormData({ ...formData, match_description: e.target.value })}
              placeholder="Any additional details about the match or specific highlights you're looking for..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
              disabled={submitting}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>

        {/* Footer Note */}
        <div className="px-6 pb-6">
          <p className="text-xs text-slate-500 text-center">
            Your request will be reviewed by the community. Highly voted requests get processed first!
          </p>
        </div>
      </div>
    </div>
  );
}
