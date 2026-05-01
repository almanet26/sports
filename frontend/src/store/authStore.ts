/**
 * Authentication & Subscription Store (Zustand)
 *
 * Single source of truth for user auth state AND subscription/billing state.
 * Replaces the former split between store/authStore.ts and stores/authStore.ts.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authApi, api } from '../lib/api';
import { AxiosError } from 'axios';
import type { Tier, SubscriptionStatus, QuotaUsage } from '../types/subscriptionPlans';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  coach_status?: string;
}

const DEFAULT_QUOTA: QuotaUsage = {
  biomech: { used: 0, limit: 0 },
  ocr_hours: { used: 0, limit: 0 },
  submissions: { used: 0, limit: 0 },
};

function normalizeQuotaUsage(value: unknown): QuotaUsage {
  if (!value || typeof value !== 'object') return DEFAULT_QUOTA;
  const candidate = value as Partial<QuotaUsage>;
  return {
    biomech: candidate.biomech ?? DEFAULT_QUOTA.biomech,
    ocr_hours: candidate.ocr_hours ?? DEFAULT_QUOTA.ocr_hours,
    submissions: candidate.submissions ?? DEFAULT_QUOTA.submissions,
  };
}

// ─── State Interface ──────────────────────────────────────────────────────────

interface AuthState {
  // ── Auth fields ──
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // ── Shared derived fields (account type + tier) ──
  accountType: UserRole;
  subscriptionTier: Tier;

  // ── Subscription / billing fields ──
  subscriptionStatus: SubscriptionStatus;
  expiresAt: string | null;
  quotaUsage: QuotaUsage;

  // ── Auth actions ──
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

  // ── Subscription actions ──
  fetchMe: () => Promise<void>;
  refreshQuota: () => Promise<void>;

  // ── Helpers ──
  hasRole: (role: UserRole | UserRole[]) => boolean;
  canUpload: () => boolean;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ── Initial state ──
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      accountType: 'PLAYER',
      subscriptionTier: 'free' as Tier,
      subscriptionStatus: 'inactive' as SubscriptionStatus,
      expiresAt: null,
      quotaUsage: DEFAULT_QUOTA,

      // ── Auth actions ─────────────────────────────────────────────────────

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(email, password);
          const { access_token, refresh_token, user } = response.data;

          localStorage.setItem('access_token', access_token);
          if (refresh_token) localStorage.setItem('refresh_token', refresh_token);

          // Decode JWT for immediate role hint (fetchMe will correct this)
          let roleFromToken: UserRole = 'PLAYER';
          let userIdFromToken = '';
          try {
            const b64 = access_token.split('.')[1];
            const decoded = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
            if (decoded.role) roleFromToken = decoded.role as UserRole;
            if (decoded.user_id) userIdFromToken = decoded.user_id;
          } catch { /* fetchMe will supply correct values */ }

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
            subscriptionTier: (user?.subscription_role ?? 'free') as Tier,
          });

          // Fetch full profile + billing in one shot
          await get().fetchMe();

          set({ isLoading: false });
          return true;
        } catch (error) {
          const axiosError = error as AxiosError<{ detail: string }>;
          const message = axiosError.response?.data?.detail || 'Login failed. Please check your credentials.';
          set({ isLoading: false, error: message, isAuthenticated: false, user: null });
          throw new Error(message);
        }
      },

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

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore logout errors
        } finally {
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
            subscriptionTier: 'free' as Tier,
            subscriptionStatus: 'inactive' as SubscriptionStatus,
            expiresAt: null,
            quotaUsage: DEFAULT_QUOTA,
          });
        }
      },

      /**
       * fetchProfile — kept for backward compatibility, delegates to fetchMe.
       */
      fetchProfile: async () => {
        return get().fetchMe();
      },

      // ── Subscription actions ──────────────────────────────────────────────

      /**
       * fetchMe — fetches both the user profile (/auth/me) and billing usage
       * (/billing/usage) in parallel.  This is the canonical way to hydrate
       * both auth and subscription state after login or page load.
       */
      fetchMe: async () => {
        set({ isLoading: true });
        try {
          const [{ data: profile }, { data: usage }] = await Promise.all([
            api.get('/auth/me'),
            api.get('/billing/usage'),
          ]);

          const mappedUser: User = {
            ...profile,
            role: (profile.account_type ?? profile.role ?? 'PLAYER') as UserRole,
            name: profile.full_name ?? profile.name,
          };

          localStorage.setItem('user_profile', JSON.stringify(mappedUser));

          set({
            user: mappedUser,
            isAuthenticated: true,
            accountType: mappedUser.role,
            subscriptionTier: (profile.subscription_role ?? usage.role ?? 'free') as Tier,
            subscriptionStatus: (usage.status ?? 'inactive') as SubscriptionStatus,
            expiresAt: usage.expires_at ?? null,
            quotaUsage: normalizeQuotaUsage(usage.current_month),
          });
        } catch {
          // Auth interceptor in api.ts handles 401 redirect; quota failures are non-fatal
        } finally {
          set({ isLoading: false });
        }
      },

      /**
       * refreshQuota — lightweight re-fetch of just the billing/usage endpoint.
       * Call after actions that consume quota (biomech analysis, submission, etc.)
       */
      refreshQuota: async () => {
        try {
          const { data } = await api.get('/billing/usage');
          set({
            quotaUsage: normalizeQuotaUsage((data as { current_month?: unknown }).current_month),
            subscriptionStatus: (data.status ?? 'inactive') as SubscriptionStatus,
            expiresAt: data.expires_at ?? null,
          });
        } catch {
          // Non-fatal
        }
      },

      // ── Helpers ───────────────────────────────────────────────────────────

      clearError: () => set({ error: null }),

      hasRole: (role) => {
        const { user } = get();
        if (!user) return false;
        if (Array.isArray(role)) return role.includes(user.role);
        return user.role === role;
      },

      canUpload: () => {
        const { user } = get();
        return user?.role === 'ADMIN' || user?.role === 'COACH';
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Never persist quota — must be fetched fresh each session
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        accountType: state.accountType,
        subscriptionTier: state.subscriptionTier,
        subscriptionStatus: state.subscriptionStatus,
        expiresAt: state.expiresAt,
      }),
    },
  ),
);

// ── Re-export useSubscriptionStore as an alias so old imports still compile
// while being gradually migrated.
export const useSubscriptionStore = useAuthStore;

// ── Selector hooks ────────────────────────────────────────────────────────────
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useUserRole = () => useAuthStore((state) => state.user?.role);
export const useCanUpload = () => useAuthStore((state) => state.canUpload());
