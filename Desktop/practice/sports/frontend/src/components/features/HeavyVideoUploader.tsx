import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as UpChunk from "@mux/upchunk";
import { Pause, Play, RotateCcw, UploadCloud } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Progress } from "../ui/Progress";
import { formatFileSize } from "../../lib/utils";
import { resolveMediaUrl, videosApi } from "../../lib/api";

type UploadStatus = "idle" | "ready" | "requesting" | "uploading" | "finishing" | "done" | "error";

interface UploadState {
  status: UploadStatus;
  progress: number;
  message: string;
  error: string;
  submissionId: string;
  highlightUrl: string;
}

interface GeneratedVideoItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
  supercut_path?: string;
  total_events?: number;
}

interface SubmissionPollData {
  status?: string;
  annotated_video_url?: string;
  original_filename?: string;
}

interface UploadCompletePayload {
  submissionId: string;
  filename: string;
}

interface HeavyVideoUploaderProps {
  analysisType?: "FULL_MATCH" | "BOWLING" | "BATTING";
  sessionPath?: string;
  startProcessingPath?: string;
  onUploadComplete?: (payload: UploadCompletePayload) => void;
}

interface UpChunkLike {
  pause: () => void;
  resume: () => void;
  on: (event: string, cb: (eventData?: unknown) => void) => void;
}

interface ErrorLike {
  message?: string;
  detail?: unknown;
  target?: unknown;
  currentTarget?: unknown;
  type?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
// UpChunk expects chunk size in KiB (not bytes).
// Valid range: 256..512000 KiB, multiple of 256.
const DEFAULT_CHUNK_SIZE_KIB = 64 * 1024; // 64 MiB (fewer requests for multi-GB uploads)
const MIN_CHUNK_SIZE_KIB = 8 * 1024;
const MAX_CHUNK_SIZE_KIB = 128 * 1024;
const UPLOAD_RETRY_ATTEMPTS = 12;
const UPLOAD_RETRY_DELAY_SECONDS = 2;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 * 1024;

const initialState: UploadState = {
  status: "idle",
  progress: 0,
  message: "Choose a video to upload.",
  error: "",
  submissionId: "",
  highlightUrl: "",
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractUploadError(error: unknown): string {
  const fallback = "Chunk upload failed. Please retry.";

  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  const candidate = error as ErrorLike;
  if (candidate.message && candidate.message.trim()) {
    return candidate.message;
  }

  // UpChunk can emit ProgressEvent-like errors where useful data is on target/currentTarget.
  const xhrLike = (candidate.target || candidate.currentTarget || candidate.detail) as
    | { status?: unknown; responseText?: unknown; statusText?: unknown }
    | undefined;

  const status = toNumber(xhrLike?.status);
  const responseText = typeof xhrLike?.responseText === "string" ? xhrLike.responseText.trim() : "";
  const statusText = typeof xhrLike?.statusText === "string" ? xhrLike.statusText.trim() : "";

  if (status > 0 || responseText || statusText) {
    const parts: string[] = [];
    if (status > 0) parts.push(`HTTP ${status}`);
    if (statusText) parts.push(statusText);
    if (responseText) parts.push(responseText);
    return `Upload request failed: ${parts.join(" | ")}`;
  }

  if (candidate.type) {
    return `Upload failed with browser event '${candidate.type}'. This upload is direct browser-to-storage, so backend logs can stay empty. Usually this means network interruption, tab sleep, or an expired resumable session.`;
  }

  try {
    const raw = JSON.stringify(error);
    if (raw && raw !== "{}") {
      return raw;
    }
  } catch {
    // Ignore JSON serialization failures.
  }

  return fallback;
}

function normalizeMediaUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}

function toLibraryVideoRoute(videoId: string): string {
  return `/video/${videoId}`;
}

export default function HeavyVideoUploader({
  analysisType = "FULL_MATCH",
  sessionPath = "/api/v1/storage/resumable-session",
  startProcessingPath = "/api/v1/storage/start-processing",
  onUploadComplete,
}: HeavyVideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadRef = useRef<UpChunkLike | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>(initialState);
  const [paused, setPaused] = useState(false);
  const [generatedHighlights, setGeneratedHighlights] = useState<GeneratedVideoItem[]>([]);
  const [loadingGenerated, setLoadingGenerated] = useState(false);

  const isBusy = useMemo(
    () => state.status === "requesting" || state.status === "uploading" || state.status === "finishing",
    [state.status],
  );

  const reset = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.pause();
      uploadRef.current = null;
    }
    setPaused(false);
    setFile(null);
    setState(initialState);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  useEffect(() => {
    return () => {
      if (uploadRef.current) {
        uploadRef.current.pause();
        uploadRef.current = null;
      }
    };
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setState({
        ...initialState,
        status: "error",
        message: "File too large.",
        error: `Maximum supported size is ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`,
      });
      return;
    }

    setFile(selected);
    setState({
      ...initialState,
      status: "ready",
      message: `Ready: ${selected.name}`,
    });
  }, []);

  const buildHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("access_token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, []);

  const requestSessionUri = useCallback(
    async (selectedFile: File): Promise<{ sessionUri: string; submissionId: string }> => {
      const payload = {
        filename: selectedFile.name,
        content_type: selectedFile.type || "application/octet-stream",
        analysis_type: analysisType,
        size_bytes: selectedFile.size,
      };

      const response = await axios.post(`${API_BASE_URL}${sessionPath}`, payload, {
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders(),
        },
        timeout: 60000,
      });

      const data = (response.data || {}) as Record<string, unknown>;
      const sessionUri =
        (data.session_uri as string) ||
        (data.sessionUrl as string) ||
        (data.upload_url as string) ||
        (data.resumable_session_uri as string);
      const submissionId = (data.submission_id as string) || (data.submissionId as string) || "";

      if (!sessionUri) {
        throw new Error("Backend did not return a session_uri.");
      }
      return { sessionUri, submissionId };
    },
    [analysisType, buildHeaders, sessionPath],
  );

  const triggerProcessing = useCallback(
    async (submissionId: string) => {
      if (!submissionId) {
        throw new Error("Missing submission_id from resumable-session response.");
      }

      await axios.post(`${API_BASE_URL}/api/v1/storage/confirm-upload`, null, {
        params: { submission_id: submissionId },
        headers: buildHeaders(),
        timeout: 60000,
      });

      await axios.post(`${API_BASE_URL}${startProcessingPath}`, null, {
        params: { submission_id: submissionId },
        headers: buildHeaders(),
        timeout: 60000,
      });
    },
    [buildHeaders, startProcessingPath],
  );

  const fetchGeneratedHighlights = useCallback(async () => {
    setLoadingGenerated(true);
    try {
      const response = await videosApi.listMine(1, 30);
      const videos = ((response.data as { videos?: GeneratedVideoItem[] }).videos || [])
        .filter((v) => String(v.status || "").toLowerCase() === "completed")
        .filter((v) => Boolean(v.supercut_path));
      setGeneratedHighlights(videos);
    } catch {
      // Keep uploader usable even if listing fails.
    } finally {
      setLoadingGenerated(false);
    }
  }, []);

  useEffect(() => {
    void fetchGeneratedHighlights();
  }, [fetchGeneratedHighlights]);

  const pollSubmissionForHighlight = useCallback(
    async (submissionId: string) => {
      const maxAttempts = 120; // ~20 minutes at 10s interval
      const delayMs = 10000;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        try {
          const response = await axios.get(`${API_BASE_URL}/api/v1/submissions/${submissionId}`, {
            headers: buildHeaders(),
            timeout: 30000,
          });

          const data = (response.data || {}) as SubmissionPollData;

          const status = String(data.status || "").toUpperCase();
          const annotatedVideoUrl = normalizeMediaUrl(String(data.annotated_video_url || ""));
          const originalFilename = String(data.original_filename || "").trim();

          if (annotatedVideoUrl) {
            let preferredUrl = annotatedVideoUrl;
            try {
              const mineResponse = await videosApi.listMine(1, 50);
              const mine = ((mineResponse.data as { videos?: GeneratedVideoItem[] }).videos || []);

              const directMatch = mine.find((v) => {
                const supercut = resolveMediaUrl(v.supercut_path || "");
                return Boolean(supercut) && supercut === annotatedVideoUrl;
              });

              const filenameMatch = !directMatch
                ? mine
                    .filter((v) => originalFilename && v.title === originalFilename)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                : undefined;

              const matchedVideo = directMatch || filenameMatch;
              if (matchedVideo?.id) {
                preferredUrl = toLibraryVideoRoute(matchedVideo.id);
              }
            } catch {
              // If matching fails, retain direct media URL fallback.
            }

            setState((prev) => ({
              ...prev,
              status: "done",
              message: "Highlight generated successfully.",
              highlightUrl: preferredUrl,
            }));
            void fetchGeneratedHighlights();
            return;
          }

          if (status === "PUBLISHED" || status === "DRAFT_REVIEW") {
            setState((prev) => ({
              ...prev,
              status: "done",
              message: `Processing finished with status ${status}, but no highlight URL was attached.`,
            }));
            return;
          }

          if (status === "PROCESSING") {
            setState((prev) => ({
              ...prev,
              message: "OCR processing in progress...",
            }));
          }
        } catch {
          // Stop aggressive polling on auth expiry; the interceptor will handle session state.
          setState((prev) => ({
            ...prev,
            status: "error",
            message: "Session expired while waiting for processing result.",
            error: "Please log in again and open the library page to continue tracking this upload.",
          }));
          return;
        }
      }

      setState((prev) => ({
        ...prev,
        status: "error",
        message: "Upload succeeded, but processing timed out waiting for result.",
        error: "Worker may still be running. Check backend worker logs and Cloud Tasks execution history.",
      }));
    },
    [buildHeaders, fetchGeneratedHighlights],
  );

  const startUpload = useCallback(async () => {
    if (!file || isBusy) return;

    setPaused(false);
    setState((prev) => ({
      ...prev,
      status: "requesting",
      progress: 0,
      error: "",
      message: "Creating resumable upload session...",
    }));

    try {
      const { sessionUri, submissionId } = await requestSessionUri(file);

      setState((prev) => ({
        ...prev,
        status: "uploading",
        submissionId,
        message: "Uploading in chunks...",
      }));

      const upload = UpChunk.createUpload({
        endpoint: sessionUri,
        file,
        chunkSize: DEFAULT_CHUNK_SIZE_KIB,
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        attempts: UPLOAD_RETRY_ATTEMPTS,
        delayBeforeAttempt: UPLOAD_RETRY_DELAY_SECONDS,
        dynamicChunkSize: true,
        minChunkSize: MIN_CHUNK_SIZE_KIB,
        maxChunkSize: MAX_CHUNK_SIZE_KIB,
        retryCodes: [408, 409, 429, 500, 502, 503, 504],
      }) as UpChunkLike;

      uploadRef.current = upload;

      upload.on("progress", (evt?: unknown) => {
        const detail = typeof evt === "object" && evt && "detail" in evt ? Number((evt as { detail: number }).detail) : 0;
        const rounded = Math.max(0, Math.min(100, Number(detail.toFixed(2))));
        setState((prev) => ({
          ...prev,
          status: "uploading",
          progress: rounded,
          message: `Uploading... ${rounded.toFixed(2)}%`,
        }));
      });

      upload.on("error", (err?: unknown) => {
        const msg = extractUploadError(err);
        setState((prev) => ({
          ...prev,
          status: "error",
          message: "Upload failed.",
          error: msg,
        }));
      });

      upload.on("success", async () => {
        try {
          setState((prev) => ({
            ...prev,
            status: "finishing",
            progress: 100,
            message: "Upload complete. Starting backend processing...",
          }));

          await triggerProcessing(submissionId);

          setState((prev) => ({
            ...prev,
            status: "finishing",
            message: "Upload complete and processing queued. Waiting for highlight generation...",
          }));

          void pollSubmissionForHighlight(submissionId);

          onUploadComplete?.({ submissionId, filename: file.name });
        } catch (processingError: unknown) {
          const detail =
            typeof processingError === "object" && processingError && "response" in processingError
              ? String((processingError as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to trigger processing.")
              : String((processingError as Error)?.message || "Failed to trigger processing.");

          setState((prev) => ({
            ...prev,
            status: "error",
            message: "Upload succeeded, but processing trigger failed.",
            error: detail,
          }));
        }
      });
    } catch (error: unknown) {
      const detail =
        typeof error === "object" && error && "response" in error
          ? String((error as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to initialize resumable upload.")
          : String((error as Error)?.message || "Failed to initialize resumable upload.");

      setState((prev) => ({
        ...prev,
        status: "error",
        message: "Could not start upload.",
        error: detail,
      }));
    }
  }, [file, isBusy, onUploadComplete, pollSubmissionForHighlight, requestSessionUri, triggerProcessing]);

  const pauseUpload = useCallback(() => {
    if (!uploadRef.current) return;
    uploadRef.current.pause();
    setPaused(true);
    setState((prev) => ({ ...prev, message: `Upload paused at ${prev.progress.toFixed(2)}%.` }));
  }, []);

  const resumeUpload = useCallback(() => {
    if (!uploadRef.current) return;
    uploadRef.current.resume();
    setPaused(false);
    setState((prev) => ({ ...prev, message: `Resuming upload... ${prev.progress.toFixed(2)}%` }));
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto border border-white/10 bg-slate-900/40">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-blue-400" />
          Resumable Video Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            disabled={isBusy}
            className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border file:border-slate-600 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-100"
          />
          {file ? <p className="text-sm text-slate-300">{file.name} ({formatFileSize(file.size)})</p> : null}
        </div>

        <div className="space-y-2">
          <Progress value={state.progress} />
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>{state.message}</span>
            <span>{state.progress.toFixed(2)}%</span>
          </div>
          {state.submissionId ? <p className="text-xs text-slate-400">Submission ID: {state.submissionId}</p> : null}
          {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
          {state.highlightUrl ? (
            <a
              href={state.highlightUrl}
              target={state.highlightUrl.startsWith("/") ? "_self" : "_blank"}
              rel={state.highlightUrl.startsWith("/") ? undefined : "noopener noreferrer"}
              className="text-sm text-emerald-400 underline underline-offset-2"
            >
              Open generated highlight in library
            </a>
          ) : null}
        </div>

        <div className="space-y-3 rounded-lg border border-white/10 bg-slate-950/40 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Generated Highlights</h3>
            <Button variant="outline" onClick={() => void fetchGeneratedHighlights()} disabled={loadingGenerated}>
              Refresh
            </Button>
          </div>

          {loadingGenerated ? <p className="text-xs text-slate-400">Loading highlights...</p> : null}

          {!loadingGenerated && generatedHighlights.length === 0 ? (
            <p className="text-xs text-slate-400">No generated highlights yet.</p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {generatedHighlights.map((item) => {
              const mediaUrl = resolveMediaUrl(item.supercut_path || "");
              return (
                <div key={item.id} className="rounded-lg border border-white/10 bg-slate-900/60 p-2">
                  <p className="truncate text-xs font-medium text-slate-200">{item.title}</p>
                  <p className="text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400">Events: {item.total_events || 0}</p>
                  <a
                    href={toLibraryVideoRoute(item.id)}
                    className="mt-1 inline-block text-[11px] text-blue-300 underline underline-offset-2"
                  >
                    Open in library
                  </a>
                  {mediaUrl ? (
                    <video className="mt-2 w-full rounded" controls preload="metadata" src={mediaUrl} />
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-500">Highlight URL unavailable</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={startUpload} disabled={!file || isBusy || state.status === "done"}>Start Upload</Button>
          <Button variant="outline" onClick={pauseUpload} disabled={!uploadRef.current || paused || state.status !== "uploading"}>
            <Pause className="h-4 w-4 mr-1" /> Pause
          </Button>
          <Button variant="outline" onClick={resumeUpload} disabled={!uploadRef.current || !paused || state.status !== "uploading"}>
            <Play className="h-4 w-4 mr-1" /> Resume
          </Button>
          <Button variant="outline" onClick={reset} disabled={isBusy && !paused}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
