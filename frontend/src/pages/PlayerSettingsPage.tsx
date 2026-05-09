import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export default function PlayerSettingsPage() {
  const { theme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [notifs, setNotifs] = useState({
    email_submissions: true,
    email_published: true,
    email_messages: false,
    push_all: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingNotifs, setSavingNotifs] = useState(false);

  useEffect(() => {
    api.get('/notifications/preferences')
      .then(r => setNotifs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleNotificationToggle = async (key: string) => {
    const updated = { ...notifs, [key]: !notifs[key as keyof typeof notifs] };
    setNotifs(updated);
    setSavingNotifs(true);
    try {
      await api.put('/notifications/preferences', updated);
    } catch {
      setNotifs(notifs);
    } finally {
      setSavingNotifs(false);
    }
  };

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const inputCls = `w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all ${
    theme === 'dark' ? 'glass border-white/10 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-400'
  }`;

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) { setPwMsg({ type: 'error', text: 'All fields are required.' }); return; }
    if (pwForm.newPw.length < 8) { setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' }); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return; }
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', { current_password: pwForm.current, new_password: pwForm.newPw });
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err: unknown) {
      const detail = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      setPwMsg({ type: 'error', text: detail || 'Failed to change password.' });
    } finally { setPwLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.email) return;
    setDeleting(true);
    try {
      await api.delete('/auth/me');
      await logout();
      navigate('/');
    } catch (err: unknown) {
      const detail = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      alert(detail || 'Failed to delete account.');
    } finally { setDeleting(false); }
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-all ${checked ? 'bg-blue-500' : theme === 'dark' ? 'bg-white/20' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
    </button>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className={`max-w-2xl mx-auto ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-cog text-blue-400"></i>Settings
        </h1>
        <p className={`mt-1 text-sm ${sub}`}>Manage your security, notifications and account</p>
      </motion.div>

      {/* Change Password */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className={`rounded-3xl p-6 mb-4 border ${glass}`}>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-lock text-blue-400"></i>Change Password
        </h2>
        <div className="space-y-3">
          {([
            { key: 'current', label: 'Current Password', show: showPw.current, toggle: () => setShowPw(s => ({ ...s, current: !s.current })) },
            { key: 'newPw', label: 'New Password', show: showPw.newPw, toggle: () => setShowPw(s => ({ ...s, newPw: !s.newPw })) },
            { key: 'confirm', label: 'Confirm New Password', show: showPw.confirm, toggle: () => setShowPw(s => ({ ...s, confirm: !s.confirm })) },
          ] as const).map(({ key, label, show, toggle }) => (
            <div key={key}>
              <label className={`block text-xs mb-1 ${sub}`}>{label}</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={pwForm[key]}
                  onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder="••••••••" className={inputCls + ' pr-10'} />
                <button type="button" onClick={toggle}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${sub} hover:text-white transition-colors`}>
                  <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                </button>
              </div>
            </div>
          ))}
        </div>
        <AnimatePresence>
          {pwMsg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mt-3 p-3 rounded-xl text-sm border ${pwMsg.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              <i className={`fas ${pwMsg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2`}></i>
              {pwMsg.text}
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={handleChangePassword} disabled={pwLoading}
          className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2 hover:opacity-90 transition-opacity">
          {pwLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</> : <><i className="fas fa-save" />Update Password</>}
        </button>
      </motion.div>

      {/* Account Settings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className={`rounded-3xl p-6 mb-4 border ${glass}`}>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-user-cog text-purple-400"></i>Account Settings
        </h2>
        <div className="space-y-3">
          <div className={`flex items-center justify-between p-4 rounded-xl border ${cardBg}`}>
            <div>
              <p className="font-medium text-sm">Account Email</p>
              <p className={`text-xs mt-0.5 ${sub}`}>{user?.email}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full border ${user?.is_verified ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
              {user?.is_verified ? 'Verified' : 'Pending'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Notification Preferences */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className={`rounded-3xl p-6 mb-4 border ${glass}`}>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-bell text-yellow-400"></i>Notification Preferences
          {savingNotifs && <span className="text-xs text-blue-400">Saving...</span>}
        </h2>
        <div className="space-y-4">
          {[
            { key: 'email_submissions', label: 'New video submissions', desc: 'When a coach reviews your submission' },
            { key: 'email_published', label: 'Report published', desc: 'When your coach publishes a report' },
            { key: 'email_messages', label: 'New messages', desc: 'When a coach sends you a message' },
            { key: 'push_all', label: 'Push notifications', desc: 'All in-app notifications' },
          ].map(({ key, label, desc }) => (
            <div key={key} className={`flex items-center justify-between p-4 rounded-xl border ${cardBg}`}>
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className={`text-xs mt-0.5 ${sub}`}>{desc}</p>
              </div>
              <Toggle checked={notifs[key as keyof typeof notifs]} onChange={() => handleNotificationToggle(key)} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-3xl p-6 border border-red-500/30 bg-red-500/5">
        <h2 className="font-semibold mb-1 flex items-center gap-2 text-red-400">
          <i className="fas fa-exclamation-triangle"></i>Danger Zone
        </h2>
        <p className={`text-sm mb-4 ${sub}`}>These actions are irreversible. Please proceed with caution.</p>
        <button onClick={() => setShowDeleteModal(true)}
          className="px-5 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 font-semibold text-sm hover:bg-red-500/30 transition-all flex items-center gap-2">
          <i className="fas fa-trash-alt"></i>Delete Account
        </button>
      </motion.div>

      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-md glass rounded-3xl p-6 border border-red-500/30 text-white">
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-trash-alt text-2xl text-red-400"></i>
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Delete Account</h3>
              <p className="text-white/60 text-sm text-center mb-4">This will permanently delete your account and all data.</p>
              <p className="text-sm mb-2">Type your email to confirm: <span className="text-red-400 font-medium">{user?.email}</span></p>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={user?.email}
                className="w-full px-4 py-3 rounded-xl glass border border-white/10 text-white text-sm focus:outline-none focus:border-red-500 mb-4" />
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                  className="flex-1 py-2.5 rounded-xl glass border border-white/20 text-sm font-medium hover:bg-white/10 transition-all">Cancel</button>
                <button onClick={handleDeleteAccount} disabled={deleteConfirm !== user?.email || deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50 hover:bg-red-600 transition-all flex items-center justify-center gap-2">
                  {deleting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</> : 'Delete Account'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
