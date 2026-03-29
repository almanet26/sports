import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Submission {
  id: string;
  player_name: string;
  player_email: string;
  video_title: string;
  submitted_at: string;
  status: 'pending' | 'reviewed' | 'published';
  analysis_type: 'BATTING' | 'BOWLING';
  thumbnail?: string;
}

export default function CoachVideoReviewsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

  const handleReviewVideo = (submissionId: string) => {
    alert(`Opening video review for submission ${submissionId}`);
  };

  const handlePublishVideo = (submissionId: string) => {
    if (confirm('Publish this video review to the player?')) {
      setSubmissions(submissions.map(s => s.id === submissionId ? {...s, status: 'published' as const} : s));
    }
  };

  const handleViewVideo = (submissionId: string) => {
    alert(`Viewing published video ${submissionId}`);
  };

  useEffect(() => {
    // Mock data
    setTimeout(() => {
      setSubmissions([
        {
          id: '1',
          player_name: 'John Doe',
          player_email: 'john@example.com',
          video_title: 'Batting Practice Session',
          submitted_at: '2024-01-18 10:30 AM',
          status: 'pending',
          analysis_type: 'BATTING',
        },
        {
          id: '2',
          player_name: 'Jane Smith',
          player_email: 'jane@example.com',
          video_title: 'Bowling Technique Review',
          submitted_at: '2024-01-17 2:15 PM',
          status: 'pending',
          analysis_type: 'BOWLING',
        },
        {
          id: '3',
          player_name: 'Mike Johnson',
          player_email: 'mike@example.com',
          video_title: 'Cover Drive Analysis',
          submitted_at: '2024-01-16 9:00 AM',
          status: 'reviewed',
          analysis_type: 'BATTING',
        },
        {
          id: '4',
          player_name: 'Sarah Williams',
          player_email: 'sarah@example.com',
          video_title: 'Fast Bowling Action',
          submitted_at: '2024-01-15 4:30 PM',
          status: 'published',
          analysis_type: 'BOWLING',
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredSubmissions = submissions.filter(sub => {
    if (filter === 'all') return true;
    return sub.status === filter;
  });

  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const reviewedCount = submissions.filter(s => s.status === 'reviewed').length;
  const publishedCount = submissions.filter(s => s.status === 'published').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'reviewed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'published': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getAnalysisIcon = (type: string) => {
    return type === 'BATTING' ? 'fa-baseball-bat-ball' : 'fa-bowling-ball';
  };

  return (
    <div className="text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 mb-6 border border-white/20"
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-inbox text-blue-400"></i>
          Video Reviews
        </h1>
        <p className="text-white/70 mt-2">Review and analyze player video submissions</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Submissions</p>
              <p className="text-3xl font-bold mt-2">{submissions.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <i className="fas fa-video text-blue-400 text-xl"></i>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Pending Review</p>
              <p className="text-3xl font-bold mt-2">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <i className="fas fa-clock text-yellow-400 text-xl"></i>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Reviewed</p>
              <p className="text-3xl font-bold mt-2">{reviewedCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <i className="fas fa-check-circle text-blue-400 text-xl"></i>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Published</p>
              <p className="text-3xl font-bold mt-2">{publishedCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <i className="fas fa-paper-plane text-green-400 text-xl"></i>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <div className="glass rounded-2xl p-2 mb-6 border border-white/20 inline-flex">
        <button
          onClick={() => setFilter('all')}
          className={`px-6 py-2 rounded-xl font-medium transition-all ${
            filter === 'all'
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
              : 'text-white/60 hover:text-white'
          }`}
        >
          All ({submissions.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-6 py-2 rounded-xl font-medium transition-all ${
            filter === 'pending'
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('reviewed')}
          className={`px-6 py-2 rounded-xl font-medium transition-all ${
            filter === 'reviewed'
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Reviewed ({reviewedCount})
        </button>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="glass rounded-2xl p-12 border border-white/20 text-center">
          <i className="fas fa-spinner animate-spin text-4xl text-blue-400 mb-4"></i>
          <p className="text-white/60">Loading submissions...</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="glass rounded-2xl p-12 border border-white/20 text-center">
          <i className="fas fa-inbox text-4xl text-white/20 mb-4"></i>
          <p className="text-white/60">No submissions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((submission, index) => (
            <motion.div
              key={submission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl p-6 border border-white/20 hover:border-blue-500/50 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <i className={`fas ${getAnalysisIcon(submission.analysis_type)} text-white text-2xl`}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{submission.video_title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs border ${getStatusColor(submission.status)}`}>
                        {submission.status}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm mb-2">
                      <i className="fas fa-user mr-2"></i>
                      {submission.player_name} ({submission.player_email})
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="text-white/60">
                        <i className="fas fa-clock mr-1 text-blue-400"></i>
                        {submission.submitted_at}
                      </span>
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs">
                        {submission.analysis_type}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {submission.status === 'pending' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleReviewVideo(submission.id)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg text-sm font-medium transition-all"
                    >
                      <i className="fas fa-play mr-1"></i>
                      Review Now
                    </motion.button>
                  )}
                  {submission.status === 'reviewed' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handlePublishVideo(submission.id)}
                      className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-all"
                    >
                      <i className="fas fa-paper-plane mr-1"></i>
                      Publish
                    </motion.button>
                  )}
                  {submission.status === 'published' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleViewVideo(submission.id)}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all"
                    >
                      <i className="fas fa-eye mr-1"></i>
                      View
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
