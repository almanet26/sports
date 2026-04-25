import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { reviewsApi, type MyCoach } from '../lib/api';

export default function PlayerMyCoachesPage() {
  const { theme } = useThemeStore();
  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';

  const [coaches, setCoaches] = useState<MyCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState<MyCoach | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    reviewsApi.getMyCoaches()
      .then(r => setCoaches(r.data.coaches))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openModal(coach: MyCoach) {
    setReviewModal(coach);
    setRating(coach.existing_review?.rating ?? 5);
    setComment(coach.existing_review?.comment ?? '');
    setSuccess('');
  }

  async function handleSubmit() {
    if (!reviewModal) return;
    setSubmitting(true);
    try {
      await reviewsApi.submitReview({ coach_id: reviewModal.id, rating, comment });
      setSuccess('Review submitted!');
      setCoaches(prev => prev.map(c =>
        c.id === reviewModal.id ? { ...c, existing_review: { rating, comment } } : c
      ));
      setTimeout(() => setReviewModal(null), 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-user-tie text-blue-400"></i>My Coaches
        </h1>
        <p className={`mt-1 text-sm ${sub}`}>Coaches you've worked with — leave a review</p>
      </motion.div>

      {loading ? (
        <p className={`text-sm ${sub}`}>Loading...</p>
      ) : !coaches.length ? (
        <p className={`text-sm ${sub}`}>You haven't submitted to any coach yet.</p>
      ) : (
        <div className="space-y-4">
          {coaches.map((coach, i) => (
            <motion.div key={coach.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border p-5 flex items-center justify-between ${cardBg}`}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {coach.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold">{coach.name}</p>
                  <p className={`text-xs ${sub}`}>{coach.specialization?.join(', ') || coach.email}</p>
                  {coach.existing_review && (
                    <div className="flex gap-0.5 mt-1">
                      {[1,2,3,4,5].map(s => (
                        <i key={s} className={`fas fa-star text-xs ${coach.existing_review!.rating >= s ? 'text-yellow-400' : sub}`}></i>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => openModal(coach)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium hover:opacity-90 transition-all">
                {coach.existing_review ? 'Edit Review' : 'Leave Review'}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-md rounded-3xl border p-6 ${glass}`}>
            <h2 className="text-xl font-bold mb-1">Review {reviewModal.name}</h2>
            <p className={`text-sm mb-5 ${sub}`}>Share your experience</p>

            <div className="flex gap-2 mb-5 justify-center">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(s)}>
                  <i className={`fas fa-star text-2xl transition-colors ${rating >= s ? 'text-yellow-400' : theme === 'dark' ? 'text-white/20' : 'text-gray-300'}`}></i>
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Write your review (optional)..."
              rows={4}
              className={`w-full rounded-xl p-3 text-sm resize-none border outline-none mb-4 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
            />

            {success && <p className="text-green-400 text-sm mb-3">{success}</p>}

            <div className="flex gap-3">
              <button onClick={() => setReviewModal(null)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium ${theme === 'dark' ? 'border-white/20 text-white/60 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'} transition-all`}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
