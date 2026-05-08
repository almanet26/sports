export interface PlayerProfileSummary {
  fullName: string;
  avatar: string;
}

export function getStoredPlayerProfileSummary(): PlayerProfileSummary {
  try {
    const stored = localStorage.getItem('user_profile');
    if (stored) {
      const profile = JSON.parse(stored);
      return {
        fullName: profile.name || profile.full_name || '',
        avatar: profile.profile_image_url || '',
      };
    }
  } catch (e) {
    console.error('Failed to parse player profile:', e);
  }
  return { fullName: '', avatar: '' };
}
