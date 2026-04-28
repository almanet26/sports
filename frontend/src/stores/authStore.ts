import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../lib/api';
import type { Tier, SubscriptionStatus, QuotaUsage } from '../types/subscriptionPlans';

interface SubscriptionUser {
  id: string;
  email: string;
  name: string;
  accountType: 'PLAYER' | 'COACH' | 'ADMIN';
}

interface SubscriptionState {
  user: SubscriptionUser | null;
  accountType: 'PLAYER' | 'COACH' | 'ADMIN';
  subscriptionTier: Tier;
  subscriptionStatus: SubscriptionStatus;
  expiresAt: string | null;
  quotaUsage: QuotaUsage;
  isLoading: boolean;
  fetchMe: () => Promise<void>;
  refreshQuota: () => Promise<void>;
}

const DEFAULT_QUOTA: QuotaUsage = {
  biomech: { used: 0, limit: 0 },
  ocr_hours: { used: 0, limit: 0 },
  submissions: { used: 0, limit: 0 },
};

function normalizeQuotaUsage(value: unknown): QuotaUsage {
  if (!value || typeof value !== 'object') {
    return DEFAULT_QUOTA;
  }

  const candidate = value as Partial<QuotaUsage>;

  return {
    biomech: candidate.biomech ?? DEFAULT_QUOTA.biomech,
    ocr_hours: candidate.ocr_hours ?? DEFAULT_QUOTA.ocr_hours,
    submissions: candidate.submissions ?? DEFAULT_QUOTA.submissions,
  };
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      user: null,
      accountType: 'PLAYER',
      subscriptionTier: 'free' as Tier,
      subscriptionStatus: 'inactive' as SubscriptionStatus,
      expiresAt: null,
      quotaUsage: DEFAULT_QUOTA,
      isLoading: false,

      fetchMe: async () => {
        set({ isLoading: true });
        try {
          const [{ data: profile }, { data: usage }] = await Promise.all([
            api.get('/auth/me'),
            api.get('/billing/usage'),
          ]);
          set({
            user: {
              id: profile.id,
              email: profile.email,
              name: profile.full_name ?? profile.name,
              accountType: (profile.account_type ?? profile.role ?? 'PLAYER') as 'PLAYER' | 'COACH' | 'ADMIN',
            },
            accountType: (profile.account_type ?? profile.role ?? 'PLAYER') as 'PLAYER' | 'COACH' | 'ADMIN',
            subscriptionTier: (profile.subscription_role ?? usage.role ?? 'free') as Tier,
            subscriptionStatus: (usage.status ?? 'inactive') as SubscriptionStatus,
            expiresAt: usage.expires_at ?? null,
            // billing/usage wraps quota inside current_month
            quotaUsage: usage.current_month ?? DEFAULT_QUOTA,
          });
        } catch {
          // Auth interceptor in api.ts handles 401 redirect
        } finally {
          set({ isLoading: false });
        }
      },

      refreshQuota: async () => {
        try {
          const { data } = await api.get('/billing/usage');
          set({ quotaUsage: normalizeQuotaUsage((data as { current_month?: unknown }).current_month) });
        } catch {
          // Quota refresh failures are non-fatal
        }
      },
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(() => localStorage),
      // Never persist quota — it must be fetched fresh each session
      partialize: (state) => ({
        user: state.user,
        accountType: state.accountType,
        subscriptionTier: state.subscriptionTier,
        subscriptionStatus: state.subscriptionStatus,
        expiresAt: state.expiresAt,
      }),
    },
  ),
);
