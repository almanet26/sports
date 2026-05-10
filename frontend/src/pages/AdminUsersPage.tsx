import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi, api, resolveMediaUrl } from '../lib/api';
import { useThemeStore } from '../store/themeStore';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  last_login: string | null;
  subscription_tier: string;
  subscription_status: string;
  subscription_plan_key: string | null;
  subscription_expires_at: string | null;
}

interface SubEditState {
  plan_key: string;
  status: string;
  expires_at: string;
}

const PLAN_KEYS = [
  'free', 'basic_90d', 'platinum_180d',
  'coach_starter_180d', 'coach_pro_365d', 'academy_365d',
];

const roleBadge: Record<string, string> = {
  ADMIN:  'from-red-500/20 to-orange-500/20 text-red-400 border-red-500/30',
  COACH:  'from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30',
  PLAYER: 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30',
};

const statusBadge: Record<string, string> = {
  active:   'bg-green-500/20 text-green-400 border-green-500/30',
  expired:  'bg-red-500/20 text-red-400 border-red-500/30',
  past_due: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  inactive: 'bg-white/10 text-white/40 border-white/20',
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  phone?: string;
  team?: string;
  profile_bio?: string;
  gender?: string;
  jersey_number?: number;
  coach_status?: string;
  coach_category?: string;
  years_of_experience?: number;
  date_of_birth?: string;
  specialization?: string[];
  certifications?: Array<{ name: string; issuer: string; year: string }>;
  subscription_plan?: string;
  intro_video_url?: string;
  profile_image_url?: string;
  // Player
  submissions?: Array<{ id: string; analysis_type: string; status: string; coach_name?: string; created_at?: string; pdf_report_url?: string }>;
  // Coach
  submissions_received?: Array<{ id: string; analysis_type: string; status: string; player_name?: string; created_at?: string }>;
  reviews?: Array<{ player_name: string; rating: number; comment?: string; created_at?: string }>;
  average_rating?: number;
  total_reviews?: number;
}

function ProfileModal({ userId, onClose, theme }: { userId: string; onClose: () => void; theme: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profile' | 'activity'>('profile');

  useEffect(() => {
    api.get(`/admin/users/${userId}`)
      .then(r => setProfile(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const sub = theme === 'dark' ? 'text-white/40' : 'text-slate-400';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-slate-50/80 border-slate-200/60';
  const val = theme === 'dark' ? 'text-white' : 'text-slate-800';

  const Field = ({ label, value }: { label: string; value: any }) =>
    value ? (
      <div>
        <p className={`text-xs mb-0.5 ${sub}`}>{label}</p>
        <p className={`text-sm font-medium ${val}`}>{value}</p>
      </div>
    ) : null;

  const statusColor = (s: string) => {
    if (['PUBLISHED', 'verified', 'Active'].includes(s)) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (['PENDING', 'pending'].includes(s)) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (['PROCESSING', 'DRAFT_REVIEW'].includes(s)) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    return 'bg-white/10 text-white/50 border-white/20';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl ${
          theme === 'dark' ? 'glass border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b backdrop-blur-md ${
          theme === 'dark' ? 'border-white/10 bg-black/20' : 'border-slate-200/60 bg-white/80'
        }`}>
          <h2 className="text-xl font-bold gradient-text">User Profile</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass border border-white/20 flex items-center justify-center hover:bg-white/10 transition-all">
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : profile ? (
            <div className="space-y-5">
              {/* Avatar + basic */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                  {profile.profile_image_url
                    ? <img src={profile.profile_image_url} alt={profile.name} className="w-full h-full object-cover" />
                    : profile.name.charAt(0).toUpperCase()
                  }
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold">{profile.name}</p>
                  <p className={`text-sm ${sub}`}>{profile.email}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      profile.role === 'COACH' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      profile.role === 'ADMIN' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    }`}>{profile.role}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      profile.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>{profile.is_active ? 'Active' : 'Suspended'}</span>
                    {profile.coach_status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(profile.coach_status)}`}>
                        {profile.coach_status}
                      </span>
                    )}
                    {profile.subscription_plan && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-400 border-purple-500/30">
                        {profile.subscription_plan}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className={`flex gap-1 p-1 rounded-xl w-fit ${ theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                {(['profile', 'activity'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                      tab === t ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' : `${sub} hover:text-white`
                    }`}>{t}</button>
                ))}
              </div>

              {tab === 'profile' && (
                <>
                  {/* Personal Info */}
                  <div className={`rounded-2xl p-4 border ${cardBg}`}>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <i className="fas fa-user text-blue-400"></i> Personal Info
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Phone" value={profile.phone} />
                      <Field label="Gender" value={profile.gender} />
                      <Field label="Team" value={profile.team} />
                      <Field label="Jersey #" value={profile.jersey_number} />
                      <Field label="Date of Birth" value={profile.date_of_birth} />
                      <Field label="Joined" value={new Date(profile.created_at).toLocaleDateString()} />
                      <Field label="Last Login" value={profile.last_login ? new Date(profile.last_login).toLocaleDateString() : 'Never'} />
                    </div>
                    {profile.profile_bio && (
                      <div className="mt-3">
                        <p className={`text-xs mb-0.5 ${sub}`}>Bio</p>
                        <p className={`text-sm ${val}`}>{profile.profile_bio}</p>
                      </div>
                    )}
                  </div>

                  {/* Coach Details */}
                  {profile.role === 'COACH' && (
                    <div className={`rounded-2xl p-4 border ${cardBg}`}>
                      <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <i className="fas fa-chalkboard-teacher text-green-400"></i> Coach Details
                      </p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <Field label="Category" value={profile.coach_category} />
                        <Field label="Experience" value={profile.years_of_experience ? `${profile.years_of_experience} years` : null} />
                        <Field label="Avg Rating" value={profile.average_rating ? `${profile.average_rating} ⭐ (${profile.total_reviews} reviews)` : null} />
                      </div>
                      {profile.specialization?.length ? (
                        <div className="mb-3">
                          <p className={`text-xs mb-1 ${sub}`}>Specialization</p>
                          <div className="flex flex-wrap gap-1">
                            {profile.specialization.map(s => (
                              <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">{s}</span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {profile.certifications?.length ? (
                        <div>
                          <p className={`text-xs mb-1 ${sub}`}>Certifications</p>
                          <div className="space-y-1">
                            {profile.certifications.map((c, i) => (
                              <p key={i} className={`text-xs ${val}`}>{c.name} — {c.issuer} ({c.year})</p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {profile.intro_video_url && (
                        <div className="mt-3">
                          <p className={`text-xs mb-1 ${sub}`}>Intro Video</p>
                          <video
                            controls
                            className="w-full rounded-xl max-h-48 bg-black"
                            src={resolveMediaUrl(profile.intro_video_url)}
                            onError={e => {
                              const el = e.currentTarget.parentElement;
                              if (el) el.innerHTML = '<p class="text-xs text-yellow-400 mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>Video file not found on server.</p>';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {tab === 'activity' && (
                <>
                  {/* Player submissions */}
                  {profile.role === 'PLAYER' && (
                    <div className={`rounded-2xl p-4 border ${cardBg}`}>
                      <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <i className="fas fa-paper-plane text-blue-400"></i>
                        Submissions ({profile.submissions?.length || 0})
                      </p>
                      {!profile.submissions?.length ? (
                        <p className={`text-sm ${sub}`}>No submissions yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {profile.submissions.map(s => (
                            <div key={s.id} className={`flex items-center justify-between p-3 rounded-xl border ${
                              theme === 'dark' ? 'border-white/5 bg-white/3' : 'border-slate-200 bg-white'
                            }`}>
                              <div>
                                <p className={`text-xs font-medium ${val}`}>{s.analysis_type} Analysis</p>
                                <p className={`text-xs ${sub}`}>
                                  Coach: {s.coach_name || 'N/A'} · {s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(s.status)}`}>{s.status}</span>
                                {s.pdf_report_url && (
                                  <a href={s.pdf_report_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-300">
                                    <i className="fas fa-file-pdf"></i>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Coach submissions received */}
                  {profile.role === 'COACH' && (
                    <div className={`rounded-2xl p-4 border ${cardBg}`}>
                      <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <i className="fas fa-inbox text-green-400"></i>
                        Submissions Received ({profile.submissions_received?.length || 0})
                      </p>
                      {!profile.submissions_received?.length ? (
                        <p className={`text-sm ${sub}`}>No submissions received yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {profile.submissions_received.map(s => (
                            <div key={s.id} className={`flex items-center justify-between p-3 rounded-xl border ${
                              theme === 'dark' ? 'border-white/5 bg-white/3' : 'border-slate-200 bg-white'
                            }`}>
                              <div>
                                <p className={`text-xs font-medium ${val}`}>{s.analysis_type} — {s.player_name || 'Unknown'}</p>
                                <p className={`text-xs ${sub}`}>{s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}</p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(s.status)}`}>{s.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Coach reviews */}
                  {profile.role === 'COACH' && (
                    <div className={`rounded-2xl p-4 border ${cardBg}`}>
                      <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <i className="fas fa-star text-yellow-400"></i>
                        Reviews ({profile.reviews?.length || 0})
                        {profile.average_rating ? <span className="text-yellow-400 font-bold">{profile.average_rating} ⭐</span> : null}
                      </p>
                      {!profile.reviews?.length ? (
                        <p className={`text-sm ${sub}`}>No reviews yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {profile.reviews.map((r, i) => (
                            <div key={i} className={`p-3 rounded-xl border ${
                              theme === 'dark' ? 'border-white/5 bg-white/3' : 'border-slate-200 bg-white'
                            }`}>
                              <div className="flex items-center justify-between mb-1">
                                <p className={`text-xs font-medium ${val}`}>{r.player_name}</p>
                                <div className="flex gap-0.5">
                                  {[1,2,3,4,5].map(s => (
                                    <i key={s} className={`fas fa-star text-[10px] ${r.rating >= s ? 'text-yellow-400' : sub}`}></i>
                                  ))}
                                </div>
                              </div>
                              {r.comment && <p className={`text-xs ${sub}`}>{r.comment}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="text-center py-8 text-white/50">Failed to load profile</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { theme } = useThemeStore();
  const navigate = useNavigate();

  const [users, setUsers]       = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter]   = useState('');
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]       = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Subscription edit modal
  const [editTarget, setEditTarget]   = useState<UserRow | null>(null);
  const [subEdit, setSubEdit]         = useState<SubEditState>({ plan_key: 'free', status: 'active', expires_at: '' });
  const [savingSub, setSavingSub]     = useState(false);
  const [subError, setSubError]       = useState<string | null>(null);

  // Impersonation banner
  const [impersonating, setImpersonating] = useState<{ name: string; token: string } | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listUsers({
        page,
        per_page: 20,
        search: search || undefined,
        role: roleFilter || undefined,
        subscription_status: statusFilter || undefined,
        plan: planFilter || undefined,
      });
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch {
      showToast('Failed to fetch users', false);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter, planFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openSubEdit(user: UserRow) {
    setEditTarget(user);
    setSubEdit({
      plan_key: user.subscription_plan_key ?? 'free',
      status: user.subscription_status ?? 'active',
      expires_at: user.subscription_expires_at
        ? user.subscription_expires_at.slice(0, 16)
        : '',
    });
    setSubError(null);
  }

  async function saveSub() {
    if (!editTarget) return;
    setSavingSub(true);
    setSubError(null);
    try {
      await adminApi.overrideSubscription(editTarget.id, {
        plan_key: subEdit.plan_key,
        status: subEdit.status,
        expires_at: subEdit.expires_at ? new Date(subEdit.expires_at).toISOString() : undefined,
      });
      setEditTarget(null);
      showToast('Subscription updated', true);
      fetchUsers();
    } catch (err: unknown) {
      const detail =
        typeof err === 'object' && err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : undefined;
      setSubError(typeof detail === 'string' ? detail : 'Save failed');
    } finally {
      setSavingSub(false);
    }
  }

  async function handleImpersonate(user: UserRow) {
    try {
      const { data } = await adminApi.impersonateUser(user.id);
      sessionStorage.setItem('impersonation_token', data.access_token);
      sessionStorage.setItem('impersonation_target', JSON.stringify(data.target_user));
      setImpersonating({ name: data.target_user.name, token: data.access_token });
      // Redirect to their dashboard
      const path = data.target_user.role === 'COACH' ? '/coach' : '/player';
      navigate(path);
    } catch (err: unknown) {
      const detail =
        typeof err === 'object' && err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : undefined;
      showToast(typeof detail === 'string' ? detail : 'Impersonation failed', false);
    }
  }

  function exitImpersonation() {
    sessionStorage.removeItem('impersonation_token');
    sessionStorage.removeItem('impersonation_target');
    setImpersonating(null);
    navigate('/admin/users');
  }

  const th = theme === 'dark';

  return (
    <div className={th ? 'text-white' : 'text-gray-900'}>
      <AnimatePresence>
        {selectedUserId && (
          <ProfileModal
            userId={selectedUserId}
            onClose={() => setSelectedUserId(null)}
            theme={theme}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
            toast.ok ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </motion.div>
      )}

      {/* Impersonation banner */}
      {impersonating && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-black px-6 py-2 flex items-center justify-between text-sm font-medium">
          <span><i className="fas fa-user-secret mr-2"></i>Impersonating <strong>{impersonating.name}</strong></span>
          <button onClick={exitImpersonation} className="px-3 py-1 bg-black/20 hover:bg-black/30 rounded-lg transition-all">
            Exit Impersonation
          </button>
        </div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 mb-8 border ${th ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-users text-blue-400"></i>
          User Management
        </h1>
        <p className={`mt-1 text-sm ${th ? 'text-white/60' : 'text-gray-500'}`}>
          {total} users · Search, filter, edit subscriptions, impersonate
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`rounded-3xl p-5 mb-6 border ${th ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Search', type: 'text', value: search,
              onChange: (v: string) => { setSearch(v); setPage(1); },
              placeholder: 'Name or email…',
            },
          ].map((f) => (
            <div key={f.label}>
              <label className={`block text-xs font-medium mb-1 ${th ? 'text-white/50' : 'text-gray-500'}`}>{f.label}</label>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                placeholder={f.placeholder}
                className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:border-blue-500 ${
                  th ? 'glass border-white/20 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>
          ))}

          <div>
            <label className={`block text-xs font-medium mb-1 ${th ? 'text-white/50' : 'text-gray-500'}`}>Account Type</label>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:border-blue-500 ${
                th ? 'glass border-white/20 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            >
              <option value="">All Types</option>
              <option value="PLAYER">Player</option>
              <option value="COACH">Coach</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${th ? 'text-white/50' : 'text-gray-500'}`}>Subscription Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:border-blue-500 ${
                th ? 'glass border-white/20 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="past_due">Past Due</option>
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${th ? 'text-white/50' : 'text-gray-500'}`}>Plan</label>
            <select
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
              className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:border-blue-500 ${
                th ? 'glass border-white/20 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            >
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="platinum">Platinum</option>
              <option value="coach_starter">Coach Starter</option>
              <option value="coach_pro">Coach Pro</option>
              <option value="academy">Academy</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPlanFilter(''); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              th ? 'glass border-white/20 hover:bg-white/10 text-white/60' : 'bg-gray-50 border-gray-300 hover:bg-gray-100 text-gray-600'
            }`}
          >
            <i className="fas fa-redo mr-1"></i>Reset
          </button>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-3xl p-6 border ${th ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <i className={`fas fa-users text-4xl mb-3 ${th ? 'text-white/20' : 'text-gray-300'}`}></i>
            <p className={th ? 'text-white/50' : 'text-gray-500'}>No users found</p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className={`hidden lg:grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-4 px-4 pb-3 text-xs font-medium uppercase tracking-wide ${th ? 'text-white/40' : 'text-gray-400'} border-b ${th ? 'border-white/10' : 'border-gray-200'}`}>
              <span>User</span>
              <span>Email</span>
              <span>Role</span>
              <span>Plan / Status</span>
              <span>Expires / Joined</span>
              <span>Actions</span>
            </div>

            <div className="space-y-2 mt-3">
              {users.map((user, i) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`rounded-2xl p-4 border transition-all ${
                    th ? 'glass border-white/10 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="lg:grid lg:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] lg:gap-4 lg:items-center flex flex-wrap gap-3">
                    {/* Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium truncate">{user.name}</span>
                    </div>

                    {/* Email */}
                    <span className={`text-sm truncate ${th ? 'text-white/60' : 'text-gray-600'}`}>{user.email}</span>

                    {/* Role badge */}
                    <span className={`text-xs px-2 py-1 rounded-full border bg-gradient-to-r w-fit ${roleBadge[user.role] ?? roleBadge.PLAYER}`}>
                      {user.role}
                    </span>

                    {/* Plan / status */}
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs ${th ? 'text-white/60' : 'text-gray-600'}`}>{user.subscription_tier}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${statusBadge[user.subscription_status] ?? statusBadge.inactive}`}>
                        {user.subscription_status}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className={`text-xs ${th ? 'text-white/40' : 'text-gray-500'}`}>
                      <div>Exp: {fmt(user.subscription_expires_at)}</div>
                      <div>Joined: {fmt(user.created_at)}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openSubEdit(user)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-all"
                      >
                        <i className="fas fa-edit mr-1"></i>Edit Sub
                      </button>
                      {user.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleImpersonate(user)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition-all"
                        >
                          <i className="fas fa-user-secret mr-1"></i>Impersonate
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`px-4 py-2 rounded-xl border transition-all ${
                    page === 1
                      ? 'opacity-40 cursor-not-allowed'
                      : th ? 'glass border-white/20 hover:bg-white/10' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                <span className={`px-4 py-2 text-sm ${th ? 'text-white/60' : 'text-gray-600'}`}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`px-4 py-2 rounded-xl border transition-all ${
                    page === totalPages
                      ? 'opacity-40 cursor-not-allowed'
                      : th ? 'glass border-white/20 hover:bg-white/10' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Edit Subscription Modal */}
      <AnimatePresence>
        {editTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setEditTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-3xl border border-white/20 p-6 w-full max-w-md"
            >
              <h2 className="text-lg font-semibold text-white mb-1">Edit Subscription</h2>
              <p className="text-sm text-white/50 mb-5">{editTarget.name} · {editTarget.email}</p>

              {subError && (
                <p className="text-red-400 text-sm mb-4 flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i> {subError}
                </p>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Plan Key</label>
                  <select
                    value={subEdit.plan_key}
                    onChange={(e) => setSubEdit({ ...subEdit, plan_key: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white"
                  >
                    {PLAN_KEYS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-white/50 mb-1">Status</label>
                  <select
                    value={subEdit.status}
                    onChange={(e) => setSubEdit({ ...subEdit, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white"
                  >
                    <option value="active">active</option>
                    <option value="expired">expired</option>
                    <option value="past_due">past_due</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-white/50 mb-1">Expires At (optional)</label>
                  <input
                    type="datetime-local"
                    value={subEdit.expires_at}
                    onChange={(e) => setSubEdit({ ...subEdit, expires_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveSub}
                  disabled={savingSub}
                  className="flex-1 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 text-sm font-medium transition-all disabled:opacity-50"
                >
                  {savingSub ? <i className="fas fa-spinner fa-spin mr-1"></i> : null}
                  Save
                </button>
                <button
                  onClick={() => setEditTarget(null)}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 text-sm font-medium transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
