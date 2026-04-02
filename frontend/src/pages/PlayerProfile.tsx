import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  IdCard,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import {
  getPlayerProfile,
  type PlayerProfileApiResponse,
  type PlayerProfileEnvelope,
  type UpdatePlayerProfilePayload,
  updatePlayerProfile,
} from "../services/playerProfile";
import { deletePlayerVideo, getPlayerVideos, type PlayerVideoItem, uploadPlayerVideo } from "../services/playerVideos";
import { resolveMediaUrl } from "../lib/api";

type PlayerProfileState = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatar: string;
  verified: boolean;
  age: string;
  gender: string;
  city: string;
  state: string;
  country: string;
  educationType: string;
  institutionName: string;
  hasCricketClub: boolean | null;
  cricketClubName: string;
  cricketRole: string;
  experienceLevel: string;
  battingHand: string;
  bowlingArm: string;
  bowlingType: string;
  preferredFormat: string;
  bio: string;
  matchCount: number;
  highlightCount: number;
  currentLevel: string;
  performanceSnapshot: {
    label: string;
    value: string;
    detail: string;
    accent: string;
  }[];
  recentActivity: string[];
  completionPercentage: number;
  missingFields: string[];
  profileCompleted: boolean;
};

type CompletionSummary = {
  completionPercentage: number;
  missingFields: string[];
  profileCompleted: boolean;
};

type SetupItem = {
  label: string;
  completed: boolean;
  helper: string;
};

type ProfileFieldName =
  | "fullName"
  | "age"
  | "country"
  | "cricketRole"
  | "battingHand"
  | "preferredFormat"
  | "bio"
  | "username"
  | "gender"
  | "city"
  | "state"
  | "educationType"
  | "institutionName"
  | "experienceLevel"
  | "bowlingArm"
  | "bowlingType"
  | "cricketClubName";

type FormErrors = Partial<Record<ProfileFieldName, string>>;
type RequiredProfileField = { key: ProfileFieldName; label: string };

const INVALID_PLACEHOLDERS = new Set(["", "NONE", "NULL", "N/A", "NA", "SELECT OPTION"]);
const BASE_REQUIRED_FIELDS: RequiredProfileField[] = [
  { key: "fullName", label: "Full Name" },
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "country", label: "Country" },
  { key: "cricketRole", label: "Cricket Role" },
  { key: "preferredFormat", label: "Preferred Format" },
  { key: "bio", label: "Bio" },
  { key: "educationType", label: "Education Type" },
];
const ROLE_REQUIRED_FIELDS: Record<string, RequiredProfileField[]> = {
  BATSMAN: [{ key: "battingHand", label: "Batting Hand" }],
  BOWLER: [
    { key: "bowlingArm", label: "Bowling Arm" },
    { key: "bowlingType", label: "Bowling Type" },
  ],
  "ALL-ROUNDER": [
    { key: "battingHand", label: "Batting Hand" },
    { key: "bowlingArm", label: "Bowling Arm" },
    { key: "bowlingType", label: "Bowling Type" },
  ],
  "ALL ROUNDER": [
    { key: "battingHand", label: "Batting Hand" },
    { key: "bowlingArm", label: "Bowling Arm" },
    { key: "bowlingType", label: "Bowling Type" },
  ],
  ALLROUNDER: [
    { key: "battingHand", label: "Batting Hand" },
    { key: "bowlingArm", label: "Bowling Arm" },
    { key: "bowlingType", label: "Bowling Type" },
  ],
  WICKETKEEPER: [{ key: "battingHand", label: "Batting Hand" }],
  "WICKET KEEPER": [{ key: "battingHand", label: "Batting Hand" }],
  KEEPER: [{ key: "battingHand", label: "Batting Hand" }],
};

const defaultPerformanceSnapshot = [
  { label: "Current Form", value: "Building", detail: "More match data unlocks stronger insight.", accent: "from-emerald-500 to-teal-500" },
  { label: "Match Readiness", value: "Pending", detail: "Complete your profile for better tracking.", accent: "from-blue-500 to-cyan-500" },
  { label: "Consistency Score", value: "--", detail: "Generated as activity grows.", accent: "from-violet-500 to-fuchsia-500" },
  { label: "Fitness Trend", value: "Tracking", detail: "Will improve with regular usage.", accent: "from-orange-500 to-amber-500" },
];

const LOCAL_PROFILE_STORAGE_KEY = "pitchvision-player-profile";
const MAX_PROFILE_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_PROFILE_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function isMeaningfulText(value: string | null | undefined) {
  return !INVALID_PLACEHOLDERS.has(normalizeText(value).toUpperCase());
}

function normalizeRole(value: string | null | undefined) {
  return normalizeText(value).toUpperCase();
}

function getRequiredProfileFields(profile: PlayerProfileState): RequiredProfileField[] {
  const required = [...BASE_REQUIRED_FIELDS];
  const role = normalizeRole(profile.cricketRole);
  const roleFields = ROLE_REQUIRED_FIELDS[role] ?? [];

  required.push(...roleFields);

  if (isMeaningfulText(profile.educationType)) {
    required.push({ key: "institutionName", label: "Institution Name" });
  }

  if (profile.hasCricketClub === true) {
    required.push({ key: "cricketClubName", label: "Cricket Club Name" });
  }

  return required;
}

function getFieldErrorMessage(field: ProfileFieldName, profile: PlayerProfileState) {
  const role = normalizeRole(profile.cricketRole);
  const genericMessages: Record<ProfileFieldName, string> = {
    fullName: "Full name is required.",
    age: "Age is required.",
    country: "Country is required.",
    cricketRole: "Select a cricket role.",
    battingHand:
      role === "BATSMAN" || role === "WICKETKEEPER" || role === "WICKET KEEPER" || role === "KEEPER"
        ? "Batting hand is required for the selected role."
        : "Select a batting hand.",
    preferredFormat: "Select a preferred format.",
    bio: "Bio is required.",
    username: "Username is required.",
    gender: "Gender is required.",
    city: "City is required.",
    state: "State is required.",
    educationType: "Select an education type.",
    institutionName: "Institution name is required when education type is selected.",
    experienceLevel: "Experience level is required.",
    bowlingArm: "Bowling arm is required for the selected role.",
    bowlingType: "Bowling type is required for the selected role.",
    cricketClubName: "Cricket club name is required when you have a cricket club.",
  };

  return genericMessages[field];
}

function apiProfileToState(
  apiProfile: PlayerProfileApiResponse,
  base: PlayerProfileState,
): PlayerProfileState {
  return {
    ...base,
    id: apiProfile.id || base.id,
    fullName: apiProfile.fullName || "",
    username: apiProfile.username || base.username,
    email: apiProfile.email || base.email,
    avatar: apiProfile.profilePhoto || "",
    verified: Boolean(apiProfile.verified),
    age: apiProfile.age != null ? String(apiProfile.age) : "",
    gender: apiProfile.gender || "",
    city: apiProfile.city || "",
    state: apiProfile.state || "",
    country: apiProfile.country || "",
    educationType: apiProfile.educationType || "",
    institutionName: apiProfile.institutionName || "",
    hasCricketClub: apiProfile.hasCricketClub ?? null,
    cricketClubName: apiProfile.cricketClubName || "",
    cricketRole: apiProfile.cricketRole || "",
    experienceLevel: apiProfile.experienceLevel || "",
    battingHand: apiProfile.battingHand || "",
    bowlingArm: apiProfile.bowlingArm || "",
    bowlingType: apiProfile.bowlingType || "",
    preferredFormat: apiProfile.preferredFormat || "",
    bio: apiProfile.bio || "",
    matchCount: apiProfile.matches || 0,
    highlightCount: apiProfile.highlights || 0,
    currentLevel: apiProfile.currentLevel || "Beginner",
    completionPercentage: apiProfile.completionPercentage || 0,
    missingFields: apiProfile.missingFields || [],
    profileCompleted: Boolean(apiProfile.profileCompleted),
  };
}

function titleCaseFromEmail(email: string) {
  const namePart = email.split("@")[0] ?? "";
  return namePart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugifyUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function getDisplayName(user: { name?: string | null; email?: string | null }, fullName?: string) {
  if (fullName?.trim()) return fullName.trim();
  if (user.name?.trim()) return user.name.trim();
  if (user.email?.trim()) return titleCaseFromEmail(user.email);
  return "Player";
}

function buildInitialProfile(user: ReturnType<typeof useAuthStore.getState>["user"]): PlayerProfileState {
  const derivedName = getDisplayName(user ?? {}, "");
  const derivedEmail = user?.email ?? "";
  const baseUsername = slugifyUsername(derivedName || derivedEmail || "player");

  return {
    id: user?.id ?? "local-player",
    fullName: user?.name ?? "",
    username: baseUsername ? `@${baseUsername}` : "",
    email: derivedEmail,
    avatar: "",
    verified: Boolean(user?.is_verified),
    age: "",
    gender: "",
    city: "",
    state: "",
    country: "",
    educationType: "",
    institutionName: "",
    hasCricketClub: null,
    cricketClubName: "",
    cricketRole: "",
    experienceLevel: "",
    battingHand: "",
    bowlingArm: "",
    bowlingType: "",
    preferredFormat: "",
    bio: user?.profile_bio ?? "",
    matchCount: 0,
    highlightCount: 0,
    currentLevel: "Beginner",
    performanceSnapshot: defaultPerformanceSnapshot,
    recentActivity: ["Joined PitchVision", "Opened player dashboard"],
    completionPercentage: 0,
    missingFields: [],
    profileCompleted: false,
  };
}

function getProfileStorageKey(user: ReturnType<typeof useAuthStore.getState>["user"]) {
  return `${LOCAL_PROFILE_STORAGE_KEY}:${user?.id || user?.email || "player"}`;
}

function loadLocalProfile(user: ReturnType<typeof useAuthStore.getState>["user"]) {
  const base = buildInitialProfile(user);

  try {
    const stored = localStorage.getItem(getProfileStorageKey(user));
    if (!stored) {
      const completion = getProfileCompletion(base);
      return { ...base, ...completion };
    }

    const parsed = JSON.parse(stored) as Partial<PlayerProfileState>;
    const merged: PlayerProfileState = {
      ...base,
      ...parsed,
      performanceSnapshot: parsed.performanceSnapshot ?? base.performanceSnapshot,
      recentActivity: parsed.recentActivity ?? base.recentActivity,
    };

    const completion = getProfileCompletion(merged);
    return { ...merged, ...completion };
  } catch {
    const completion = getProfileCompletion(base);
    return { ...base, ...completion };
  }
}

function persistLocalProfile(
  user: ReturnType<typeof useAuthStore.getState>["user"],
  profile: PlayerProfileState,
) {
  localStorage.setItem(getProfileStorageKey(user), JSON.stringify(profile));
}

function getProfileCompletion(profile: PlayerProfileState): CompletionSummary {
  const requiredFields = getRequiredProfileFields(profile);
  const missingFields = requiredFields
    .filter(({ key }) => !isMeaningfulText(profile[key]))
    .map(({ label }) => label);
  const completedCount = requiredFields.length - missingFields.length;
  const completionPercentage = requiredFields.length > 0 ? Math.round((completedCount / requiredFields.length) * 100) : 0;

  return {
    completionPercentage,
    missingFields,
    profileCompleted: missingFields.length === 0,
  };
}

function validateProfile(profile: PlayerProfileState) {
  const errors: FormErrors = {};
  for (const field of getRequiredProfileFields(profile)) {
    if (!isMeaningfulText(profile[field.key])) {
      errors[field.key] = getFieldErrorMessage(field.key, profile);
    }
  }

  return errors;
}

function ValueOrPlaceholder({ value, placeholder }: { value: string; placeholder: string }) {
  return value?.trim() ? (
    <span className="text-base font-medium text-white">{value}</span>
  ) : (
    <span className="text-base font-medium text-slate-500">{placeholder}</span>
  );
}

function FormFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-sm text-rose-300">{message}</p>;
}

export default function PlayerProfile() {
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<PlayerProfileState>(() => loadLocalProfile(user));
  const [draftProfile, setDraftProfile] = useState<PlayerProfileState>(() => loadLocalProfile(user));
  const [uploadedVideos, setUploadedVideos] = useState<PlayerVideoItem[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [pageMessageType, setPageMessageType] = useState<"success" | "error">("success");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const modalRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fieldRefs = useRef<
    Partial<Record<ProfileFieldName, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>
  >({});

  const loadUploadedVideos = useCallback(async () => {
    const data = await getPlayerVideos();
    setUploadedVideos(data.videos ?? []);
  }, []);

  const applyApiResponse = useCallback(
    (data: PlayerProfileEnvelope) => {
      const apiProfile = data.profile;
      const base = buildInitialProfile(user);
      const merged = apiProfileToState(apiProfile, base);
      persistLocalProfile(user, merged);
      setProfile(merged);
      setDraftProfile(merged);
    },
    [user],
  );

  useEffect(() => {
    const localProfile = loadLocalProfile(user);
    setProfile(localProfile);
    setDraftProfile(localProfile);

    Promise.allSettled([getPlayerProfile(), loadUploadedVideos()])
      .then((results) => {
        const [profileResult] = results;
        if (profileResult.status === "fulfilled" && profileResult.value) {
          applyApiResponse(profileResult.value);
        }
      })
      .catch(() => {
        // silently fall back to localStorage
      });
  }, [user, applyApiResponse, loadUploadedVideos]);

  useEffect(() => {
    if (!isEditOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        setIsEditOpen(false);
      }

      if (event.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    modalRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEditOpen, isSaving]);

  useEffect(() => {
    if (!pageMessage || pageMessageType !== "success") return;

    const timeout = window.setTimeout(() => {
      setPageMessage("");
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [pageMessage, pageMessageType]);

  const formatVideoDate = useCallback((value: string | null) => {
    if (!value) return "Just now";
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  const displayName = useMemo(() => getDisplayName(user ?? {}, profile.fullName), [profile.fullName, user]);
  const displayUsername = useMemo(() => {
    if (profile.username.trim()) {
      return profile.username.startsWith("@") ? profile.username : `@${profile.username}`;
    }
    const source = displayName || user?.email || "player";
    return `@${slugifyUsername(source) || "player"}`;
  }, [displayName, profile.username, user?.email]);

  const completion = useMemo(
    () => ({
      completionPercentage: profile.completionPercentage,
      missingFields: profile.missingFields,
      profileCompleted: profile.profileCompleted,
    }),
    [profile.completionPercentage, profile.missingFields, profile.profileCompleted],
  );
  const completionPreview = useMemo(() => getProfileCompletion(draftProfile), [draftProfile]);
  const isProfileCompleted = completion.profileCompleted;

  const checklist: SetupItem[] = useMemo(() => {
    const required = getRequiredProfileFields(profile);
    const missingSet = new Set(profile.missingFields);
    const helperText: Record<string, string> = {
      "Full Name": "Use your player identity",
      Age: "Helps contextualize growth",
      Gender: "Required for a complete player profile",
      Country: "Used for your player identity",
      "Cricket Role": "Batsman, Bowler, All-Rounder, Keeper",
      "Batting Hand": "Required for batting roles",
      "Bowling Arm": "Required for bowling roles",
      "Bowling Type": "Avoid placeholder values like None",
      "Preferred Format": "Used for personalization",
      Bio: "Describe strengths and style",
      "Education Type": "Choose School, College, or Other",
      "Institution Name": "Shown when education type is selected",
      "Cricket Club Name": "Required only if you have a cricket club",
    };

    return required.map(({ label }) => ({
      label: `Add ${label.toLowerCase()}`,
      completed: !missingSet.has(label),
      helper: helperText[label] || "Complete this profile field",
    }));
  }, [profile]);

  const statsStrip = [
    { label: "Matches", value: String(profile.matchCount || 0) },
    { label: "Highlights", value: String(uploadedVideos.length || profile.highlightCount || 0) },
    { label: "Verified", value: profile.verified ? "Yes" : "No" },
    { label: "Role", value: profile.cricketRole || "Not selected" },
    { label: "Current Level", value: profile.currentLevel || (isProfileCompleted ? "Rising Star" : "Setting Up") },
  ];

  const openEditModal = () => {
    setDraftProfile(profile);
    setFormErrors({});
    setSaveError("");
    setPageMessage("");
    setPageMessageType("success");
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    if (isSaving) return;
    setIsEditOpen(false);
    setFormErrors({});
    setSaveError("");
  };

  const updateField = <K extends keyof PlayerProfileState>(key: K, value: PlayerProfileState[K]) => {
    setDraftProfile((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => {
      if (typeof key !== "string" || !current[key as ProfileFieldName]) return current;
      const next = { ...current };
      delete next[key as ProfileFieldName];
      return next;
    });
  };

  const saveProfile = async () => {
    const errors = validateProfile(draftProfile);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstField = Object.keys(errors)[0] as ProfileFieldName;
      fieldRefs.current[firstField]?.scrollIntoView({ behavior: "smooth", block: "center" });
      fieldRefs.current[firstField]?.focus();
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const rawUsername = draftProfile.username.replace(/^@/, "").trim();
      const normalizedUsername =
        rawUsername ||
        slugifyUsername(getDisplayName(user ?? {}, draftProfile.fullName) || user?.email || "player");

      const payload: UpdatePlayerProfilePayload = {
        fullName: draftProfile.fullName.trim(),
        username: normalizedUsername,
        age: draftProfile.age ? parseInt(draftProfile.age, 10) || null : null,
        gender: draftProfile.gender.trim(),
        city: draftProfile.city.trim(),
        state: draftProfile.state.trim(),
        country: draftProfile.country.trim(),
        educationType: draftProfile.educationType.trim(),
        institutionName: draftProfile.educationType.trim() ? draftProfile.institutionName.trim() : "",
        hasCricketClub: draftProfile.hasCricketClub,
        cricketClubName: draftProfile.hasCricketClub ? draftProfile.cricketClubName.trim() : "",
        cricketRole: draftProfile.cricketRole.trim(),
        experienceLevel: draftProfile.experienceLevel.trim(),
        battingHand: draftProfile.battingHand.trim(),
        bowlingArm: draftProfile.bowlingArm.trim(),
        bowlingType: draftProfile.bowlingType.trim(),
        preferredFormat: draftProfile.preferredFormat.trim(),
        bio: draftProfile.bio.trim(),
        profilePhoto: draftProfile.avatar.trim(),
      };

      const data = await updatePlayerProfile(payload);
      applyApiResponse(data);

      setFormErrors({});
      setIsEditOpen(false);
      setPageMessageType("success");
      setPageMessage("Profile updated successfully.");

      if (user) {
        const nextUser = { ...user, name: payload.fullName || user.name, profile_bio: payload.bio };
        useAuthStore.setState({ user: nextUser });
        localStorage.setItem("user_profile", JSON.stringify(nextUser));
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const triggerVideoPicker = () => {
    if (isUploadingVideo) return;
    fileInputRef.current?.click();
  };

  const handleVideoSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile) return;

    const lowerName = selectedFile.name.toLowerCase();
    const hasValidExtension = ALLOWED_PROFILE_VIDEO_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!(selectedFile.type.startsWith("video/") || hasValidExtension)) {
      setPageMessageType("error");
      setPageMessage("Please select a valid video file.");
      return;
    }

    if (selectedFile.size > MAX_PROFILE_VIDEO_SIZE_BYTES) {
      setPageMessageType("error");
      setPageMessage("Video is too large. Maximum allowed size is 100MB.");
      return;
    }

    setIsUploadingVideo(true);
    setPageMessage("");

    try {
      await uploadPlayerVideo(selectedFile);
      await Promise.all([
        loadUploadedVideos(),
        getPlayerProfile().then((data) => {
          if (data) applyApiResponse(data);
        }),
      ]);
      setPageMessageType("success");
      setPageMessage("Video uploaded successfully.");
    } catch (error) {
      setPageMessageType("error");
      setPageMessage(error instanceof Error ? error.message : "Failed to upload video.");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    setDeletingVideoId(videoId);
    try {
      await deletePlayerVideo(videoId);
      await Promise.all([
        loadUploadedVideos(),
        getPlayerProfile().then((data) => {
          if (data) applyApiResponse(data);
        }),
      ]);
      setPageMessageType("success");
      setPageMessage("Video deleted successfully.");
    } catch (error) {
      setPageMessageType("error");
      setPageMessage(error instanceof Error ? error.message : "Failed to delete video.");
    } finally {
      setDeletingVideoId(null);
    }
  };

  return (
    <div className="space-y-8 text-white">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoSelection}
      />
      <AnimatePresence>
        {pageMessage && pageMessageType === "success" ? (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="fixed right-4 top-4 z-[70] w-[min(92vw,380px)]"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-slate-950/95 px-4 py-3 shadow-[0_18px_50px_rgba(16,185,129,0.22)] backdrop-blur-xl">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Success</p>
                <p className="mt-1 text-sm text-emerald-200">{pageMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setPageMessage("")}
                className="rounded-xl p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Dismiss success message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {pageMessage && pageMessageType === "error" ? (
        <div
          className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
        >
          {pageMessage}
        </div>
      ) : null}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_20px_80px_rgba(2,6,23,0.42)] backdrop-blur-2xl md:p-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_28%)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="relative">
              {profile.avatar ? (
                <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.28)]">
                  <img src={profile.avatar} alt={displayName} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/10 bg-gradient-to-br from-blue-500 to-violet-600 text-4xl font-semibold shadow-[0_0_50px_rgba(99,102,241,0.28)]">
                  {(displayName || "P").charAt(0).toUpperCase()}
                </div>
              )}
              {profile.verified ? (
                <div className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-sky-400 to-blue-600 shadow-[0_0_22px_rgba(59,130,246,0.45)]">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
              ) : null}
            </div>

            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{displayName}</h1>
                {profile.verified ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sm text-sky-200">
                    <ShieldCheck className="h-4 w-4" />
                    Verified Player
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-slate-300">
                    {!isProfileCompleted ? "Profile Incomplete" : "Unverified"}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span>{displayUsername}</span>
                <span className="text-slate-500">|</span>
                <span>{profile.email || "No email available"}</span>
              </div>

              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
                {isProfileCompleted
                  ? profile.bio || "Track your progress and achievements."
                  : "Complete your player profile to unlock a better sports identity and personalized tracking."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openEditModal}
              className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-violet-700"
            >
              {isProfileCompleted ? "Edit Profile" : "Complete Profile"}
            </button>
          </div>
        </div>
      </motion.section>

      {!isProfileCompleted ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[30px] border border-violet-300/15 bg-gradient-to-br from-violet-500/10 via-slate-950/90 to-blue-500/10 p-6 shadow-[0_20px_70px_rgba(79,70,229,0.14)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-violet-200">Complete Your Profile</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Profile setup progress</h2>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/70 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-400">Completion</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{completion.completionPercentage}% complete</p>
                </div>
                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
                  {completion.missingFields.length} field{completion.missingFields.length === 1 ? "" : "s"} left
                </div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completion.completionPercentage}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400"
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {completion.missingFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200"
                  >
                    Missing: {field}
                  </span>
                ))}
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={openEditModal}
                  className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-violet-700"
                >
                  Complete Profile
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Profile Setup Checklist</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Complete your athlete identity</h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-start gap-4 rounded-[20px] border border-white/10 bg-slate-950/70 p-4">
                  <div
                    className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${item.completed ? "bg-gradient-to-br from-emerald-500 to-teal-500" : "bg-white/[0.05]"
                      }`}
                  >
                    {item.completed ? <Check className="h-5 w-5 text-white" /> : <ArrowRight className="h-5 w-5 text-slate-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{item.label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${item.completed ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200"
                          }`}
                      >
                        {item.completed ? "Done" : "Pending"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{item.helper}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-5">
        {statsStrip.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: index * 0.06 }}
            whileHover={{ y: -4 }}
            className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-xl"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
            <p className="mt-3 text-xl font-semibold text-white">{item.value}</p>
          </motion.div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600">
              <IdCard className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Personal Information</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Personal Information</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              { label: "Full Name", value: profile.fullName, placeholder: displayName },
              { label: "Age", value: profile.age, placeholder: "Not added" },
              { label: "Gender", value: profile.gender, placeholder: "Not added" },
              { label: "City / State", value: [profile.city, profile.state].filter(Boolean).join(", "), placeholder: "Not added" },
              { label: "Country", value: profile.country, placeholder: "Not added" },
              { label: "Education Type", value: profile.educationType, placeholder: "Not selected" },
              { label: "Institution", value: profile.institutionName, placeholder: "Not added" },
              {
                label: "Cricket Club",
                value:
                  profile.hasCricketClub === null
                    ? ""
                    : profile.hasCricketClub
                      ? profile.cricketClubName || "Yes"
                      : "No",
                placeholder: "Not selected",
              },
              { label: "Cricket Role", value: profile.cricketRole, placeholder: "Not selected" },
              { label: "Experience Level", value: profile.experienceLevel, placeholder: "Not selected" },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-white/10 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <div className="mt-3">
                  <ValueOrPlaceholder value={item.value} placeholder={item.placeholder} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Playing Style</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Playing Style</h2>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { label: "Batting Hand", value: profile.battingHand, placeholder: "Not selected" },
              { label: "Bowling Arm", value: profile.bowlingArm, placeholder: "Not selected" },
              { label: "Bowling Type", value: profile.bowlingType, placeholder: "Not selected" },
              { label: "Preferred Format", value: profile.preferredFormat, placeholder: "Not selected" },
              { label: "Role", value: profile.cricketRole, placeholder: "Not selected" },
              { label: "Level", value: profile.experienceLevel, placeholder: "Not selected" },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                whileHover={{ y: -3, scale: 1.01 }}
                className={`rounded-full border px-4 py-3 text-sm ${index % 3 === 0
                  ? "border-blue-400/20 bg-blue-400/10 text-blue-200"
                  : index % 3 === 1
                    ? "border-violet-400/20 bg-violet-400/10 text-violet-200"
                    : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                  }`}
              >
                {item.label}: <span className={item.value ? "" : "text-white/60"}>{item.value || item.placeholder}</span>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Style Snapshot</p>
            <p className="mt-3 text-base leading-7 text-slate-200">
              {profile.cricketRole || profile.preferredFormat
                ? `${profile.cricketRole || "Player"} profile with ${profile.preferredFormat || "developing"} focus and ${profile.bowlingType || "evolving"} playing identity.`
                : "Select your playing style fields to build a stronger cricket identity."}
            </p>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr]">
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Quick Performance Snapshot</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">AI Snapshot</h2>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {profile.performanceSnapshot.map((item) => (
                <motion.div
                  key={item.label}
                  whileHover={{ y: -2 }}
                  className="rounded-[22px] border border-white/10 bg-slate-950/70 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">{item.label}</p>
                      <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
                    </div>
                    <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${item.accent} opacity-90`} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600">
                <UserRound className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">About Player</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">About Player</h2>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/70 p-5">
              <p className={`text-base leading-7 ${profile.bio ? "text-slate-200" : "text-slate-400"}`}>
                {profile.bio || "Add a short player bio to describe your cricket style, strengths, and goals."}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Video Highlights</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Video Highlights</h2>
            <p className="mt-2 text-slate-400">Showcase key moments from analysis, matches, and standout performances.</p>
          </div>
          <button
            type="button"
            onClick={triggerVideoPicker}
            disabled={isUploadingVideo}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {isUploadingVideo ? "Uploading..." : "Upload Match Video"}
          </button>
        </div>

        {uploadedVideos.length === 0 ? (
          <div className="rounded-[30px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20">
              <Video className="h-8 w-8 text-blue-200" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-white">No highlights added yet</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Upload a match video to build your player portfolio and showcase standout batting, bowling, or fielding moments.
            </p>
            <button
              type="button"
              onClick={triggerVideoPicker}
              disabled={isUploadingVideo}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Upload className="h-4 w-4" />
              {isUploadingVideo ? "Uploading..." : "Upload Match Video"}
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {uploadedVideos.map((uploadedVideo) => (
              <motion.article
                key={uploadedVideo.id}
                whileHover={{ y: -5, scale: 1.01 }}
                className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl"
              >
                <div className="relative h-52">
                  <video
                    className="h-full w-full object-cover"
                    preload="metadata"
                    controls={false}
                    muted
                    src={resolveMediaUrl(uploadedVideo.url)}
                  >
                    <source src={resolveMediaUrl(uploadedVideo.url)} type="video/mp4" />
                  </video>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs text-blue-200">
                      {uploadedVideo.status}
                    </span>
                    <span className="rounded-full bg-black/35 px-3 py-1 text-xs text-white">
                      {formatVideoDate(uploadedVideo.uploadedAt)}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="truncate text-lg font-semibold text-white">{uploadedVideo.title}</h3>
                  <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    Uploaded {formatVideoDate(uploadedVideo.uploadedAt)}
                  </div>
                  <div className="mt-5 flex gap-3">
                    <Link
                      to={`/video/${uploadedVideo.id}`}
                      className="flex-1 rounded-xl bg-white/[0.07] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                    >
                      View / Play
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDeleteVideo(uploadedVideo.id)}
                      disabled={deletingVideoId === uploadedVideo.id}
                      className="flex-1 rounded-xl border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingVideoId === uploadedVideo.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Recent Activity</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Recent Activity</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {profile.recentActivity.length > 0 ? (
              profile.recentActivity.map((item, index) => (
                <div key={`${item}-${index}`} className="flex items-start gap-4 rounded-[20px] border border-white/10 bg-slate-950/70 p-4">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{item}</p>
                    <p className="mt-1 text-sm text-slate-400">Player activity updates appear here as you use PitchVision.</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                Your recent activity will appear here once you start uploading videos, watching highlights, and building streaks.
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Profile Status</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Profile Status</h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-5">
              <p className="text-sm text-slate-400">Identity strength</p>
              <p className="mt-2 text-3xl font-semibold text-white">{completion.completionPercentage}%</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {isProfileCompleted
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

      <AnimatePresence>
        {isEditOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeEditModal();
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md md:p-6"
          >
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="complete-profile-title"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(7,12,24,0.98))] shadow-[0_30px_120px_rgba(2,6,23,0.72)]"
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-slate-950/70 px-5 py-5 backdrop-blur-xl md:px-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-violet-200">Player Profile Setup</p>
                  <h2 id="complete-profile-title" className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                    Complete Your Profile
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Add your cricket identity and basic details
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-slate-300 transition hover:bg-white/[0.08]"
                  aria-label="Close complete profile modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-5 md:px-6">
                <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                  <div className="space-y-6">
                    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                      <h3 className="text-lg font-semibold text-white">Personal Information</h3>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {[
                          { label: "Full Name", key: "fullName", type: "text", placeholder: displayName, autoFocus: true },
                          { label: "Age", key: "age", type: "text", placeholder: "18" },
                          { label: "Gender", key: "gender", options: ["", "Male", "Female", "Other", "Prefer not to say"] },
                          { label: "City", key: "city", type: "text", placeholder: "City" },
                          { label: "State", key: "state", type: "text", placeholder: "State" },
                          { label: "Country", key: "country", type: "text", placeholder: "Country" },
                        ].map((field) => (
                          <label key={field.key} className="block">
                            <span className="mb-2 block text-sm text-slate-300">{field.label}</span>
                            {"options" in field ? (
                              (() => {
                                const selectOptions = field.options ?? [];
                                return (
                                  <select
                                    ref={(element) => {
                                      fieldRefs.current[field.key as ProfileFieldName] = element;
                                    }}
                                    data-autofocus={field.autoFocus ? "true" : undefined}
                                    value={draftProfile[field.key as keyof PlayerProfileState] as string}
                                    onChange={(event) => updateField(field.key as ProfileFieldName, event.target.value)}
                                    className={`w-full rounded-2xl border bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:ring-2 ${formErrors[field.key as ProfileFieldName]
                                      ? "border-rose-400/60 focus:border-rose-400/60 focus:ring-rose-500/20"
                                      : "border-white/10 focus:border-blue-400/40 focus:ring-blue-500/20"
                                      }`}
                                  >
                                    {selectOptions.map((option) => (
                                      <option key={option || "blank"} value={option}>
                                        {option || "Select option"}
                                      </option>
                                    ))}
                                  </select>
                                );
                              })()
                            ) : (
                              <input
                                ref={(element) => {
                                  fieldRefs.current[field.key as ProfileFieldName] = element;
                                }}
                                data-autofocus={field.autoFocus ? "true" : undefined}
                                type={field.type}
                                value={draftProfile[field.key as keyof PlayerProfileState] as string}
                                onChange={(event) => updateField(field.key as ProfileFieldName, event.target.value)}
                                placeholder={field.placeholder}
                                className={`w-full rounded-2xl border bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:ring-2 ${formErrors[field.key as ProfileFieldName]
                                  ? "border-rose-400/60 focus:border-rose-400/60 focus:ring-rose-500/20"
                                  : "border-white/10 focus:border-blue-400/40 focus:ring-blue-500/20"
                                  }`}
                              />
                            )}
                            <FormFieldError message={formErrors[field.key as ProfileFieldName]} />
                          </label>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                      <h3 className="text-lg font-semibold text-white">Cricket Identity</h3>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {[
                          { label: "Cricket Role", key: "cricketRole", options: ["", "Batsman", "Bowler", "All-Rounder", "Wicket Keeper"] },
                          { label: "Experience Level", key: "experienceLevel", options: ["", "Beginner", "Intermediate", "Advanced", "Competitive"] },
                          { label: "Batting Hand", key: "battingHand", options: ["", "Right Handed", "Left Handed"] },
                          { label: "Bowling Arm", key: "bowlingArm", options: ["", "Right Arm", "Left Arm"] },
                          { label: "Bowling Type", key: "bowlingType", options: ["", "Fast", "Medium Pace", "Off Spin", "Leg Spin", "Orthodox Spin", "None"] },
                          { label: "Preferred Format", key: "preferredFormat", options: ["", "T20", "ODI", "Test", "Tennis Ball", "Leather Ball"] },
                        ].map((field) => (
                          <label key={field.key} className="block">
                            <span className="mb-2 block text-sm text-slate-300">{field.label}</span>
                            <select
                              ref={(element) => {
                                fieldRefs.current[field.key as ProfileFieldName] = element;
                              }}
                              value={draftProfile[field.key as keyof PlayerProfileState] as string}
                              onChange={(event) => updateField(field.key as ProfileFieldName, event.target.value)}
                              className={`w-full rounded-2xl border bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:ring-2 ${formErrors[field.key as ProfileFieldName]
                                ? "border-rose-400/60 focus:border-rose-400/60 focus:ring-rose-500/20"
                                : "border-white/10 focus:border-blue-400/40 focus:ring-blue-500/20"
                                }`}
                            >
                              {field.options.map((option) => (
                                <option key={option || "blank"} value={option}>
                                  {option || "Select option"}
                                </option>
                              ))}
                            </select>
                            <FormFieldError message={formErrors[field.key as ProfileFieldName]} />
                          </label>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                      <h3 className="text-lg font-semibold text-white">Education & Club</h3>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-300">Education Type</span>
                          <select
                            ref={(element) => {
                              fieldRefs.current.educationType = element;
                            }}
                            value={draftProfile.educationType}
                            onChange={(event) => updateField("educationType", event.target.value)}
                            className={`w-full rounded-2xl border bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:ring-2 ${formErrors.educationType
                              ? "border-rose-400/60 focus:border-rose-400/60 focus:ring-rose-500/20"
                              : "border-white/10 focus:border-blue-400/40 focus:ring-blue-500/20"
                              }`}
                          >
                            {["", "School", "College", "Other"].map((option) => (
                              <option key={option || "blank"} value={option}>
                                {option || "Select option"}
                              </option>
                            ))}
                          </select>
                          <FormFieldError message={formErrors.educationType} />
                        </label>

                        {draftProfile.educationType.trim() ? (
                          <label className="block">
                            <span className="mb-2 block text-sm text-slate-300">Institution Name</span>
                            <input
                              ref={(element) => {
                                fieldRefs.current.institutionName = element;
                              }}
                              type="text"
                              value={draftProfile.institutionName}
                              onChange={(event) => updateField("institutionName", event.target.value)}
                              placeholder="Enter your institution name"
                              className={`w-full rounded-2xl border bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:ring-2 ${formErrors.institutionName
                                ? "border-rose-400/60 focus:border-rose-400/60 focus:ring-rose-500/20"
                                : "border-white/10 focus:border-blue-400/40 focus:ring-blue-500/20"
                                }`}
                            />
                            <FormFieldError message={formErrors.institutionName} />
                          </label>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
                            Select an education type to add your institution name.
                          </div>
                        )}

                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-300">Do you have a cricket club?</span>
                          <select
                            value={
                              draftProfile.hasCricketClub === null ? "" : draftProfile.hasCricketClub ? "yes" : "no"
                            }
                            onChange={(event) => {
                              const nextValue =
                                event.target.value === "yes" ? true : event.target.value === "no" ? false : null;
                              updateField("hasCricketClub", nextValue);
                            }}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="">Select option</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>

                        {draftProfile.hasCricketClub === true ? (
                          <label className="block">
                            <span className="mb-2 block text-sm text-slate-300">Cricket Club Name</span>
                            <input
                              ref={(element) => {
                                fieldRefs.current.cricketClubName = element;
                              }}
                              type="text"
                              value={draftProfile.cricketClubName}
                              onChange={(event) => updateField("cricketClubName", event.target.value)}
                              placeholder="Enter your cricket club name"
                              className={`w-full rounded-2xl border bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:ring-2 ${formErrors.cricketClubName
                                ? "border-rose-400/60 focus:border-rose-400/60 focus:ring-rose-500/20"
                                : "border-white/10 focus:border-blue-400/40 focus:ring-blue-500/20"
                                }`}
                            />
                            <FormFieldError message={formErrors.cricketClubName} />
                          </label>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
                            Cricket club name is only needed when you select Yes.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                      <h3 className="text-lg font-semibold text-white">Identity & Bio</h3>
                      <div className="mt-5 space-y-4">
                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-300">Username</span>
                          <input
                            ref={(element) => {
                              fieldRefs.current.username = element;
                            }}
                            type="text"
                            value={draftProfile.username}
                            onChange={(event) => updateField("username", event.target.value)}
                            placeholder={displayUsername}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/20"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-300">Bio</span>
                          <textarea
                            ref={(element) => {
                              fieldRefs.current.bio = element;
                            }}
                            rows={6}
                            value={draftProfile.bio}
                            onChange={(event) => updateField("bio", event.target.value)}
                            placeholder="Describe your cricket style, strengths, and goals."
                            className={`w-full rounded-2xl border bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:ring-2 ${formErrors.bio
                              ? "border-rose-400/60 focus:border-rose-400/60 focus:ring-rose-500/20"
                              : "border-white/10 focus:border-blue-400/40 focus:ring-blue-500/20"
                              }`}
                          />
                          <FormFieldError message={formErrors.bio} />
                        </label>
                      </div>

                      <div className="mt-5 rounded-[22px] border border-dashed border-white/10 bg-slate-950/70 p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20">
                            <Camera className="h-5 w-5 text-blue-200" />
                          </div>
                          <div>
                            <p className="font-medium text-white">Profile Photo</p>
                            <p className="mt-1 text-sm leading-6 text-slate-400">
                              This upload area is UI-ready for backend integration. Your initials avatar stays visible until image upload is wired.
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                      <h3 className="text-lg font-semibold text-white">Completion Preview</h3>
                      <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/70 p-5">
                        <p className="text-sm text-slate-400">After save</p>
                        <p className="mt-2 text-3xl font-semibold text-white">{completionPreview.completionPercentage}% complete</p>
                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/8">
                          <motion.div
                            initial={false}
                            animate={{ width: `${completionPreview.completionPercentage}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400"
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {completionPreview.missingFields.length > 0 ? (
                            completionPreview.missingFields.map((field) => (
                              <span
                                key={field}
                                className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200"
                              >
                                {field}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                              Profile ready
                            </span>
                          )}
                        </div>
                      </div>
                    </section>

                    {saveError ? (
                      <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                        {saveError}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/10 bg-slate-950/75 px-5 py-4 backdrop-blur-xl md:px-6">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isSaving}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={isSaving}
                  className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
