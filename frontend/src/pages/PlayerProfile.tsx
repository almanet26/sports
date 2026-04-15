import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import {
  getPlayerProfile,
  type PlayerProfileApiResponse,
  type PlayerProfileEnvelope,
  type UpdatePlayerProfilePayload,
  updatePlayerProfile,
} from "../services/playerProfile";
import {
  deletePlayerVideo,
  getPlayerVideos,
  type PlayerVideoItem,
  uploadPlayerVideo,
} from "../services/playerVideos";
import ProfileHeader from "../components/features/profile/ProfileHeader";
import ProfileForm from "../components/features/profile/ProfileForm";
import VideoGrid from "../components/features/profile/VideoGrid";
import ProfileErrorBoundary from "../components/features/profile/ProfileErrorBoundary";
import type { PlayerProfileState, ProfileFieldName, FormErrors } from "../components/features/profile/profileTypes";

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "pitchvision-player-profile";
const INVALID = new Set(["", "NONE", "NULL", "N/A", "NA", "SELECT OPTION"]);
const FREE_UPLOAD_LIMIT = 5;
const MAX_FILE_SIZE_MB = 50;
const MAX_UPLOAD_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const DEFAULT_SNAPSHOT = [
  { label: "Current Form", value: "Building", detail: "More match data unlocks stronger insight.", accent: "from-emerald-500 to-teal-500" },
  { label: "Match Readiness", value: "Pending", detail: "Complete your profile for better tracking.", accent: "from-blue-500 to-cyan-500" },
  { label: "Consistency Score", value: "--", detail: "Generated as activity grows.", accent: "from-violet-500 to-fuchsia-500" },
  { label: "Fitness Trend", value: "Tracking", detail: "Will improve with regular usage.", accent: "from-orange-500 to-amber-500" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function clean(v: string | null | undefined) { return (v ?? "").trim(); }
function isFilled(v: string | null | undefined) { return !INVALID.has(clean(v).toUpperCase()); }
function slugify(v: string) { return v.toLowerCase().replace(/[^a-z0-9]+/g, "").trim(); }

function nameFromEmail(email: string) {
  return (email.split("@")[0] ?? "")
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function displayNameFor(user: { name?: string | null; email?: string | null } | null, fullName: string) {
  if (fullName.trim()) return fullName.trim();
  if (user?.name?.trim()) return user.name.trim();
  if (user?.email?.trim()) return nameFromEmail(user.email);
  return "Player";
}

function storageKey(user: { id?: string; email?: string } | null) {
  return `${STORAGE_KEY}:${user?.id || user?.email || "player"}`;
}

function calcCompletion(profile: PlayerProfileState) {
  const required: { key: ProfileFieldName; label: string }[] = [
    { key: "fullName", label: "Full Name" },
    { key: "age", label: "Age" },
    { key: "gender", label: "Gender" },
    { key: "country", label: "Country" },
    { key: "cricketRole", label: "Cricket Role" },
    { key: "preferredFormat", label: "Preferred Format" },
    { key: "bio", label: "Bio" },
    { key: "educationType", label: "Education Type" },
  ];

  const role = clean(profile.cricketRole).toUpperCase();
  if (["BATSMAN", "WICKETKEEPER", "WICKET KEEPER", "KEEPER"].includes(role))
    required.push({ key: "battingHand", label: "Batting Hand" });
  if (["BOWLER"].includes(role)) {
    required.push({ key: "bowlingArm", label: "Bowling Arm" });
    required.push({ key: "bowlingType", label: "Bowling Type" });
  }
  if (["ALL-ROUNDER", "ALL ROUNDER", "ALLROUNDER"].includes(role)) {
    required.push({ key: "battingHand", label: "Batting Hand" });
    required.push({ key: "bowlingArm", label: "Bowling Arm" });
    required.push({ key: "bowlingType", label: "Bowling Type" });
  }
  if (isFilled(profile.educationType))
    required.push({ key: "institutionName", label: "Institution Name" });
  if (profile.hasCricketClub === true)
    required.push({ key: "cricketClubName", label: "Cricket Club Name" });

  const missing = required.filter(({ key }) => !isFilled(profile[key] as string)).map(({ label }) => label);
  return {
    completionPercentage: Math.round(((required.length - missing.length) / required.length) * 100),
    missingFields: missing,
    profileCompleted: missing.length === 0,
  };
}

function validate(profile: PlayerProfileState): FormErrors {
  const errors: FormErrors = {};
  const { missingFields } = calcCompletion(profile);
  const fieldMap: Record<string, ProfileFieldName> = {
    "Full Name": "fullName", Age: "age", Gender: "gender", Country: "country",
    "Cricket Role": "cricketRole", "Preferred Format": "preferredFormat", Bio: "bio",
    "Education Type": "educationType", "Institution Name": "institutionName",
    "Batting Hand": "battingHand", "Bowling Arm": "bowlingArm", "Bowling Type": "bowlingType",
    "Cricket Club Name": "cricketClubName",
  };
  for (const label of missingFields) {
    const key = fieldMap[label];
    if (key) errors[key] = `${label} is required.`;
  }
  return errors;
}

function buildInitial(user: ReturnType<typeof useAuthStore.getState>["user"]): PlayerProfileState {
  const name = displayNameFor(user, "");
  return {
    id: user?.id ?? "local",
    fullName: user?.name ?? "",
    username: slugify(name || user?.email || "player") ? `@${slugify(name || user?.email || "player")}` : "",
    email: user?.email ?? "",
    avatar: "",
    verified: Boolean(user?.is_verified),
    age: "", gender: "", city: "", state: "", country: "",
    educationType: "", institutionName: "",
    hasCricketClub: null, cricketClubName: "",
    cricketRole: "", experienceLevel: "",
    battingHand: "", bowlingArm: "", bowlingType: "", preferredFormat: "",
    bio: user?.profile_bio ?? "",
    matchCount: 0, highlightCount: 0, currentLevel: "Beginner",
    performanceSnapshot: DEFAULT_SNAPSHOT,
    recentActivity: ["Joined PitchVision", "Opened player dashboard"],
    completionPercentage: 0, missingFields: [], profileCompleted: false,
  };
}

function loadLocal(user: ReturnType<typeof useAuthStore.getState>["user"]): PlayerProfileState {
  const base = buildInitial(user);
  try {
    const raw = localStorage.getItem(storageKey(user));
    if (!raw) return { ...base, ...calcCompletion(base) };
    const parsed = JSON.parse(raw) as Partial<PlayerProfileState>;
    const merged = {
      ...base, ...parsed,
      performanceSnapshot: parsed.performanceSnapshot ?? base.performanceSnapshot,
      recentActivity: parsed.recentActivity ?? base.recentActivity,
    };
    return { ...merged, ...calcCompletion(merged) };
  } catch {
    return { ...base, ...calcCompletion(base) };
  }
}

function saveLocal(user: ReturnType<typeof useAuthStore.getState>["user"], profile: PlayerProfileState) {
  localStorage.setItem(storageKey(user), JSON.stringify(profile));
}

function apiToState(api: PlayerProfileApiResponse, base: PlayerProfileState): PlayerProfileState {
  const merged: PlayerProfileState = {
    ...base,
    id: api.id || base.id,
    fullName: api.fullName || "",
    username: api.username || base.username,
    email: api.email || base.email,
    avatar: api.profilePhoto || "",
    verified: Boolean(api.verified),
    age: api.age != null ? String(api.age) : "",
    gender: api.gender || "",
    city: api.city || "",
    state: api.state || "",
    country: api.country || "",
    educationType: api.educationType || "",
    institutionName: api.institutionName || "",
    hasCricketClub: api.hasCricketClub ?? null,
    cricketClubName: api.cricketClubName || "",
    cricketRole: api.cricketRole || "",
    experienceLevel: api.experienceLevel || "",
    battingHand: api.battingHand || "",
    bowlingArm: api.bowlingArm || "",
    bowlingType: api.bowlingType || "",
    preferredFormat: api.preferredFormat || "",
    bio: api.bio || "",
    matchCount: api.matches || 0,
    highlightCount: api.highlights || 0,
    currentLevel: api.currentLevel || "Beginner",
    completionPercentage: api.completionPercentage || 0,
    missingFields: api.missingFields || [],
    profileCompleted: Boolean(api.profileCompleted),
  };
  return merged;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PlayerProfile() {
  // Auth state comes exclusively from useAuthStore — no raw localStorage reads
  const user = useAuthStore((state) => state.user);
  const isFreeUser = user?.role === "PLAYER";

  const [profile, setProfile] = useState<PlayerProfileState>(() => loadLocal(user));
  const [draft, setDraft] = useState<PlayerProfileState>(() => loadLocal(user));
  const [videos, setVideos] = useState<PlayerVideoItem[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────

  const loadVideos = useCallback(async () => {
    try {
      const data = await getPlayerVideos();
      setVideos(data.videos ?? []);
    } catch {
      // videos stay empty — not a fatal error
    }
  }, []);

  const applyApiProfile = useCallback(
    (envelope: PlayerProfileEnvelope) => {
      // Preserve non-API fields (snapshot, activity) from current profile state
      setProfile((current) => {
        const merged = apiToState(envelope.profile, current);
        saveLocal(user, merged);
        return merged;
      });
      setDraft((current) => apiToState(envelope.profile, current));
    },
    [user],
  );

  useEffect(() => {
    const local = loadLocal(user);
    setProfile(local);
    setDraft(local);

    Promise.allSettled([getPlayerProfile(), loadVideos()]).then(([profileResult]) => {
      if (profileResult.status === "fulfilled" && profileResult.value) {
        applyApiProfile(profileResult.value);
      }
    });
  }, [user, applyApiProfile, loadVideos]);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!toast || toast.type !== "success") return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ── Derived values ──────────────────────────────────────────────────────

  const displayName = useMemo(() => displayNameFor(user, profile.fullName), [user, profile.fullName]);

  const displayUsername = useMemo(() => {
    const raw = profile.username.trim();
    if (raw) return raw.startsWith("@") ? raw : `@${raw}`;
    return `@${slugify(displayName || user?.email || "player") || "player"}`;
  }, [profile.username, displayName, user?.email]);

  const completion = useMemo(
    () => ({ completionPercentage: profile.completionPercentage, missingFields: profile.missingFields, profileCompleted: profile.profileCompleted }),
    [profile.completionPercentage, profile.missingFields, profile.profileCompleted],
  );

  const completionPreview = useMemo(() => calcCompletion(draft), [draft]);
  const latestVideos = useMemo(() => {
    const sorted = [...videos].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return sorted.slice(0, 2);
  }, [videos]);

  // ── Edit modal ──────────────────────────────────────────────────────────

  const openEdit = () => {
    setDraft(profile);
    setFormErrors({});
    setSaveError("");
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    if (isSaving) return;
    setIsEditOpen(false);
    setFormErrors({});
    setSaveError("");
  };

  const onFieldChange = <K extends keyof PlayerProfileState>(key: K, value: PlayerProfileState[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => {
      if (!prev[key as ProfileFieldName]) return prev;
      const next = { ...prev };
      delete next[key as ProfileFieldName];
      return next;
    });
  };

  const saveProfile = async () => {
    const errors = validate(draft);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const rawUsername = draft.username.replace(/^@/, "").trim();
      const payload: UpdatePlayerProfilePayload = {
        fullName: draft.fullName.trim(),
        username: rawUsername || slugify(displayNameFor(user, draft.fullName) || user?.email || "player"),
        age: draft.age ? parseInt(draft.age, 10) || null : null,
        gender: draft.gender.trim(),
        city: draft.city.trim(),
        state: draft.state.trim(),
        country: draft.country.trim(),
        educationType: draft.educationType.trim(),
        institutionName: draft.educationType.trim() ? draft.institutionName.trim() : "",
        hasCricketClub: draft.hasCricketClub,
        cricketClubName: draft.hasCricketClub ? draft.cricketClubName.trim() : "",
        cricketRole: draft.cricketRole.trim(),
        experienceLevel: draft.experienceLevel.trim(),
        battingHand: draft.battingHand.trim(),
        bowlingArm: draft.bowlingArm.trim(),
        bowlingType: draft.bowlingType.trim(),
        preferredFormat: draft.preferredFormat.trim(),
        bio: draft.bio.trim(),
        profilePhoto: draft.avatar.trim(),
      };

      const data = await updatePlayerProfile(payload);
      applyApiProfile(data);

      // Sync name/bio back into useAuthStore — single source of truth
      if (user) {
        const nextUser = {
          ...user,
          name: payload.fullName || user.name,
          profile_bio: payload.bio,
          gender: payload.gender,
          profile_image_url: payload.profilePhoto,
        };

        useAuthStore.setState({ user: nextUser });
        localStorage.setItem("user_profile", JSON.stringify(nextUser));
      }

      setFormErrors({});
      setIsEditOpen(false);
      setToast({ msg: "Profile updated successfully.", type: "success" });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Video handlers ──────────────────────────────────────────────────────

  const handleUpload = async (file: File) => {
    const now = new Date();
    const uploadsThisMonth = videos.filter((v) => {
      const created = new Date(v.createdAt || 0);
      return !Number.isNaN(created.getTime()) && created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    }).length;

    if (isFreeUser && uploadsThisMonth >= FREE_UPLOAD_LIMIT) {
      setToast({ msg: "Free users can upload only 5 videos per month.", type: "error" });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setToast({ msg: "File size should be less than 50MB.", type: "error" });
      return;
    }
    setIsUploading(true);
    setToast(null);
    try {
      await uploadPlayerVideo(file);
      await Promise.all([
        loadVideos(),
        getPlayerProfile().then((d) => { if (d) applyApiProfile(d); }),
      ]);
      setToast({ msg: "Video uploaded successfully.", type: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload video.";
      if (message.toLowerCase().includes("forbidden") || message.toLowerCase().includes("access")) {
        setToast({ msg: "Upload failed due to access restrictions.", type: "error" });
      } else {
        setToast({ msg: message, type: "error" });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (videoId: string) => {
    setDeletingId(videoId);
    try {
      await deletePlayerVideo(videoId);
      await Promise.all([
        loadVideos(),
        getPlayerProfile().then((d) => { if (d) applyApiProfile(d); }),
      ]);
      setToast({ msg: "Video deleted successfully.", type: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to delete video.", type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <ProfileErrorBoundary>
      <div className="space-y-8 text-white">

        {/* Toast */}
        <AnimatePresence>
          {toast?.type === "success" && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="fixed right-4 top-4 z-[70] w-[min(92vw,380px)]"
            >
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-slate-950/95 px-4 py-3 shadow-xl backdrop-blur-xl">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <p className="flex-1 text-sm text-emerald-200">{toast.msg}</p>
                <button type="button" onClick={() => setToast(null)} className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline error banner */}
        {toast?.type === "error" && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            <span>{toast.msg}</span>
            <button type="button" onClick={() => setToast(null)} className="shrink-0 text-rose-300 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <ProfileHeader
          displayName={displayName}
          displayUsername={displayUsername}
          email={profile.email}
          avatar={profile.avatar}
          verified={profile.verified}
          isProfileCompleted={completion.profileCompleted}
          bio={profile.bio}
          onEdit={openEdit}
        />

        {/* Stats strip */}
        <section className="grid gap-4 md:grid-cols-5">
          {[
            { label: "Matches", value: String(profile.matchCount || 0) },
            { label: "Highlights", value: String(videos.length || profile.highlightCount || 0) },
            { label: "Verified", value: profile.verified ? "Yes" : "No" },
            { label: "Role", value: profile.cricketRole || "Not selected" },
            { label: "Level", value: profile.currentLevel || "Setting Up" },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-xl"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
              <p className="mt-3 text-xl font-semibold text-white">{item.value}</p>
            </motion.div>
          ))}
        </section>

        {/* Personal Info + Playing Style */}
        <section className="grid gap-6 xl:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
          >
            <h2 className="text-lg font-semibold text-white mb-5">Personal Information</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Full Name", value: profile.fullName },
                { label: "Age", value: profile.age },
                { label: "Gender", value: profile.gender },
                { label: "City / State", value: [profile.city, profile.state].filter(Boolean).join(", ") },
                { label: "Country", value: profile.country },
                { label: "Education", value: profile.educationType },
                { label: "Institution", value: profile.institutionName },
                { label: "Cricket Club", value: profile.hasCricketClub === null ? "" : profile.hasCricketClub ? profile.cricketClubName || "Yes" : "No" },
                { label: "Cricket Role", value: profile.cricketRole },
                { label: "Experience", value: profile.experienceLevel },
              ].map((item) => (
                <div key={item.label} className="rounded-[18px] border border-white/10 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500">{item.label}</p>
                  <p className={`mt-2 text-sm font-medium ${item.value ? "text-white" : "text-slate-500"}`}>
                    {item.value || "Not added"}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
          >
            <h2 className="text-lg font-semibold text-white mb-5">Playing Style</h2>
            <div className="flex flex-wrap gap-3 mb-6">
              {[
                { label: "Batting Hand", value: profile.battingHand },
                { label: "Bowling Arm", value: profile.bowlingArm },
                { label: "Bowling Type", value: profile.bowlingType },
                { label: "Format", value: profile.preferredFormat },
              ].map((item, i) => (
                <span key={item.label} className={`rounded-full border px-4 py-2 text-sm ${i % 3 === 0 ? "border-blue-400/20 bg-blue-400/10 text-blue-200"
                  : i % 3 === 1 ? "border-violet-400/20 bg-violet-400/10 text-violet-200"
                    : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                  }`}>
                  {item.label}: <span className={item.value ? "" : "opacity-50"}>{item.value || "Not set"}</span>
                </span>
              ))}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-400 mb-2">Bio</p>
              <p className={`text-sm leading-6 ${profile.bio ? "text-slate-200" : "text-slate-500"}`}>
                {profile.bio || "Add a short bio to describe your cricket style, strengths, and goals."}
              </p>
            </div>
          </motion.div>
        </section>

        {/* Video grid */}
        <VideoGrid
          videos={latestVideos}
          isUploading={isUploading}
          deletingId={deletingId}
          isFreeUser={isFreeUser}
          freeUploadsThisMonth={videos.filter((v) => {
            const now = new Date();
            const created = new Date(v.createdAt || 0);
            return !Number.isNaN(created.getTime()) && created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
          }).length}
          onUpload={handleUpload}
          onDelete={handleDelete}
          onError={(msg) => setToast({ msg, type: "error" })}
        />

        {videos.length > 2 ? (
          <div className="flex justify-end">
            <Link
              to="/player/videos"
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            >
              View All Videos
            </Link>
          </div>
        ) : null}

        {/* Recent Activity + Profile Status */}
        <section className="grid gap-6 xl:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500">
                <span className="text-white text-lg">⚡</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Recent Activity</p>
                <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
              </div>
            </div>
            <div className="space-y-3">
              {profile.recentActivity.length > 0 ? (
                profile.recentActivity.map((item, index) => (
                  <div key={`${item}-${index}`} className="flex items-start gap-4 rounded-[20px] border border-white/10 bg-slate-950/70 p-4">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500">
                      <span className="text-white text-sm">↯</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{item}</p>
                      <p className="mt-1 text-sm text-slate-400">Player activity updates appear here as you use PitchVision.</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  Your recent activity will appear here once you start uploading videos and building streaks.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500">
                <span className="text-white text-lg">✦</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Profile Status</p>
                <h2 className="text-xl font-semibold text-white">Profile Status</h2>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">Identity strength</p>
                <p className="mt-2 text-3xl font-semibold text-white">{completion.completionPercentage}%</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {completion.profileCompleted
                    ? "Your profile is ready to represent your player identity across PitchVision."
                    : "Finish the missing fields to unlock a stronger athlete presence and better personalization."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Verification</p>
                  <p className="mt-3 text-lg font-semibold text-white">{profile.verified ? "Verified" : "Pending"}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Missing Fields</p>
                  <p className="mt-3 text-lg font-semibold text-white">{completion.missingFields.length}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Edit modal */}
        <ProfileForm
          isOpen={isEditOpen}
          isSaving={isSaving}
          draft={draft}
          formErrors={formErrors}
          saveError={saveError}
          completionPreview={completionPreview}
          displayUsername={displayUsername}
          displayName={displayName}
          onClose={closeEdit}
          onSave={saveProfile}
          onFieldChange={onFieldChange}
        />
      </div>
    </ProfileErrorBoundary>
  );
}
