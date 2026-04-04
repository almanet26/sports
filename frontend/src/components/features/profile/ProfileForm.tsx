import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { Camera, X } from "lucide-react";
import type { PlayerProfileState, ProfileFieldName, FormErrors } from "./profileTypes";

interface Props {
  isOpen: boolean;
  isSaving: boolean;
  draft: PlayerProfileState;
  formErrors: FormErrors;
  saveError: string;
  completionPreview: { completionPercentage: number; missingFields: string[] };
  displayUsername: string;
  displayName: string;
  onClose: () => void;
  onSave: () => void;
  onFieldChange: <K extends keyof PlayerProfileState>(key: K, value: PlayerProfileState[K]) => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-sm text-rose-300">{message}</p>;
}

const inputClass = (hasError: boolean) =>
  `w-full rounded-2xl border bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:ring-2 ${
    hasError
      ? "border-rose-400/60 focus:border-rose-400/60 focus:ring-rose-500/20"
      : "border-white/10 focus:border-blue-400/40 focus:ring-blue-500/20"
  }`;

export default function ProfileForm({
  isOpen, isSaving, draft, formErrors, saveError,
  completionPreview, displayUsername, displayName,
  onClose, onSave, onFieldChange,
}: Props) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md md:p-6"
        >
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-form-title"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(7,12,24,0.98))] shadow-[0_30px_120px_rgba(2,6,23,0.72)]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-slate-950/70 px-5 py-5 backdrop-blur-xl md:px-6">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-violet-200">Player Profile Setup</p>
                <h2 id="profile-form-title" className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                  Complete Your Profile
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Add your cricket identity and basic details</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-5 py-5 md:px-6">
              <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">

                {/* Left column */}
                <div className="space-y-6">
                  {/* Personal Info */}
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <h3 className="text-lg font-semibold text-white">Personal Information</h3>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {([
                        { label: "Full Name", key: "fullName", type: "text", placeholder: displayName },
                        { label: "Age", key: "age", type: "text", placeholder: "18" },
                        { label: "City", key: "city", type: "text", placeholder: "City" },
                        { label: "State", key: "state", type: "text", placeholder: "State" },
                        { label: "Country", key: "country", type: "text", placeholder: "Country" },
                      ] as const).map((f) => (
                        <label key={f.key} className="block">
                          <span className="mb-2 block text-sm text-slate-300">{f.label}</span>
                          <input
                            type={f.type}
                            value={draft[f.key] as string}
                            onChange={(e) => onFieldChange(f.key, e.target.value)}
                            placeholder={f.placeholder}
                            className={inputClass(!!formErrors[f.key as ProfileFieldName])}
                          />
                          <FieldError message={formErrors[f.key as ProfileFieldName]} />
                        </label>
                      ))}
                      <label className="block">
                        <span className="mb-2 block text-sm text-slate-300">Gender</span>
                        <select
                          value={draft.gender}
                          onChange={(e) => onFieldChange("gender", e.target.value)}
                          className={inputClass(!!formErrors.gender)}
                        >
                          {["", "Male", "Female", "Other", "Prefer not to say"].map((o) => (
                            <option key={o || "blank"} value={o}>{o || "Select option"}</option>
                          ))}
                        </select>
                        <FieldError message={formErrors.gender} />
                      </label>
                    </div>
                  </section>

                  {/* Cricket Identity */}
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <h3 className="text-lg font-semibold text-white">Cricket Identity</h3>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {([
                        { label: "Cricket Role", key: "cricketRole", options: ["", "Batsman", "Bowler", "All-Rounder", "Wicket Keeper"] },
                        { label: "Experience Level", key: "experienceLevel", options: ["", "Beginner", "Intermediate", "Advanced", "Competitive"] },
                        { label: "Batting Hand", key: "battingHand", options: ["", "Right Handed", "Left Handed"] },
                        { label: "Bowling Arm", key: "bowlingArm", options: ["", "Right Arm", "Left Arm"] },
                        { label: "Bowling Type", key: "bowlingType", options: ["", "Fast", "Medium Pace", "Off Spin", "Leg Spin", "Orthodox Spin", "None"] },
                        { label: "Preferred Format", key: "preferredFormat", options: ["", "T20", "ODI", "Test", "Tennis Ball", "Leather Ball"] },
                      ] as const).map((f) => (
                        <label key={f.key} className="block">
                          <span className="mb-2 block text-sm text-slate-300">{f.label}</span>
                          <select
                            value={draft[f.key] as string}
                            onChange={(e) => onFieldChange(f.key, e.target.value)}
                            className={inputClass(!!formErrors[f.key as ProfileFieldName])}
                          >
                            {f.options.map((o) => (
                              <option key={o || "blank"} value={o}>{o || "Select option"}</option>
                            ))}
                          </select>
                          <FieldError message={formErrors[f.key as ProfileFieldName]} />
                        </label>
                      ))}
                    </div>
                  </section>

                  {/* Education & Club */}
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <h3 className="text-lg font-semibold text-white">Education & Club</h3>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm text-slate-300">Education Type</span>
                        <select
                          value={draft.educationType}
                          onChange={(e) => onFieldChange("educationType", e.target.value)}
                          className={inputClass(!!formErrors.educationType)}
                        >
                          {["", "School", "College", "Other"].map((o) => (
                            <option key={o || "blank"} value={o}>{o || "Select option"}</option>
                          ))}
                        </select>
                        <FieldError message={formErrors.educationType} />
                      </label>

                      {draft.educationType.trim() ? (
                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-300">Institution Name</span>
                          <input
                            type="text"
                            value={draft.institutionName}
                            onChange={(e) => onFieldChange("institutionName", e.target.value)}
                            placeholder="Enter your institution name"
                            className={inputClass(!!formErrors.institutionName)}
                          />
                          <FieldError message={formErrors.institutionName} />
                        </label>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
                          Select an education type to add your institution name.
                        </div>
                      )}

                      <label className="block">
                        <span className="mb-2 block text-sm text-slate-300">Do you have a cricket club?</span>
                        <select
                          value={draft.hasCricketClub === null ? "" : draft.hasCricketClub ? "yes" : "no"}
                          onChange={(e) => {
                            const v = e.target.value === "yes" ? true : e.target.value === "no" ? false : null;
                            onFieldChange("hasCricketClub", v);
                          }}
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">Select option</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </label>

                      {draft.hasCricketClub === true ? (
                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-300">Cricket Club Name</span>
                          <input
                            type="text"
                            value={draft.cricketClubName}
                            onChange={(e) => onFieldChange("cricketClubName", e.target.value)}
                            placeholder="Enter your cricket club name"
                            className={inputClass(!!formErrors.cricketClubName)}
                          />
                          <FieldError message={formErrors.cricketClubName} />
                        </label>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
                          Cricket club name is only needed when you select Yes.
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <h3 className="text-lg font-semibold text-white">Identity & Bio</h3>
                    <div className="mt-5 space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-sm text-slate-300">Username</span>
                        <input
                          type="text"
                          value={draft.username}
                          onChange={(e) => onFieldChange("username", e.target.value)}
                          placeholder={displayUsername}
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm text-slate-300">Bio</span>
                        <textarea
                          rows={6}
                          value={draft.bio}
                          onChange={(e) => onFieldChange("bio", e.target.value)}
                          placeholder="Describe your cricket style, strengths, and goals."
                          className={inputClass(!!formErrors.bio)}
                        />
                        <FieldError message={formErrors.bio} />
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
                            Photo upload is UI-ready. Your initials avatar stays visible until image upload is wired.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Completion preview */}
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
                          completionPreview.missingFields.map((f) => (
                            <span key={f} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                              {f}
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

                  {saveError && (
                    <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                      {saveError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/10 bg-slate-950/75 px-5 py-4 backdrop-blur-xl md:px-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-violet-700 disabled:opacity-70"
              >
                {isSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
