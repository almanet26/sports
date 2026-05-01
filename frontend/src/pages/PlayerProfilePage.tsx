import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { authService } from '../utils/auth';
import { authApi } from '../lib/api';
import { profileApi } from '../lib/api';
import { useAuthStore, useSubscriptionStore } from '../store/authStore';
import { TIER_HIERARCHY } from '../types/plans';

/* ── tiny toast helper ─────────────────────────────────────────── */
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-lg ${
        ok ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {msg}
    </motion.div>
  );
}

/* ── stat card ─────────────────────────────────────────────────── */
function StatCard({ label, value, unit }: { label: string; value: number | null | undefined; unit?: string }) {
  return (
    <div className="glass rounded-2xl p-4 border border-white/10 flex flex-col gap-1">
      <p className="text-xs text-white/50 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-white">
        {value != null ? `${value.toFixed(1)}${unit ?? ''}` : <span className="text-white/30 text-base">No data yet</span>}
      </p>
    </div>
  );
}

/* ── feature gate wrapper ─────────────────────────────────────── */
function PlatinumGate({ children }: { children: React.ReactNode }) {
  const subscriptionTier = useSubscriptionStore((s) => s.subscriptionTier);
  const isPlatinum = TIER_HIERARCHY[subscriptionTier] >= TIER_HIERARCHY['platinum'];
  if (isPlatinum) return <>{children}</>;
  return (
    <div className="glass rounded-2xl p-6 border border-amber-500/30 bg-amber-500/5 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
        <i className="fas fa-lock text-amber-400 text-lg" />
      </div>
      <p className="text-amber-400 font-semibold mb-1">Platinum Plan Required</p>
      <p className="text-white/50 text-sm">Upgrade to Platinum to control your scouting visibility and get discovered by academy coaches.</p>
    </div>
  );
}

export default function PlayerProfilePage() {
  const userProfile = authService.getUserProfile();
  const user = useAuthStore((s) => s.user);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  /* ── basic auth fields ── */
  const [authForm, setAuthForm] = useState({
    name: userProfile?.name || '',
    phone: userProfile?.phone || '',
    team: userProfile?.team || '',
    bio: userProfile?.profile_bio || '',
    gender: userProfile?.gender || '',
    jerseyNumber: String(userProfile?.jersey_number || ''),
  });

  /* ── scouting profile fields ── */
  const [profile, setProfile] = useState({
    display_name: '',
    city: '',
    state: '',
    age: '',
    bat_style: '',
    bowl_style: '',
    cricket_role: '',
    experience_level: '',
    preferred_format: '',
    profile_image_url: '',
  });

  /* ── scouting stats (read-only, from server) ── */
  const [stats, setStats] = useState<{
    avg_bat_speed: number | null;
    peak_bat_speed: number | null;
    avg_wrist_speed: number | null;
    avg_release_height: number | null;
    best_front_knee_angle: number | null;
    best_shoulder_rotation: number | null;
    best_elbow_angle: number | null;
    best_release_consistency: number | null;
    total_analyses: number;
    analyses_last_updated: string | null;
    scouting_visible: boolean;
  }>({
    avg_bat_speed: null, peak_bat_speed: null, avg_wrist_speed: null,
    avg_release_height: null, best_front_knee_angle: null, best_shoulder_rotation: null,
    best_elbow_angle: null, best_release_consistency: null,
    total_analyses: 0, analyses_last_updated: null, scouting_visible: false,
  });

  const [scoutingLoading, setScoutingLoading] = useState(false);
  const [, setProfileLoaded] = useState(false);

  /* ── load existing scouting profile ── */
  useEffect(() => {
    if (!user?.id) return;
    profileApi.getPublic(user.id)
      .then(({ data }) => {
        setProfile({
          display_name: data.display_name || '',
          city: data.city || '',
          state: data.state || '',
          age: data.age ? String(data.age) : '',
          bat_style: data.bat_style || '',
          bowl_style: data.bowl_style || '',
          cricket_role: data.cricket_role || '',
          experience_level: data.experience_level || '',
          preferred_format: data.preferred_format || '',
          profile_image_url: data.profile_image_url || '',
        });
        setStats({
          avg_bat_speed: data.stats?.avg_bat_speed ?? null,
          peak_bat_speed: data.stats?.peak_bat_speed ?? null,
          avg_wrist_speed: data.stats?.avg_wrist_speed ?? null,
          avg_release_height: data.stats?.avg_release_height ?? null,
          best_front_knee_angle: data.stats?.best_front_knee_angle ?? null,
          best_shoulder_rotation: data.stats?.best_shoulder_rotation ?? null,
          best_elbow_angle: data.stats?.best_elbow_angle ?? null,
          best_release_consistency: data.stats?.best_release_consistency ?? null,
          total_analyses: data.total_analyses ?? 0,
          analyses_last_updated: data.analyses_last_updated ?? null,
          scouting_visible: true,
        });
      })
      .catch(() => { /* profile not public yet, that's fine */ })
      .finally(() => setProfileLoaded(true));
  }, [user?.id]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── save basic auth profile ── */
  const handleSaveAuth = async () => {
    setSaving(true);
    try {
      await authApi.updateProfile({
        name: authForm.name,
        phone: authForm.phone,
        team: authForm.team,
        profile_bio: authForm.bio,
        gender: authForm.gender,
      });
      const updated = { ...userProfile, ...authForm };
      localStorage.setItem('user_profile', JSON.stringify(updated));
      setIsEditing(false);
      showToast('Profile updated');
    } catch {
      showToast('Failed to save profile', false);
    } finally {
      setSaving(false);
    }
  };

  /* ── save cricket profile ── */
  const [savingCricket, setSavingCricket] = useState(false);
  const handleSaveCricket = async () => {
    setSavingCricket(true);
    try {
      await profileApi.setup({
        display_name: profile.display_name || undefined,
        city: profile.city || undefined,
        state: profile.state || undefined,
        age: profile.age ? parseInt(profile.age) : undefined,
        bat_style: profile.bat_style || undefined,
        bowl_style: profile.bowl_style || undefined,
        cricket_role: profile.cricket_role as 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper' || undefined,
        experience_level: profile.experience_level as 'beginner' | 'intermediate' | 'advanced' | 'professional' || undefined,
        preferred_format: profile.preferred_format as 'T20' | 'ODI' | 'Test' | 'All' || undefined,
        profile_image_url: profile.profile_image_url || undefined,
      });
      showToast('Cricket profile saved');
    } catch {
      showToast('Failed to save cricket profile', false);
    } finally {
      setSavingCricket(false);
    }
  };

  /* ── scouting toggle ── */
  const handleToggleScouting = async (visible: boolean) => {
    setScoutingLoading(true);
    try {
      const { data } = await profileApi.toggleScouting(visible);
      setStats((s) => ({ ...s, scouting_visible: data.scouting_visible }));
      showToast(data.message);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.error === 'profile_incomplete') {
        showToast(`Complete your profile first: ${detail.missing?.join(', ')}`, false);
      } else {
        showToast('Failed to update scouting visibility', false);
      }
    } finally {
      setScoutingLoading(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent';
  const selectCls = `${inputCls} [&>option]:bg-gray-900`;
  const labelCls = 'block text-sm font-medium text-white/60 mb-2';

  return (
    <div className="text-white max-w-4xl mx-auto space-y-6">
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="glass rounded-3xl p-6 border border-white/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-user-cog text-blue-400" /> My Profile
            </h1>
            <p className="text-white/60 mt-1 text-sm">Manage your personal info, cricket profile, and scouting visibility</p>
          </div>
        </div>
      </motion.div>

      {/* ══════════════════ SECTION 1 — Personal Info ══════════════════ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass rounded-3xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <i className="fas fa-id-card text-purple-400" /> Personal Information
          </h2>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)}
              className="px-4 py-2 glass border border-white/20 hover:bg-white/10 text-white rounded-xl font-medium transition-all flex items-center gap-2">
              <i className="fas fa-edit" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)}
                className="px-4 py-2 glass border border-white/20 hover:bg-white/10 text-white rounded-xl font-medium transition-all">
                Cancel
              </button>
              <button onClick={handleSaveAuth} disabled={saving}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50">
                {saving ? <i className="fas fa-spinner animate-spin" /> : <i className="fas fa-save" />}
                Save
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold flex-shrink-0">
            {authForm.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-xl font-semibold">{authForm.name}</p>
            <p className="text-white/50 text-sm">{userProfile?.email}</p>
            <span className="inline-block mt-1 px-3 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-full text-xs font-semibold">
              <i className="fas fa-running mr-1" /> PLAYER
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'name', label: 'Full Name', type: 'text', locked: true },
            { key: 'phone', label: 'Phone', type: 'tel' },
            { key: 'team', label: 'Team', type: 'text' },
            { key: 'jerseyNumber', label: 'Jersey Number', type: 'number' },
          ].map(({ key, label, type, locked }) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              {isEditing && !locked ? (
                <input type={type} value={(authForm as any)[key]}
                  onChange={(e) => setAuthForm({ ...authForm, [key]: e.target.value })}
                  className={inputCls} />
              ) : (
                <p className="glass rounded-xl px-4 py-3 border border-white/10 text-white">
                  {(authForm as any)[key] || <span className="text-white/30">Not provided</span>}
                </p>
              )}
              {locked && <p className="text-xs text-white/30 mt-1">Cannot be changed</p>}
            </div>
          ))}

          <div>
            <label className={labelCls}>Gender</label>
            {isEditing ? (
              <select value={authForm.gender} onChange={(e) => setAuthForm({ ...authForm, gender: e.target.value })} className={selectCls}>
                <option value="">Select Gender</option>
                {['Male', 'Female', 'Other', 'Prefer not to say'].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            ) : (
              <p className="glass rounded-xl px-4 py-3 border border-white/10">{authForm.gender || <span className="text-white/30">Not provided</span>}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Bio</label>
            {isEditing ? (
              <textarea value={authForm.bio} onChange={(e) => setAuthForm({ ...authForm, bio: e.target.value })}
                rows={3} className={`${inputCls} resize-none`} />
            ) : (
              <p className="glass rounded-xl px-4 py-3 border border-white/10 min-h-[70px]">{authForm.bio || <span className="text-white/30">No bio provided</span>}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ══════════════════ SECTION 2 — Cricket Profile ══════════════════ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass rounded-3xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <i className="fas fa-cricket text-green-400" /> Cricket Profile
          </h2>
          <button onClick={handleSaveCricket} disabled={savingCricket}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50">
            {savingCricket ? <i className="fas fa-spinner animate-spin" /> : <i className="fas fa-save" />}
            Save Cricket Profile
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Display Name <span className="text-amber-400">*</span></label>
            <input type="text" value={profile.display_name} placeholder="Name shown to coaches"
              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Age</label>
            <input type="number" min={10} max={50} value={profile.age}
              onChange={(e) => setProfile({ ...profile, age: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input type="text" value={profile.city}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <input type="text" value={profile.state}
              onChange={(e) => setProfile({ ...profile, state: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cricket Role <span className="text-amber-400">*</span></label>
            <select value={profile.cricket_role} onChange={(e) => setProfile({ ...profile, cricket_role: e.target.value })} className={selectCls}>
              <option value="">Select Role</option>
              <option value="batsman">Batsman</option>
              <option value="bowler">Bowler</option>
              <option value="all_rounder">All-rounder</option>
              <option value="wicket_keeper">Wicket-keeper</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Experience Level</label>
            <select value={profile.experience_level} onChange={(e) => setProfile({ ...profile, experience_level: e.target.value })} className={selectCls}>
              <option value="">Select Level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="professional">Professional</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Preferred Format</label>
            <select value={profile.preferred_format} onChange={(e) => setProfile({ ...profile, preferred_format: e.target.value })} className={selectCls}>
              <option value="">Select Format</option>
              <option value="T20">T20</option>
              <option value="ODI">ODI</option>
              <option value="Test">Test</option>
              <option value="All">All Formats</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Batting Style</label>
            <select value={profile.bat_style} onChange={(e) => setProfile({ ...profile, bat_style: e.target.value })} className={selectCls}>
              <option value="">Select Style</option>
              <option value="right_hand">Right-hand</option>
              <option value="left_hand">Left-hand</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Bowling Style</label>
            <select value={profile.bowl_style} onChange={(e) => setProfile({ ...profile, bowl_style: e.target.value })} className={selectCls}>
              <option value="">Select Style</option>
              <option value="right_arm_fast">Right-arm Fast</option>
              <option value="right_arm_medium">Right-arm Medium</option>
              <option value="right_arm_spin">Right-arm Spin (Off-break)</option>
              <option value="leg_break">Leg-break</option>
              <option value="left_arm_fast">Left-arm Fast</option>
              <option value="left_arm_spin">Left-arm Spin</option>
              <option value="none">Does not bowl</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* ══════════════════ SECTION 3 — Verified Stats (read-only) ══════════════════ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="glass rounded-3xl p-6 border border-white/20">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
          <i className="fas fa-chart-bar text-blue-400" /> Verified Performance Stats
        </h2>
        <p className="text-white/50 text-sm mb-6">
          <i className="fas fa-info-circle mr-1 text-blue-400" />
          These stats are automatically computed from your analyses — you cannot edit them.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Avg Bat Speed" value={stats.avg_bat_speed} unit=" km/h" />
          <StatCard label="Peak Bat Speed" value={stats.peak_bat_speed} unit=" km/h" />
          <StatCard label="Avg Wrist Speed" value={stats.avg_wrist_speed} unit=" km/h" />
          <StatCard label="Avg Release Height" value={stats.avg_release_height} unit=" m" />
          <StatCard label="Best Knee Angle" value={stats.best_front_knee_angle} unit="°" />
          <StatCard label="Best Shoulder Rot." value={stats.best_shoulder_rotation} unit="°" />
          <StatCard label="Best Elbow Angle" value={stats.best_elbow_angle} unit="°" />
          <StatCard label="Release Consistency" value={stats.best_release_consistency} unit="%" />
        </div>
        <div className="flex items-center gap-6 text-sm text-white/50">
          <span><i className="fas fa-flask mr-1 text-blue-400" /> {stats.total_analyses} total analyses</span>
          <span><i className="fas fa-clock mr-1 text-blue-400" />
            {stats.analyses_last_updated
              ? `Last updated ${new Date(stats.analyses_last_updated).toLocaleDateString()}`
              : 'Never updated'}
          </span>
        </div>
      </motion.div>

      {/* ══════════════════ SECTION 4 — Scouting Visibility ══════════════════ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="glass rounded-3xl p-6 border border-white/20">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
          <i className="fas fa-eye text-amber-400" /> Scouting Visibility
        </h2>
        <p className="text-white/50 text-sm mb-6">Control whether academy coaches can discover your profile in the scouting directory.</p>
        <PlatinumGate>
          <div className={`rounded-2xl p-5 border transition-all ${
            stats.scouting_visible
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-white/10 bg-white/5'
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white mb-1">
                  {stats.scouting_visible ? '👁 Visible to coaches' : '🔒 Profile is private'}
                </p>
                <p className="text-sm text-white/50">
                  {stats.scouting_visible
                    ? 'Academy coaches can find and view your profile in the scouting directory.'
                    : 'Your profile is hidden. No coaches can discover you through scouting.'}
                </p>
              </div>
              <button
                onClick={() => handleToggleScouting(!stats.scouting_visible)}
                disabled={scoutingLoading}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 flex-shrink-0 ${
                  stats.scouting_visible ? 'bg-emerald-500' : 'bg-white/20'
                } disabled:opacity-50`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-all duration-300 ${
                  stats.scouting_visible ? 'translate-x-7' : 'translate-x-0'
                }`} />
              </button>
            </div>
            {stats.scouting_visible && (
              <div className="mt-4 pt-4 border-t border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-400">
                <i className="fas fa-check-circle" />
                Your verified stats and cricket profile are visible to academy coaches.
              </div>
            )}
          </div>
        </PlatinumGate>
      </motion.div>
    </div>
  );
}
