import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

const SPECIALIZATIONS = ['Batting', 'Bowling', 'Fielding', 'Wicketkeeping', 'Fitness', 'All-round'];
const CATEGORIES = ['Under 12', 'Under 15', 'Under 18', 'Under 21', 'Senior', 'All Ages'];

export default function CoachProfileSetupPage() {
  const navigate = useNavigate();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [form, setForm] = useState({
    phone: '',
    team: '',
    profile_bio: '',
    coach_category: '',
    specialization: [] as string[],
  });
  const [document, setDocument] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleSpec = (s: string) =>
    setForm((f) => ({
      ...f,
      specialization: f.specialization.includes(s)
        ? f.specialization.filter((x) => x !== s)
        : [...f.specialization, s],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!document) {
      setError('Please upload your verification document.');
      return;
    }
    if (form.specialization.length === 0) {
      setError('Please select at least one specialization.');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('coach_document', document);
      if (form.phone) fd.append('phone', form.phone);
      if (form.team) fd.append('team', form.team);
      if (form.profile_bio) fd.append('profile_bio', form.profile_bio);
      if (form.coach_category) fd.append('coach_category', form.coach_category);
      fd.append('specialization', JSON.stringify(form.specialization));

      await api.post('/auth/coach-profile', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await fetchProfile();
      navigate('/coach-pending');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070A14] via-[#0A0F1C] to-[#0D1117] text-white flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="glass rounded-3xl p-8 border border-white/20 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 mb-4">
              <i className="fas fa-id-card text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold gradient-text mb-1">Complete Your Profile</h1>
            <p className="text-white/60 text-sm">Fill in your details and upload your credentials for admin verification.</p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1234567890"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:outline-none transition-all"
              />
            </div>

            {/* Team */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Team / Organization</label>
              <input
                type="text"
                value={form.team}
                onChange={(e) => setForm({ ...form, team: e.target.value })}
                placeholder="e.g. Mumbai Cricket Academy"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:outline-none transition-all"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Bio</label>
              <textarea
                value={form.profile_bio}
                onChange={(e) => setForm({ ...form, profile_bio: e.target.value })}
                placeholder="Brief description of your coaching experience..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:outline-none transition-all resize-none"
              />
            </div>

            {/* Coach Category */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Age Category</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, coach_category: cat })}
                    className={`py-2 px-3 rounded-xl text-xs border transition-all ${
                      form.coach_category === cat
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-transparent text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Specialization */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Specialization *</label>
              <div className="grid grid-cols-3 gap-2">
                {SPECIALIZATIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpec(s)}
                    className={`py-2 px-3 rounded-xl text-xs border transition-all ${
                      form.specialization.includes(s)
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 border-transparent text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Document Upload */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Verification Document *</label>
              <input
                type="file"
                id="doc-upload"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setDocument(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="doc-upload"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center gap-3"
              >
                <i className="fas fa-upload text-white/40"></i>
                <span className="flex-1 text-sm">{document ? document.name : 'Upload coaching certificate or ID'}</span>
                {document && <i className="fas fa-check-circle text-green-400"></i>}
              </label>
              <p className="text-xs text-white/40 mt-1">PDF, DOC, or Image — max 10MB</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Submitting...
                </span>
              ) : (
                'Submit for Verification'
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
