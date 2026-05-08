import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "../store/themeStore";
import { api } from "../lib/api";

const toast = {
  error: (msg: string) => console.error(msg),
  success: (msg: string) => console.log(msg),
};

interface Content {
  id: number;
  title: string;
  description: string;
  content_type: "article" | "video" | "image";
  article_content?: string;
  file_url?: string;
  thumbnail_url?: string;
  tags?: string;
  views: number;
  likes: number;
  created_at: string;
}

export default function MyContent() {
  const { theme } = useThemeStore();
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [contentType, setContentType] = useState<"article" | "video" | "image">("article");
  const [filterType, setFilterType] = useState<"all" | "article" | "video" | "image">("all");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    try {
      const response = await api.get("/coach/content");
      setContents(response.data);
    } catch (error) {
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("content_type", contentType);
    formData.append("tags", tags);

    if (contentType === "article") {
      formData.append("article_content", articleContent);
    }

    if (file) {
      formData.append("file", file);
    }

    if (thumbnail) {
      formData.append("thumbnail", thumbnail);
    }

    try {
      await api.post("/coach/content", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Content uploaded successfully!");
      setShowUploadModal(false);
      resetForm();
      fetchContents();
    } catch (error) {
      toast.error("Failed to upload content");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this content?")) return;

    try {
      await api.delete(`/coach/content/${id}`);
      toast.success("Content deleted successfully");
      fetchContents();
    } catch (error) {
      toast.error("Failed to delete content");
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setArticleContent("");
    setTags("");
    setFile(null);
    setThumbnail(null);
  };

  const filteredContents = filterType === "all" 
    ? contents 
    : contents.filter(c => c.content_type === filterType);

  const getIcon = (type: string) => {
    switch (type) {
      case "article": return "fas fa-file-alt";
      case "video": return "fas fa-video";
      case "image": return "fas fa-image";
      default: return "fas fa-file";
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "article": return "from-blue-500 to-cyan-500";
      case "video": return "from-purple-500 to-pink-500";
      case "image": return "from-green-500 to-emerald-500";
      default: return "from-gray-500 to-gray-600";
    }
  };

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 mb-8 border ${
          theme === 'dark'
            ? 'glass border-white/20'
            : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-folder-open text-blue-400"></i>
              My Content
            </h1>
            <p className={`mt-2 text-sm ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>
              Manage your articles, videos, and images
            </p>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 font-semibold flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            Upload Content
          </button>
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
        {["all", "article", "video", "image"].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type as any)}
            className={`px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${
              filterType === type
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-transparent'
                : theme === 'dark'
                ? 'glass border-white/20 hover:border-white/30'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <i className={`${getIcon(type)} mr-2`}></i>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filteredContents.length === 0 ? (
        <div className={`text-center py-12 rounded-3xl border border-dashed ${
          theme === 'dark' ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-400'
        }`}>
          <i className="fas fa-folder-open text-5xl mb-4 block"></i>
          <p>No content yet. Start by uploading your first piece!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContents.map((content, i) => (
            <motion.div
              key={content.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl overflow-hidden border transition-all duration-300 group ${
                theme === 'dark'
                  ? 'glass border-white/20 hover:border-white/30'
                  : 'bg-white border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg'
              }`}
            >
              {/* Thumbnail */}
              <div className={`h-48 bg-gradient-to-r ${getColor(content.content_type)} relative overflow-hidden`}>
                {content.thumbnail_url ? (
                  <img src={content.thumbnail_url} alt={content.title} className="w-full h-full object-cover" />
                ) : content.content_type === "image" && content.file_url ? (
                  <img src={content.file_url} alt={content.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <i className={`${getIcon(content.content_type)} text-6xl text-white/50`}></i>
                  </div>
                )}
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-xs">
                  <i className={`${getIcon(content.content_type)} mr-1`}></i>
                  {content.content_type}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2 line-clamp-2">{content.title}</h3>
                <p className={`text-sm mb-4 line-clamp-2 ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>
                  {content.description}
                </p>

                {/* Stats */}
                <div className={`flex items-center gap-4 text-sm mb-4 ${
                  theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                }`}>
                  <span><i className="fas fa-eye mr-1"></i>{content.views}</span>
                  <span><i className="fas fa-heart mr-1"></i>{content.likes}</span>
                  <span className="ml-auto text-xs">
                    {new Date(content.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(content.id)}
                    className={`flex-1 px-3 py-2 rounded-lg border transition-all text-sm ${
                      theme === 'dark'
                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                        : 'border-red-300 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <i className="fas fa-trash mr-1"></i>
                    Delete
                  </button>
                  <button
                    className={`flex-1 px-3 py-2 rounded-lg border transition-all text-sm ${
                      theme === 'dark'
                        ? 'border-white/20 hover:bg-white/10'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <i className="fas fa-eye mr-1"></i>
                    View
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-2xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto ${
                theme === 'dark' ? 'glass border border-white/20' : 'bg-white shadow-2xl'
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold gradient-text">Upload Content</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className={`w-10 h-10 rounded-xl transition-all ${
                    theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                  }`}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                {/* Content Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Content Type</label>
                  <div className="grid grid-cols-3 gap-3">
                    {["article", "video", "image"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setContentType(type as any)}
                        className={`p-4 rounded-xl border transition-all ${
                          contentType === type
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-transparent'
                            : theme === 'dark'
                            ? 'glass border-white/20 hover:border-white/30'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <i className={`${getIcon(type)} text-2xl mb-2 block`}></i>
                        <span className="text-sm capitalize">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'glass border-white/20 focus:border-blue-500'
                        : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                    }`}
                    placeholder="Enter title..."
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'glass border-white/20 focus:border-blue-500'
                        : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                    }`}
                    placeholder="Enter description..."
                  />
                </div>

                {/* Article Content */}
                {contentType === "article" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Article Content</label>
                    <textarea
                      value={articleContent}
                      onChange={(e) => setArticleContent(e.target.value)}
                      rows={8}
                      required
                      className={`w-full px-4 py-3 rounded-xl border transition-all ${
                        theme === 'dark'
                          ? 'glass border-white/20 focus:border-blue-500'
                          : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                      }`}
                      placeholder="Write your article..."
                    />
                  </div>
                )}

                {/* File Upload */}
                {contentType !== "article" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {contentType === "video" ? "Video File" : "Image File"}
                    </label>
                    <input
                      type="file"
                      accept={contentType === "video" ? "video/*" : "image/*"}
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      required
                      className={`w-full px-4 py-3 rounded-xl border transition-all ${
                        theme === 'dark'
                          ? 'glass border-white/20'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    />
                  </div>
                )}

                {/* Thumbnail */}
                <div>
                  <label className="block text-sm font-medium mb-2">Thumbnail (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'glass border-white/20'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'glass border-white/20 focus:border-blue-500'
                        : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                    }`}
                    placeholder="e.g., batting, technique, tips"
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className={`flex-1 px-6 py-3 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'border-white/20 hover:bg-white/10'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all font-semibold disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-upload mr-2"></i>
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
