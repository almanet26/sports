import React, { useCallback, useRef, useState, useEffect } from "react";
import { battingApi, cloudUploadAndProcess, pollSubmissionResult, resolveMediaUrl, type SubmissionDetail } from "../../lib/api";
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
  Crosshair,
  ExternalLink,
  Target,
  Youtube,
  Loader2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Types 
interface BattingBiometrics {
  avg_head_alignment: number;
  avg_stride_length: number;
  avg_backlift_height: number;
  avg_front_knee_angle: number;
  avg_shoulder_rotation: number;
}

interface Feedback {
  summary: string;
  full_text: string;
}

interface PhaseInfo {
  stance_end: number | null;
  stride_peak: number | null;
  downswing_start: number | null;
  impact: number | null;
  followthrough_start: number | null;
}

interface DetectedFlaw {
  flaw_name: string;
  description: string;
  rating: number | null;
  timestamp: string | null;
}

interface DrillRecommendation {
  query: string;
  title: string;
  link: string;
  reason: string;
}

interface BattingResult {
  id: string;
  player_id: string;
  original_filename: string | null;
  biometrics: BattingBiometrics;
  feedback: Feedback;
  phases: PhaseInfo | null;
  annotated_video_url: string | null;
  report_url: string | null;
  created_at: string;
  detected_flaws: DetectedFlaw[];
  drill_recommendations: DrillRecommendation[];
}

interface BattingSummary {
  id: string;
  original_filename: string | null;
  avg_head_alignment: number | null;
  avg_stride_length: number | null;
  avg_front_knee_angle: number | null;
  report_url: string | null;
  created_at: string;
}

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

// Parser helpers — extract structured data from Gemini free-text response
function parseDetectedFlaws(text: string): DetectedFlaw[] {
  const match = text.match(/\*\*WEAKNESSES\*\*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  if (!match) return [];
  return match[1]
    .split("\n")
    .filter(l => l.trim().startsWith("-"))
    .map(line => {
      const nameMatch = line.match(/\[(.+?)\]/);
      const ratingMatch = line.match(/Rating:\s*(\d+)/i);
      const timestampMatch = line.match(/Timestamp:\s*([\d.]+s?)/i);
      const descMatch = line.match(/\]\s*\.\s*(.+)$/);
      return {
        flaw_name: nameMatch?.[1]?.trim() ?? line.replace(/^-\s*/, "").substring(0, 60),
        description: descMatch?.[1]?.replace(/\[.*?\]/g, "").trim() ?? "",
        rating: ratingMatch ? parseInt(ratingMatch[1]) : null,
        timestamp: timestampMatch?.[1]?.trim() ?? null,
      };
    })
    .filter(f => f.flaw_name.length > 0);
}

function parseDrillRecommendations(text: string): DrillRecommendation[] {
  const match = text.match(/\*\*RECOMMENDED TUTORIALS\*\*([\s\S]*)/i);
  if (!match) return [];
  const section = match[1];
  const clean = (v: string) => v.replace(/\*\*/g, "").trim();
  const results: DrillRecommendation[] = [];

  // Prefer direct Title/Link/Why blocks (robust to wrapped lines in title/why text).
  const lines = section.split("\n");
  let curTitle = "";
  let curLink = "";
  let curWhy = "";
  let activeField: "title" | "why" | null = null;

  const flush = () => {
    const title = clean(curTitle);
    const link = curLink.trim();
    const reason = clean(curWhy);
    if (title && link) {
      results.push({ query: title, title, link, reason });
    }
    curTitle = "";
    curLink = "";
    curWhy = "";
    activeField = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const titleMatch = line.match(/^\d+\.\s*(?:\*\*)?Title(?:\*\*)?:\s*(.*)$/i) || line.match(/^(?:\*\*)?Title(?:\*\*)?:\s*(.*)$/i);
    if (titleMatch) {
      if (curTitle || curLink || curWhy) flush();
      curTitle = titleMatch[1] ?? "";
      activeField = "title";
      continue;
    }

    const linkMatch = line.match(/^(?:\*\*)?Link(?:\*\*)?:\s*(https?:\/\/\S+)/i);
    if (linkMatch) {
      curLink = linkMatch[1] ?? "";
      activeField = null;
      continue;
    }

    const whyMatch = line.match(/^(?:\*\*)?Why(?:\s*this\s*video)?(?:\*\*)?:\s*(.*)$/i);
    if (whyMatch) {
      curWhy = whyMatch[1] ?? "";
      activeField = "why";
      continue;
    }

    // Continuation lines for wrapped title/why blocks.
    if (activeField === "title") {
      curTitle += ` ${line}`;
    } else if (activeField === "why") {
      curWhy += ` ${line}`;
    }
  }
  if (curTitle || curLink || curWhy) flush();

  if (results.length > 0) return results;

  // Fallback to Search Intent format.
  for (const entry of section.split(/\n\d+\.\s+/)) {
    const queryMatch = entry.match(/Search Intent:\s*(.+)/i);
    const whyMatch = entry.match(/Why(?: this video)?:\s*(.+)/i);
    if (!queryMatch) continue;
    const query = clean(queryMatch[1]);
    results.push({
      query,
      title: query,
      link: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      reason: clean(whyMatch?.[1] ?? ""),
    });
  }

  return results;
}

function stripParsedSections(text: string): string {
  return text
    .replace(/\*\*WEAKNESSES\*\*[\s\S]*?(?=\*\*SPECIFIC CORRECTIONS|\*\*PERFORMANCE|$)/i, "")
    .replace(/\*\*RECOMMENDED TUTORIALS\*\*[\s\S]*/i, "")
    .trim();
}

/** Map a SubmissionDetail (async Cloud Tasks result) to the BattingResult shape the UI expects. */
function mapSubmissionToBattingResult(sub: SubmissionDetail): BattingResult {
  const summary = (sub.raw_biometrics?.summary ?? {}) as Record<string, Record<string, number>>;

  // Find display_df column names by partial match (BATTING_METRIC_LABELS renames)
  const findKey = (needle: string) =>
    Object.keys(summary).find((k) => k.toLowerCase().includes(needle)) ?? "";

  const phases = (sub.phase_info ?? {}) as Record<string, number | null>;

  const fullText = sub.ai_draft_text ?? sub.coach_final_text ?? "";
  const detectedFlaws = (sub.detected_flaws && sub.detected_flaws.length > 0)
    ? sub.detected_flaws.map((f) => ({
        flaw_name: f.flaw_name,
        description: f.description,
        rating: f.rating ?? null,
        timestamp: f.timestamp ?? null,
      }))
    : parseDetectedFlaws(fullText);
  const drillRecs = (sub.drill_recommendations && sub.drill_recommendations.length > 0)
    ? sub.drill_recommendations.map((d) => ({
        query: d.query,
        title: d.title,
        link: d.link,
        reason: d.reason,
      }))
    : parseDrillRecommendations(fullText);
  const cleanedText = stripParsedSections(fullText);

  return {
    id: sub.id,
    player_id: sub.player_id,
    original_filename: sub.original_filename ?? null,
    biometrics: {
      avg_head_alignment: summary[findKey("head")]?.mean ?? 0,
      avg_stride_length: summary[findKey("stride")]?.mean ?? 0,
      avg_backlift_height: summary[findKey("backlift")]?.mean ?? 0,
      avg_front_knee_angle: summary[findKey("front knee")]?.mean ?? summary[findKey("knee")]?.mean ?? 0,
      avg_shoulder_rotation: summary[findKey("shoulder")]?.mean ?? 0,
    },
    feedback: {
      summary: "Batting analysis complete. See full report.",
      full_text: cleanedText,
    },
    phases: {
      stance_end: phases.stance_end ?? null,
      stride_peak: phases.stride_peak ?? null,
      downswing_start: phases.downswing_start ?? null,
      impact: phases.impact ?? null,
      followthrough_start: phases.followthrough_start ?? null,
    },
    annotated_video_url: sub.annotated_video_url ?? null,
    report_url: sub.pdf_report_url ?? null,
    created_at: sub.created_at,
    detected_flaws: detectedFlaws,
    drill_recommendations: drillRecs,
  };
}

// Component 
const BattingAnalysis: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<BattingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [history, setHistory] = useState<BattingSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const acceptedTypes = ".mp4,.mov,.avi";

  // Fetch history on mount & after new analysis
  useEffect(() => {
    battingApi
      .history(10)
      .then((res) => setHistory(res.data.analyses ?? []))
      .catch(() => {});
  }, [result]);

  // Handlers 
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
      // Upload to GCS + queue Cloud Tasks processing
      const submissionId = await cloudUploadAndProcess(
        file,
        "BATTING",
        (p) => setUploadProgress(p),
      );

      // Switch to processing phase while Cloud Tasks runs ML pipeline
      setPhase("processing");

      // Poll until results are ready (DRAFT_REVIEW / PUBLISHED)
      const sub = await pollSubmissionResult(submissionId);

      // Map SubmissionDetail → BattingResult for the existing UI
      setResult(mapSubmissionToBattingResult(sub));
      setPhase("done");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ??
        (err instanceof Error ? err.message : "Analysis failed. Please try again.");
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



  // Render 
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crosshair className="h-6 w-6 text-amber-400" />
            Batting Analysis
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Upload your batting video for AI-powered biomechanics feedback
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
                      {h.avg_head_alignment != null && (
                        <span>Head {h.avg_head_alignment.toFixed(2)}</span>
                      )}
                      {h.avg_front_knee_angle != null && (
                        <span>Knee {h.avg_front_knee_angle.toFixed(1)}°</span>
                      )}
                      {h.report_url && (
                        <a
                          href={resolveMediaUrl(h.report_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline flex items-center gap-0.5"
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
          <CardTitle className="text-base">Upload Batting Video</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 cursor-pointer transition-colors",
              file
                ? "border-amber-500/50 bg-amber-500/5"
                : "border-slate-700 hover:border-slate-500 bg-slate-800/30"
            )}
          >
            {file ? (
              <>
                <FileVideo className="h-8 w-8 text-amber-400 mb-2" />
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
                  ? `Uploading to cloud… ${uploadProgress}%`
                  : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      AI analysis in progress — this may take a few minutes…
                    </span>
                  )}
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
                  <CheckCircle2 className="h-5 w-5 text-amber-400" />
                  Biomechanics Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <MetricTile
                    label="Head Alignment"
                    value={result.biometrics.avg_head_alignment.toFixed(2)}
                    subtitle="0 = back foot, 1 = front foot"
                  />
                  <MetricTile
                    label="Stride Length"
                    value={result.biometrics.avg_stride_length.toFixed(3)}
                    subtitle="Normalized distance"
                  />
                  <MetricTile
                    label="Backlift Height"
                    value={result.biometrics.avg_backlift_height.toFixed(3)}
                    subtitle="Wrist Y position"
                  />
                  <MetricTile
                    label="Front Knee Angle"
                    value={`${result.biometrics.avg_front_knee_angle.toFixed(1)}°`}
                  />
                  <MetricTile
                    label="Shoulder Rotation"
                    value={`${result.biometrics.avg_shoulder_rotation.toFixed(1)}°`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Phase Detection */}
            {result.phases && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Phase Detection (Frame #)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-sm">
                    <PhaseBlock label="Stance End" frame={result.phases.stance_end} color="blue" />
                    <PhaseBlock label="Stride Peak" frame={result.phases.stride_peak} color="green" />
                    <PhaseBlock label="Downswing" frame={result.phases.downswing_start} color="yellow" />
                    <PhaseBlock label="Impact" frame={result.phases.impact} color="red" />
                    <PhaseBlock label="Follow-Through" frame={result.phases.followthrough_start} color="purple" />
                  </div>
                </CardContent>
              </Card>
            )}

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
                      src={resolveMediaUrl(result.annotated_video_url)}
                      onError={(e) => {
                        console.error("Video load error:", e);
                      }}
                    >
                      <source
                        src={resolveMediaUrl(result.annotated_video_url)}
                        type="video/mp4"
                      />
                      Your browser does not support video playback.
                    </video>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    Joint positions and skeleton connections detected via MediaPipe
                  </p>
                </CardContent>
              </Card>
            )}

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
                href={resolveMediaUrl(result.report_url)}
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

const phaseColorMap: Record<string, string> = {
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  yellow: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  red: "border-red-500/40 bg-red-500/10 text-red-300",
  purple: "border-purple-500/40 bg-purple-500/10 text-purple-300",
};

function PhaseBlock({
  label,
  frame,
  color,
}: {
  label: string;
  frame: number | null;
  color: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        phaseColorMap[color] ?? phaseColorMap.blue
      )}
    >
      <p className="text-xs uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-1">
        {frame != null ? `#${frame}` : "—"}
      </p>
    </div>
  );
}

export default BattingAnalysis;
