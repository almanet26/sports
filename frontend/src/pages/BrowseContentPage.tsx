import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api, resolveMediaUrl } from '../lib/api';
import { useNavigate } from 'react-router-dom';

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

interface CoachProfile {
  id: string;
  name: string;
  profile_bio?: string;
  specialization?: string[];
  intro_video_url?: string;
  profile_image_url?: string;
  coach_category?: string;
  years_of_experience?: number;
}

const TYPE_META = {
  article: { icon: 'fas fa-file-alt', color: 'from-blue-500 to-cyan-500', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  video: { icon: 'fas fa-play-circle', color: 'from-purple-500 to-pink-500', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  image: { icon: 'fas fa-image', color: 'from-green-500 to-emerald-500', badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

export default function BrowseContentPage() {
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'article' | 'video' | 'image'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [playingCoach, setPlayingCoach] = useState<string | null>(null);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const inputCls = `w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${theme === 'dark' ? 'glass border-white/10 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-400'}`;

  useEffect(() => {
    api.get('/coach/content/public')
      .then(r => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    api.get('/auth/coaches/public')
      .then(r => setCoaches(r.data.coaches || []))
      .catch(() => {});
  }, []);

  const filtered = items.filter(i => {
    const matchesType = filter === 'all' || i.content_type === filter;
    const matchesSearch = !searchQuery || 
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.tags?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleViewContent = (id: string) => {
    navigate(`/content/${id}`);
  };

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-graduation-cap text-blue-400"></i>Learning Hub
            </h1>
            <p className={`mt-1 text-sm ${sub}`}>Browse articles, videos, and training content from expert coaches</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <i className={`fas fa-search absolute left-4 top-1/2 -translate-y-1/2 ${sub}`}></i>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search content..."
            className={`${inputCls} pl-11`}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'article', 'video', 'image'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all capitalize ${filter === f
                ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-transparent'
                : theme === 'dark' ? 'glass border-white/10 text-white/60 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}>
              {f === 'all' ? `All (${items.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)}s (${items.filter(i => i.content_type === f).length})`}
            </button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Meet Our Coaches */}
          {coaches.length > 0 && (
            <div className="mb-8">
              <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <i className="fas fa-chalkboard-teacher text-green-400"></i>Meet Our Coaches
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {coaches.map((coach, i) => (
                  <motion.div key={coach.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`rounded-2xl border overflow-hidden ${cardBg}`}>
                    {/* Intro video or avatar */}
                    <div className="relative h-44 bg-gradient-to-br from-blue-600 to-purple-700">
                      {coach.intro_video_url && playingCoach === coach.id ? (
                        <video
                          autoPlay controls
                          className="w-full h-full object-cover"
                          src={resolveMediaUrl(coach.intro_video_url)}
                          onEnded={() => setPlayingCoach(null)}
                          onError={() => setPlayingCoach(null)}
                        />
                      ) : (
                        <>
                          {coach.profile_image_url
                            ? <img src={resolveMediaUrl(coach.profile_image_url)} alt={coach.name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }}/>
                            : <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-white/40">{coach.name.charAt(0)}</div>
                          }
                          {coach.intro_video_url && (
                            <button
                              onClick={() => setPlayingCoach(coach.id)}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-all group"
                            >
                              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
                                <i className="fas fa-play text-white text-xl ml-1"></i>
                              </div>
                              <span className="absolute bottom-3 left-0 right-0 text-center text-white text-xs font-medium">Watch Intro</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-semibold">{coach.name}</p>
                      {coach.coach_category && <p className={`text-xs ${sub} mb-1`}>{coach.coach_category} Coach</p>}
                      {coach.years_of_experience && <p className={`text-xs ${sub} mb-2`}>{coach.years_of_experience} years experience</p>}
                      {coach.specialization?.length ? (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {coach.specialization.slice(0, 3).map(s => (
                            <span key={s} className={`text-xs px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>{s}</span>
                          ))}
                        </div>
                      ) : null}
                      {coach.profile_bio && <p className={`text-xs ${sub} line-clamp-2`}>{coach.profile_bio}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Content grid */}
          {filtered.length === 0 ? (
            <div className={`rounded-3xl border p-16 text-center ${glass}`}>
              <i className={`fas fa-search text-5xl mb-4 ${sub}`}></i>
              <p className="font-semibold text-lg mb-1">No content found</p>
              <p className={`text-sm ${sub}`}>Try adjusting your filters or search query</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((item, i) => {
                const meta = TYPE_META[item.content_type] || TYPE_META.article;
                return (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`rounded-2xl border overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform ${cardBg}`}
                    onClick={() => handleViewContent(item.id)}>
                    <div className={`h-40 bg-gradient-to-r ${meta.color} relative`}>
                      {item.thumbnail_url ? (
                        <img src={resolveMediaUrl(item.thumbnail_url)} alt={item.title} className="w-full h-full object-cover" />
                      ) : item.content_type === 'image' && item.file_url ? (
                        <img src={resolveMediaUrl(item.file_url)} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <i className={`${meta.icon} text-5xl text-white/50`}></i>
                        </div>
                      )}
                      <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full border capitalize ${meta.badge}`}>{item.content_type}</span>
                      {!item.is_public && (
                        <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full border bg-orange-500/20 text-orange-400 border-orange-500/30">
                          <i className="fas fa-lock mr-1"></i>Private
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-semibold mb-1 truncate">{item.title}</p>
                      {item.description && (
                        <p className={`text-xs ${sub} mb-3 line-clamp-2`}>{item.description}</p>
                      )}
                      {item.tags && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {item.tags.split(',').slice(0, 3).map((tag, idx) => (
                            <span key={idx} className={`text-xs px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className={`flex items-center gap-3 text-xs ${sub}`}>
                        <span><i className="fas fa-eye mr-1"></i>{item.views}</span>
                        <span><i className="fas fa-heart mr-1"></i>{item.likes}</span>
                        <span className="ml-auto">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
