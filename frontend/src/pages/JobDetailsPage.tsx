import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

export default function JobDetailsPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  // Mock data - replace with actual API call
  const job = {
    id: jobId,
    videoTitle: 'IND vs AUS - ODI World Cup 2023',
    youtubeUrl: 'https://www.youtube.com/watch?v=example',
    status: 'PROCESSING', // DOWNLOADING | PROCESSING | READY | FAILED
    currentStep: 'Detecting events',
    createdAt: '2023-12-15 14:30:00',
    completedAt: null,
    error: null,
    steps: [
      { name: 'Downloading video', status: 'COMPLETED', duration: '45s' },
      { name: 'Syncing scoreboard', status: 'COMPLETED', duration: '1m 12s' },
      { name: 'Detecting events', status: 'IN_PROGRESS', duration: null },
      { name: 'Cutting clips', status: 'PENDING', duration: null },
    ],
    progress: 65
  };

  const handleRetry = () => {
    // TODO: Implement retry logic
    console.log('Retrying job:', jobId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-emerald-400';
      case 'IN_PROGRESS':
        return 'text-blue-400 animate-pulse';
      case 'FAILED':
        return 'text-red-400';
      default:
        return 'text-slate-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'IN_PROGRESS':
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      case 'FAILED':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        );
    }
  };

  return (
    <DashboardLayout>
      <div>
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/player-dashboard')}
            className="text-slate-400 hover:text-slate-300 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-100">{job.videoTitle}</h1>
              <p className="text-slate-400 mt-1 text-sm font-mono">Job ID: {job.id}</p>
              <p className="text-slate-500 mt-1 text-sm">Created: {job.createdAt}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              job.status === 'READY'
                ? 'bg-emerald-500/20 text-emerald-400'
                : job.status === 'FAILED'
                ? 'bg-red-500/20 text-red-400'
                : job.status === 'PROCESSING'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-slate-700 text-slate-400'
            }`}>
              {job.status}
            </span>
          </div>
        </div>

        {/* Progress Section */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-slate-100">Processing Progress</h2>
              <span className="text-sm text-slate-400 font-mono">{job.progress}%</span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {job.steps.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-4 p-4 rounded-lg border transition ${
                  step.status === 'IN_PROGRESS'
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : step.status === 'COMPLETED'
                    ? 'bg-slate-900 border-slate-700'
                    : 'bg-slate-900/50 border-slate-800'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  step.status === 'COMPLETED'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : step.status === 'IN_PROGRESS'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400 animate-pulse'
                    : step.status === 'FAILED'
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}>
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1">
                  <div className={`font-semibold ${
                    step.status === 'IN_PROGRESS' ? 'text-slate-100' : 'text-slate-300'
                  }`}>
                    {step.name}
                  </div>
                  {step.duration && (
                    <div className="text-sm text-slate-500 font-mono mt-1">
                      Completed in {step.duration}
                    </div>
                  )}
                </div>
                <div className={`text-xs font-semibold uppercase tracking-wide ${getStatusColor(step.status)}`}>
                  {step.status.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Section */}
        {job.status === 'FAILED' && job.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-red-400">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-400 mb-2">Processing Failed</h3>
                <p className="text-slate-300 mb-4">{job.error}</p>
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition"
                >
                  Retry Processing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Section */}
        {job.status === 'READY' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <div className="text-emerald-400">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-emerald-400 mb-2">Highlights Ready!</h3>
                <p className="text-slate-300 mb-4">Your highlights have been generated successfully.</p>
                <button
                  onClick={() => navigate(`/highlights/${job.id}`)}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition"
                >
                  View Highlights →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Info */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mt-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Source Video
          </h3>
          <a
            href={job.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
          >
            {job.youtubeUrl}
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
