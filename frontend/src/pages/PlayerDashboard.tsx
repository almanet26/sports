import DashboardLayout from '../components/DashboardLayout';
import { Link } from 'react-router-dom';
import { authService } from '../utils/auth';

export default function PlayerDashboard() {
  const userProfile = authService.getUserProfile();

  // Mock data - replace with actual API calls
  const currentJob = {
    id: '1',
    videoTitle: 'IND vs AUS - ODI World Cup 2023',
    status: 'PROCESSING',
    step: 'Detecting events',
    progress: 65
  };

  const recentVideos = [
    { id: '1', title: 'IND vs PAK - T20 World Cup', date: '2023-12-10', status: 'READY', highlights: 12 },
    { id: '2', title: 'MI vs CSK - IPL Final', date: '2023-12-08', status: 'READY', highlights: 18 },
    { id: '3', title: 'ENG vs AUS - Ashes Test', date: '2023-12-05', status: 'FAILED', highlights: 0 },
  ];

  const stats = {
    totalVideos: 24,
    totalHighlights: 186,
    lastProcessed: '2 hours ago'
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-100">Player Dashboard</h1>
            <p className="text-slate-400 mt-2">Welcome back, {userProfile?.name}</p>
          </div>
          <Link
            to="/upload"
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-lg shadow-lg transition-all transform hover:scale-105"
          >
            + Generate New Highlights
          </Link>
        </div>

        {/* Current Processing Job */}
        {currentJob && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">
                  Currently Processing
                </div>
                <h2 className="text-xl font-bold text-slate-100">{currentJob.videoTitle}</h2>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
                {currentJob.status}
              </span>
            </div>

            {/* Progress Steps */}
            <div className="space-y-3">
              {['Downloading video', 'Syncing scoreboard', 'Detecting events', 'Cutting clips'].map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === currentJob.step
                      ? 'bg-emerald-500 text-white animate-pulse'
                      : idx < 2
                      ? 'bg-emerald-500/30 text-emerald-400'
                      : 'bg-slate-700 text-slate-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className={`flex-1 ${
                    step === currentJob.step ? 'text-slate-100 font-medium' : 'text-slate-400'
                  }`}>
                    {step}
                  </div>
                  {step === currentJob.step && (
                    <div className="text-xs text-emerald-400 font-mono">{currentJob.progress}%</div>
                  )}
                </div>
              ))}
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${currentJob.progress}%` }}
                />
              </div>
            </div>

            <Link
              to={`/job/${currentJob.id}`}
              className="mt-4 inline-block text-sm text-emerald-400 hover:text-emerald-300"
            >
              View Details →
            </Link>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Recent Videos</h2>
          <div className="space-y-3">
            {recentVideos.map((video) => (
              <div
                key={video.id}
                className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-100">{video.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        video.status === 'READY'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : video.status === 'FAILED'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {video.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="font-mono">{video.date}</span>
                      {video.status === 'READY' && (
                        <span>{video.highlights} highlights</span>
                      )}
                    </div>
                  </div>
                  {video.status === 'READY' && (
                    <Link
                      to={`/highlights/${video.id}`}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      View Highlights
                    </Link>
                  )}
                  {video.status === 'FAILED' && (
                    <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Total Videos
            </div>
            <div className="text-3xl font-bold text-slate-100 font-mono">{stats.totalVideos}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Total Highlights
            </div>
            <div className="text-3xl font-bold text-emerald-400 font-mono">{stats.totalHighlights}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Last Processed
            </div>
            <div className="text-lg font-bold text-slate-100 font-mono">{stats.lastProcessed}</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
