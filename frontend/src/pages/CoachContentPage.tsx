import { useState } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';

interface ContentItem {
  id: string;
  title: string;
  type: 'video' | 'document' | 'drill';
  size: string;
  date: string;
  views: number;
}

const MOCK: ContentItem[] = [
  { id: '1', title: 'Batting Stance Fundamentals', type: 'video', size: '124 MB', date: '2025-06-10', views: 34 },
  { id: '2', title: 'Bowling Action Checklist', type: 'document', size: '2.1 MB', date: '2025-06-08', views: 18 },
  { id: '3', title: 'Footwork Drill Series', type: 'drill', size: '87 MB', date: '2025-06-05', views: 52 },
  { id: '4', title: 'Spin Bowling Masterclass', type: 'video', size: '210 MB', date: '2025-05-28', views: 91 },
];

const TYPE_META = {
  video:    { icon: 'fas fa-play-circle',  color: 'from-blue-500 to-cyan-500',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  document: { icon: 'fas fa-file-alt',     color: 'from-purple-500 to-pink-500', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  drill:    { icon: 'fas fa-running',      color: 'from-green-500 to-emerald-500', badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

export default function CoachContentPage() {
  const { theme } = useThemeStore();
  const [items, setItems] = useState<ContentItem[]>(MOCK);
  const [filter, setFilter] = useState<'all' | 'video' | 'document' | 'drill'>('all');

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  const handleDelete = (id: string) => {
    if (!confirm('Delete this content?')) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-photo-video text-pink-400"></i>My Content
            </h1>
            <p className={`mt-1 text-sm ${sub}`}>Manage your uploaded videos, drills, and documents</p>
          </div>
          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
            <i className="fas fa-upload"></i>Upload
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          {[
            { label: 'Total Items', value: items.length, icon: 'fas fa-layer-group', color: 'from-blue-500 to-cyan-500' },
            { label: 'Total Views', value: items.reduce((a, i) => a + i.views, 0), icon: 'fas fa-eye', color: 'from-purple-500 to-pink-500' },
            { label: 'Videos', value: items.filter(i => i.type === 'video').length, icon: 'fas fa-play-circle', color: 'from-green-500 to-emerald-500' },
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
        {(['all', 'video', 'document', 'drill'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all capitalize ${filter === f
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent'
              : theme === 'dark' ? 'glass border-white/10 text-white/60 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={`rounded-3xl border p-16 text-center ${glass}`}>
          <i className={`fas fa-photo-video text-5xl mb-4 ${sub}`}></i>
          <p className="font-semibold text-lg mb-1">No content yet</p>
          <p className={`text-sm ${sub}`}>Upload your first piece of content</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item, i) => {
            const meta = TYPE_META[item.type];
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`rounded-2xl border p-5 ${cardBg}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${meta.color} flex items-center justify-center flex-shrink-0`}>
                    <i className={`${meta.icon} text-white text-sm`}></i>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${meta.badge}`}>{item.type}</span>
                </div>
                <p className="font-semibold mb-1 truncate">{item.title}</p>
                <div className={`flex items-center gap-3 text-xs ${sub} mb-4`}>
                  <span><i className="fas fa-hdd mr-1"></i>{item.size}</span>
                  <span><i className="fas fa-eye mr-1"></i>{item.views} views</span>
                  <span><i className="fas fa-calendar mr-1"></i>{item.date}</span>
                </div>
                <div className="flex gap-2">
                  <button className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${theme === 'dark' ? 'glass border-white/10 hover:border-blue-500/40 hover:text-blue-400' : 'bg-white border-gray-200 hover:border-blue-400 hover:text-blue-500'}`}>
                    <i className="fas fa-eye mr-1"></i>View
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="px-3 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
