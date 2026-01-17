import React, { useRef, useState } from "react";
import { videosApi } from "../../lib/api";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Progress } from "../ui/Progress";
import { Upload, X, Film, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatFileSize } from "../../lib/utils";

interface VideoUploadProps {
  onUploadComplete?: (videoId: number) => void;
  className?: string;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export const VideoUpload: React.FC<VideoUploadProps> = ({
  onUploadComplete,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const acceptedTypes = ["video/mp4", "video/webm", "video/quicktime"];
  const maxFileSize = 5000 * 1024 * 1024;  // 5GB 

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return "Invalid file type. Please upload MP4, WebM, or MOV files.";
    }
    if (file.size > maxFileSize) {
      return `File too large. Maximum size is ${formatFileSize(maxFileSize)}.`;
    }
    return null;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const error = validateFile(droppedFile);
      if (error) {
        setErrorMessage(error);
        setStatus("error");
        return;
      }
      setFile(droppedFile);
      setTitle(droppedFile.name.replace(/\.[^/.]+$/, "")); // Use filename as default title
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error) {
        setErrorMessage(error);
        setStatus("error");
        return;
      }
      setFile(selectedFile);
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) return;

    setStatus("uploading");
    setProgress(0);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      formData.append("is_public", String(isPublic));

      const response = await videosApi.upload(formData, (progressEvent) => {
        let percentCompleted = 0;
        if (typeof progressEvent === 'number') {
          percentCompleted = progressEvent;
        } else if (
          typeof progressEvent === 'object' && 
          progressEvent !== null && 
          'loaded' in progressEvent && 
          'total' in progressEvent
        ) {
          const event = progressEvent as { loaded: number; total: number };
          percentCompleted = event.total ? Math.round((event.loaded * 100) / event.total) : 0;
        }
        setProgress(percentCompleted);
      });

      setStatus("success");
      setProgress(100);
      onUploadComplete?.(response.data.id);

      // Reset form after 2 seconds
      setTimeout(() => {
        setFile(null);
        setTitle("");
        setDescription("");
        setIsPublic(false);
        setStatus("idle");
        setProgress(0);
      }, 2000);
    } catch (error: unknown) {
      setStatus("error");
      if (error instanceof Error) {
        setErrorMessage(error.message || "Upload failed. Please try again.");
      } else {
        setErrorMessage("Upload failed. Please try again.");
      }
    }
  };

  const clearFile = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setStatus("idle");
    setProgress(0);
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-emerald-500" />
          Upload Video
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            dragActive
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50",
            file && "border-emerald-500/50 bg-emerald-500/5"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={handleFileChange}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center justify-center gap-4">
              <Film className="h-10 w-10 text-emerald-500" />
              <div className="text-left">
                <p className="font-medium text-white truncate max-w-xs">
                  {file.name}
                </p>
                <p className="text-sm text-slate-400">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="text-slate-400 hover:text-red-400"
              >
                <X size={20} />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">
                Drag and drop your video here
              </p>
              <p className="text-slate-500 text-sm mt-1">
                or click to browse (MP4, WebM, MOV up to 500MB)
              </p>
            </>
          )}
        </div>

        {/* Title Input */}
        {file && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <label htmlFor="isPublic" className="text-sm text-slate-300">
                Make this video public (visible to all users)
              </label>
            </div>
          </>
        )}

        {/* Progress Bar */}
        {status === "uploading" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Uploading...</span>
              <span className="text-emerald-400 font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Status Messages */}
        {status === "success" && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="text-emerald-400">Upload complete!</span>
          </div>
        )}

        {status === "error" && errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-400">{errorMessage}</span>
          </div>
        )}

        {/* Upload Button */}
        {file && status !== "success" && (
          <Button
            onClick={handleUpload}
            disabled={!title.trim() || status === "uploading"}
            className="w-full"
          >
            {status === "uploading" ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Video
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoUpload;
