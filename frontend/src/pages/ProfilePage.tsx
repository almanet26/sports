import { useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { authService } from '../utils/auth';
import { authApi } from '../lib/api';

export default function ProfilePage() {
  const userProfile = authService.getUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
    team: userProfile?.team || '',
    jerseyNumber: userProfile?.jersey_number || '',
    bio: userProfile?.profile_bio || ''
  });

  const handleSave = async () => {
    try {
      await authApi.updateProfile({
        name: formData.name,
        phone: formData.phone,
        team: formData.team,
        profile_bio: formData.bio
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Profile & Settings</h1>
          <p className="text-slate-400 mt-1">Manage your account and preferences</p>
        </div>

        {/* Profile Section */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-100">Personal Information</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg font-medium transition"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
               <p className="text-slate-100">{formData.name}</p>
                <p className="text-xs text-slate-500 mt-1">Name cannot be changed</p>               
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
              <p className="text-slate-100">{formData.email}</p>
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Phone</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              ) : (
                <p className="text-slate-100">{formData.phone || 'Not provided'}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Role</label>
              <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-semibold">
                {userProfile?.role}
              </span>
            </div>

            {/* Team */}
            {userProfile?.role === 'PLAYER' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Team</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.team}
                      onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-100">{formData.team || 'Not provided'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Jersey Number</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={formData.jerseyNumber}
                      onChange={(e) => setFormData({ ...formData, jerseyNumber: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-100">{formData.jerseyNumber || 'Not provided'}</p>
                  )}
                </div>
              </>
            )}

            {/* Bio */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-400 mb-2">Bio</label>
              {isEditing ? (
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              ) : (
                <p className="text-slate-100">{formData.bio || 'No bio provided'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-6">Account Settings</h2>
          
          <div className="space-y-4">
            {/* Email Verification */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-700 rounded-lg">
              <div>
                <div className="font-medium text-slate-100">Email Verification</div>
                <div className="text-sm text-slate-400">
                  {userProfile?.is_verified ? 'Your email is verified' : 'Verify your email address'}
                </div>
              </div>
              {!userProfile?.is_verified && (
                <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition">
                  Send Verification Email
                </button>
              )}
            </div>

            {/* Change Password */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-700 rounded-lg">
              <div>
                <div className="font-medium text-slate-100">Password</div>
                <div className="text-sm text-slate-400">Last changed: Never</div>
              </div>
              <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
