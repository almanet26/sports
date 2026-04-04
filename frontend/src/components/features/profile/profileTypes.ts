export type PlayerProfileState = {
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
  performanceSnapshot: { label: string; value: string; detail: string; accent: string }[];
  recentActivity: string[];
  completionPercentage: number;
  missingFields: string[];
  profileCompleted: boolean;
};

export type ProfileFieldName =
  | "fullName" | "age" | "country" | "cricketRole" | "battingHand"
  | "preferredFormat" | "bio" | "username" | "gender" | "city" | "state"
  | "educationType" | "institutionName" | "experienceLevel"
  | "bowlingArm" | "bowlingType" | "cricketClubName";

export type FormErrors = Partial<Record<ProfileFieldName, string>>;
