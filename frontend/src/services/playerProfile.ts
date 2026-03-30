import { api } from "../lib/api";

export interface PlayerProfileApiResponse {
  id: string;
  userId: string;
  email: string;
  username: string;
  fullName: string;
  age: number | null;
  gender: string;
  city: string;
  state: string;
  country: string;
  cricketRole: string;
  experienceLevel: string;
  battingHand: string;
  bowlingArm: string;
  bowlingType: string;
  preferredFormat: string;
  bio: string;
  profilePhoto: string;
  educationType: string;
  institutionName: string;
  hasCricketClub: boolean | null;
  cricketClubName: string;
  verified: boolean;
  matches: number;
  highlights: number;
  currentLevel: string;
  completionPercentage: number;
  profileCompleted: boolean;
  missingFields: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PlayerProfileEnvelope {
  success: boolean;
  profile: PlayerProfileApiResponse;
  completion_percentage: number;
  missing_fields: string[];
  fields_left: number;
  profile_status: "complete" | "incomplete";
  message?: string;
}

export interface UpdatePlayerProfilePayload {
  fullName: string;
  username: string;
  age: number | null;
  gender: string;
  city: string;
  state: string;
  country: string;
  cricketRole: string;
  experienceLevel: string;
  battingHand: string;
  bowlingArm: string;
  bowlingType: string;
  preferredFormat: string;
  bio: string;
  profilePhoto: string;
  educationType: string;
  institutionName: string;
  hasCricketClub: boolean | null;
  cricketClubName: string;
}

export async function getPlayerProfile() {
  const response = await api.get("/player/profile");
  return response.data as PlayerProfileEnvelope;
}

export async function updatePlayerProfile(payload: UpdatePlayerProfilePayload) {
  const response = await api.put("/player/profile", payload);
  return response.data as PlayerProfileEnvelope;
}
