import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api } from '../lib/api';

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
  specialization?: string[];
  certifications?: Array<{ name: string; issuer: string; year: string }>;
  subscription_plan?: string;
  intro_video_url?: string;
  profile_image_url?: string;
}

function ProfileModal({ userId, onClose, theme }: { userId: string; onClose: () => void; theme: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/users/${userId}`)
      .then(r => setProfile(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const field = (label: string, value: any) =>
    value ? (
      <div>
        <p className={`text-xs mb-0.5 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>{label}</p>
        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border shadow-2xl ${
          theme === 'dark' ? 'glass border-white/20 text-white' : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-white/10 backdrop-blur-md">
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
            <div className="space-y-6">
              {/* Avatar + basic */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-bold">{profile.name}</p>
                  <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>{profile.email}</p>
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
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        profile.coach_status === 'verified' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                        profile.coach_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                        profile.coach_status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        'bg-white/10 text-white/50 border-white/20'
                      }`}>{profile.coach_status}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Info */}
              <div className={`rounded-2xl p-4 border ${ theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <i className="fas fa-user text-blue-400"></i> Personal Info
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {field('Phone', profile.phone)}
                  {field('Gender', profile.gender)}
                  {field('Team', profile.team)}
                  {field('Jersey #', profile.jersey_number)}
                  {field('Subscription', profile.subscription_plan)}
                  {field('Joined', new Date(profile.created_at).toLocaleDateString())}
                  {field('Last Login', profile.last_login ? new Date(profile.last_login).toLocaleDateString() : 'Never')}
                </div>
                {profile.profile_bio && (
                  <div className="mt-3">
                    <p className={`text-xs mb-0.5 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Bio</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>{profile.profile_bio}</p>
                  </div>
                )}
              </div>

              {/* Coach-specific */}
              {profile.role === 'COACH' && (
                <div className={`rounded-2xl p-4 border ${ theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <i className="fas fa-chalkboard-teacher text-green-400"></i> Coach Details
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {field('Category', profile.coach_category)}
                  </div>
                  {profile.specialization && profile.specialization.length > 0 && (
                    <div className="mb-3">
                      <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Specialization</p>
                      <div className="flex flex-wrap gap-1">
                        {profile.specialization.map(s => (
                          <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.certifications && profile.certifications.length > 0 && (
                    <div>
                      <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Certifications</p>
                      <div className="space-y-1">
                        {profile.certifications.map((c, i) => (
                          <p key={i} className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                            {c.name} — {c.issuer} ({c.year})
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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

  useEffect(() => {
    fetchUsers();
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
