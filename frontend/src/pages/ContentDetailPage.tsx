import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api, resolveMediaUrl } from '../lib/api';
import { useParams, useNavigate } from 'react-router-dom';

interface ContentItem {
  id: string;
  coach_id: string;
  title: string;
  description?: string;
  content_type: 'article' | 'video' | 'image';
  article_body?: string;
  file_url?: string;
  thumbnail_url?: string;
  tags?: string;
  is_public?: boolean;
  views: number;
  likes: number;
  created_at: string;
}

export default function ContentDetailPage() {
  const { theme } = useThemeStore();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';

  useEffect(() => {
    if (!id) return;
    
    // Fetch content - this automatically increments view count
    api.get(`/coach/content/${id}`)
      .then(r => setContent(r.data))
      .catch(() => navigate('/browse-content'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleLike = async () => {
    if (!id || liked) return;
    
    try {
      const response = await api.post(`/coach/content/${id}/like`);
      setContent(prev => prev ? { ...prev, likes: response.data.likes } : null);
      setLiked(true);
      localStorage.setItem(`liked_${id}`, 'true');
    } catch (error) {
      console.error('Failed to like content');
    }
  };

  useEffect(() => {
    if (id) {
      setLiked(localStorage.getItem(`liked_${id}`) === 'true');
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className={`rounded-3xl border p-16 text-center ${glass}`}>
        <i className={`fas fa-exclamation-circle text-5xl mb-4 ${sub}`}></i>
        <p className="font-semibold text-lg mb-1">Content not found</p>
        <button onClick={() => navigate('/browse-content')} className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-sm font-semibold">
          Back to Browse
        </button>
      </div>
    );
  }

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      {/* Back button */}
      <button onClick={() => navigate('/browse-content')} className={`mb-4 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${theme === 'dark' ? 'glass border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
        <i className="fas fa-arrow-left mr-2"></i>Back to Browse
      </button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-8 border ${glass}`}>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold">{content.title}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${content.is_public ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>
                  <i className={`fas ${content.is_public ? 'fa-globe' : 'fa-lock'} mr-1`}></i>
                  {content.is_public ? 'Public' : 'Private'}
                </span>
              </div>
              {content.description && (
                <p className={`text-sm ${sub} mb-3`}>{content.description}</p>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${content.content_type === 'article' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
              content.content_type === 'video' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
              'bg-green-500/20 text-green-400 border-green-500/30'
            }`}>
              {content.content_type}
            </span>
          </div>

          {/* Stats and actions */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-3 text-sm ${sub}`}>
              <span><i className="fas fa-eye mr-1"></i>{content.views} views</span>
              <span><i className="fas fa-heart mr-1"></i>{content.likes} likes</span>
              <span><i className="fas fa-calendar mr-1"></i>{new Date(content.created_at).toLocaleDateString()}</span>
            </div>
            <button
              onClick={handleLike}
              disabled={liked}
              className={`ml-auto px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                liked
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-500 to-red-500 text-white hover:opacity-90'
              }`}>
              <i className={`fas fa-heart mr-2 ${liked ? 'fas' : 'far'}`}></i>
              {liked ? 'Liked' : 'Like'}
            </button>
          </div>

          {/* Tags */}
          {content.tags && (
            <div className="flex flex-wrap gap-2 mt-4">
              {content.tags.split(',').map((tag, idx) => (
                <span key={idx} className={`text-xs px-3 py-1 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content body */}
        <div className="mt-6">
          {content.content_type === 'article' && content.article_body && (
            <div className={`prose max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
              <div className="whitespace-pre-wrap text-base leading-relaxed">{content.article_body}</div>
            </div>
          )}

          {content.content_type === 'video' && content.file_url && (
            <div className="rounded-2xl overflow-hidden bg-black">
              <video controls className="w-full max-h-[600px]" src={resolveMediaUrl(content.file_url)}>
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {content.content_type === 'image' && content.file_url && (
            <div className="rounded-2xl overflow-hidden">
              <img src={resolveMediaUrl(content.file_url)} alt={content.title} className="w-full max-h-[600px] object-contain" />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
