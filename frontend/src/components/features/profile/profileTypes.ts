export interface ProfileSnapshotItem {
  label: string;
  value: string;
  detail: string;
  accent: string;
}

export interface PlayerProfileState {
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
  performanceSnapshot: ProfileSnapshotItem[];
  recentActivity: string[];
  completionPercentage: number;
  missingFields: string[];
  profileCompleted: boolean;
}

export type ProfileFieldName = Extract<
  keyof PlayerProfileState,
  | "fullName" | "username" | "avatar" | "age" | "gender" | "city" | "state"
  | "country" | "educationType" | "institutionName" | "hasCricketClub"
  | "cricketClubName" | "cricketRole" | "experienceLevel" | "battingHand"
  | "bowlingArm" | "bowlingType" | "preferredFormat" | "bio"
>;

export type FormErrors = Partial<Record<ProfileFieldName, string>>;
