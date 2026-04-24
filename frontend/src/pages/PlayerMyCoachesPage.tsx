import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { submissionsApi } from '../lib/api';
import ReviewModal from '../components/ReviewModal';

interface Coach {
  id: string;
  name: string;
  email: string;
  submissions: number;
  hasReviewed: boolean;
}

export default function PlayerMyCoachesPage() {
  const { theme } = useThemeStore();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoach, setSelectedCoach] = useState<{ id: string; name: string } | null>(null);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';

  useEffect(() => {
    fetchCoaches();
  }, []);

  const fetchCoaches = async () => {
    try {
      const response = await submissionsApi.mySubmissions();
      
      // Extract unique coaches from submissions
      const coachMap = new Map<string, Coach>();
      
      response.data.submissions.forEach((submission: any) => {
        if (submission.coach_id && submission.coach_name) {
          if (!coachMap.has(submission.coach_id)) {
            coachMap.set(submission.coach_id, {
              id: submission.coach_id,
              name: submission.coach_name,
              email: submission.coach_email || '',
              submissions: 1,
              hasReviewed: false
            });
          } else {
            const coach = coachMap.get(submission.coach_id)!;
            coach.submissions += 1;
          }
        }
      });

      setCoaches(Array.from(coachMap.values()));
    } catch (error) {
      console.error('Failed to fetch coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSuccess = () => {
    fetchCoaches();
  };

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 mb-6 border ${glass}`}
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-chalkboard-teacher text-green-400"></i>
          My Coaches
        </h1>
        <p className={`mt-1 text-sm ${sub}`}>
          Coaches you've worked with and submitted videos to
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Coaches', value: coaches.length, icon: 'fas fa-users', color: 'from-blue-500 to-cyan-500' },
          { label: 'Total Submissions', value: coaches.reduce((sum, c) => sum + c.submissions, 0), icon: 'fas fa-video', color: 'from-purple-500 to-pink-500' },
          { label: 'Reviews Given', value: coaches.filter(c => c.hasReviewed).length, icon: 'fas fa-star', color: 'from-yellow-500 to-orange-500' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-2xl border p-4 ${cardBg}`}
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${stat.color} flex items-center justify-center mb-3`}>
              <i className={`${stat.icon} text-white`}></i>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className={`text-xs ${sub}`}>{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Coaches List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : coaches.length === 0 ? (
        <div className={`rounded-3xl border p-16 text-center ${glass}`}>
          <i className={`fas fa-chalkboard-teacher text-5xl mb-4 ${sub}`}></i>
          <p className="font-semibold text-lg mb-1">No coaches yet</p>
          <p className={`text-sm ${sub}`}>Submit videos to coaches to see them here</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {coaches.map((coach, i) => (
            <motion.div
              key={coach.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border p-5 ${cardBg} hover:border-blue-500/50 transition-all`}
            >
              {/* Coach Avatar & Info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  {coach.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-lg truncate">{coach.name}</p>
                  <p className={`text-xs truncate ${sub}`}>{coach.email || 'Coach'}</p>
                </div>
              </div>

              {/* Stats */}
              <div className={`flex items-center gap-4 text-sm ${sub} mb-4 pb-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <span>
                  <i className="fas fa-video mr-1"></i>
                  {coach.submissions} submission{coach.submissions !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCoach({ id: coach.id, name: coach.name })}
                  className={`flex-1 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium ${
                    theme === 'dark'
                      ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                      : 'border-yellow-400 text-yellow-600 hover:bg-yellow-50'
                  }`}
                >
                  <i className="fas fa-star mr-2"></i>
                  Leave Review
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedCoach && (
        <ReviewModal
          isOpen={!!selectedCoach}
          onClose={() => setSelectedCoach(null)}
          coachId={selectedCoach.id}
          coachName={selectedCoach.name}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
}
