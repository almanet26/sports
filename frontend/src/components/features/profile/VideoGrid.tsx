import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Film, Loader2, Send, Trash2, Upload, Video, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { Link } from "react-router-dom";
import type { PlayerVideoItem } from "../../../services/playerVideos";
import { api } from "../../../lib/api";
import { useSubscriptionStore } from "../../../store/authStore";
import type { Tier } from "../../../types/subscriptionPlans";
import { formatFileSize } from "../../../lib/utils";

interface Props {
  videos: PlayerVideoItem[];
  isUploading: boolean;
  deletingId: string | null;
  isFreeUser?: boolean;
  freeUploadsThisMonth?: number;
  onUpload: (file: File) => Promise<void>;
  onDelete: (videoId: string) => Promise<void>;
  onError: (message: string) => void;
}

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-m4v"];
const FREE_UPLOAD_LIMIT = 5;

const UPLOAD_LIMITS: Record<Tier, number> = {
  free: 10 * 1024 * 1024,
  coach_free: 10 * 1024 * 1024,
  basic: 50 * 1024 * 1024,
  platinum: 100 * 1024 * 1024,
  coach_starter: 50 * 1024 * 1024,
  coach_pro: 100 * 1024 * 1024,
  academy: 150 * 1024 * 1024,
};

function formatDate(value: string) {
  if (!value) return "Recently added";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently added";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(value: number | null) {
  if (!value || value < 1) return "--";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function VideoGrid({
  videos,
  isUploading,
  deletingId,
  isFreeUser,
  freeUploadsThisMonth,
  onUpload,
  onDelete,
  onError,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const subscriptionTier = useSubscriptionStore((s) => s.subscriptionTier) as Tier;
  const sortedVideos = useMemo(
    () => [...videos].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [videos],
  );

  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playerTitle, setPlayerTitle] = useState("");
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const closePlayer = () => {
    setIsPlayerOpen(false);
    setPlayerLoading(false);
    setPlayerError("");
    if (playerUrl) {
      URL.revokeObjectURL(playerUrl);
      setPlayerUrl(null);
    }
  };

  useEffect(() => {
    return () => {
      if (playerUrl) URL.revokeObjectURL(playerUrl);
    };
  }, [playerUrl]);

  const isFreeLimited = Boolean(isFreeUser) && typeof freeUploadsThisMonth === "number" && freeUploadsThisMonth >= FREE_UPLOAD_LIMIT;

  const openPlayer = async (video: PlayerVideoItem) => {
    setIsPlayerOpen(true);
    setPlayerTitle(video.title);
    setPlayerError("");
    setPlayerLoading(true);

    try {
      if (playerUrl) {
        URL.revokeObjectURL(playerUrl);
        setPlayerUrl(null);
      }

      const response = await api.get(`/player/videos/${video.id}/stream`, {
        responseType: "blob",
        timeout: 0,
      });

      const blob = response.data as Blob;
      const objectUrl = URL.createObjectURL(blob);
      setPlayerUrl(objectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load video.";
      setPlayerError(message);
      onError(message);
    } finally {
      setPlayerLoading(false);
    }
  };

  const handleUploadClick = () => {
    if (isFreeLimited) {
      onError("Free users can upload only 5 videos per month.");
      return;
    }
    inputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (isFreeLimited) {
      onError("Free users can upload only 5 videos per month.");
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onError("Please choose an MP4, MOV, AVI, or M4V video.");
      return;
    }
    const maxBytes = UPLOAD_LIMITS[subscriptionTier] ?? UPLOAD_LIMITS.free;
    if (file.size > maxBytes) {
      onError(`File size should be less than ${formatFileSize(maxBytes)}.`);
      return;
    }

    await onUpload(file);
  };

  return (
    <section className="space-y-5 rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <AnimatePresence>
        {isPlayerOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
            onClick={closePlayer}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/10 bg-[#07111f] shadow-[0_24px_120px_rgba(2,6,23,0.58)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{playerTitle || "Video"}</p>
                  <p className="mt-1 text-xs text-slate-400">Private playback</p>
                </div>
                <button
                  type="button"
                  onClick={closePlayer}
                  className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative bg-black">
                {playerLoading ? (
                  <div className="flex h-[52vh] min-h-[320px] items-center justify-center">
                    <div className="flex items-center gap-3 text-slate-200">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">Loading video...</span>
                    </div>
                  </div>
                ) : playerError ? (
                  <div className="flex h-[52vh] min-h-[320px] items-center justify-center px-6 text-center">
                    <div className="space-y-2">
                      <p className="text-base font-semibold text-white">Unable to play this video</p>
                      <p className="text-sm text-slate-400">{playerError}</p>
                    </div>
                  </div>
                ) : playerUrl ? (
                  <video
                    key={playerUrl}
                    src={playerUrl}
                    controls
                    autoPlay
                    className="h-[52vh] min-h-[320px] w-full bg-black"
                  />
                ) : (
                  <div className="flex h-[52vh] min-h-[320px] items-center justify-center text-slate-400">
                    No video source available.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Private Gallery</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">My videos</h2>
          <p className="mt-2 text-sm text-slate-400">Upload and review your private videos anytime.</p>
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/x-m4v"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isUploading ? "Uploading..." : "Upload Video"}
          </button>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-950/70 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.04]">
            <Video className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">No videos yet</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Upload a video to start building your private gallery. You can submit a video to a coach later.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isUploading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-cyan-600 disabled:opacity-70"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Video
            </button>
            <Link
              to="/library"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            >
              Go to Library
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sortedVideos.map((video, index) => {
            return (
              <motion.article
                key={video.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500">
                        <Film className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-white">{video.title}</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                          Uploaded
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDelete(video.id)}
                    disabled={deletingId === video.id}
                    className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-2 text-rose-200 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Delete video"
                  >
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
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Type</p>
                    <p className="mt-2 text-sm font-medium text-white">Video</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void openPlayer(video)}
                    className="rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-200 transition hover:bg-blue-400/20"
                  >
                    Play
                  </button>
                  <Link
                    to="/player/submissions"
                    state={{ prefillVideoId: video.id, prefillTitle: video.title }}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20"
                  >
                    <Send className="h-4 w-4" />
                    Submit to Coach
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </section>
  );
}
