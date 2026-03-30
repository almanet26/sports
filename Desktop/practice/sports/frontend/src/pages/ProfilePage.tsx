import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { authService } from '../utils/auth';
import { authApi } from '../lib/api';

const SPECIALIZATIONS = ['Batting', 'Bowling', 'Fielding', 'Fitness', 'Mental', 'Wicketkeeping'];

interface Certification {
  name: string;
  issuer: string;
  year: string;
}

export default function ProfilePage() {
  const userProfile = authService.getUserProfile();
  const isCoach = userProfile?.role === 'COACH';
  const videoInputRef = useRef<HTMLInputElement>(null);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileComplete, setProfileComplete] = useState(0);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
    team: userProfile?.team || '',
    jerseyNumber: userProfile?.jersey_number || '',
    bio: userProfile?.profile_bio || '',
    gender: userProfile?.gender || '',
    coachCategory: userProfile?.coach_category || '',
    sessionType: userProfile?.session_type || '',
  });

  // Coach-specific fields
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [specialization, setSpecialization] = useState<string[]>([]);
  const [introVideo, setIntroVideo] = useState<File | null>(null);

  // Load coach branding data on mount
  useEffect(() => {
    if (isCoach && userProfile) {
      if (userProfile.certifications) setCertifications(userProfile.certifications);
      if (userProfile.specialization) setSpecialization(userProfile.specialization);
    }
  }, []);

  // Calculate profile completion whenever relevant data changes
  useEffect(() => {
    if (!isCoach) return;
    
    let complete = 0;
    
    // Basic info (40%)
    if (formData.name) complete += 10;
    if (formData.email) complete += 10;
    if (formData.phone) complete += 10;
    if (formData.bio) complete += 10;
    
    // Coach branding (60%)
    if (certifications.length > 0) complete += 20;
    if (specialization.length > 0) complete += 20;
    if (introVideo || userProfile?.intro_video_url) complete += 20;
    
    setProfileComplete(complete);
  }, [isCoach, formData, certifications, specialization, introVideo, userProfile]);

  const toggleSpecialization = (spec: string) => {
    setSpecialization(prev => 
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  };

  const addCertification = () => {
    setCertifications([...certifications, { name: '', issuer: '', year: '' }]);
  };

  const updateCertification = (index: number, field: keyof Certification, value: string) => {
    const updated = [...certifications];
    updated[index] = { ...updated[index], [field]: value };
    setCertifications(updated);
  };

  const removeCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIntroVideo(file);
    }
  };

  const handleProfileImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        name: formData.name,
        phone: formData.phone,
        team: formData.team,
        profile_bio: formData.bio,
        gender: formData.gender,
      };

      // Add coach branding fields if user is coach
      if (isCoach) {
        updateData.certifications = certifications;
        updateData.specialization = specialization;
        updateData.coach_category = formData.coachCategory;
        updateData.session_type = formData.sessionType;
      }

      await authApi.updateProfile(updateData);
      
      // Update local storage
      const updatedProfile = { ...userProfile, ...updateData };
      localStorage.setItem('user_profile', JSON.stringify(updatedProfile));
      
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
              My Profile
            </h1>
            <p className="text-white/70 mt-2 text-sm">Manage your profile and account preferences</p>
          </div>
        </div>
      </motion.div>

      {/* Coach Profile Preview - Only for COACH role */}
      {isCoach && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="glass rounded-3xl p-6 mb-6 border border-white/20"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <i className="fas fa-id-card text-purple-400"></i>
              My Coach Profile
            </h2>
            <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
              How players see you
            </span>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Profile Info */}
            <div className="lg:col-span-2 space-y-4">
              {/* Profile Image & Bio */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Profile Image */}
                <div className="rounded-xl p-4 glass border border-white/10 flex flex-col items-center justify-center">
                  {profileImagePreview || userProfile?.profile_image_url ? (
                    <img 
                      src={profileImagePreview || userProfile?.profile_image_url} 
                      alt="Profile" 
                      className="w-24 h-24 rounded-2xl object-cover mb-2"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold mb-2">
                      {formData.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <p className="text-xs text-white/50 text-center">Profile Photo</p>
                </div>

                {/* Bio */}
                <div className="rounded-xl p-4 glass border border-white/10 md:col-span-2">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <i className="fas fa-quote-left text-purple-400"></i>
                    Professional Bio
                  </p>
                  <p className="text-sm text-white/70">
                    {formData.bio || 'No bio added yet. Add your coaching background, achievements, and what makes you unique to attract more players.'}
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3 glass border border-white/10 text-center">
                  <p className="text-xs text-white/50 mb-1">Certifications</p>
                  <p className="text-lg font-bold">{certifications.length}</p>
                </div>
                <div className="rounded-xl p-3 glass border border-white/10 text-center">
                  <p className="text-xs text-white/50 mb-1">Specialization</p>
                  <p className="text-lg font-bold">{specialization.length > 0 ? specialization.join(', ') : 'None'}</p>
                </div>
                <div className="rounded-xl p-3 glass border border-white/10 text-center">
                  <p className="text-xs text-white/50 mb-1">Rating</p>
                  <p className="text-lg font-bold">4.8 ⭐</p>
                </div>
              </div>
            </div>

            {/* Profile Completion */}
            <div className="space-y-4">
              <div className="rounded-xl p-4 glass border border-white/10">
                <p className="text-sm font-medium mb-3">Profile Completion</p>
                <div className="h-2 rounded-full overflow-hidden bg-white/10 mb-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${profileComplete}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                  />
                </div>
                <p className="text-xs text-white/50">{profileComplete}% complete</p>
              </div>

              <div className="rounded-xl p-4 glass border border-white/10">
                <p className="text-sm font-medium mb-3">Complete Your Profile</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <i className={`fas ${formData.bio ? 'fa-check-circle text-green-400' : 'fa-circle text-white/20'}`}></i>
                    <span>Add bio</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <i className={`fas ${certifications.length > 0 ? 'fa-check-circle text-green-400' : 'fa-circle text-white/20'}`}></i>
                    <span>Add certifications</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <i className={`fas ${introVideo || userProfile?.intro_video_url ? 'fa-check-circle text-green-400' : 'fa-circle text-white/20'}`}></i>
                    <span>Upload intro video</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <i className={`fas ${specialization.length > 0 ? 'fa-check-circle text-green-400' : 'fa-circle text-white/20'}`}></i>
                    <span>Set specialization</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

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
          <div className="relative">
            {profileImagePreview || userProfile?.profile_image_url ? (
              <img 
                src={profileImagePreview || userProfile?.profile_image_url} 
                alt="Profile" 
                className="w-20 h-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold">
                {formData.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            {isEditing && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => profileImageInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs shadow-lg"
              >
                <i className="fas fa-camera"></i>
              </motion.button>
            )}
            <input
              ref={profileImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              className="hidden"
              onChange={handleProfileImageSelect}
            />
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

          {/* Coach Category - Only for COACH role */}
          {isCoach && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                <i className="fas fa-layer-group mr-1"></i> Coach Category
              </label>
              {isEditing ? (
                <select
                  value={formData.coachCategory}
                  onChange={(e) => setFormData({ ...formData, coachCategory: e.target.value })}
                  className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
                >
                  <option value="" className="bg-gray-800">Select Category</option>
                  <option value="Under 12" className="bg-gray-800">Under 12</option>
                  <option value="Under 15" className="bg-gray-800">Under 15</option>
                  <option value="Under 18" className="bg-gray-800">Under 18</option>
                  <option value="Under 21" className="bg-gray-800">Under 21</option>
                  <option value="Senior" className="bg-gray-800">Senior</option>
                  <option value="Professional" className="bg-gray-800">Professional</option>
                  <option value="All Levels" className="bg-gray-800">All Levels</option>
                </select>
              ) : (
                <p className="text-white glass rounded-xl px-4 py-3 border border-white/10">
                  {formData.coachCategory || 'Not provided'}
                </p>
              )}
            </div>
          )}

          {/* Session Type - Only for COACH role */}
          {isCoach && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                <i className="fas fa-map-marker-alt mr-1"></i> Session Type
              </label>
              {isEditing ? (
                <select
                  value={formData.sessionType}
                  onChange={(e) => setFormData({ ...formData, sessionType: e.target.value })}
                  className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
                >
                  <option value="" className="bg-gray-800">Select Session Type</option>
                  <option value="Virtual" className="bg-gray-800">Virtual Only</option>
                  <option value="In-Field" className="bg-gray-800">In-Field Only</option>
                  <option value="Both" className="bg-gray-800">Both (Virtual & In-Field)</option>
                </select>
              ) : (
                <p className="text-white glass rounded-xl px-4 py-3 border border-white/10">
                  {formData.sessionType || 'Not provided'}
                </p>
              )}
            </div>
          )}

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

      {/* Coach Branding Section - Only for COACH role */}
      {isCoach && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="glass rounded-3xl p-6 mb-6 border border-white/20"
        >
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <i className="fas fa-star text-yellow-400"></i>
            Coach Branding
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Certifications */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-white/60">
                  <i className="fas fa-certificate mr-1"></i> Certifications
                </label>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={addCertification}
                  className="px-3 py-1 glass border border-white/20 hover:bg-white/10 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                >
                  <i className="fas fa-plus"></i>
                  Add Certification
                </motion.button>
              </div>
              
              {certifications.length === 0 ? (
                <div className="glass rounded-xl px-4 py-8 border border-white/10 text-center">
                  <i className="fas fa-certificate text-white/20 text-3xl mb-2"></i>
                  <p className="text-sm text-white/40">No certifications added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {certifications.map((cert, index) => (
                    <div key={index} className="glass rounded-xl p-4 border border-white/10">
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          type="text"
                          placeholder="Certification name"
                          value={cert.name}
                          onChange={(e) => updateCertification(index, 'name', e.target.value)}
                          className="col-span-3 sm:col-span-1 px-3 py-2 glass border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 bg-transparent"
                        />
                        <input
                          type="text"
                          placeholder="Issuing body"
                          value={cert.issuer}
                          onChange={(e) => updateCertification(index, 'issuer', e.target.value)}
                          className="col-span-2 sm:col-span-1 px-3 py-2 glass border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 bg-transparent"
                        />
                        <div className="col-span-1 flex gap-2">
                          <input
                            type="text"
                            placeholder="Year"
                            value={cert.year}
                            onChange={(e) => updateCertification(index, 'year', e.target.value)}
                            className="flex-1 px-3 py-2 glass border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 bg-transparent"
                          />
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => removeCertification(index)}
                            className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                          >
                            <i className="fas fa-trash text-xs"></i>
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Specialization */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-white/60 mb-3">
                <i className="fas fa-crosshairs mr-1"></i> Specialization
              </label>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map((spec) => (
                  <motion.button
                    key={spec}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleSpecialization(spec)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                      specialization.includes(spec)
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'glass border-white/20 text-white/60 hover:border-blue-400 hover:text-blue-400'
                    }`}
                  >
                    {spec}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Intro Video */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-white/60 mb-3">
                <i className="fas fa-video mr-1"></i> Intro Video
              </label>
              
              {introVideo ? (
                <div className="glass rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                        <i className="fas fa-video text-white"></i>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{introVideo.name}</p>
                        <p className="text-xs text-white/50">{(introVideo.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIntroVideo(null)}
                      className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-all"
                    >
                      <i className="fas fa-times mr-1"></i>
                      Remove
                    </motion.button>
                  </div>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => videoInputRef.current?.click()}
                  className="w-full py-8 glass rounded-xl border-2 border-dashed border-white/20 hover:border-purple-400 transition-all flex flex-col items-center gap-3 text-white/60 hover:text-purple-400"
                >
                  <i className="fas fa-cloud-upload-alt text-4xl"></i>
                  <div className="text-center">
                    <p className="text-sm font-medium">Upload Intro Video</p>
                    <p className="text-xs mt-1">MP4, MOV, WebM • Max 100MB</p>
                  </div>
                </motion.button>
              )}
              
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={handleVideoSelect}
              />
            </div>
          </div>
        </motion.div>
      )}


    </div>
  );
}
