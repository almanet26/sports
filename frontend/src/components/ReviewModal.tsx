import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api } from '../lib/api';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  coachId: string;
  coachName: string;
  onSuccess?: () => void;
}

export default function ReviewModal({ isOpen, onClose, coachId, coachName, onSuccess }: ReviewModalProps) {
  const { theme } = useThemeStore();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError('Please select a rating'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/coach/reviews', { coach_id: coachId, rating, comment: comment.trim() || null });
      setRating(0);
      setComment('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const detail = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      setError(detail || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) { setRating(0); setComment(''); setError(''); onClose(); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}>
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-3xl p-6 ${theme === 'dark' ? 'glass border border-white/20' : 'bg-white shadow-2xl'}`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold gradient-text">Rate Your Coach</h2>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                  How was your experience with {coachName}?
                </p>
              </div>
              <button onClick={handleClose} disabled={submitting}
                className={`w-10 h-10 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'} disabled:opacity-50`}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3">Your Rating</label>
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)} onMouseLeave={() => setHoveredRating(0)}
                      className="transition-transform hover:scale-110">
                      <i className={`fas fa-star text-4xl ${star <= (hoveredRating || rating) ? 'text-yellow-400' : theme === 'dark' ? 'text-white/20' : 'text-gray-300'}`}></i>
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className={`text-center mt-2 text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                    {rating === 5 && (
                      <span className="inline-flex items-center gap-2">
                        <i className="fas fa-star text-yellow-400" />
                        Excellent!
                      </span>
                    )}
                    {rating === 4 && (
                      <span className="inline-flex items-center gap-2">
                        <i className="fas fa-thumbs-up text-emerald-400" />
                        Very Good!
                      </span>
                    )}
                    {rating === 3 && (
                      <span className="inline-flex items-center gap-2">
                        <i className="fas fa-smile text-blue-400" />
                        Good
                      </span>
                    )}
                    {rating === 2 && (
                      <span className="inline-flex items-center gap-2">
                        <i className="fas fa-meh text-amber-400" />
                        Fair
                      </span>
                    )}
                    {rating === 1 && (
                      <span className="inline-flex items-center gap-2">
                        <i className="fas fa-frown text-red-400" />
                        Poor
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Your Feedback <span className={theme === 'dark' ? 'text-white/40' : 'text-gray-400'}>(Optional)</span>
                </label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={500}
                  placeholder="Share your experience with this coach..."
                  className={`w-full px-4 py-3 rounded-xl border transition-all resize-none ${theme === 'dark' ? 'glass border-white/20 focus:border-blue-500 placeholder-white/30' : 'bg-gray-50 border-gray-200 focus:border-blue-500 placeholder-gray-400'}`} />
                <p className={`text-xs mt-1 text-right ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>{comment.length}/500</p>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  <i className="fas fa-exclamation-circle mr-2"></i>{error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose} disabled={submitting}
                  className={`flex-1 px-6 py-3 rounded-xl border transition-all ${theme === 'dark' ? 'border-white/20 hover:bg-white/10' : 'border-gray-300 hover:bg-gray-50'} disabled:opacity-50`}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting || rating === 0}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? <><i className="fas fa-spinner fa-spin mr-2"></i>Submitting...</> : <><i className="fas fa-paper-plane mr-2"></i>Submit Review</>}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
