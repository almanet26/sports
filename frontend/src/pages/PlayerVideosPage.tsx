import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Film, Loader2, Search, Send, Trash2, Upload, Video, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { deletePlayerVideo, getPlayerVideos, type PlayerVideoItem, uploadPlayerVideo } from "../services/playerVideos";
import { useAuthStore } from "../store/authStore";

type SortMode = "latest" | "oldest" | "az";
type FilterMode = "all" | "submitted" | "not_submitted";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-m4v"];
const FREE_UPLOAD_LIMIT = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatDate(value: string) {
  if (!value) return "Recently added";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently added";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function countUploadsThisMonth(items: PlayerVideoItem[]) {
  const now = new Date();
  return items.filter((v) => {
    const created = new Date(v.createdAt || 0);
    return !Number.isNaN(created.getTime()) && created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  }).length;
}

function formatDuration(value: number | null) {
  if (!value || value < 1) return "--";
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function LoadingCard({ index }: { index: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
      className="glass min-h-[210px] rounded-3xl border border-white/20 p-6">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-white/10" />
            <div className="h-3 w-1/3 rounded bg-white/10" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="h-14 rounded-2xl bg-white/5" />
          <div className="h-14 rounded-2xl bg-white/5" />
          <div className="h-14 rounded-2xl bg-white/5" />
        </div>
      </div>
    </motion.div>
  );
}

export default function PlayerVideosPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const user = useAuthStore((s) => s.user);
  const isFreeUser = user?.role === "PLAYER";

  const [videos, setVideos] = useState<PlayerVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playerTitle, setPlayerTitle] = useState("");
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const uploadsThisMonth = useMemo(() => countUploadsThisMonth(videos), [videos]);

  useEffect(() => { loadVideos(); }, []);

  useEffect(() => {
    if (!toast || toast.type !== "success") return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    return () => { if (playerUrl) URL.revokeObjectURL(playerUrl); };
  }, [playerUrl]);

  const loadVideos = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPlayerVideos();
      setVideos(data.videos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load videos.");
    } finally {
      setLoading(false);
    }
  };

  const closePlayer = () => {
    setIsPlayerOpen(false);
    setPlayerLoading(false);
    setPlayerError("");
    if (playerUrl) { URL.revokeObjectURL(playerUrl); setPlayerUrl(null); }
  };

  const openPlayer = async (video: PlayerVideoItem) => {
    setIsPlayerOpen(true);
    setPlayerTitle(video.title);
    setPlayerError("");
    setPlayerLoading(true);
    try {
      if (playerUrl) { URL.revokeObjectURL(playerUrl); setPlayerUrl(null); }
      const response = await api.get(`/player/videos/${video.id}/stream`, { responseType: "blob", timeout: 0 });
      setPlayerUrl(URL.createObjectURL(response.data as Blob));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load video.";
      setPlayerError(message);
    } finally {
      setPlayerLoading(false);
    }
  };

  const handleUploadClick = () => {
    if (isFreeUser && uploadsThisMonth >= FREE_UPLOAD_LIMIT) {
      setToast({ msg: "Free users can upload only 5 videos per month.", type: "error" });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) { setToast({ msg: "Please choose an MP4, MOV, AVI, or M4V video.", type: "error" }); return; }
    if (file.size > MAX_FILE_SIZE) { setToast({ msg: "File size should be less than 50MB.", type: "error" }); return; }
    setUploading(true);
    try {
      await uploadPlayerVideo(file);
      await loadVideos();
      setToast({ msg: "Video uploaded successfully.", type: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Upload failed.", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (videoId: string) => {
    setDeletingId(videoId);
    try {
      await deletePlayerVideo(videoId);
      await loadVideos();
      setToast({ msg: "Video deleted.", type: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Delete failed.", type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? videos.filter((v) => v.title.toLowerCase().includes(q)) : videos;
    return [...base].sort((a, b) => {
      if (sortMode === "az") return a.title.localeCompare(b.title);
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return sortMode === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [videos, query, sortMode, filterMode]);

  return (
    <div className="space-y-8 text-white">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="fixed right-4 top-4 z-[80] w-[min(92vw,380px)]">
            <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-xl ${
              toast.type === "success" ? "border-emerald-400/20 bg-slate-950/95 text-emerald-200" : "border-rose-400/20 bg-slate-950/95 text-rose-200"
            }`}>
              <p className="flex-1 text-sm">{toast.msg}</p>
              <button type="button" onClick={() => setToast(null)}><X className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPlayerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
            onClick={closePlayer}>
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ duration: 0.2 }}
              className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/10 bg-[#07111f]"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                <p className="truncate text-sm font-semibold text-white">{playerTitle || "Video"}</p>
                <button type="button" onClick={closePlayer} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative bg-black">
                {playerLoading ? (
                  <div className="flex h-[52vh] min-h-[320px] items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-200" />
                  </div>
                ) : playerError ? (
                  <div className="flex h-[52vh] min-h-[320px] items-center justify-center px-6 text-center">
                    <p className="text-sm text-slate-400">{playerError}</p>
                  </div>
                ) : playerUrl ? (
                  <video key={playerUrl} src={playerUrl} controls autoPlay className="h-[52vh] min-h-[320px] w-full bg-black" />
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl border border-white/20 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">My Videos</h1>
            <p className="mt-2 text-sm text-white/60">Manage your private video gallery</p>
            {!loading && <p className="mt-1 text-xs text-white/40">{videos.length} videos</p>}
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/x-m4v" className="hidden" onChange={handleFileChange} />
            <button type="button" onClick={handleUploadClick} disabled={uploading}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white hover:from-blue-600 hover:to-cyan-600 disabled:opacity-70">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading..." : "Upload Video"}
            </button>
          </div>
        </div>
      </motion.div>

      <div className="glass rounded-3xl border border-white/20 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search videos..."
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-400/40" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
              <span className="text-xs uppercase tracking-widest text-white/50">Sort</span>
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="bg-transparent text-sm text-white outline-none">
                <option value="latest" className="bg-slate-950">Latest first</option>
                <option value="oldest" className="bg-slate-950">Oldest first</option>
                <option value="az" className="bg-slate-950">A-Z</option>
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
              <span className="text-xs uppercase tracking-widest text-white/50">Filter</span>
              <select value={filterMode} onChange={(e) => setFilterMode(e.target.value as FilterMode)} className="bg-transparent text-sm text-white outline-none">
                <option value="all" className="bg-slate-950">All</option>
                <option value="not_submitted" className="bg-slate-950">Not Submitted</option>
                <option value="submitted" className="bg-slate-950">Submitted to Coach</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass rounded-3xl border border-rose-400/20 bg-rose-400/5 p-6">
          <p className="text-lg font-semibold text-rose-200">Could not load your videos</p>
          <p className="mt-2 text-sm text-white/60">{error}</p>
          <button type="button" onClick={() => void loadVideos()}
            className="mt-5 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <LoadingCard key={i} index={i} />)}
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="glass rounded-3xl border border-white/20 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.04]">
            <Video className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">
            {videos.length === 0 ? "No videos uploaded yet" : "No matching videos"}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
            {videos.length === 0 ? "Upload your first private video to build your gallery." : "Try adjusting your search or filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {filteredVideos.map((video, index) => (
            <motion.article key={video.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: index * 0.04 }} className="glass rounded-3xl border border-white/20 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex-shrink-0">
                    <Film className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-white">{video.title}</h3>
                    <span className="text-xs text-white/40">{formatDate(video.createdAt)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => void handleDelete(video.id)} disabled={deletingId === video.id}
                  className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-2 text-rose-200 hover:bg-rose-400/20 disabled:opacity-60">
                  {deletingId === video.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Added</p>
                  <p className="mt-2 text-sm font-medium text-white">{formatDate(video.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Duration</p>
                  <p className="mt-2 text-sm font-medium text-white">{formatDuration(video.durationSeconds)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Status</p>
                  <p className="mt-2 text-sm font-medium text-white">Uploaded</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => void openPlayer(video)}
                  className="rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-200 hover:bg-blue-400/20">
                  Play / View
                </button>
                <button type="button"
                  onClick={() => navigate("/player/submissions", { state: { prefillVideoId: video.id, prefillTitle: video.title } })}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-400/20">
                  <Send className="h-4 w-4" />
                  Submit to Coach
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
