import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

interface Props {
  displayName: string;
  displayUsername: string;
  email: string;
  avatar: string;
  verified: boolean;
  isProfileCompleted: boolean;
  bio: string;
  onEdit: () => void;
}

export default function ProfileHeader({
  displayName, displayUsername, email, avatar,
  verified, isProfileCompleted, bio, onEdit,
}: Props) {
  return (
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
            {avatar ? (
              <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white/10">
                <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/10 bg-gradient-to-br from-blue-500 to-violet-600 text-4xl font-semibold">
                {(displayName || "P").charAt(0).toUpperCase()}
              </div>
            )}
            {verified && (
              <div className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-sky-400 to-blue-600">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
            )}
          </div>

          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{displayName}</h1>
              {verified ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sm text-sky-200">
                  <ShieldCheck className="h-4 w-4" /> Verified Player
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
              <span>{email || "No email available"}</span>
            </div>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
              {isProfileCompleted
                ? bio || "Track your progress and achievements."
                : "Complete your player profile to unlock a better sports identity."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-violet-700"
        >
          {isProfileCompleted ? "Edit Profile" : "Complete Profile"}
        </button>
      </div>
    </motion.section>
  );
}
