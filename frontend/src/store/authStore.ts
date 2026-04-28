/**
 * Authentication Store (Zustand)
 * 
 * Manages user authentication state with persistence.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authApi } from '../lib/api';
import { AxiosError } from 'axios';

// Types
export type UserRole = 'PLAYER' | 'COACH' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  team?: string;
  profile_bio?: string;
  gender?: string;
  jersey_number?: number;
  is_verified: boolean;
  created_at: string;
  last_login?: string;
  
  // Coach profile fields
  certifications?: Array<{name: string; issuer: string; year: string}>;
  specialization?: string[];
  intro_video_url?: string;
  profile_image_url?: string;
  coach_category?: string;
}

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  accountType: UserRole;
  subscriptionTier: string;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role: 'PLAYER' | 'COACH';
    phone?: string;
    team?: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  clearError: () => void;
  
  // Helpers
  hasRole: (role: UserRole | UserRole[]) => boolean;
  canUpload: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      accountType: 'PLAYER',
      subscriptionTier: 'free',
      
      // Login action
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          // Call login endpoint
          const response = await authApi.login(email, password);
          const { access_token, refresh_token, user } = response.data;

          // Store tokens in localStorage for axios interceptor
          localStorage.setItem('access_token', access_token);
          if (refresh_token) {
            localStorage.setItem('refresh_token', refresh_token);
          }

          // Decode JWT payload immediately — backend embeds role from DB at signing time
          let roleFromToken: UserRole = 'PLAYER';
          let userIdFromToken = '';
          try {
            const b64 = access_token.split('.')[1];
            const decoded = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
            if (decoded.role) roleFromToken = decoded.role as UserRole;
            if (decoded.user_id) userIdFromToken = decoded.user_id;
          } catch { /* fetchProfile will supply correct values */ }

          const userData: User = user ? {
            id: user.id,
            email: user.email,
            name: user.full_name || user.name || '',
            role: (user.account_type ?? user.role ?? roleFromToken) as UserRole,
            is_verified: true,
            created_at: new Date().toISOString(),
          } : {
            id: userIdFromToken,
            email,
            name: '',
            role: roleFromToken,
            is_verified: true,
            created_at: new Date().toISOString(),
          };

          localStorage.setItem('user_profile', JSON.stringify(userData));

          set({
            token: access_token,
            refreshToken: refresh_token || null,
            user: userData,
            isAuthenticated: true,
            accountType: userData.role,
            subscriptionTier: (user?.subscription_role ?? 'free') as string,
          });

          // Fetch full profile to populate name, phone, team, etc.
          await get().fetchProfile();

          set({ isLoading: false });
          return true;
        } catch (error) {
          const axiosError = error as AxiosError<{ detail: string }>;
          const message = axiosError.response?.data?.detail || 'Login failed. Please check your credentials.';
          set({ isLoading: false, error: message, isAuthenticated: false, user: null });
          throw new Error(message);
        }
      },
      
      // Register action
      register: async (data) => {
        set({ isLoading: true, error: null });
        
        try {
          await authApi.register(data);
          set({ isLoading: false });
          return true;
        } catch (error) {
          const axiosError = error as AxiosError<{ detail: string }>;
          const message = axiosError.response?.data?.detail || 'Registration failed. Please try again.';
          set({ isLoading: false, error: message });
          return false;
        }
      },
      
      // Logout action
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore logout errors
        } finally {
          // Clear all auth data
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_profile');
          
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            error: null,
            accountType: 'PLAYER',
            subscriptionTier: 'free',
          });
        }
      },
      
      // Fetch user profile
      fetchProfile: async () => {
        try {
          const response = await authApi.getProfile();
          const profile = response.data as User & { account_type?: UserRole; subscription_role?: string };
          const mappedUser: User = {
            ...profile,
            role: (profile.account_type ?? profile.role ?? 'PLAYER') as UserRole,
          };
          
          // Also store in localStorage for backward compatibility
          localStorage.setItem('user_profile', JSON.stringify(mappedUser));
          
          set({
            user: mappedUser,
            isAuthenticated: true,
            accountType: mappedUser.role,
            subscriptionTier: profile.subscription_role ?? 'free',
          });
        } catch (error) {
          console.error('Failed to fetch profile:', error);
          // If profile fetch fails, clear auth
          get().logout();
        }
      },
      
      // Clear error
      clearError: () => set({ error: null }),
      
      // Check if user has required role(s)
      hasRole: (role: UserRole | UserRole[]) => {
        const { user } = get();
        if (!user) return false;
        
        if (Array.isArray(role)) {
          return role.includes(user.role);
        }
        return user.role === role;
      },
      
      // Check if user can upload videos (ADMIN or COACH)
      canUpload: () => {
        const { user } = get();
        return user?.role === 'ADMIN' || user?.role === 'COACH';
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        accountType: state.accountType,
        subscriptionTier: state.subscriptionTier,
      }),
    }
  )
);

// Selector hooks for common use cases
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useUserRole = () => useAuthStore((state) => state.user?.role);
export const useCanUpload = () => useAuthStore((state) => state.canUpload());

