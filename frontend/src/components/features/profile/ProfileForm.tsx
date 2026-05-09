import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import type { FormErrors, PlayerProfileState } from "./profileTypes";

interface Props {
  isOpen: boolean;
  isSaving: boolean;
  draft: PlayerProfileState;
  formErrors: FormErrors;
  saveError: string;
  completionPreview: { completionPercentage: number; missingFields: string[]; profileCompleted: boolean };
  displayUsername: string;
  displayName: string;
  onClose: () => void;
  onSave: () => void;
  onFieldChange: <K extends keyof PlayerProfileState>(key: K, value: PlayerProfileState[K]) => void;
}

const EDUCATION_OPTIONS = ["School", "College", "University", "Academy", "Other"];
const ROLE_OPTIONS = ["Batsman", "Bowler", "All-Rounder", "Wicketkeeper"];
const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Advanced", "Professional"];
const FORMAT_OPTIONS = ["T20", "ODI", "Test", "T10", "All Formats"];
const BATTING_OPTIONS = ["Right Hand", "Left Hand"];
const BOWLING_ARM_OPTIONS = ["Right Arm", "Left Arm"];
const BOWLING_TYPE_OPTIONS = ["Fast", "Fast Medium", "Medium Pace", "Off Spin", "Leg Spin", "Left Arm Orthodox", "Left Arm Chinaman"];

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      {children}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </label>
  );
}

function inputClass(hasError: boolean) {
  return `w-full rounded-2xl border bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition ${hasError ? "border-rose-400/50 focus:border-rose-300" : "border-white/10 focus:border-blue-400/50"}`;
}

function SelectField({ label, value, error, placeholder, options, onChange }: {
  label: string; value: string; error?: string; placeholder: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <Field label={label} error={error}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass(Boolean(error))}>
        <option value="" className="bg-slate-950">{placeholder}</option>
        {options.map((o) => <option key={o} value={o} className="bg-slate-950">{o}</option>)}
      </select>
    </Field>
  );
}

export default function ProfileForm({ isOpen, isSaving, draft, formErrors, saveError, completionPreview, displayUsername, displayName, onClose, onSave, onFieldChange }: Props) {
  const role = draft.cricketRole.trim().toUpperCase();
  const needsBattingHand = ["BATSMAN", "WICKETKEEPER", "WICKET KEEPER", "KEEPER", "ALL-ROUNDER", "ALL ROUNDER", "ALLROUNDER"].includes(role);
  const needsBowlingDetails = ["BOWLER", "ALL-ROUNDER", "ALL ROUNDER", "ALLROUNDER"].includes(role);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] bg-slate-950/75 p-4 backdrop-blur-md" onClick={onClose}>
          <div className="fixed left-1/2 top-1/2 w-[min(90vw,1000px)] -translate-x-1/2 -translate-y-1/2">
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ duration: 0.2 }}
              className="max-h-[90vh] overflow-y-auto rounded-[32px] border border-white/10 bg-[#07111f] p-6 shadow-[0_24px_120px_rgba(2,6,23,0.58)]"
              onClick={(e) => e.stopPropagation()}>

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Player Profile</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Edit {displayName || "Player"} profile</h2>
                  <p className="mt-2 text-sm text-slate-400">Handle: <span className="text-slate-200">{draft.username || displayUsername}</span></p>
                </div>
                <button type="button" onClick={onClose} disabled={isSaving}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:text-white disabled:opacity-50">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
                <div className="space-y-6">
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <h3 className="text-lg font-semibold text-white">Identity</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Full Name" error={formErrors.fullName}>
                        <input value={draft.fullName} onChange={(e) => onFieldChange("fullName", e.target.value)} className={inputClass(Boolean(formErrors.fullName))} placeholder="Your full name" />
                      </Field>
                      <Field label="Username" error={formErrors.username}>
                        <input value={draft.username} onChange={(e) => onFieldChange("username", e.target.value)} className={inputClass(Boolean(formErrors.username))} placeholder="@player" />
                      </Field>
                      <Field label="Profile Photo URL" error={formErrors.avatar}>
                        <input value={draft.avatar} onChange={(e) => onFieldChange("avatar", e.target.value)} className={inputClass(Boolean(formErrors.avatar))} placeholder="https://..." />
                      </Field>
                      <Field label="Age" error={formErrors.age}>
                        <input value={draft.age} onChange={(e) => onFieldChange("age", e.target.value.replace(/[^\d]/g, ""))} className={inputClass(Boolean(formErrors.age))} inputMode="numeric" placeholder="18" />
                      </Field>
                      <SelectField label="Gender" value={draft.gender} error={formErrors.gender} placeholder="Select gender" options={["Male", "Female", "Other", "Prefer not to say"]} onChange={(v) => onFieldChange("gender", v)} />
                      <Field label="Country" error={formErrors.country}>
                        <input value={draft.country} onChange={(e) => onFieldChange("country", e.target.value)} className={inputClass(Boolean(formErrors.country))} placeholder="Country" />
                      </Field>
                      <Field label="City" error={formErrors.city}>
                        <input value={draft.city} onChange={(e) => onFieldChange("city", e.target.value)} className={inputClass(Boolean(formErrors.city))} placeholder="City" />
                      </Field>
                      <Field label="State" error={formErrors.state}>
                        <input value={draft.state} onChange={(e) => onFieldChange("state", e.target.value)} className={inputClass(Boolean(formErrors.state))} placeholder="State" />
                      </Field>
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <h3 className="text-lg font-semibold text-white">Cricket Background</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <SelectField label="Cricket Role" value={draft.cricketRole} error={formErrors.cricketRole} placeholder="Select role" options={ROLE_OPTIONS} onChange={(v) => onFieldChange("cricketRole", v)} />
                      <SelectField label="Experience Level" value={draft.experienceLevel} error={formErrors.experienceLevel} placeholder="Select experience" options={EXPERIENCE_OPTIONS} onChange={(v) => onFieldChange("experienceLevel", v)} />
                      <SelectField label="Preferred Format" value={draft.preferredFormat} error={formErrors.preferredFormat} placeholder="Select format" options={FORMAT_OPTIONS} onChange={(v) => onFieldChange("preferredFormat", v)} />
                      <SelectField label="Education Type" value={draft.educationType} error={formErrors.educationType} placeholder="Select education" options={EDUCATION_OPTIONS} onChange={(v) => onFieldChange("educationType", v)} />
                      {draft.educationType && (
                        <Field label="Institution Name" error={formErrors.institutionName}>
                          <input value={draft.institutionName} onChange={(e) => onFieldChange("institutionName", e.target.value)} className={inputClass(Boolean(formErrors.institutionName))} placeholder="Institution name" />
                        </Field>
                      )}
                      <Field label="Cricket Club" error={formErrors.hasCricketClub}>
                        <select value={draft.hasCricketClub === null ? "" : draft.hasCricketClub ? "yes" : "no"}
                          onChange={(e) => onFieldChange("hasCricketClub", e.target.value === "" ? null : e.target.value === "yes")}
                          className={inputClass(Boolean(formErrors.hasCricketClub))}>
                          <option value="" className="bg-slate-950">Select option</option>
                          <option value="yes" className="bg-slate-950">Yes</option>
                          <option value="no" className="bg-slate-950">No</option>
                        </select>
                      </Field>
                      {draft.hasCricketClub && (
                        <Field label="Cricket Club Name" error={formErrors.cricketClubName}>
                          <input value={draft.cricketClubName} onChange={(e) => onFieldChange("cricketClubName", e.target.value)} className={inputClass(Boolean(formErrors.cricketClubName))} placeholder="Club name" />
                        </Field>
                      )}
                      {needsBattingHand && <SelectField label="Batting Hand" value={draft.battingHand} error={formErrors.battingHand} placeholder="Select batting hand" options={BATTING_OPTIONS} onChange={(v) => onFieldChange("battingHand", v)} />}
                      {needsBowlingDetails && <SelectField label="Bowling Arm" value={draft.bowlingArm} error={formErrors.bowlingArm} placeholder="Select bowling arm" options={BOWLING_ARM_OPTIONS} onChange={(v) => onFieldChange("bowlingArm", v)} />}
                      {needsBowlingDetails && <SelectField label="Bowling Type" value={draft.bowlingType} error={formErrors.bowlingType} placeholder="Select bowling type" options={BOWLING_TYPE_OPTIONS} onChange={(v) => onFieldChange("bowlingType", v)} />}
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <h3 className="text-lg font-semibold text-white">Bio</h3>
                    <div className="mt-4">
                      <Field label="Player Bio" error={formErrors.bio}>
                        <textarea value={draft.bio} onChange={(e) => onFieldChange("bio", e.target.value)} className={`${inputClass(Boolean(formErrors.bio))} min-h-32 resize-y`} placeholder="Describe your game, strengths, and goals." />
                      </Field>
                    </div>
                  </section>
                </div>

                <aside className="space-y-6">
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Completion Preview</p>
                    <p className="mt-3 text-4xl font-semibold text-white">{completionPreview.completionPercentage}%</p>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all" style={{ width: `${completionPreview.completionPercentage}%` }} />
                    </div>
                    {completionPreview.missingFields.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {completionPreview.missingFields.map((item) => (
                          <span key={item} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">{item}</span>
                        ))}
                      </div>
                    )}
                  </section>

                  {saveError && (
                    <section className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{saveError}</section>
                  )}
                </aside>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} disabled={isSaving}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/[0.04] disabled:opacity-50">Cancel</button>
                <button type="button" onClick={onSave} disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-3 text-sm font-semibold text-white hover:from-blue-600 hover:to-violet-700 disabled:opacity-70">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
