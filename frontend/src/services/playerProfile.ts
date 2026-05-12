import { AxiosError } from "axios";
import { authApi } from "../lib/api";

export interface PlayerProfileApiResponse {
  id: string;
  fullName: string;
  username: string;
  email: string;
  profilePhoto: string;
  verified: boolean;
  age: number | null;
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
  matches: number;
  highlights: number;
  currentLevel: string;
  completionPercentage: number;
  missingFields: string[];
  profileCompleted: boolean;
}

export interface PlayerProfileEnvelope {
  profile: PlayerProfileApiResponse;
}

export interface PlayerProfileSummary {
  fullName: string;
  username: string;
  avatar: string;
  bio: string;
  completionPercentage: number;
  profileCompleted: boolean;
}

export interface UpdatePlayerProfilePayload {
  fullName: string;
  username: string;
  age: number | null;
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
  profilePhoto: string;
}

type PersistedPlayerProfile = Partial<
  Omit<PlayerProfileApiResponse, "id" | "email" | "verified" | "bio" | "fullName" | "gender" | "profilePhoto">
> & {
  avatar?: string;
  fullName?: string;
  bio?: string;
  gender?: string;
  profilePhoto?: string;
  matchCount?: number;
  highlightCount?: number;
  // Historical localStorage snapshot (PlayerProfileState) stores `age` as a string.
  age?: number | null | string;
};

const STORAGE_KEY = "pitchvision-player-profile";
const INVALID = new Set(["", "NONE", "NULL", "N/A", "NA", "SELECT OPTION"]);

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function coerceAge(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isFilled(value: string | null | undefined) {
  return !INVALID.has(clean(value).toUpperCase());
}

function getStoredUser():
  | {
      id?: string;
      email?: string;
      name?: string;
      is_verified?: boolean;
      profile_bio?: string;
      gender?: string;
      profile_image_url?: string;
    }
  | null {
  try {
    const authState = JSON.parse(localStorage.getItem("auth-storage") ?? "null") as
      | { state?: { user?: Record<string, unknown> } }
      | null;
    if (authState?.state?.user) {
      return authState.state.user as ReturnType<typeof getStoredUser>;
    }
  } catch {
    // fall back to legacy key below
  }

  try {
    const raw = localStorage.getItem("user_profile");
    return raw ? (JSON.parse(raw) as ReturnType<typeof getStoredUser>) : null;
  } catch {
    return null;
  }
}

function storageKeyForCurrentUser() {
  const user = getStoredUser();
  return `${STORAGE_KEY}:${user?.id || user?.email || "player"}`;
}

function readPersistedProfile(): PersistedPlayerProfile {
  try {
    const raw = localStorage.getItem(storageKeyForCurrentUser());
    return raw ? (JSON.parse(raw) as PersistedPlayerProfile) : {};
  } catch {
    return {};
  }
}

function writePersistedProfile(patch: PersistedPlayerProfile) {
  const current = readPersistedProfile();
  localStorage.setItem(storageKeyForCurrentUser(), JSON.stringify({ ...current, ...patch }));
  try {
    window.dispatchEvent(new Event("pitchvision:playerProfileUpdated"));
  } catch {
    // no-op (SSR/tests)
  }
}

function calcCompletion(profile: Omit<PlayerProfileApiResponse, "completionPercentage" | "missingFields" | "profileCompleted">) {
  type CompletionFieldKey =
    | "fullName"
    | "age"
    | "gender"
    | "country"
    | "cricketRole"
    | "preferredFormat"
    | "bio"
    | "educationType"
    | "institutionName"
    | "battingHand"
    | "bowlingArm"
    | "bowlingType"
    | "cricketClubName";

  const required: Array<{ key: CompletionFieldKey; label: string }> = [
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
  if (["BATSMAN", "WICKETKEEPER", "WICKET KEEPER", "KEEPER"].includes(role)) {
    required.push({ key: "battingHand", label: "Batting Hand" });
  }
  if (role === "BOWLER") {
    required.push({ key: "bowlingArm", label: "Bowling Arm" });
    required.push({ key: "bowlingType", label: "Bowling Type" });
  }
  if (["ALL-ROUNDER", "ALL ROUNDER", "ALLROUNDER"].includes(role)) {
    required.push({ key: "battingHand", label: "Batting Hand" });
    required.push({ key: "bowlingArm", label: "Bowling Arm" });
    required.push({ key: "bowlingType", label: "Bowling Type" });
  }
  if (isFilled(profile.educationType)) {
    required.push({ key: "institutionName", label: "Institution Name" });
  }
  if (profile.hasCricketClub === true) {
    required.push({ key: "cricketClubName", label: "Cricket Club Name" });
  }

  const missingFields = required
    .filter(({ key }) => {
      if (key === "age") return profile.age == null;
      return !isFilled(profile[key] as string | null | undefined);
    })
    .map(({ label }) => label);

  return {
    completionPercentage: Math.round(((required.length - missingFields.length) / required.length) * 100),
    missingFields,
    profileCompleted: missingFields.length === 0,
  };
}

function normalizeProfile(source: Record<string, unknown>, persisted: PersistedPlayerProfile = readPersistedProfile()): PlayerProfileEnvelope {
  const profileBase = {
    id: String(source.id ?? ""),
    fullName: clean((persisted.fullName as string | undefined) ?? (source.name as string | undefined)),
    username: clean(persisted.username as string | undefined),
    email: clean(source.email as string | undefined),
    profilePhoto: clean(
      (persisted.profilePhoto as string | undefined) ??
        persisted.avatar ??
        (source.profile_image_url as string | undefined),
    ),
    verified: Boolean(source.is_verified),
    age: coerceAge(persisted.age),
    gender: clean((persisted.gender as string | undefined) ?? (source.gender as string | undefined)),
    city: clean(persisted.city as string | undefined),
    state: clean(persisted.state as string | undefined),
    country: clean(persisted.country as string | undefined),
    educationType: clean(persisted.educationType as string | undefined),
    institutionName: clean(persisted.institutionName as string | undefined),
    hasCricketClub: typeof persisted.hasCricketClub === "boolean" ? persisted.hasCricketClub : null,
    cricketClubName: clean(persisted.cricketClubName as string | undefined),
    cricketRole: clean(persisted.cricketRole as string | undefined),
    experienceLevel: clean(persisted.experienceLevel as string | undefined),
    battingHand: clean(persisted.battingHand as string | undefined),
    bowlingArm: clean(persisted.bowlingArm as string | undefined),
    bowlingType: clean(persisted.bowlingType as string | undefined),
    preferredFormat: clean(persisted.preferredFormat as string | undefined),
    bio: clean((persisted.bio as string | undefined) ?? (source.profile_bio as string | undefined)),
    matches:
      typeof persisted.matches === "number"
        ? persisted.matches
        : typeof persisted.matchCount === "number"
          ? persisted.matchCount
          : 0,
    highlights:
      typeof persisted.highlights === "number"
        ? persisted.highlights
        : typeof persisted.highlightCount === "number"
          ? persisted.highlightCount
          : 0,
    currentLevel: clean(persisted.currentLevel as string | undefined) || "Beginner",
  };

  return {
    profile: {
      ...profileBase,
      ...calcCompletion(profileBase),
    },
  };
}

export function getStoredPlayerProfileSummary(): PlayerProfileSummary {
  const user = getStoredUser();
  const persisted = readPersistedProfile();
  const profile = normalizeProfile(user ? (user as Record<string, unknown>) : {}, persisted).profile;

  return {
    fullName: profile.fullName,
    username: profile.username,
    avatar: profile.profilePhoto,
    bio: profile.bio,
    completionPercentage: profile.completionPercentage,
    profileCompleted: profile.profileCompleted,
  };
}

function toErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: string }>;
  return axiosError.response?.data?.detail || axiosError.message || fallback;
}

export async function getPlayerProfile(): Promise<PlayerProfileEnvelope | null> {
  const response = await authApi.getProfile();
  return normalizeProfile(response.data as Record<string, unknown>);
}

export async function updatePlayerProfile(payload: UpdatePlayerProfilePayload): Promise<PlayerProfileEnvelope> {
  try {
    const response = await authApi.updateProfile({
      name: payload.fullName,
      profile_bio: payload.bio,
      gender: payload.gender,
    });

    writePersistedProfile({
      fullName: payload.fullName,
      username: payload.username,
      age: payload.age,
      gender: payload.gender,
      city: payload.city,
      state: payload.state,
      country: payload.country,
      educationType: payload.educationType,
      institutionName: payload.institutionName,
      hasCricketClub: payload.hasCricketClub,
      cricketClubName: payload.cricketClubName,
      cricketRole: payload.cricketRole,
      experienceLevel: payload.experienceLevel,
      battingHand: payload.battingHand,
      bowlingArm: payload.bowlingArm,
      bowlingType: payload.bowlingType,
      preferredFormat: payload.preferredFormat,
      bio: payload.bio,
      profilePhoto: payload.profilePhoto,
      avatar: payload.profilePhoto,
    });

    return normalizeProfile(response.data as Record<string, unknown>);
  } catch (error) {
    throw new Error(toErrorMessage(error, "Failed to update player profile."));
  }
}
