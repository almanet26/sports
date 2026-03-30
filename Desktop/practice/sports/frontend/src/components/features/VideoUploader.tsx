/**
 * VideoUploader — Direct-to-Cloud (GCS) Upload Component
 * Uploads heavy video files straight to Google Cloud Storage via a signed URL, completely bypassing the FastAPI backend's memory.
 * Flow:
 *   1. GET  /api/v1/storage/upload-url   → signed_url + submission_id
 *   2. PUT  signed_url (axios → GCS)     → upload file with progress
 *   3. POST /api/v1/storage/confirm-upload → verify blob landed
 *   4. POST /api/v1/submissions/:id/analyze → queue ML processing
 */

import React, { useRef, useState } from "react";
import axios, { AxiosError, type CancelTokenSource } from "axios";
import { storageApi } from "../../lib/api";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Progress } from "../ui/Progress";
import {
  Upload,
  X,
  Film,
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Loader2,
} from "lucide-react";
import { cn, formatFileSize } from "../../lib/utils";

// Types
interface VideoUploaderProps {
  /** Called with the new submission ID once processing is queued */
  onUploadComplete?: (submissionId: string) => void;
  /** Default analysis type */
  analysisType?: "BATTING" | "BOWLING";
  className?: string;
}

type UploadStage =
  | "idle"        // waiting for file selection
  | "requesting"  // fetching signed URL
  | "uploading"   // PUTting to GCS
  | "confirming"  // verifying blob landed
  | "queuing"     // triggering ML worker
  | "done"        // all good
  | "error";      // something broke

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"];
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

// Human-friendly labels shown during each stage
const STAGE_LABELS: Record<UploadStage, string> = {
  idle: "Select a video to upload",
  requesting: "Requesting secure upload link…",
  uploading: "Uploading to cloud…",
  confirming: "Verifying upload…",
  queuing: "Queuing video for analysis…",
  done: "Upload complete — processing started!",
  error: "Upload failed",
};

// Component
export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onUploadComplete,
  analysisType = "BATTING",
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<CancelTokenSource | null>(null);

  // State
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(STAGE_LABELS.idle);
  const [errorDetail, setErrorDetail] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const isUploading = !["idle", "done", "error"].includes(stage);

  // helpers
  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return "Unsupported format. Please select an MP4 or MOV file.";
    }
    if (f.size > MAX_FILE_SIZE) {
      return `File too large (${formatFileSize(f.size)}). Maximum is ${formatFileSize(MAX_FILE_SIZE)}.`;
    }
    return null;
  };

  const reset = () => {
    // Cancel any in-flight upload
    cancelRef.current?.cancel("User cancelled");
    cancelRef.current = null;

    setFile(null);
    setStage("idle");
    setUploadProgress(0);
    setStatusMessage(STAGE_LABELS.idle);
    setErrorDetail("");
    setSubmissionId(null);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fail = (message: string, detail = "") => {
    setStage("error");
    setStatusMessage(message);
    setErrorDetail(detail);
    setUploadProgress(0);
  };

  // file selection 
  const onFileSelected = (f: File) => {
    const err = validateFile(f);
    if (err) {
      fail(err);
      return;
    }
    setFile(f);
    setStage("idle");
    setStatusMessage(`Ready: ${f.name} (${formatFileSize(f.size)})`);
    setErrorDetail("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) onFileSelected(selected);
  };

  // drag & drop 
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelected(dropped);
  };

  // the main upload pipeline 
  const handleUpload = async () => {
    if (!file) return;

    try {
      // Step 1: Get signed URL from backend 
      setStage("requesting");
      setStatusMessage(STAGE_LABELS.requesting);
      setUploadProgress(0);

      const { data: urlData } = await storageApi.getUploadUrl(
        file.name,
        file.type,
        analysisType,
      );

      const { signed_url, submission_id } = urlData;
      setSubmissionId(submission_id);

      // Step 2: PUT file to GCS via signed URL 
      setStage("uploading");
      setStatusMessage(STAGE_LABELS.uploading);

      const source = axios.CancelToken.source();
      cancelRef.current = source;

      await axios.put(signed_url, file, {
        headers: { "Content-Type": file.type },
        cancelToken: source.token,
        // axios progress callback
        onUploadProgress: (evt) => {
          if (evt.total) {
            const pct = Math.round((evt.loaded * 100) / evt.total);
            setUploadProgress(pct);
            setStatusMessage(`Uploading to cloud: ${pct}%`);
          }
        },
      });

      cancelRef.current = null;

      // Step 3: Confirm upload with backend 
      setStage("confirming");
      setStatusMessage(STAGE_LABELS.confirming);
      setUploadProgress(100);

      await storageApi.confirmUpload(submission_id);

      // Step 4: Queue background ML processing 
      setStage("queuing");
      setStatusMessage(STAGE_LABELS.queuing);

      await storageApi.startProcessing(submission_id);

      // Done 
      setStage("done");
      setStatusMessage(STAGE_LABELS.done);
      onUploadComplete?.(submission_id);
    } catch (err) {
      // Distinguish user-cancelled from real errors
      if (axios.isCancel(err)) {
        reset();
        return;
      }

      const axiosErr = err as AxiosError<{ detail?: string }>;
      const status = axiosErr.response?.status;
      const detail =
        axiosErr.response?.data?.detail || axiosErr.message || "Unknown error";

      if (status === 403 || status === 400) {
        // Signed URL expired or invalid
        fail("Upload link expired — please try again.", detail);
      } else if (status === 503) {
        fail("Cloud storage is not configured on this server.", detail);
      } else {
        fail("Something went wrong. Please try again.", detail);
      }
    }
  };

  // derived UI values 
  const progressColor =
    stage === "error"
      ? "bg-red-500"
      : stage === "done"
        ? "bg-emerald-500"
        : "bg-sky-500";

  const showProgress = isUploading || stage === "done";

  // render 
  return (
    <Card className={cn("w-full max-w-xl mx-auto", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CloudUpload className="h-5 w-5 text-emerald-400" />
          Upload Video for Analysis
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ---- drop zone ---- */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition cursor-pointer",
            dragActive
              ? "border-emerald-400 bg-emerald-500/10"
              : "border-slate-700 hover:border-slate-500 bg-slate-800/40",
            isUploading && "pointer-events-none opacity-60",
          )}
        >
          {file ? (
            <>
              <Film className="h-10 w-10 text-emerald-400" />
              <p className="text-sm text-slate-300 text-center truncate max-w-full">
                {file.name}
              </p>
              <p className="text-xs text-slate-500">
                {formatFileSize(file.size)}
              </p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-slate-500" />
              <p className="text-sm text-slate-400 text-center">
                Drag &amp; drop a video here, or click to browse
              </p>
              <p className="text-xs text-slate-600">MP4 or MOV — up to 5 GB</p>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* ---- progress bar ---- */}
        {showProgress && (
          <div className="space-y-1.5">
            <Progress value={uploadProgress} indicatorClassName={progressColor} />
            <p className="text-xs text-slate-400 text-center tabular-nums">
              {uploadProgress}%
            </p>
          </div>
        )}

        {/* ---- status message ---- */}
        <div className="flex items-center gap-2 min-h-[1.5rem]">
          {stage === "error" && (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          )}
          {stage === "done" && (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          {isUploading && (
            <Loader2 className="h-4 w-4 shrink-0 text-sky-400 animate-spin" />
          )}

          <p
            className={cn(
              "text-sm",
              stage === "error" ? "text-red-400" : "text-slate-400",
            )}
          >
            {statusMessage}
          </p>
        </div>

        {/* ---- error detail ---- */}
        {errorDetail && (
          <p className="text-xs text-red-500/80 bg-red-500/10 rounded px-3 py-2">
            {errorDetail}
          </p>
        )}

        {/* ---- action buttons ---- */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading || stage === "done"}
            className="flex-1"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : stage === "done" ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Done
              </>
            ) : (
              <>
                <CloudUpload className="mr-2 h-4 w-4" />
                Upload &amp; Analyze
              </>
            )}
          </Button>

          {(file || stage === "error" || stage === "done") && (
            <Button variant="ghost" size="icon" onClick={reset} title="Clear">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* ---- post-upload link ---- */}
        {stage === "done" && submissionId && (
          <p className="text-xs text-slate-500 text-center">
            Submission{" "}
            <span className="font-mono text-emerald-400">
              {submissionId.slice(0, 8)}…
            </span>{" "}
            is now being processed. You'll be notified when results are ready.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoUploader;
