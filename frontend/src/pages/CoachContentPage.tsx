import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api, resolveMediaUrl } from '../lib/api';

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  content_type: 'article' | 'video' | 'image';
  article_body?: string;
  file_url?: string;
  thumbnail_url?: string;
  tags?: string;
  views: number;
  likes: number;
  created_at: string;
  updated_at: string;
}

const TYPE_META = {
  article:  { icon: 'fas fa-file-alt',     color: 'from-blue-500 to-cyan-500',     badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  video:    { icon: 'fas fa-play-circle',  color: 'from-purple-500 to-pink-500',   badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  image:    { icon: 'fas fa-image',        color: 'from-green-500 to-emerald-500', badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

export default function CoachContentPage() {
  const { theme } = useThemeStore();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'article' | 'video' | 'image'>('all');
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [form, setForm] = useState({ title: '', description: '', content_type: 'article', article_body: '', tags: '', is_public: true });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const inputCls = `w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${theme === 'dark' ? 'glass border-white/10 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-400'}`;

  useEffect(() => {
    api.get('/coach/content')
      .then(r => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? items : items.filter(i => i.content_type === filter);

  const handleUpload = async () => {
    if (!form.title.trim()) return;
    if (form.content_type === 'article' && !form.article_body.trim()) return;
    if (form.content_type !== 'article' && !selectedFile) return;
    
    setUploading(true);
    setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('content_type', form.content_type);
      fd.append('tags', form.tags);
      fd.append('is_public', form.is_public.toString());
      
      if (form.content_type === 'article') {
        fd.append('article_body', form.article_body);
      }
      
      if (selectedFile) {
        fd.append('file', selectedFile);
      }
      
      if (selectedThumbnail) {
        fd.append('thumbnail', selectedThumbnail);
      }
      
      const r = await api.post('/coach/content', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      setItems(prev => [r.data, ...prev]);
      setShowModal(false);
      setForm({ title: '', description: '', content_type: 'article', article_body: '', tags: '', is_public: true });
      setSelectedFile(null);
      setSelectedThumbnail(null);
    } catch {
      alert('Failed to upload. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this content?')) return;
    await api.delete(`/coach/content/${id}`);
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
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
            <i className="fas fa-upload"></i>Upload
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Total Items', value: items.length, icon: 'fas fa-layer-group', color: 'from-blue-500 to-cyan-500' },
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
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent'
              : theme === 'dark' ? 'glass border-white/10 text-white/60 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-3xl border p-16 text-center ${glass}`}>
          <i className={`fas fa-photo-video text-5xl mb-4 ${sub}`}></i>
          <p className="font-semibold text-lg mb-1">No content yet</p>
          <p className={`text-sm ${sub}`}>Upload your first piece of content</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item, i) => {
            const meta = TYPE_META[item.content_type] || TYPE_META.article;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`rounded-2xl border overflow-hidden ${cardBg}`}>
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
                  <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full border ${item.is_public ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>
                    <i className={`fas ${item.is_public ? 'fa-globe' : 'fa-lock'} mr-1`}></i>
                    {item.is_public ? 'Public' : 'Private'}
                  </span>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <p className="font-semibold mb-1 truncate">{item.title}</p>
                  {item.description && (
                    <p className={`text-xs ${sub} mb-2 line-clamp-2`}>{item.description}</p>
                  )}
                  <div className={`flex items-center gap-3 text-xs ${sub} mb-3`}>
                    <span><i className="fas fa-eye mr-1"></i>{item.views}</span>
                    <span><i className="fas fa-heart mr-1"></i>{item.likes}</span>
                    <span className="ml-auto">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    {item.file_url && (
                      <a href={resolveMediaUrl(item.file_url)} target="_blank" rel="noopener noreferrer"
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${theme === 'dark' ? 'glass border-white/10 hover:border-blue-500/40 hover:text-blue-400' : 'bg-white border-gray-200 hover:border-blue-400 hover:text-blue-500'}`}>
                        <i className="fas fa-eye mr-1"></i>View
                      </a>
                    )}
                    <button onClick={() => handleDelete(item.id)} className="px-3 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !uploading && setShowModal(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className={`relative w-full max-w-md rounded-3xl border p-6 ${theme === 'dark' ? 'glass border-white/20 text-white' : 'bg-white border-gray-200 shadow-2xl text-gray-900'}`}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">Upload Content</h2>
                <button onClick={() => setShowModal(false)} disabled={uploading}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                  <i className="fas fa-times text-sm"></i>
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>Content Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['article', 'video', 'image'] as const).map(type => (
                      <button key={type} type="button"
                        onClick={() => setForm(f => ({ ...f, content_type: type }))}
                        className={`p-3 rounded-xl border text-center transition-all ${form.content_type === type
                          ? 'bg-gradient-to-r from-pink-500 to-purple-600 border-transparent'
                          : theme === 'dark' ? 'glass border-white/10 hover:border-white/20' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                        <i className={`${TYPE_META[type].icon} text-xl mb-1 block`}></i>
                        <span className="text-xs capitalize">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>Title *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Enter content title" />
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} rows={2} placeholder="Brief description" />
                </div>
                {form.content_type === 'article' && (
                  <div>
                    <label className={`block text-xs mb-1 ${sub}`}>Article Content *</label>
                    <textarea value={form.article_body} onChange={e => setForm(f => ({ ...f, article_body: e.target.value }))} className={inputCls} rows={6} placeholder="Write your article content..." />
                  </div>
                )}
                {form.content_type !== 'article' && (
                  <div>
                    <label className={`block text-xs mb-1 ${sub}`}>{form.content_type === 'video' ? 'Video' : 'Image'} File *</label>
                    <div onClick={() => fileInputRef.current?.click()}
                      className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${theme === 'dark' ? 'border-white/20 hover:border-white/40' : 'border-gray-300 hover:border-gray-400'}`}>
                      {selectedFile
                        ? <><i className="fas fa-file-check text-green-400 text-2xl mb-1"></i><p className="text-sm font-medium">{selectedFile.name}</p><p className={`text-xs ${sub}`}>{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p></>
                        : <><i className={`fas fa-cloud-upload-alt text-2xl mb-1 ${sub}`}></i><p className={`text-sm ${sub}`}>Click to select file</p></>}
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden" accept={form.content_type === 'video' ? 'video/*' : 'image/*'} onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                  </div>
                )}
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>Thumbnail (Optional)</label>
                  <div onClick={() => thumbnailInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${theme === 'dark' ? 'border-white/20 hover:border-white/40' : 'border-gray-300 hover:border-gray-400'}`}>
                    {selectedThumbnail
                      ? <><i className="fas fa-image text-green-400 text-xl mb-1"></i><p className="text-xs font-medium">{selectedThumbnail.name}</p></>
                      : <><i className={`fas fa-image text-xl mb-1 ${sub}`}></i><p className={`text-xs ${sub}`}>Add thumbnail</p></>}
                  </div>
                  <input ref={thumbnailInputRef} type="file" className="hidden" accept="image/*" onChange={e => setSelectedThumbnail(e.target.files?.[0] || null)} />
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>Tags (comma-separated)</label>
                  <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className={inputCls} placeholder="e.g., batting, technique, tips" />
                </div>
                <div>
                  <label className={`block text-xs mb-2 ${sub}`}>Visibility</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, is_public: true }))}
                      className={`flex-1 p-3 rounded-xl border transition-all ${form.is_public
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 border-transparent text-white'
                        : theme === 'dark' ? 'glass border-white/10 text-white/60 hover:border-white/20' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <i className="fas fa-globe mr-2"></i>
                      <span className="text-sm font-medium">Public</span>
                      <p className={`text-xs mt-1 ${form.is_public ? 'text-white/80' : sub}`}>Everyone can see</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, is_public: false }))}
                      className={`flex-1 p-3 rounded-xl border transition-all ${!form.is_public
                        ? 'bg-gradient-to-r from-orange-500 to-red-600 border-transparent text-white'
                        : theme === 'dark' ? 'glass border-white/10 text-white/60 hover:border-white/20' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <i className="fas fa-lock mr-2"></i>
                      <span className="text-sm font-medium">Private</span>
                      <p className={`text-xs mt-1 ${!form.is_public ? 'text-white/80' : sub}`}>Only my players</p>
                    </button>
                  </div>
                </div>
                {uploading && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={sub}>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} disabled={uploading}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium disabled:opacity-50 ${theme === 'dark' ? 'glass border-white/20 hover:bg-white/10' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                  Cancel
                </button>
                <button onClick={handleUpload} disabled={uploading || !form.title.trim() || (form.content_type === 'article' ? !form.article_body.trim() : !selectedFile)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {uploading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="fas fa-upload"></i>}
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
