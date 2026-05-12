import { AxiosError } from "axios";
import { videosApi } from "../lib/api";

interface VideoListResponse {
  videos: PlayerVideoItem[];
  total: number;
  page: number;
  per_page: number;
}

interface RawVideoItem {
  id: string;
  title: string;
  description?: string | null;
  created_at?: string;
  file_path?: string | null;
  duration_seconds?: number | null;
}

export interface PlayerVideoItem {
  id: string;
  title: string;
  createdAt: string;
  // Always the authenticated stream endpoint for private playback
  videoUrl: string;
  // Optional if the backend includes it, otherwise we fall back to `title`
  filePath: string;
  durationSeconds: number | null;
}

function toErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: string }>;
  return axiosError.response?.data?.detail || axiosError.message || fallback;
}

function normalizeVideo(video: RawVideoItem): PlayerVideoItem {
  const filePath = video.file_path ?? "";

  return {
    id: video.id,
    title: video.title || "Untitled video",
    createdAt: video.created_at ?? "",
    filePath,
    videoUrl: videosApi.getStreamUrl(video.id),
    durationSeconds: video.duration_seconds ?? null,
  };
}

export async function getPlayerVideos(): Promise<VideoListResponse> {
  try {
    const response = await videosApi.listMine();
    const data = response.data as { videos?: RawVideoItem[]; total?: number; page?: number; per_page?: number };

    return {
      videos: (data.videos ?? []).map(normalizeVideo),
      total: data.total ?? 0,
      page: data.page ?? 1,
      per_page: data.per_page ?? 20,
    };
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    if (axiosError.response?.status === 403) {
      throw new Error("Please subscribe to view your videos.");
    }
    const detail = axiosError.response?.data?.detail?.toLowerCase() ?? "";
    if (detail.includes("subscription") || (detail.includes("access") && detail.includes("denied"))) {
      throw new Error("Please subscribe to view your videos.");
    }
    throw new Error(toErrorMessage(error, "Failed to load player videos."));
  }
}

export async function uploadPlayerVideo(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", file.name);
  // Ensure gallery uploads remain private by default (ADMIN can still override elsewhere).
  formData.append("visibility", "private");

  try {
    const response = await videosApi.upload(formData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    if (axiosError.response?.status === 403) {
      throw new Error("Upload failed due to access restrictions.");
    }
    const detail = axiosError.response?.data?.detail?.toLowerCase() ?? "";
    if (detail.includes("access") && detail.includes("denied")) {
      throw new Error("Upload failed due to access restrictions.");
    }
    throw new Error(toErrorMessage(error, "Failed to upload video."));
  }
}

export async function deletePlayerVideo(videoId: string) {
  try {
    await videosApi.delete(videoId);
  } catch (error) {
    throw new Error(toErrorMessage(error, "Failed to delete video."));
  }
}
