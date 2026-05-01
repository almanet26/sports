/**
 * @deprecated Use `../../store/authStore` directly.
 *
 * This file is kept as a thin re-export shim so that existing imports
 * (`from '../stores/authStore'`) continue to work while the codebase is
 * gradually migrated to the single canonical store at `store/authStore.ts`.
 */
export {
  useAuthStore,
  useUser,
  useIsAuthenticated,
  useUserRole,
  useCanUpload,
} from '../store/authStore';
export type { User, UserRole } from '../store/authStore';

// stub for main branch compatibility
export const useSubscriptionStore = () => ({ tier: 'BASIC', isActive: false });
