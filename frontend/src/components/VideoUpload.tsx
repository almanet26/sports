/**
 * VideoUpload Component
 * 
 * Handles the full lifecycle of video upload:
 * 1. File Selection (Drag & Drop / Click) OR YouTube URL
 * 2. Upload Progress (0-100%)
 * 3. OCR Processing (with polling)
 * 4. Completion (View Highlights)
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { videosApi, jobsApi } from '../lib/api';

type UploadStage = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
type UploadMode = 'file' | 'youtube';

// Large file support: 10GB default (configurable by backend)
// For files >10GB, YouTube URL upload handles up to 12GB
const MAX_SIZE_MB = 10000; // 10GB

interface VideoMetadata {
  title: string;
  description: string;
  teams: string;
  venue: string;
  matchDate: string;
  visibility: 'public' | 'private';
}

export default function VideoUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Upload State
  const [mode, setMode] = useState<UploadMode>('file');
  const [stage, setStage] = useState<UploadStage>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Metadata State
  const [metadata, setMetadata] = useState<VideoMetadata>({
    title: '',
    description: '',
    teams: '',
    venue: '',
    matchDate: '',
    visibility: 'private',
  });

  // Advanced Settings State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [paddingBefore, setPaddingBefore] = useState(12); // Pre-roll duration in seconds
  const [paddingAfter, setPaddingAfter] = useState(8);   // Post-roll duration in seconds

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Stage 4: Poll for processing status
  const startPolling = (id: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await jobsApi.getStatus(id);
        const status = response.data.status;

        if (status === 'completed') {
          setStage('completed');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        } else if (status === 'failed') {
          setStage('error');
          setError('OCR processing failed. Please try again.');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000) as unknown as number;
  };

  // Handle YouTube URL upload
  const handleYouTubeUpload = async () => {
    setStage('uploading');
    setError(null);
    setUploadProgress(0);

    try {
      const response = await videosApi.uploadYouTube({
        url: youtubeUrl,
        title: metadata.title,
        description: metadata.description,
        teams: metadata.teams,
        venue: metadata.venue,
        match_date: metadata.matchDate,
        visibility: metadata.visibility,
      }, (progress) => {
        setUploadProgress(progress);
      });

      const uploadedVideoId = response.data.id;
      setVideoId(uploadedVideoId);

      setStage('processing');
      await jobsApi.trigger(uploadedVideoId, {
        padding_before: paddingBefore,
        padding_after: paddingAfter,
      });
      startPolling(uploadedVideoId);
    } catch (err: unknown) {
      setStage('error');
      console.error('YouTube upload error:', err);
      
      const error = err as { 
        response?: { data?: { detail?: string } },
        message?: string,
        code?: string 
      };
      
      let errorMessage = 'Failed to process YouTube URL';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'YouTube download timed out. Please try a shorter video or check your connection.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    }
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setStage('uploading');
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', metadata.title || selectedFile.name);
    formData.append('description', metadata.description);
    formData.append('teams', metadata.teams);
    formData.append('venue', metadata.venue);
    formData.append('match_date', metadata.matchDate);
    formData.append('visibility', metadata.visibility);
    formData.append('padding_before', String(paddingBefore));
    formData.append('padding_after', String(paddingAfter));

    try {
      const response = await videosApi.upload(formData, (progress) => {
        setUploadProgress(progress);
      });

      const uploadedVideoId = response.data.id;
      setVideoId(uploadedVideoId);

      setStage('processing');
      await jobsApi.trigger(uploadedVideoId, {
        padding_before: paddingBefore,
        padding_after: paddingAfter,
      });
      startPolling(uploadedVideoId);
    } catch (err: unknown) {
      setStage('error');
      const error = err as { 
        response?: { data?: { detail?: string }, status?: number },
        message?: string,
        code?: string 
      };
      
      let errorMessage = 'Upload failed. Please try again.';
      
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_RESET') {
        errorMessage = 'Connection lost during upload. This may be due to file size or timeout limits. Try a smaller file (<500MB) or shorter video.';
      } else if (error.response?.status === 413) {
        errorMessage = 'File too large. Maximum size is 500MB for cloud deployment.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    }
  };

  const handleUpload = async () => {
    if (mode === 'youtube') {
      if (!youtubeUrl.trim()) {
        setError('Please enter a YouTube URL');
        return;
      }
      
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
      if (!youtubeRegex.test(youtubeUrl)) {
        setError('Please enter a valid YouTube URL');
        return;
      }
      
      await handleYouTubeUpload();
    } else {
      if (!selectedFile) {
        setError('Please select a file');
        return;
      }
      await handleFileUpload();
    }
  };

  const validateFile = (f: File | null): string => {
    if (!f) return 'Please select a video file.';
    if (!f.type.startsWith('video/')) return 'Only video files are allowed.';
    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > MAX_SIZE_MB) return `File too large. Max ${MAX_SIZE_MB}MB allowed.`;
    return '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const msg = validateFile(file);
      if (msg) {
        setError(msg);
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const msg = validateFile(file);
      if (msg) {
        setError(msg);
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleReset = () => {
    setMode('file');
    setStage('idle');
    setSelectedFile(null);
    setYoutubeUrl('');
    setUploadProgress(0);
    setVideoId(null);
    setError(null);
    setDragActive(false);
    setMetadata({
      title: '',
      description: '',
      teams: '',
      venue: '',
      matchDate: '',
      visibility: 'private',
    });
    setShowAdvanced(false);
    setPaddingBefore(12);
    setPaddingAfter(8);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const pickFile = () => fileInputRef.current?.click();

  // ===================== RENDER STAGES =====================

  // Render: Idle State (Upload Form)
  if (stage === 'idle') {
    return (
      <div className="text-white">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="glass rounded-3xl p-8 border border-white/20 shadow-2xl"
        >
          {/* Title */}
          <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
            <div>
              <h1 className="text-3xl font-bold gradient-text mb-2">Upload Sports Video</h1>
              <p className="text-white/70 text-sm">
                Upload any training or match video. Our AI will analyze it and provide insights.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-xl glass border border-white/20 hover:bg-white/10 transition-all duration-300 text-sm flex items-center gap-2"
              >
                <i className="fas fa-chart-line"></i>
                Dashboard
              </Link>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2 p-1 glass rounded-xl border border-white/20 mb-6">
            <button
              onClick={() => setMode('file')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                mode === 'file'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <i className="fas fa-upload"></i>
              Upload File
            </button>
            <button
              onClick={() => setMode('youtube')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                mode === 'youtube'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <i className="fab fa-youtube"></i>
              YouTube URL
            </button>
          </div>

          {/* Upload Box */}
          <div
            className={`glass rounded-3xl p-8 border-2 transition-all duration-300 ${
              dragActive
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-white/20 hover:border-white/30'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* File Upload Mode */}
            {mode === 'file' && (
              <div className="text-center mb-6">
                <motion.div
                  animate={{
                    scale: dragActive ? 1.1 : 1,
                    rotate: dragActive ? 5 : 0,
                  }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 mb-4"
                >
                  <i className="fas fa-cloud-upload-alt text-white text-3xl"></i>
                </motion.div>

                <h3 className="text-xl font-semibold mb-2">
                  {dragActive ? 'Drop your video here!' : 'Select or drag a video file'}
                </h3>

                <p className="text-white/60 text-sm mb-4">
                  Supported: MP4, MOV, MKV • Max {MAX_SIZE_MB}MB
                </p>

                {selectedFile ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass rounded-2xl p-4 border border-white/20 mb-4 inline-block"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                        <i className="fas fa-file-video text-white"></i>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm">{selectedFile.name}</p>
                        <p className="text-white/60 text-xs">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-white/50 text-sm mb-4">No file selected yet</div>
                )}
              </div>
            )}

            {/* YouTube URL Mode */}
            {mode === 'youtube' && (
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 mb-4">
                  <i className="fab fa-youtube text-white text-3xl"></i>
                </div>

                <h3 className="text-xl font-semibold mb-2">Enter YouTube Video URL</h3>
                <p className="text-white/60 text-sm mb-4">
                  We'll download and process the video automatically
                </p>

                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full max-w-md mx-auto px-4 py-3 glass border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 bg-transparent"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center flex-wrap">
              {mode === 'file' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={pickFile}
                  className="px-6 py-3 rounded-2xl glass border border-white/20 hover:bg-white/10 transition-all duration-300 flex items-center gap-2"
                >
                  <i className="fas fa-folder-open"></i>
                  Choose File
                </motion.button>
              )}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleUpload}
                disabled={mode === 'file' ? !selectedFile : !youtubeUrl.trim()}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <i className="fas fa-cloud-upload-alt"></i>
                {mode === 'youtube' ? 'Process URL' : 'Start Upload'}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReset}
                className="px-6 py-3 rounded-2xl glass border border-white/20 hover:bg-white/10 transition-all duration-300 flex items-center gap-2"
              >
                <i className="fas fa-redo"></i>
                Reset
              </motion.button>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 text-sm text-red-300 border border-red-500/30 bg-red-500/10 p-4 rounded-2xl flex items-center gap-3"
              >
                <i className="fas fa-exclamation-triangle"></i>
                {error}
              </motion.div>
            )}
          </div>

          {/* Metadata Form */}
          {(selectedFile || youtubeUrl) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 glass rounded-2xl border border-white/20 p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <i className="fas fa-info-circle text-blue-400"></i>
                Video Details
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Title</label>
                  <input
                    type="text"
                    value={metadata.title}
                    onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                    placeholder={mode === 'youtube' ? 'Video title' : selectedFile?.name || 'Video title'}
                    className="w-full px-4 py-2 glass border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 bg-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Teams</label>
                  <input
                    type="text"
                    value={metadata.teams}
                    onChange={(e) => setMetadata({ ...metadata, teams: e.target.value })}
                    placeholder="e.g., India vs Australia"
                    className="w-full px-4 py-2 glass border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 bg-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Venue</label>
                  <input
                    type="text"
                    value={metadata.venue}
                    onChange={(e) => setMetadata({ ...metadata, venue: e.target.value })}
                    placeholder="e.g., MCG Melbourne"
                    className="w-full px-4 py-2 glass border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 bg-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Match Date</label>
                  <input
                    type="date"
                    value={metadata.matchDate}
                    onChange={(e) => setMetadata({ ...metadata, matchDate: e.target.value })}
                    className="w-full px-4 py-2 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
                <textarea
                  value={metadata.description}
                  onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                  placeholder="Optional match description..."
                  rows={3}
                  className="w-full px-4 py-2 glass border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 bg-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Visibility</label>
                <select
                  value={metadata.visibility}
                  onChange={(e) => setMetadata({ ...metadata, visibility: e.target.value as 'public' | 'private' })}
                  className="w-full px-4 py-2 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
                >
                  <option value="private" className="bg-gray-900">Private (Only you can see)</option>
                  <option value="public" className="bg-gray-900">Public (Everyone can see)</option>
                </select>
              </div>

              {/* Advanced Settings Accordion */}
              <div className="border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between py-2 text-left text-white/70 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <i className="fas fa-sliders-h text-blue-400"></i>
                    Advanced Clip Settings
                  </span>
                  <motion.i
                    animate={{ rotate: showAdvanced ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="fas fa-chevron-down text-xs"
                  />
                </button>
                
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 space-y-4"
                  >
                    <p className="text-xs text-white/50 mb-3">
                      Fine-tune how clips are extracted around detected events. These settings affect the accuracy and context of generated highlights.
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">
                          Pre-Roll Duration (sec)
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={paddingBefore}
                            onChange={(e) => setPaddingBefore(Math.max(1, Math.min(30, parseInt(e.target.value) || 12)))}
                            className="w-full px-4 py-2 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
                          />
                          <span className="text-white/40 text-sm whitespace-nowrap">seconds</span>
                        </div>
                        <p className="text-xs text-white/40 mt-1">Footage before the event (default: 12s)</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">
                          Post-Roll Duration (sec)
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={paddingAfter}
                            onChange={(e) => setPaddingAfter(Math.max(1, Math.min(30, parseInt(e.target.value) || 8)))}
                            className="w-full px-4 py-2 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
                          />
                          <span className="text-white/40 text-sm whitespace-nowrap">seconds</span>
                        </div>
                        <p className="text-xs text-white/40 mt-1">Footage after the event (default: 8s)</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Process Steps */}
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {[
              {
                step: '01',
                title: 'Upload Video',
                desc: 'Upload any sports training or match video',
                icon: 'fas fa-cloud-upload-alt',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                step: '02',
                title: 'AI Processing',
                desc: 'AI identifies key actions and important moments',
                icon: 'fas fa-robot',
                color: 'from-purple-500 to-pink-500',
              },
              {
                step: '03',
                title: 'Get Insights',
                desc: 'AI insights + feedback + dashboard',
                icon: 'fas fa-lightbulb',
                color: 'from-green-500 to-emerald-500',
              },
            ].map((x, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="glass rounded-2xl p-6 border border-white/20 hover:border-white/30 transition-all duration-300 group cursor-pointer"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-r ${x.color} flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-300`}
                  >
                    <i className={`${x.icon} text-white`}></i>
                  </div>
                  <div className="text-xs text-white/50 font-mono">STEP {x.step}</div>
                </div>
                <h3 className="font-semibold mb-2">{x.title}</h3>
                <p className="text-sm text-white/70">{x.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Render: Uploading State
  if (stage === 'uploading') {
    return (
      <div className="max-w-2xl mx-auto text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl p-8 border border-white/20"
        >
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <i className="fas fa-video text-white text-3xl"></i>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {mode === 'youtube' ? 'Processing YouTube URL...' : 'Uploading Video...'}
            </h3>
            <p className="text-white/60">
              {mode === 'youtube'
                ? 'Downloading and preparing video for processing'
                : 'Please wait while your video is being uploaded'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-white/60">
              <span className="flex items-center gap-2">
                <i className="fas fa-chart-line"></i>
                Upload Progress
              </span>
              <span className="font-mono">{uploadProgress}%</span>
            </div>

            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full relative overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
              </motion.div>
            </div>

            <div className="text-center text-xs text-white/50 flex items-center justify-center gap-2">
              <i className="fas fa-spinner animate-spin"></i>
              Uploading... Please don't refresh.
            </div>
          </div>

          {selectedFile && (
            <p className="text-center text-sm text-white/40 mt-4">{selectedFile.name}</p>
          )}
        </motion.div>
      </div>
    );
  }

  // Render: Processing State
  if (stage === 'processing') {
    return (
      <div className="max-w-2xl mx-auto text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl p-8 border border-white/20"
        >
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <i className="fas fa-cog text-white text-3xl animate-spin"></i>
            </div>
            <h3 className="text-xl font-semibold mb-2">Processing Highlights...</h3>
            <p className="text-white/60 mb-6">
              Our OCR engine is detecting 4s, 6s, and Wickets from the scoreboard
            </p>

            <div className="glass rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-center gap-2 text-sm text-white/70">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Analyzing frames and extracting events...
              </div>
            </div>

            <p className="text-sm text-white/50 mt-4">
              This may take a few minutes depending on video length
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render: Completed State
  if (stage === 'completed') {
    return (
      <div className="max-w-2xl mx-auto text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl p-8 border border-white/20"
        >
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <i className="fas fa-check text-white text-3xl"></i>
            </div>
            <h3 className="text-xl font-semibold mb-2">Processing Complete!</h3>
            <p className="text-white/60 mb-6">Your cricket highlights are ready to view</p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/video/${videoId}`)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-2xl font-medium transition-all"
              >
                <i className="fas fa-play mr-2"></i>
                View Highlights
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReset}
                className="px-6 py-3 glass border border-white/20 hover:bg-white/10 rounded-2xl transition-all"
              >
                <i className="fas fa-upload mr-2"></i>
                Upload Another Video
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render: Error State
  if (stage === 'error') {
    return (
      <div className="max-w-2xl mx-auto text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl p-8 border border-red-500/30"
        >
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center">
              <i className="fas fa-times text-white text-3xl"></i>
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload Failed</h3>
            <p className="text-white/60 mb-6">{error}</p>

            <div className="flex gap-3 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReset}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-2xl transition-all"
              >
                <i className="fas fa-redo mr-2"></i>
                Try Again
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
