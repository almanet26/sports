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
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, Loader2, Film, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { videosApi, jobsApi } from '../lib/api';

type UploadStage = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
type UploadMode = 'file' | 'youtube';

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

  // Metadata State
  const [metadata, setMetadata] = useState<VideoMetadata>({
    title: '',
    description: '',
    teams: '',
    venue: '',
    matchDate: '',
    visibility: 'private',
  });

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
    }, 5000) as unknown as number; // Poll every 5 seconds
  };

  // Handle YouTube URL upload
  const handleYouTubeUpload = async () => {
    setStage('uploading');
    setError(null);
    setUploadProgress(0);

    try {
      // Stage 1: Upload YouTube URL with progress tracking
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

      // Stage 2: Trigger OCR processing
      setStage('processing');
      await jobsApi.trigger(uploadedVideoId);

      // Stage 3: Start polling for status
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

    try {
      // Stage 1: Upload with progress tracking
      const response = await videosApi.upload(formData, (progress) => {
        setUploadProgress(progress);
      });

      const uploadedVideoId = response.data.id;
      setVideoId(uploadedVideoId);

      // Stage 2: Trigger OCR processing
      setStage('processing');
      await jobsApi.trigger(uploadedVideoId);

      // Stage 3: Start polling for status
      startPolling(uploadedVideoId);
    } catch (err: unknown) {
      setStage('error');
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Upload failed. Please try again.');
    }
  };

  // Stage 1-3: Handle upload
  const handleUpload = async () => {
    if (mode === 'youtube') {
      if (!youtubeUrl.trim()) {
        setError('Please enter a YouTube URL');
        return;
      }
      
      // Validate YouTube URL
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

  // File Selection Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Please select a valid video file');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Please select a valid video file');
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
    setMetadata({
      title: '',
      description: '',
      teams: '',
      venue: '',
      matchDate: '',
      visibility: 'private',
    });
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
  };

  // Render: Idle State
  if (stage === 'idle') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Mode Selector */}
        <div className="flex gap-2 p-1 bg-slate-800/50 rounded-lg border border-slate-700">
          <button
            onClick={() => setMode('file')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded transition-colors ${
              mode === 'file'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
          <button
            onClick={() => setMode('youtube')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded transition-colors ${
              mode === 'youtube'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            YouTube URL
          </button>
        </div>

        {/* File Upload Mode */}
        {mode === 'file' && (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center cursor-pointer hover:border-emerald-500 hover:bg-slate-800/30 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {selectedFile ? selectedFile.name : 'Upload Cricket Match Video'}
            </h3>
            <p className="text-slate-400 mb-4">
              Drag & drop your video here, or click to browse
            </p>
            <p className="text-sm text-slate-500">
              Supported formats: MP4, AVI, MOV, MKV
            </p>
          </div>
        )}

        {/* YouTube URL Mode */}
        {mode === 'youtube' && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8">
            <LinkIcon className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
            <h3 className="text-xl font-semibold text-white text-center mb-2">
              Enter YouTube Video URL
            </h3>
            <p className="text-slate-400 text-center mb-6">
              We'll download and process the video automatically
            </p>
            
            <div>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Metadata Form */}
        {(selectedFile || youtubeUrl) && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Video Details</h3>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                placeholder={mode === 'youtube' ? 'Video title' : selectedFile?.name || 'Video title'}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Teams
              </label>
              <input
                type="text"
                value={metadata.teams}
                onChange={(e) => setMetadata({ ...metadata, teams: e.target.value })}
                placeholder="e.g., India vs Australia"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Venue
                </label>
                <input
                  type="text"
                  value={metadata.venue}
                  onChange={(e) => setMetadata({ ...metadata, venue: e.target.value })}
                  placeholder="e.g., MCG Melbourne"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Match Date
                </label>
                <input
                  type="date"
                  value={metadata.matchDate}
                  onChange={(e) => setMetadata({ ...metadata, matchDate: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={metadata.description}
                onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                placeholder="Optional match description..."
                rows={3}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Visibility
              </label>
              <select
                value={metadata.visibility}
                onChange={(e) => setMetadata({ ...metadata, visibility: e.target.value as 'public' | 'private' })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="private">Private (Only you can see)</option>
                <option value="public">Public (Everyone can see)</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={handleReset}
                className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                {mode === 'youtube' ? 'Process URL' : 'Start Upload'}
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Render: Uploading State
  if (stage === 'uploading') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8">
          <div className="text-center mb-6">
            <Film className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {mode === 'youtube' ? 'Processing YouTube URL...' : 'Uploading Video...'}
            </h3>
            <p className="text-slate-400">
              {mode === 'youtube' 
                ? 'Downloading and preparing video for processing'
                : 'Please wait while your video is being uploaded'}
            </p>
          </div>

          {mode === 'file' && (
            <>
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Progress</span>
                  <span className="text-white font-medium">{uploadProgress}%</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>

              <p className="text-center text-sm text-slate-500 mt-4">
                {selectedFile?.name}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render: Processing State
  if (stage === 'processing') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8">
          <div className="text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-emerald-400 animate-spin" />
            <h3 className="text-xl font-semibold text-white mb-2">Processing Highlights...</h3>
            <p className="text-slate-400 mb-6">
              Our OCR engine is detecting 4s, 6s, and Wickets from the scoreboard
            </p>
            
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Analyzing frames and extracting events...
              </div>
            </div>

            <p className="text-sm text-slate-500 mt-4">
              This may take a few minutes depending on video length
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render: Completed State
  if (stage === 'completed') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
            <h3 className="text-xl font-semibold text-white mb-2">Processing Complete!</h3>
            <p className="text-slate-400 mb-6">
              Your cricket highlights are ready to view
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate(`/video/${videoId}`)}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
              >
                View Highlights
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Upload Another Video
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render: Error State
  if (stage === 'error') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-800/50 rounded-xl border border-red-700/50 p-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h3 className="text-xl font-semibold text-white mb-2">Upload Failed</h3>
            <p className="text-slate-400 mb-6">{error}</p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
