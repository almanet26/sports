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
  jersey_number?: number;
  is_verified: boolean;
  created_at: string;
  last_login?: string;
}

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
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

function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_profile');
}

function normalizeUser(user: unknown): User | null {
  if (!user || typeof user !== 'object') return null;

  const source = user as Partial<User> & { full_name?: string; role?: string };
  const role = typeof source.role === 'string' ? source.role.toUpperCase() : '';

  if (role !== 'PLAYER' && role !== 'COACH' && role !== 'ADMIN') {
    return null;
  }

  return {
    id: String(source.id ?? ''),
    email: String(source.email ?? ''),
    name: String(source.name ?? source.full_name ?? ''),
    role,
    phone: source.phone,
    team: source.team,
    profile_bio: source.profile_bio,
    jersey_number: source.jersey_number,
    is_verified: Boolean(source.is_verified),
    created_at: String(source.created_at ?? ''),
    last_login: source.last_login,
  };
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
          
          const userData = normalizeUser(
            user ? {
              ...user,
              name: user.full_name || user.name,
              created_at: new Date().toISOString(),
              is_verified: true,
            } : null,
          );
          
          // Store user profile in localStorage
          if (userData) {
            localStorage.setItem('user_profile', JSON.stringify(userData));
          }
          
          set({
            token: access_token,
            refreshToken: refresh_token || null,
            user: userData,
            isAuthenticated: true,
          });
          
          // If user data is not in token response, fetch profile
          if (!user) {
            await get().fetchProfile();
          }
          
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
          clearStoredAuth();
          
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },
      
      // Fetch user profile
      fetchProfile: async () => {
        try {
          const response = await authApi.getProfile();
          const user = normalizeUser(response.data);
          if (!user) {
            throw new Error('Invalid user profile response');
          }
          
          // Also store in localStorage for backward compatibility
          localStorage.setItem('user_profile', JSON.stringify(user));
          
          set({ user, isAuthenticated: true });
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
      }),
    }
  )
);

// Selector hooks for common use cases
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useUserRole = () => useAuthStore((state) => state.user?.role);
export const useCanUpload = () => useAuthStore((state) => state.canUpload());

