import { useState } from 'react';
import { motion } from 'framer-motion';
import { authService } from '../utils/auth';
import { authApi } from '../lib/api';

export default function PlayerProfilePage() {
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
    gender: userProfile?.gender || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        name: formData.name,
        phone: formData.phone,
        team: formData.team,
        jersey_number: formData.jerseyNumber,
        profile_bio: formData.bio,
        gender: formData.gender,
      };

      await authApi.updateProfile(updateData);
      
      // Update local storage
      const updatedProfile = { ...userProfile, ...updateData };
      localStorage.setItem('user_profile', JSON.stringify(updatedProfile));
      
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update player profile:', error);
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
              My Profile
            </h1>
            <p className="text-white/70 mt-2 text-sm">Manage your profile and account preferences</p>
          </div>
        </div>
      </motion.div>

      {/* Personal Information Section */}
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
          <div className="relative">
            {userProfile?.profile_image_url ? (
              <img 
                src={userProfile?.profile_image_url} 
                alt="Profile" 
                className="w-20 h-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold">
                {formData.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
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

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <i className="fas fa-venus-mars mr-1"></i> Gender
            </label>
            {isEditing ? (
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
              >
                <option value="" className="bg-gray-800">Select Gender</option>
                <option value="Male" className="bg-gray-800">Male</option>
                <option value="Female" className="bg-gray-800">Female</option>
                <option value="Other" className="bg-gray-800">Other</option>
                <option value="Prefer not to say" className="bg-gray-800">Prefer not to say</option>
              </select>
            ) : (
              <p className="text-white glass rounded-xl px-4 py-3 border border-white/10">
                {formData.gender || 'Not provided'}
              </p>
            )}
          </div>

          {/* Team */}
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

          {/* Jersey Number */}
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
    </div>
  );
}
