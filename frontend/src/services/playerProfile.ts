import { AxiosError } from "axios";
import { authApi } from "../lib/api";

export interface PlayerProfileApiResponse {
  id: string; fullName: string; username: string; email: string; profilePhoto: string;
  verified: boolean; age: number | null; gender: string; city: string; state: string;
  country: string; educationType: string; institutionName: string; hasCricketClub: boolean | null;
  cricketClubName: string; cricketRole: string; experienceLevel: string; battingHand: string;
  bowlingArm: string; bowlingType: string; preferredFormat: string; bio: string;
  matches: number; highlights: number; currentLevel: string;
  completionPercentage: number; missingFields: string[]; profileCompleted: boolean;
}

export interface PlayerProfileEnvelope { profile: PlayerProfileApiResponse; }

export interface UpdatePlayerProfilePayload {
  fullName: string; username: string; age: number | null; gender: string;
  city: string; state: string; country: string; educationType: string;
  institutionName: string; hasCricketClub: boolean | null; cricketClubName: string;
  cricketRole: string; experienceLevel: string; battingHand: string;
  bowlingArm: string; bowlingType: string; preferredFormat: string;
  bio: string; profilePhoto: string;
}

const STORAGE_KEY = "pitchvision-player-profile";
const INVALID = new Set(["", "NONE", "NULL", "N/A", "NA", "SELECT OPTION"]);

function clean(v: string | null | undefined) { return (v ?? "").trim(); }
function isFilled(v: string | null | undefined) { return !INVALID.has(clean(v).toUpperCase()); }

function getStoredUser() {
  try {
    const auth = JSON.parse(localStorage.getItem("auth-storage") ?? "null") as { state?: { user?: Record<string, unknown> } } | null;
    if (auth?.state?.user) return auth.state.user;
  } catch { /* fall through */ }
  try {
    const raw = localStorage.getItem("user_profile");
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  } catch { return null; }
}

function storageKey() {
  const u = getStoredUser();
  return `${STORAGE_KEY}:${(u?.id as string) || (u?.email as string) || "player"}`;
}

function readPersisted(): Record<string, unknown> {
  try { const r = localStorage.getItem(storageKey()); return r ? JSON.parse(r) as Record<string, unknown> : {}; }
  catch { return {}; }
}

function writePersisted(patch: Record<string, unknown>) {
  localStorage.setItem(storageKey(), JSON.stringify({ ...readPersisted(), ...patch }));
  try { window.dispatchEvent(new Event("pitchvision:playerProfileUpdated")); } catch { /* no-op */ }
}

function coerceAge(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") { const p = parseInt(v, 10); return Number.isFinite(p) ? p : null; }
  return null;
}

function calcCompletion(p: Omit<PlayerProfileApiResponse, "completionPercentage" | "missingFields" | "profileCompleted">) {
  const required: { key: string; label: string }[] = [
    { key: "fullName", label: "Full Name" }, { key: "age", label: "Age" },
    { key: "gender", label: "Gender" }, { key: "country", label: "Country" },
    { key: "cricketRole", label: "Cricket Role" }, { key: "preferredFormat", label: "Preferred Format" },
    { key: "bio", label: "Bio" }, { key: "educationType", label: "Education Type" },
  ];
  const role = clean(p.cricketRole).toUpperCase();
  if (["BATSMAN", "WICKETKEEPER", "WICKET KEEPER", "KEEPER"].includes(role)) required.push({ key: "battingHand", label: "Batting Hand" });
  if (role === "BOWLER") { required.push({ key: "bowlingArm", label: "Bowling Arm" }); required.push({ key: "bowlingType", label: "Bowling Type" }); }
  if (["ALL-ROUNDER", "ALL ROUNDER", "ALLROUNDER"].includes(role)) {
    required.push({ key: "battingHand", label: "Batting Hand" });
    required.push({ key: "bowlingArm", label: "Bowling Arm" });
    required.push({ key: "bowlingType", label: "Bowling Type" });
  }
  if (isFilled(p.educationType)) required.push({ key: "institutionName", label: "Institution Name" });
  if (p.hasCricketClub === true) required.push({ key: "cricketClubName", label: "Cricket Club Name" });

  const missing = required.filter(({ key }) => key === "age" ? p.age == null : !isFilled((p as Record<string, unknown>)[key] as string)).map(({ label }) => label);
  return { completionPercentage: Math.round(((required.length - missing.length) / required.length) * 100), missingFields: missing, profileCompleted: missing.length === 0 };
}

function normalizeProfile(source: Record<string, unknown>): PlayerProfileEnvelope {
  const persisted = readPersisted();
  const base = {
    id: String(source.id ?? ""),
    fullName: clean((persisted.fullName as string) ?? (source.name as string)),
    username: clean(persisted.username as string),
    email: clean(source.email as string),
    profilePhoto: clean((persisted.profilePhoto as string) ?? (persisted.avatar as string) ?? (source.profile_image_url as string)),
    verified: Boolean(source.is_verified),
    age: coerceAge(persisted.age),
    gender: clean((persisted.gender as string) ?? (source.gender as string)),
    city: clean(persisted.city as string), state: clean(persisted.state as string),
    country: clean(persisted.country as string), educationType: clean(persisted.educationType as string),
    institutionName: clean(persisted.institutionName as string), hasCricketClub: typeof persisted.hasCricketClub === "boolean" ? persisted.hasCricketClub : null,
    cricketClubName: clean(persisted.cricketClubName as string), cricketRole: clean(persisted.cricketRole as string),
    experienceLevel: clean(persisted.experienceLevel as string), battingHand: clean(persisted.battingHand as string),
    bowlingArm: clean(persisted.bowlingArm as string), bowlingType: clean(persisted.bowlingType as string),
    preferredFormat: clean(persisted.preferredFormat as string),
    bio: clean((persisted.bio as string) ?? (source.profile_bio as string)),
    matches: typeof persisted.matchCount === "number" ? persisted.matchCount : 0,
    highlights: typeof persisted.highlightCount === "number" ? persisted.highlightCount : 0,
    currentLevel: clean(persisted.currentLevel as string) || "Beginner",
  };
  return { profile: { ...base, ...calcCompletion(base) } };
}

export interface PlayerProfileSummary {
  fullName: string;
  username: string;
  avatar: string;
  bio: string;
  completionPercentage: number;
  profileCompleted: boolean;
}

export function getStoredPlayerProfileSummary(): PlayerProfileSummary {
  const user = getStoredUser();
  const persisted = readPersisted();
  return {
    fullName: clean(persisted.fullName as string) || clean((user?.name as string) ?? ''),
    username: clean(persisted.username as string),
    avatar: clean((persisted.profilePhoto as string) ?? (persisted.avatar as string) ?? (user?.profile_image_url as string) ?? ''),
    bio: clean((persisted.bio as string) ?? (user?.profile_bio as string) ?? ''),
    completionPercentage: typeof persisted.completionPercentage === 'number' ? persisted.completionPercentage : 0,
    profileCompleted: Boolean(persisted.profileCompleted),
  };
}

export async function getPlayerProfile(): Promise<PlayerProfileEnvelope | null> {
  const response = await authApi.getProfile();
  return normalizeProfile(response.data as Record<string, unknown>);
}

export async function updatePlayerProfile(payload: UpdatePlayerProfilePayload): Promise<PlayerProfileEnvelope> {
  try {
    writePersisted({ ...payload, avatar: payload.profilePhoto });
    const response = await authApi.updateProfile({ name: payload.fullName, profile_bio: payload.bio, gender: payload.gender });
    return normalizeProfile(response.data as Record<string, unknown>);
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    throw new Error(axiosError.response?.data?.detail || axiosError.message || "Failed to update player profile.");
  }
}
