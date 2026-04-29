import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api, resolveMediaUrl } from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

interface UserProfile extends User {
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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [resetRequests, setResetRequests] = useState<{id:string;email:string;name:string;message?:string;created_at:string}[]>([]);
  const [newPassword, setNewPassword] = useState<Record<string,string>>({});

  useEffect(() => {
    fetchUsers();
    api.get('/admin/password-reset-requests')
      .then(r => setResetRequests(r.data.requests || []))
      .catch(() => {});
  }, [page, search, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        page: page.toString(),
        per_page: '20',
      };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.is_active = statusFilter;

      const response = await api.get('/admin/users', { params });
      setUsers(response.data.users);
      setTotal(response.data.total);
      setTotalPages(response.data.total_pages);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}`, { is_active: !currentStatus });
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      ADMIN: 'from-red-500/20 to-orange-500/20 text-red-400 border-red-500/30',
      COACH: 'from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30',
      PLAYER: 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30',
    };
    return colors[role as keyof typeof colors] || colors.PLAYER;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <AnimatePresence>
        {selectedUserId && (
          <ProfileModal
            userId={selectedUserId}
            onClose={() => setSelectedUserId(null)}
            theme={theme}
          />
        )}
      </AnimatePresence>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 mb-8 border ${
          theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-users text-blue-400"></i>
          User Management
        </h1>
        <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
          Manage all users, search, filter, and control account status
        </p>
      </motion.div>

      {/* Password Reset Requests */}
      {resetRequests.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className={`rounded-3xl p-6 mb-6 border ${
            theme === 'dark' ? 'glass border-red-500/30 bg-red-500/5' : 'bg-red-50 border-red-200'
          }`}>
          <h2 className="font-semibold mb-1 flex items-center gap-2 text-red-400">
            <i className="fas fa-key"></i> Password Reset Requests ({resetRequests.length})
          </h2>
          <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
            Set a new password and click Reset. The user will be notified via their dashboard bell icon.
          </p>
          <div className="space-y-3">
            {resetRequests.map(req => (
              <div key={req.id} className={`rounded-2xl p-4 border flex flex-wrap items-center gap-4 justify-between ${
                theme === 'dark' ? 'glass border-white/10' : 'bg-white border-red-100'
              }`}>
                <div>
                  <p className="font-medium text-sm">{req.name}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>{req.email}</p>
                  {req.message && <p className={`text-xs mt-1 italic ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>"{req.message}"</p>}
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
                    {new Date(req.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="New password"
                    value={newPassword[req.id] || ''}
                    onChange={e => setNewPassword(p => ({ ...p, [req.id]: e.target.value }))}
                    className={`px-3 py-2 rounded-xl border text-sm focus:outline-none w-36 ${
                      theme === 'dark' ? 'glass border-white/20 text-white' : 'bg-white border-gray-300'
                    }`}
                  />
                  <button
                    disabled={!newPassword[req.id] || newPassword[req.id].length < 6}
                    onClick={async () => {
                      try {
                        await api.post(`/admin/password-reset-requests/${req.id}/resolve`, { new_password: newPassword[req.id] });
                        setResetRequests(prev => prev.filter(r => r.id !== req.id));
                        setNewPassword(p => { const n = {...p}; delete n[req.id]; return n; });
                      } catch (e) { console.error(e); }
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-all">
                    <i className="fas fa-check mr-1"></i>Reset
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-3xl p-6 mb-6 border ${
          theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
              <i className="fas fa-search mr-1"></i> Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Name or email..."
              className={`w-full px-4 py-2 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'glass border-white/20 text-white focus:border-blue-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
              <i className="fas fa-user-tag mr-1"></i> Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className={`w-full px-4 py-2 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'glass border-white/20 text-white focus:border-blue-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none`}
            >
              <option value="">All Roles</option>
              <option value="PLAYER">Player</option>
              <option value="COACH">Coach</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
              <i className="fas fa-toggle-on mr-1"></i> Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className={`w-full px-4 py-2 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'glass border-white/20 text-white focus:border-blue-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none`}
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Suspended</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
            Showing {users.length} of {total} users
          </p>
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              theme === 'dark'
                ? 'glass border-white/20 hover:bg-white/10'
                : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
            }`}
          >
            <i className="fas fa-redo mr-1"></i> Reset Filters
          </button>
        </div>
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`rounded-3xl p-6 border ${
          theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-users text-4xl text-white/20 mb-4"></i>
            <p className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>No users found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl p-4 border transition-all ${
                  theme === 'dark'
                    ? 'glass border-white/10 hover:border-white/20'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full border bg-gradient-to-r ${getRoleBadge(user.role)}`}>
                      {user.role}
                    </span>
                    
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      user.is_active
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {user.is_active ? 'Active' : 'Suspended'}
                    </span>

                    <div className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                      <div>Joined: {formatDate(user.created_at)}</div>
                      <div>Last login: {formatDate(user.last_login)}</div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedUserId(user.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        theme === 'dark'
                          ? 'glass border border-white/20 hover:bg-white/10'
                          : 'bg-gray-100 border border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      <i className="fas fa-eye mr-1"></i>
                      View Profile
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleUserStatus(user.id, user.is_active)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        user.is_active
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                      }`}
                    >
                      <i className={`fas ${user.is_active ? 'fa-ban' : 'fa-check'} mr-1`}></i>
                      {user.is_active ? 'Suspend' : 'Activate'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-4 py-2 rounded-xl border transition-all ${
                page === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'glass border-white/20 hover:bg-white/10'
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
              }`}
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            
            <span className={`px-4 py-2 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
              Page {page} of {totalPages}
            </span>
            
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`px-4 py-2 rounded-xl border transition-all ${
                page === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'glass border-white/20 hover:bg-white/10'
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
              }`}
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
