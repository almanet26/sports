import { api } from "../lib/api";

export interface PlayerVideoItem {
  id: string;
  title: string;
  url: string;
  uploadedAt: string | null;
  status: string;
  thumbnailUrl?: string | null;
}

export interface PlayerVideosEnvelope {
  success: boolean;
  videos: PlayerVideoItem[];
}

export interface PlayerVideoUploadEnvelope {
  success: boolean;
  message: string;
  video: PlayerVideoItem;
}

export interface PlayerVideoDeleteEnvelope {
  success: boolean;
  message: string;
}

export async function getPlayerVideos() {
  const response = await api.get("/player/videos");
  return response.data as PlayerVideosEnvelope;
}

export async function uploadPlayerVideo(file: File) {
  const formData = new FormData();
  formData.append("video", file);

  const response = await api.post("/player/videos/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data as PlayerVideoUploadEnvelope;
}

export async function deletePlayerVideo(videoId: string) {
  const response = await api.delete(`/player/videos/${videoId}`);
  return response.data as PlayerVideoDeleteEnvelope;
}
