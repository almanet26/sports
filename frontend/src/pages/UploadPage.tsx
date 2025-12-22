import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

type UploadMode = 'url' | 'file';

export default function UploadPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<UploadMode>('url');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const validateYouTubeUrl = (url: string) => {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    return pattern.test(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid video file (MP4, MOV, AVI, MKV)');
        return;
      }
      
      // Validate file size (max 2GB)
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB in bytes
      if (file.size > maxSize) {
        setError('File size must be less than 2GB');
        return;
      }

      setSelectedFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'url') {
      if (!youtubeUrl) {
        setError('Please enter a YouTube URL');
        return;
      }

      if (!validateYouTubeUrl(youtubeUrl)) {
        setError('Please enter a valid YouTube URL');
        return;
      }
    } else {
      if (!selectedFile) {
        setError('Please select a video file');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'url') {
        // TODO: Replace with actual API call for YouTube URL
        // const response = await fetch('http://localhost:8000/api/v1/videos/process', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ youtube_url: youtubeUrl })
        // });

        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // TODO: Replace with actual file upload API call
        // Simulate upload progress
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 200));
          setUploadProgress(i);
        }
      }
      
      // Redirect to job details
      navigate('/job/123');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start processing')
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <DashboardLayout>
      <div>
        <div className="mb-8">
          <button
            onClick={() => navigate('/player-dashboard')}
            className="text-slate-400 hover:text-slate-300 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-slate-100">Generate Highlights</h1>
          <p className="text-slate-400 mt-2">Extract highlights from your cricket match videos</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          {/* Mode Selector */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Choose Input Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode('url');
                  setError('');
                  setSelectedFile(null);
                }}
                className={`px-6 py-4 rounded-lg font-semibold transition-all ${
                  mode === 'url'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg scale-105'
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>YouTube URL</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('file');
                  setError('');
                  setYoutubeUrl('');
                }}
                className={`px-6 py-4 rounded-lg font-semibold transition-all ${
                  mode === 'file'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg scale-105'
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Upload File</span>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* YouTube URL Input */}
            {mode === 'url' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  YouTube Video URL *
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            )}

            {/* File Upload */}
            {mode === 'file' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Video File *
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="video/mp4,video/mov,video/avi,video/mkv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full px-6 py-12 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-emerald-500 hover:bg-slate-750 transition-all group"
                  >
                    {selectedFile ? (
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-lg font-medium text-slate-100">{selectedFile.name}</div>
                        <div className="text-sm text-slate-400 mt-1">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                        <div className="text-xs text-emerald-400 mt-2">Click to change file</div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 text-slate-400 group-hover:text-emerald-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <div className="text-base font-medium text-slate-300">Drag & drop video here</div>
                        <div className="text-sm text-slate-400 mt-2">or click to browse</div>
                        <div className="text-xs text-slate-500 mt-4 font-mono">
                          Accepted: MP4, MOV, AVI, MKV (max 2GB)
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                {error}
              </p>
            )}

            {/* Upload Progress */}
            {loading && mode === 'file' && uploadProgress > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">Uploading...</span>
                  <span className="text-sm text-slate-400 font-mono">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-blue-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 space-y-2 text-sm text-slate-300">
                  <p className="font-semibold text-blue-400">What we'll extract:</p>
                  <ul className="space-y-1 ml-4 list-disc list-inside">
                    <li>Fours - All boundary shots</li>
                    <li>Sixes - All maximum hits</li>
                    <li>Wickets - Every dismissal</li>
                  </ul>
                  <p className="mt-3 text-slate-400 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Processing typically takes 3-5 minutes depending on video length
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {mode === 'file' && uploadProgress > 0 ? 'Uploading...' : 'Starting Process...'}
                </span>
              ) : (
                'Generate Highlights'
              )}
            </button>
          </form>

          {/* Examples (only for URL mode) */}
          {mode === 'url' && (
            <div className="mt-8 pt-6 border-t border-slate-700">
              <p className="text-xs text-slate-500 mb-3">Example URLs:</p>
              <div className="space-y-2">
                <button
                  onClick={() => setYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                  className="block w-full text-left px-3 py-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 rounded text-xs text-slate-400 font-mono transition"
                >
                  https://www.youtube.com/watch?v=dQw4w9WgXcQ
                </button>
                <button
                  onClick={() => setYoutubeUrl('https://youtu.be/dQw4w9WgXcQ')}
                  className="block w-full text-left px-3 py-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 rounded text-xs text-slate-400 font-mono transition"
                >
                  https://youtu.be/dQw4w9WgXcQ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
