import React, { useCallback, useRef, useState, useEffect } from "react";
import { bowlingApi } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Progress } from "../ui/Progress";
import {
  Upload,
  FileVideo,
  AlertCircle,
  CheckCircle2,
  Download,
  History,
  ChevronRight,
  Activity,
  ExternalLink,
  Target,
  Youtube,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Types 
interface Biometrics {
  avg_elbow_angle: number;
  release_consistency: number;
}

interface Feedback {
  summary: string;
  full_text: string;
}

interface DetectedBowlingFlaw {
  flaw_name: string;
  description: string;
  rating?: number;
  timestamp?: string;
}

interface BowlingDrillRecommendation {
  query: string;
  title: string;
  link: string;
  reason: string;
}

interface AnalysisResult {
  id: string;
  player_id: string;
  original_filename: string | null;
  biometrics: Biometrics;
  feedback: Feedback;
  annotated_video_url: string | null;
  report_url: string | null;
  created_at: string;
  detected_flaws?: DetectedBowlingFlaw[];
  drill_recommendations?: BowlingDrillRecommendation[];
}

interface AnalysisSummary {
  id: string;
  original_filename: string | null;
  avg_elbow_angle: number | null;
  release_consistency: number | null;
  report_url: string | null;
  created_at: string;
}

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

// Component 
const BowlingAnalysis: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [history, setHistory] = useState<AnalysisSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Accepted formats
  const acceptedTypes = ".mp4,.mov,.avi";

  // Fetch history on mount
  useEffect(() => {
    bowlingApi
      .history(10)
      .then((res) => setHistory(res.data.analyses ?? []))
      .catch(() => {});
  }, [result]); // re-fetch after new analysis

  //  Handlers 
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        setFile(f);
        setPhase("idle");
        setErrorMsg("");
        setResult(null);
      }
    },
    []
  );

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setPhase("uploading");
    setUploadProgress(0);
    setErrorMsg("");

    try {
      setPhase("uploading");
      const res = await bowlingApi.analyze(file, (p) => {
        setUploadProgress(p);
        if (p >= 100) setPhase("processing");
      });

      setResult(res.data as AnalysisResult);
      setPhase("done");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Analysis failed. Please try again.";
      setErrorMsg(msg);
      setPhase("error");
    }
  }, [file]);

  const reset = useCallback(() => {
    setFile(null);
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
    setUploadProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const reportFullUrl = (url: string | null | undefined) => {
    if (!url) return null;
    const base = import.meta.env.VITE_API_URL || "http://localhost:8000";
    return `${base}${url}`;
  };

  // Render 
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-emerald-400" />
            Bowling Analysis
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Upload your bowling video for AI-powered biomechanics feedback
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHistory((v) => !v)}
          className="gap-1.5"
        >
          <History className="h-4 w-4" />
          {showHistory ? "Hide" : "History"}
        </Button>
      </div>

      {/* History panel */}
      <AnimatePresence>
        {showHistory && history.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Past Analyses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-md border border-slate-700 px-3 py-2 text-sm"
                  >
                    <div className="truncate flex-1">
                      <span className="text-slate-200">
                        {h.original_filename ?? "Untitled"}
                      </span>
                      <span className="text-slate-500 ml-2 text-xs">
                        {new Date(h.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0 ml-4">
                      {h.avg_elbow_angle != null && (
                        <span>Elbow {h.avg_elbow_angle.toFixed(1)}°</span>
                      )}
                      {h.report_url && (
                        <a
                          href={reportFullUrl(h.report_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline flex items-center gap-0.5"
                        >
                          PDF <ChevronRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Bowling Video</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 cursor-pointer transition-colors",
              file
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-slate-700 hover:border-slate-500 bg-slate-800/30"
            )}
          >
            {file ? (
              <>
                <FileVideo className="h-8 w-8 text-emerald-400 mb-2" />
                <p className="text-sm text-slate-200 truncate max-w-xs">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB — Click to change
                </p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-slate-500 mb-2" />
                <p className="text-sm text-slate-400">
                  Click to select an MP4, MOV, or AVI file
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={acceptedTypes}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Progress */}
          {(phase === "uploading" || phase === "processing") && (
            <div className="space-y-2">
              <Progress value={phase === "processing" ? 100 : uploadProgress} />
              <p className="text-xs text-slate-400 text-center">
                {phase === "uploading"
                  ? `Uploading… ${uploadProgress}%`
                  : "Processing — this may take a minute…"}
              </p>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={
                !file || phase === "uploading" || phase === "processing"
              }
              className="flex-1"
            >
              {phase === "uploading" || phase === "processing"
                ? "Analyzing…"
                : "Analyze"}
            </Button>
            {(file || phase === "done" || phase === "error") && (
              <Button variant="outline" onClick={reset}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <AnimatePresence>
        {phase === "done" && result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Biometrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Biomechanics Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <MetricTile
                    label="Avg Elbow Angle"
                    value={`${result.biometrics.avg_elbow_angle.toFixed(1)}°`}
                  />
                  <MetricTile
                    label="Release Consistency"
                    value={result.biometrics.release_consistency.toFixed(4)}
                    subtitle="(lower = better)"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pose-Annotated Video */}
            {result.annotated_video_url && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pose Detection Video</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg overflow-hidden border border-slate-700 bg-black">
                    <video
                      controls
                      preload="metadata"
                      className="w-full h-auto max-h-[600px]"
                      src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${result.annotated_video_url}`}
                      onError={(e) => {
                        console.error("Video load error:", e);
                        console.log("Video URL:", `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${result.annotated_video_url}`);
                      }}
                    >
                      <source 
                        src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${result.annotated_video_url}`}
                        type="video/mp4"
                      />
                      Your browser does not support video playback.
                    </video>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    🟡 Yellow dots = joint positions | ⚪ White lines = skeleton connections
                  </p>
                </CardContent>
              </Card>
            )}

            {/* AI Feedback */}
            {/* Detected Flaws */}
            {result.detected_flaws && result.detected_flaws.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-5 w-5 text-red-400" />
                    Detected Flaws
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.detected_flaws.map((flaw, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-red-500/20 bg-red-500/5 p-4"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-red-300">
                          {flaw.flaw_name}
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          {flaw.rating != null && (
                            <span className="text-slate-400">
                              Severity: {flaw.rating}/10
                            </span>
                          )}
                          {flaw.timestamp && (
                            <span className="text-amber-400">
                              @ {flaw.timestamp}s
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {flaw.description}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Recommended Video Drills */}
            {result.drill_recommendations && result.drill_recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Youtube className="h-5 w-5 text-red-500" />
                    Recommended Video Drills
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.drill_recommendations.map((drill, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm">
                            {drill.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {drill.reason}
                          </p>
                        </div>
                        <a
                          href={drill.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                        >
                          Watch Drill
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* AI Feedback */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Coaching Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.feedback.full_text.split("\n\n").map((paragraph, idx) => {
                    // First strip all markdown before checking patterns
                    let cleanText = paragraph.trim();
                    
                    // Check if it's a markdown heading (starts with #)
                    const isMarkdownHeading = cleanText.startsWith("#");
                    
                    // Check if it's a bold heading (entire line wrapped in **)
                    const isBoldHeading = /^\*\*[^*]+\*\*$/.test(cleanText);
                    
                    // Remove markdown symbols
                    cleanText = cleanText
                      .replace(/#{1,6}\s/g, "") // Remove heading markers
                      .replace(/\*\*/g, "");      // Remove bold markers
                    
                    cleanText = cleanText.trim();

                    if (isMarkdownHeading || isBoldHeading) {
                      return (
                        <h3
                          key={idx}
                          className="text-lg font-bold text-slate-100 mt-4"
                        >
                          {cleanText}
                        </h3>
                      );
                    }

                    if (cleanText.startsWith("*") || cleanText.startsWith("-")) {
                      return (
                        <div
                          key={idx}
                          className="pl-4 text-slate-300 leading-relaxed"
                        >
                          <span className="text-slate-400 mr-2">•</span>
                          {cleanText.replace(/^[*-]\s*/, "")}
                        </div>
                      );
                    }

                    if (cleanText.includes(":")) {
                      const [label, ...valueParts] = cleanText.split(":");
                      const value = valueParts.join(":");
                      return (
                        <p
                          key={idx}
                          className="text-slate-300 leading-relaxed"
                        >
                          <span className="font-semibold text-slate-100">
                            {label}:
                          </span>
                          {value}
                        </p>
                      );
                    }

                    return (
                      <p key={idx} className="text-slate-300 leading-relaxed">
                        {cleanText}
                      </p>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Report download */}
            {result.report_url && (
              <a
                href={reportFullUrl(result.report_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Download PDF Report
                </Button>
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helpers 
function MetricTile({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-center">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

export default BowlingAnalysis;
