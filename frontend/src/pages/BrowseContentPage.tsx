import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api, resolveMediaUrl } from '../lib/api';

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

const TYPE_META = {
  article:  { icon: 'fas fa-file-alt',     color: 'from-blue-500 to-cyan-500',     badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  video:    { icon: 'fas fa-play-circle',  color: 'from-purple-500 to-pink-500',   badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  image:    { icon: 'fas fa-image',        color: 'from-green-500 to-emerald-500', badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

export default function BrowseContentPage() {
  const { theme } = useThemeStore();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'article' | 'video' | 'image'>('all');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';

  useEffect(() => {
    api.get('/coach/content/public')
      .then(r => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? items : items.filter(i => i.content_type === filter);

  const handleLike = async (id: string) => {
    try {
      const response = await api.post(`/coach/content/${id}/like`);
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, likes: response.data.likes } : item
      ));
    } catch (error) {
      console.error('Failed to like content:', error);
    }
  };

  const handleView = async (item: ContentItem) => {
    setSelectedItem(item);
    // Increment view count
    try {
      await api.get(`/coach/content/${item.id}`);
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, views: i.views + 1 } : i
      ));
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-graduation-cap text-purple-400"></i>Learning Hub
            </h1>
            <p className={`mt-1 text-sm ${sub}`}>Explore training content from professional coaches</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Total Content', value: items.length, icon: 'fas fa-layer-group', color: 'from-blue-500 to-cyan-500' },
            { label: 'Articles', value: items.filter(i => i.content_type === 'article').length, icon: 'fas fa-file-alt', color: 'from-blue-500 to-cyan-500' },
            { label: 'Videos', value: items.filter(i => i.content_type === 'video').length, icon: 'fas fa-play-circle', color: 'from-purple-500 to-pink-500' },
            { label: 'Images', value: items.filter(i => i.content_type === 'image').length, icon: 'fas fa-image', color: 'from-green-500 to-emerald-500' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${cardBg}`}>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center mb-2`}>
                <i className={`${s.icon} text-white text-sm`}></i>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className={`text-xs ${sub}`}>{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'article', 'video', 'image'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all capitalize ${filter === f
              ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white border-transparent'
              : theme === 'dark' ? 'glass border-white/10 text-white/60 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-3xl border p-16 text-center ${glass}`}>
          <i className={`fas fa-graduation-cap text-5xl mb-4 ${sub}`}></i>
          <p className="font-semibold text-lg mb-1">No content available</p>
          <p className={`text-sm ${sub}`}>Check back later for new training content</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item, i) => {
            const meta = TYPE_META[item.content_type] || TYPE_META.article;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`rounded-2xl border overflow-hidden ${cardBg} hover:border-purple-500/40 transition-all cursor-pointer`}
                onClick={() => handleView(item)}>
                {/* Thumbnail */}
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
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <p className="font-semibold mb-1 truncate">{item.title}</p>
                  {item.description && (
                    <p className={`text-xs ${sub} mb-2 line-clamp-2`}>{item.description}</p>
                  )}
                  {item.tags && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.tags.split(',').slice(0, 3).map((tag, idx) => (
                        <span key={idx} className={`text-xs px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={`flex items-center gap-3 text-xs ${sub}`}>
                    <span><i className="fas fa-eye mr-1"></i>{item.views}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleLike(item.id); }} className="hover:text-red-400 transition-colors">
                      <i className="fas fa-heart mr-1"></i>{item.likes}
                    </button>
                    <span className="ml-auto">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* View Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedItem(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border p-6 ${theme === 'dark' ? 'glass border-white/20 text-white' : 'bg-white border-gray-200 shadow-2xl text-gray-900'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold">{selectedItem.title}</h2>
              <button onClick={() => setSelectedItem(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <i className="fas fa-times text-sm"></i>
              </button>
            </div>

            {selectedItem.description && (
              <p className={`${sub} mb-4`}>{selectedItem.description}</p>
            )}

            {selectedItem.content_type === 'article' && selectedItem.article_body && (
              <div className={`prose max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
                <div className="whitespace-pre-wrap">{selectedItem.article_body}</div>
              </div>
            )}

            {selectedItem.content_type === 'video' && selectedItem.file_url && (
              <video controls className="w-full rounded-xl mb-4">
                <source src={resolveMediaUrl(selectedItem.file_url)} />
              </video>
            )}

            {selectedItem.content_type === 'image' && selectedItem.file_url && (
              <img src={resolveMediaUrl(selectedItem.file_url)} alt={selectedItem.title} className="w-full rounded-xl mb-4" />
            )}

            <div className={`flex items-center gap-4 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <span className={`text-sm ${sub}`}><i className="fas fa-eye mr-2"></i>{selectedItem.views} views</span>
              <button onClick={() => handleLike(selectedItem.id)} className="text-sm hover:text-red-400 transition-colors">
                <i className="fas fa-heart mr-2"></i>{selectedItem.likes} likes
              </button>
              <span className={`text-sm ${sub} ml-auto`}>{new Date(selectedItem.created_at).toLocaleDateString()}</span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
