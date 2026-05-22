import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
  authApi: {},
}));

import { api } from '../lib/api';
import { useAuthStore } from './authStore';

describe('useAuthStore refreshQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      quotaUsage: {
        biomech: { used: 0, limit: 0 },
        ocr_hours: { used: 0, limit: 0 },
        submissions: { used: 0, limit: 0 },
      },
      subscriptionStatus: 'inactive',
      expiresAt: null,
    });
  });

  it('updates quota and subscription metadata from billing usage', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        current_month: {
          biomech: { used: 2, limit: 15 },
          ocr_hours: { used: 1, limit: 50 },
          submissions: { used: 5, limit: 150 },
        },
        status: 'active',
        expires_at: '2026-12-31T00:00:00.000Z',
      },
    });

    await useAuthStore.getState().refreshQuota();

    expect(api.get).toHaveBeenCalledWith('/billing/usage');
    expect(useAuthStore.getState().quotaUsage).toEqual({
      biomech: { used: 2, limit: 15 },
      ocr_hours: { used: 1, limit: 50 },
      submissions: { used: 5, limit: 150 },
    });
    expect(useAuthStore.getState().subscriptionStatus).toBe('active');
    expect(useAuthStore.getState().expiresAt).toBe('2026-12-31T00:00:00.000Z');
  });
});