import { type ChangeEvent, useRef } from "react";
import { motion } from "framer-motion";
import { Calendar, Upload, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../../../lib/api";
import type { PlayerVideoItem } from "../../../services/playerVideos";

const MAX_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXT = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];

interface Props {
  videos: PlayerVideoItem[];
  isUploading: boolean;
  deletingId: string | null;
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onError: (msg: string) => void;
}

function formatDate(value: string | null) {
  if (!value) return "Just now";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function VideoGrid({ videos, isUploading, deletingId, onUpload, onDelete, onError }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const lower = file.name.toLowerCase();
    const validExt = ALLOWED_EXT.some((ext) => lower.endsWith(ext));
    if (!(file.type.startsWith("video/") || validExt)) {
      onError("Please select a valid video file.");
      return;
    }
    if (file.size > MAX_SIZE) {
      onError("Video is too large. Maximum allowed size is 100MB.");
      return;
    }
    onUpload(file);
  };

  return (
    <section className="space-y-6">
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Video Highlights</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Video Highlights</h2>
          <p className="mt-2 text-slate-400">Showcase key moments from matches and standout performances.</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload Match Video"}
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="rounded-[30px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20">
            <Video className="h-8 w-8 text-blue-200" />
          </div>
          <h3 className="mt-5 text-2xl font-semibold text-white">No highlights added yet</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
            Upload a match video to build your player portfolio.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-violet-700 disabled:opacity-70"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Uploading..." : "Upload Match Video"}
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {videos.map((v) => (
            <motion.article
              key={v.id}
              whileHover={{ y: -5, scale: 1.01 }}
              className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl"
            >
              <div className="relative h-52">
                <video className="h-full w-full object-cover" preload="metadata" muted src={resolveMediaUrl(v.url)}>
                  <source src={resolveMediaUrl(v.url)} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
                  <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs text-blue-200">{v.status}</span>
                  <span className="rounded-full bg-black/35 px-3 py-1 text-xs text-white">{formatDate(v.uploadedAt)}</span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="truncate text-lg font-semibold text-white">{v.title}</h3>
                <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  Uploaded {formatDate(v.uploadedAt)}
                </div>
                <div className="mt-5 flex gap-3">
                  <Link
                    to={`/video/${v.id}`}
                    className="flex-1 rounded-xl bg-white/[0.07] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                  >
                    View / Play
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(v.id)}
                    disabled={deletingId === v.id}
                    className="flex-1 rounded-xl border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === v.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
}
