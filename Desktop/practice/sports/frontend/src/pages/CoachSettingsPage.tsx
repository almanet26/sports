import { useState } from 'react';
import { motion } from 'framer-motion';
import { authService } from '../utils/auth';

export default function CoachSettingsPage() {
  const userProfile = authService.getUserProfile();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    setSaving(true);
    // TODO: Implement password change API call
    setTimeout(() => {
      setSaving(false);
      alert('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }, 1000);
  };

  return (
    <div className="text-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20"
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-cog text-blue-400"></i>
          Settings
        </h1>
        <p className="text-white/70 mt-2 text-sm">Manage your security and account settings</p>
      </motion.div>

      {/* Security Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="glass rounded-3xl p-6 mb-6 border border-white/20"
      >
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <i className="fas fa-shield-alt text-green-400"></i>
          Security
        </h2>

        {/* Change Password */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <i className="fas fa-lock mr-1"></i> Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <i className="fas fa-key mr-1"></i> New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <i className="fas fa-check-circle mr-1"></i> Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handlePasswordChange}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <i className="fas fa-spinner animate-spin mr-2"></i>
                Updating...
              </>
            ) : (
              <>
                <i className="fas fa-save mr-2"></i>
                Change Password
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Email Verification */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="glass rounded-3xl p-6 mb-6 border border-white/20"
      >
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <i className="fas fa-envelope-open-text text-blue-400"></i>
          Email Verification
        </h2>

        <div className="flex items-center justify-between p-4 glass rounded-2xl border border-white/10">
          <div>
            <div className="font-medium flex items-center gap-2">
              <i className="fas fa-envelope text-blue-400"></i>
              {userProfile?.email}
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
      </motion.div>

      {/* Two-Factor Authentication */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="glass rounded-3xl p-6 mb-6 border border-white/20"
      >
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <i className="fas fa-mobile-alt text-purple-400"></i>
          Two-Factor Authentication
        </h2>

        <div className="flex items-center justify-between p-4 glass rounded-2xl border border-white/10">
          <div>
            <div className="font-medium">Enable 2FA</div>
            <div className="text-sm text-white/60 mt-1">
              Add an extra layer of security to your account
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 glass border border-white/20 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-all"
          >
            <i className="fas fa-plus mr-1"></i>
            Enable
          </motion.button>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="glass rounded-3xl p-6 border border-red-500/20"
      >
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-red-400">
          <i className="fas fa-exclamation-triangle"></i>
          Danger Zone
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 glass rounded-2xl border border-red-500/20">
            <div>
              <div className="font-medium text-red-400">Delete Account</div>
              <div className="text-sm text-white/60 mt-1">
                Permanently delete your account and all data
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-sm font-medium transition-all"
            >
              <i className="fas fa-trash mr-1"></i>
              Delete Account
            </motion.button>
          </div>

          <div className="flex items-center justify-between p-4 glass rounded-2xl border border-red-500/20">
            <div>
              <div className="font-medium text-red-400">Sign Out</div>
              <div className="text-sm text-white/60 mt-1">
                Sign out from your account on this device
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                authService.logout();
                window.location.href = '/login';
              }}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl text-sm font-medium transition-all"
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
