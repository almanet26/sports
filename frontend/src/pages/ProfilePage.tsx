import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { authApi, api, resolveMediaUrl } from '../lib/api';

const SPECIALIZATIONS = ['Batting', 'Bowling', 'Fielding', 'Fitness', 'Mental', 'Wicketkeeping'];

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const isCoach = user?.role === 'COACH';
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profile_image_url || '');

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    phone: user?.phone || '',
    gender: user?.gender || '',
    coach_category: user?.coach_category || '',
    profile_bio: user?.profile_bio || '',
    team: user?.team || '',
    jerseyNumber: user?.jersey_number || '',
    date_of_birth: user?.date_of_birth || '',
    years_of_experience: user?.years_of_experience?.toString() || ''
  });

  // Coach branding state
  const [certifications, setCertifications] = useState<Array<{name: string; issuer: string; year: string; certificate_url?: string}>>(user?.certifications || []);
  const [specialization, setSpecialization] = useState<string[]>(user?.specialization || []);
  const [addingCert, setAddingCert] = useState(false);
  const [newCert, setNewCert] = useState({ name: '', issuer: '', year: '', certificate_url: '' });
  const [videoUploading, setVideoUploading] = useState(false);
  const [introVideoUrl, setIntroVideoUrl] = useState(user?.intro_video_url || '');
  const [videoError, setVideoError] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/auth/profile-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.profile_image_url;
      setProfileImageUrl(url);
      updateUser({ profile_image_url: url });
      // Refresh the full profile to ensure consistency
      await useAuthStore.getState().fetchProfile();
      // Trigger storage event to update DashboardLayout
      window.dispatchEvent(new Event('storage'));
    } catch {
      // fallback: store as base64 preview locally
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        setProfileImageUrl(url);
        updateUser({ profile_image_url: url });
      };
      reader.readAsDataURL(file);
    } finally {
      setPhotoUploading(false);
    }
  };

  // Profile completion for coaches
  const completionItems = [
    { label: 'Add bio', done: !!user?.profile_bio },
    { label: 'Add certifications', done: (user?.certifications?.length || 0) > 0 },
    { label: 'Upload intro video', done: !!user?.intro_video_url },
    { label: 'Set specialization', done: (user?.specialization?.length || 0) > 0 },
  ];
  const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authApi.updateProfile({
        phone: formData.phone,
        profile_bio: formData.profile_bio,
        team: formData.team,
        gender: formData.gender,
        coach_category: formData.coach_category,
        date_of_birth: formData.date_of_birth,
        years_of_experience: formData.years_of_experience ? parseInt(formData.years_of_experience as string) : undefined,
        certifications,
        specialization,
      });
      updateUser({
        phone: formData.phone,
        profile_bio: formData.profile_bio,
        team: formData.team,
        gender: formData.gender,
        coach_category: formData.coach_category,
        date_of_birth: formData.date_of_birth,
        years_of_experience: formData.years_of_experience ? parseInt(formData.years_of_experience as string) : undefined,
        certifications,
        specialization,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/auth/coach-intro-video', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.intro_video_url;
      setIntroVideoUrl(url);
      setVideoError(false);
      updateUser({ intro_video_url: url });
    } catch (err) {
      console.error('Video upload failed:', err);
    } finally {
      setVideoUploading(false);
    }
  };

  const toggleSpec = (s: string) =>
    setSpecialization(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const addCert = () => {
    if (!newCert.name) return;
    setCertifications(prev => [...prev, newCert]);
    setNewCert({ name: '', issuer: '', year: '', certificate_url: '' });
    setAddingCert(false);
  };

  const glass = 'glass border-white/20';
  const cardBg = 'glass border-white/10';
  const sub = 'text-white/60';
  const inputCls = 'w-full px-4 py-3 glass border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 bg-transparent';

  return (
    <div className="text-white max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-user-cog text-blue-400"></i>My Profile
        </h1>
        <p className={`mt-1 text-sm ${sub}`}>Manage your profile and account preferences</p>
      </motion.div>

      {/* Coach Profile Summary */}
      {isCoach && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className={`rounded-3xl p-6 mb-6 border ${glass}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <i className="fas fa-id-badge text-purple-400"></i>My Coach Profile
            </h2>
            <button className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition-all">
              How players see you
            </button>
          </div>

          {/* Top row: photo + bio + completion */}
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_220px] gap-4 mb-4">
            {/* Profile Photo */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="relative w-24 h-24 cursor-pointer"
                onClick={() => photoInputRef.current?.click()}
                onMouseEnter={e => (e.currentTarget.querySelector('.photo-overlay') as HTMLElement).style.opacity = '1'}
                onMouseLeave={e => (e.currentTarget.querySelector('.photo-overlay') as HTMLElement).style.opacity = '0'}
              >
                {profileImageUrl
                  ? <img src={resolveMediaUrl(profileImageUrl)} alt="profile" className="w-24 h-24 rounded-2xl object-cover" />
                  : <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold">
                      {user?.name?.charAt(0)?.toUpperCase() || 'C'}
                    </div>}
                <div className="photo-overlay absolute inset-0 rounded-2xl bg-black/60 flex flex-col items-center justify-center gap-1 transition-opacity" style={{ opacity: 0 }}>
                  {photoUploading
                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <>
                        <i className="fas fa-camera text-white text-lg"></i>
                        <span className="text-white text-xs">Change</span>
                      </>}
                </div>
              </div>
              <p className={`text-xs ${sub}`}>Profile Photo</p>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            {/* Bio */}
            <div className={`rounded-2xl p-4 border ${cardBg}`}>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                <i className="fas fa-quote-left text-purple-400"></i>Professional Bio
              </p>
              <p className={`text-sm ${sub}`}>
                {user?.profile_bio || 'No bio added yet. Add your coaching background, achievements, and what makes you unique to attract more players.'}
              </p>
            </div>

            {/* Completion */}
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 border ${cardBg}`}>
                <p className="text-xs font-semibold mb-2">Profile Completion</p>
                <div className="w-full h-2 rounded-full bg-white/10 mb-1">
                  <div className="h-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all"
                    style={{ width: `${completionPct}%` }} />
                </div>
                <p className={`text-xs ${sub}`}>{completionPct}% complete</p>
              </div>
              <div className={`rounded-2xl p-4 border ${cardBg}`}>
                <p className="text-xs font-semibold mb-2">Complete Your Profile</p>
                <ul className="space-y-1.5">
                  {completionItems.map(({ label, done }) => (
                    <li key={label} className={`text-xs flex items-center gap-2 ${done ? 'text-green-400' : sub}`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-green-400' : 'bg-white/20'}`} />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Certifications', value: certifications.length },
              { label: 'Specialization', value: specialization.length > 0 ? specialization[0] : 'None' },
              { label: 'Rating', value: '4.8 ⭐' },
            ].map(({ label, value }) => (
              <div key={label} className={`rounded-xl p-3 border ${cardBg} text-center`}>
                <p className={`text-xs ${sub}`}>{label}</p>
                <p className="text-sm font-semibold mt-1">{value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Personal Information */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <i className="fas fa-id-card text-purple-400"></i>Personal Information
          </h2>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)}
              className="px-4 py-2 glass border border-white/20 hover:bg-white/10 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
              <i className="fas fa-edit"></i>Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)}
                className="px-4 py-2 glass border border-white/20 hover:bg-white/10 rounded-xl text-sm font-medium transition-all">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-all">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="fas fa-save" />}
                Save Changes
              </button>
            </div>
          )}
        </div>

        {/* Avatar row */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl overflow-hidden">
            {profileImageUrl
              ? <img src={resolveMediaUrl(profileImageUrl)} alt="profile" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>}
          </div>
          <div>
            <p className="font-semibold">{user?.name}</p>
            <p className={`text-sm ${sub}`}>{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-full text-xs font-semibold">
              <i className="fas fa-user-tag mr-1"></i>{user?.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-xs mb-1 ${sub}`}><i className="fas fa-user mr-1"></i>Full Name</label>
            <p className={`px-4 py-3 rounded-xl border ${cardBg} text-sm`}>{user?.name}</p>
            <p className={`text-xs mt-1 ${sub}`}>Name cannot be changed</p>
          </div>
          <div>
            <label className={`block text-xs mb-1 ${sub}`}><i className="fas fa-envelope mr-1"></i>Email</label>
            <p className={`px-4 py-3 rounded-xl border ${cardBg} text-sm`}>{user?.email}</p>
            <p className={`text-xs mt-1 ${sub}`}>Email cannot be changed</p>
          </div>
          <div>
            <label className={`block text-xs mb-1 ${sub}`}><i className="fas fa-phone mr-1"></i>Phone</label>
            {isEditing
              ? <input type="tel" value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
              : <p className={`px-4 py-3 rounded-xl border ${cardBg} text-sm`}>{user?.phone || 'Not provided'}</p>}
          </div>
          <div>
            <label className={`block text-xs mb-1 ${sub}`}><i className="fas fa-venus-mars mr-1"></i>Gender</label>
            {isEditing
              ? <select value={formData.gender} onChange={e => setFormData(f => ({ ...f, gender: e.target.value }))}
                  className={inputCls}>
                  <option value="">Select</option>
                  {['Male', 'Female', 'Other'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              : <p className={`px-4 py-3 rounded-xl border ${cardBg} text-sm`}>{user?.gender || 'Not provided'}</p>}
          </div>
          {isCoach && (
            <>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}><i className="fas fa-layer-group mr-1"></i>Coach Category</label>
                {isEditing
                  ? <select value={formData.coach_category} onChange={e => setFormData(f => ({ ...f, coach_category: e.target.value }))}
                      className={inputCls}>
                      <option value="">Select</option>
                      {['Junior', 'Senior', 'Elite', 'Academy'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  : <p className={`px-4 py-3 rounded-xl border ${cardBg} text-sm`}>{user?.coach_category || 'Not provided'}</p>}
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}><i className="fas fa-calendar mr-1"></i>Date of Birth</label>
                {isEditing
                  ? <input type="date" value={formData.date_of_birth} onChange={e => setFormData(f => ({ ...f, date_of_birth: e.target.value }))} className={inputCls} />
                  : <p className={`px-4 py-3 rounded-xl border ${cardBg} text-sm`}>{user?.date_of_birth || 'Not provided'}</p>}
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}><i className="fas fa-award mr-1"></i>Years of Experience</label>
                {isEditing
                  ? <input type="number" min="0" value={formData.years_of_experience} onChange={e => setFormData(f => ({ ...f, years_of_experience: e.target.value }))} className={inputCls} placeholder="e.g., 5" />
                  : <p className={`px-4 py-3 rounded-xl border ${cardBg} text-sm`}>{user?.years_of_experience ? `${user.years_of_experience} years` : 'Not provided'}</p>}
              </div>
            </>
          )}
          {user?.role === 'PLAYER' && (
            <div>
              <label className={`block text-xs mb-1 ${sub}`}><i className="fas fa-users mr-1"></i>Team</label>
              {isEditing
                ? <input value={formData.team} onChange={e => setFormData(f => ({ ...f, team: e.target.value }))} className={inputCls} />
                : <p className={`px-4 py-3 rounded-xl border ${cardBg} text-sm`}>{user?.team || 'Not provided'}</p>}
            </div>
          )}
          <div className="md:col-span-2">
            <label className={`block text-xs mb-1 ${sub}`}><i className="fas fa-quote-left mr-1"></i>Bio</label>
            {isEditing
              ? <textarea value={formData.profile_bio} onChange={e => setFormData(f => ({ ...f, profile_bio: e.target.value }))}
                  rows={3} className={inputCls + ' resize-none'} />
              : <p className={`px-4 py-3 rounded-xl border ${cardBg} text-sm min-h-[72px]`}>{user?.profile_bio || 'No bio provided'}</p>}
          </div>
        </div>
      </motion.div>

      {/* Coach Branding */}
      {isCoach && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className={`rounded-3xl p-6 mb-6 border ${glass}`}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="fas fa-star text-yellow-400"></i>Coach Branding
          </h2>

          {/* Certifications */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-1"><i className="fas fa-certificate text-white/40"></i>Certifications</p>
              <button onClick={() => setAddingCert(true)}
                className="px-3 py-1 rounded-xl text-xs border border-white/20 hover:bg-white/10 transition-all">
                + Add Certification
              </button>
            </div>
            {addingCert && (
              <div className={`rounded-2xl p-4 border ${cardBg} mb-3 space-y-2`}>
                <input placeholder="Certification name" value={newCert.name}
                  onChange={e => setNewCert(n => ({ ...n, name: e.target.value }))} className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Issuer" value={newCert.issuer}
                    onChange={e => setNewCert(n => ({ ...n, issuer: e.target.value }))} className={inputCls} />
                  <input placeholder="Year" value={newCert.year}
                    onChange={e => setNewCert(n => ({ ...n, year: e.target.value }))} className={inputCls} />
                </div>
                <input placeholder="Certificate URL (optional)" value={newCert.certificate_url}
                  onChange={e => setNewCert(n => ({ ...n, certificate_url: e.target.value }))} className={inputCls} />
                <div className="flex gap-2">
                  <button onClick={addCert} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-xs font-semibold">Add</button>
                  <button onClick={() => setAddingCert(false)} className="px-4 py-2 glass border border-white/20 rounded-xl text-xs">Cancel</button>
                </div>
              </div>
            )}
            {certifications.length === 0
              ? <div className={`rounded-2xl p-6 border ${cardBg} flex flex-col items-center justify-center gap-2`}>
                  <i className="fas fa-certificate text-3xl text-white/20"></i>
                  <p className={`text-sm ${sub}`}>No certifications added yet</p>
                </div>
              : <div className="space-y-2">
                  {certifications.map((c, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${cardBg}`}>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className={`text-xs ${sub}`}>{c.issuer} {c.year && `· ${c.year}`}</p>
                        {c.certificate_url && (
                          <a href={c.certificate_url} target="_blank" rel="noopener noreferrer" 
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
                            <i className="fas fa-external-link-alt"></i>View Certificate
                          </a>
                        )}
                      </div>
                      <button onClick={() => setCertifications(prev => prev.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-300 text-xs"><i className="fas fa-trash"></i></button>
                    </div>
                  ))}
                </div>}
          </div>

          {/* Specialization */}
          <div className="mb-5">
            <p className="text-sm font-medium mb-2 flex items-center gap-1"><i className="fas fa-crosshairs text-white/40"></i>Specialization</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map(s => (
                <button key={s} onClick={() => toggleSpec(s)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    specialization.includes(s)
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                      : 'border-white/20 text-white/60 hover:border-white/40'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Intro Video */}
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-1"><i className="fas fa-video text-white/40"></i>Intro Video</p>
            {introVideoUrl ? (
              <div className={`rounded-2xl border ${cardBg} overflow-hidden`}>
                {videoError ? (
                  <div className="p-4 flex items-center justify-between">
                    <p className="text-sm text-yellow-400 flex items-center gap-2">
                      <i className="fas fa-exclamation-triangle"></i>Video file not found. Please re-upload.
                    </p>
                    <button onClick={() => videoInputRef.current?.click()}
                      className="px-3 py-1 rounded-xl text-xs border border-white/20 hover:bg-white/10 transition-all">
                      Re-upload
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      controls
                      className="w-full max-h-64 bg-black"
                      src={resolveMediaUrl(introVideoUrl)}
                      onError={() => setVideoError(true)}
                    />
                    <div className="flex items-center justify-between px-4 py-3">
                      <p className="text-xs text-green-400 flex items-center gap-2">
                        <i className="fas fa-check-circle"></i>Intro video uploaded
                      </p>
                      <button onClick={() => videoInputRef.current?.click()}
                        className="px-3 py-1 rounded-xl text-xs border border-white/20 hover:bg-white/10 transition-all">
                        Replace
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div onClick={() => videoInputRef.current?.click()}
                className={`rounded-2xl p-8 border ${cardBg} flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-white/30 transition-all`}>
                {videoUploading
                  ? <span className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <>
                      <i className="fas fa-cloud-upload-alt text-3xl text-white/30"></i>
                      <p className="text-sm text-white/60">Click to upload intro video</p>
                      <p className="text-xs text-white/30">MP4, MOV, AVI — max 100MB</p>
                    </>}
              </div>
            )}
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
          </div>

          {/* Save branding button */}
          {isEditing && (
            <button onClick={handleSave} disabled={saving}
              className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="fas fa-save" />}
              Save Changes
            </button>
          )}
        </motion.div>
      )}

    </div>
  );
}
