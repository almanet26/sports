import { useState } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';

const MOCK_REVIEWS = [
  { id: '1', player: 'Alex Rodriguez', rating: 5, comment: 'Excellent coaching! My batting improved significantly after just 4 sessions.', date: '2024-03-10', avatar: 'A' },
  { id: '2', player: 'Maya Patel', rating: 5, comment: 'Very detailed feedback on my bowling action. Highly recommend!', date: '2024-03-08', avatar: 'M' },
  { id: '3', player: 'James Wilson', rating: 4, comment: 'Great drills and patient coaching. Would love more video analysis.', date: '2024-03-05', avatar: 'J' },
  { id: '4', player: 'Sofia Chen', rating: 5, comment: 'Best cricket coach I have worked with. Very professional and knowledgeable.', date: '2024-02-28', avatar: 'S' },
  { id: '5', player: 'Rahul Sharma', rating: 4, comment: 'Good sessions, very structured training plan. Saw improvement in 2 weeks.', date: '2024-02-20', avatar: 'R' },
];

export default function CoachReviewsPage() {
  const { theme } = useThemeStore();
  const [filter, setFilter] = useState(0);
  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';

  const filtered = filter === 0 ? MOCK_REVIEWS : MOCK_REVIEWS.filter(r => r.rating === filter);
  const avg = (MOCK_REVIEWS.reduce((s, r) => s + r.rating, 0) / MOCK_REVIEWS.length).toFixed(1);
  const dist = [5, 4, 3, 2, 1].map(n => ({ stars: n, count: MOCK_REVIEWS.filter(r => r.rating === n).length }));

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><i className="fas fa-star text-yellow-400"></i>Reviews</h1>
        <p className={`mt-1 text-sm ${sub}`}>Player feedback and ratings</p>
      </motion.div>

      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className={`rounded-3xl border p-6 mb-6 ${glass}`}>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="text-center">
            <p className="text-6xl font-bold gradient-text">{avg}</p>
            <div className="flex gap-1 justify-center mt-2">
              {[1,2,3,4,5].map(s => <i key={s} className={`fas fa-star text-lg ${parseFloat(avg) >= s ? 'text-yellow-400' : sub}`}></i>)}
            </div>
            <p className={`text-sm mt-1 ${sub}`}>{MOCK_REVIEWS.length} reviews</p>
          </div>
          <div className="flex-1 w-full space-y-2">
            {dist.map(({ stars, count }) => (
              <div key={stars} className="flex items-center gap-3">
                <span className={`text-xs w-4 ${sub}`}>{stars}</span>
                <i className="fas fa-star text-yellow-400 text-xs"></i>
                <div className={`flex-1 h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(count / MOCK_REVIEWS.length) * 100}%` }} />
                </div>
                <span className={`text-xs w-4 ${sub}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Filter */}
      <div className={`flex gap-2 mb-5 p-1 rounded-2xl w-fit ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
        {[0,5,4,3].map(n => (
          <button key={n} onClick={() => setFilter(n)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${filter === n ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' : theme === 'dark' ? 'text-white/60 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
            {n === 0 ? 'All' : `${n} ★`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`rounded-2xl border p-5 ${cardBg}`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                {r.avatar}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">{r.player}</p>
                  <span className={`text-xs ${sub}`}>{new Date(r.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex gap-0.5 mb-2">
                  {[1,2,3,4,5].map(s => <i key={s} className={`fas fa-star text-xs ${r.rating >= s ? 'text-yellow-400' : sub}`}></i>)}
                </div>
                <p className={`text-sm ${sub}`}>{r.comment}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
