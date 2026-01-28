import { useState } from 'react';
import { motion } from 'framer-motion';
import { authService } from '../utils/auth';
import { authApi } from '../lib/api';

export default function ProfilePage() {
  const userProfile = authService.getUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
    team: userProfile?.team || '',
    jerseyNumber: userProfile?.jersey_number || '',
    bio: userProfile?.profile_bio || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await authApi.updateProfile({
        name: formData.name,
        team: formData.team,
        phone: formData.phone,
        jersey_number: Number(formData.jerseyNumber),
        team: formData.team,
        profile_bio: formData.bio,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="text-white max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-user-cog text-blue-400"></i>
              Profile & Settings
            </h1>
            <p className="text-white/70 mt-2 text-sm">Manage your account and preferences</p>
          </div>
        </div>
      </motion.div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="glass rounded-3xl p-6 mb-6 border border-white/20"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <i className="fas fa-id-card text-purple-400"></i>
            Personal Information
          </h2>
          {!isEditing ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 glass border border-white/20 hover:bg-white/10 text-white rounded-xl font-medium transition-all flex items-center gap-2"
            >
              <i className="fas fa-edit"></i>
              Edit Profile
            </motion.button>
          ) : (
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 glass border border-white/20 hover:bg-white/10 text-white rounded-xl font-medium transition-all"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <i className="fas fa-spinner animate-spin"></i>
                ) : (
                  <i className="fas fa-save"></i>
                )}
                Save Changes
              </motion.button>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold">
            {formData.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-xl font-semibold">{formData.name}</p>
            <p className="text-white/60">{formData.email}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-400 rounded-full text-sm font-semibold">
              <i className="fas fa-user-tag mr-1"></i>
              {userProfile?.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <i className="fas fa-user mr-1"></i> Full Name
            </label>
            {isEditing ? (
              <input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-3 glass border border-white/20 rounded-xl"
              />
            ) : (
              <p className="text-white ...">{formData.name}</p>
            )}

            <p className="text-white glass rounded-xl px-4 py-3 border border-white/10">{formData.name}</p>
            <p className="text-xs text-white/40 mt-1">Name cannot be changed</p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <i className="fas fa-envelope mr-1"></i> Email
            </label>
            <p className="text-white glass rounded-xl px-4 py-3 border border-white/10">{formData.email}</p>
            <p className="text-xs text-white/40 mt-1">Email cannot be changed</p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <i className="fas fa-phone mr-1"></i> Phone
            </label>
            {isEditing ? (
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
              />
            ) : (
              <p className="text-white glass rounded-xl px-4 py-3 border border-white/10">
                {formData.phone || 'Not provided'}
              </p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <i className="fas fa-user-shield mr-1"></i> Role
            </label>
            <p className="text-white glass rounded-xl px-4 py-3 border border-white/10">{userProfile?.role}</p>
          </div>

          {/* Team (Player only) */}
          {userProfile?.role === 'PLAYER' && (
            <>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  <i className="fas fa-users mr-1"></i> Team
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
                  />
                ) : (
                  <p className="text-white glass rounded-xl px-4 py-3 border border-white/10">
                    {formData.team || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  <i className="fas fa-tshirt mr-1"></i> Jersey Number
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.jerseyNumber}
                    onChange={(e) => setFormData({ ...formData, jerseyNumber: e.target.value })}
                    className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
                  />
                ) : (
                  <p className="text-white glass rounded-xl px-4 py-3 border border-white/10">
                    {formData.jerseyNumber || 'Not provided'}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Bio */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-white/60 mb-2">
              <i className="fas fa-quote-left mr-1"></i> Bio
            </label>
            {isEditing ? (
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent resize-none"
              />
            ) : (
              <p className="text-white glass rounded-xl px-4 py-3 border border-white/10 min-h-[80px]">
                {formData.bio || 'No bio provided'}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Account Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="glass rounded-3xl p-6 border border-white/20"
      >
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <i className="fas fa-cog text-green-400"></i>
          Account Settings
        </h2>

        <div className="space-y-4">
          {/* Email Verification */}
          <div className="flex items-center justify-between p-4 glass rounded-2xl border border-white/10">
            <div>
              <div className="font-medium flex items-center gap-2">
                <i className="fas fa-envelope-open-text text-blue-400"></i>
                Email Verification
              </div>
              <div className="text-sm text-white/60 mt-1">
                {userProfile?.is_verified ? (
                  <span className="text-green-400">
                    <i className="fas fa-check-circle mr-1"></i>
                    Your email is verified
                  </span>
                ) : (
                  'Verify your email address'
                )}
              </div>
            </div>
            {!userProfile?.is_verified && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                <i className="fas fa-paper-plane mr-1"></i>
                Send Verification
              </motion.button>
            )}
          </div>

          {/* Change Password */}
          <div className="flex items-center justify-between p-4 glass rounded-2xl border border-white/10">
            <div>
              <div className="font-medium flex items-center gap-2">
                <i className="fas fa-lock text-yellow-400"></i>
                Password
              </div>
              <div className="text-sm text-white/60 mt-1">Last changed: Never</div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 glass border border-white/20 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-all"
            >
              <i className="fas fa-key mr-1"></i>
              Change Password
            </motion.button>
          </div>

          {/* Logout */}
          <div className="flex items-center justify-between p-4 glass rounded-2xl border border-red-500/20">
            <div>
              <div className="font-medium flex items-center gap-2 text-red-400">
                <i className="fas fa-sign-out-alt"></i>
                Danger Zone
              </div>
              <div className="text-sm text-white/60 mt-1">Sign out from your account</div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                authService.logout();
                window.location.href = '/login';
              }}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-sm font-medium transition-all"
            >
              <i className="fas fa-sign-out-alt mr-1"></i>
              Logout
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
