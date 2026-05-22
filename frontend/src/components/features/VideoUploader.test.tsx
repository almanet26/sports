import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isUploadingStage, runVideoUploadFlow } from './videoUploadFlow';
import { storageApi } from '../../lib/api';

const refreshQuotaMock = vi.fn();

vi.mock('../../lib/api', () => ({
  storageApi: {
    getUploadUrl: vi.fn(),
    confirmUpload: vi.fn(),
    startProcessing: vi.fn(),
  },
  api: {},
  authApi: {},
  billingApi: {},
  videosApi: {},
  submissionApi: {},
  subscriptionApi: {},
}));

vi.mock('axios', () => ({
  default: {
    put: vi.fn(),
    isCancel: vi.fn(() => false),
    CancelToken: {
      source: vi.fn(() => ({
        token: 'test-token',
        cancel: vi.fn(),
      })),
    },
  },
}));

describe('VideoUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshQuotaMock.mockResolvedValue(undefined);
  });

  it('marks the upload stage as busy and refreshes quota after success', async () => {
    let resolveUploadUrl: any;
    const uploadUrlPromise = new Promise((resolve) => {
      resolveUploadUrl = resolve;
    });

    vi.mocked(storageApi.getUploadUrl).mockReturnValue(uploadUrlPromise as never);
    vi.mocked(storageApi.confirmUpload).mockResolvedValue({
      data: {
        submission_id: 'submission-123',
        status: 'confirmed',
        blob_name: 'match.mp4',
      },
    } as never);
    vi.mocked(storageApi.startProcessing).mockResolvedValue({
      data: {
        submission_id: 'submission-123',
        status: 'queued',
        task_name: 'task-1',
      },
    } as never);

    const axiosModule = await import('axios');
    vi.mocked(axiosModule.default.put).mockResolvedValue({} as never);

    const stageCalls: string[] = [];
    const statusCalls: string[] = [];
    const progressCalls: number[] = [];

    const uploadPromise = runVideoUploadFlow({
      file: new File(['video-bytes'], 'match.mp4', { type: 'video/mp4' }),
      analysisType: 'BATTING',
      storageApi,
      axiosClient: axiosModule.default,
      refreshQuota: refreshQuotaMock,
      setStage: (stage) => stageCalls.push(stage),
      setStatusMessage: (message) => statusCalls.push(message),
      setUploadProgress: (progress) => progressCalls.push(progress),
      setSubmissionId: vi.fn(),
    });

    expect(isUploadingStage('requesting')).toBe(true);
    expect(stageCalls).toContain('requesting');

    resolveUploadUrl?.({
      data: {
        signed_url: 'https://storage.example/upload',
        blob_name: 'match.mp4',
        submission_id: 'submission-123',
      },
    });

    await uploadPromise;

    expect(refreshQuotaMock).toHaveBeenCalledTimes(1);
    expect(storageApi.getUploadUrl).toHaveBeenCalledWith('match.mp4', 'video/mp4', 'BATTING');
    expect(storageApi.confirmUpload).toHaveBeenCalledWith('submission-123');
    expect(storageApi.startProcessing).toHaveBeenCalledWith('submission-123');
    expect(stageCalls).toContain('uploading');
    expect(stageCalls).toContain('done');
    expect(statusCalls).toContain('Upload complete — processing started!');
    expect(progressCalls).toContain(100);
  });

  it('calls onFailure with quota message and still refreshes quota on 429', async () => {
    const err = Object.assign(new Error('Request failed with status code 429'), {
      response: { status: 429, data: { detail: 'monthly limit reached' } },
    });
    vi.mocked(storageApi.getUploadUrl).mockRejectedValue(err);

    const axiosModule = await import('axios');
    const onFailure = vi.fn();

    await runVideoUploadFlow({
      file: new File([''], 'test.mp4', { type: 'video/mp4' }),
      analysisType: 'BATTING',
      storageApi,
      axiosClient: axiosModule.default,
      refreshQuota: refreshQuotaMock,
      setStage: vi.fn(),
      setStatusMessage: vi.fn(),
      setUploadProgress: vi.fn(),
      setSubmissionId: vi.fn(),
      onFailure,
    });

    expect(onFailure).toHaveBeenCalledWith(
      'Monthly quota reached - upgrade your plan to continue.',
      'monthly limit reached',
    );
    expect(refreshQuotaMock).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel and not onFailure when the upload is cancelled mid-flight', async () => {
    const axiosModule = await import('axios');
    const cancelErr = new Error('Upload cancelled by user');
    vi.mocked(axiosModule.default.put).mockRejectedValue(cancelErr);
    vi.mocked(axiosModule.default.isCancel).mockReturnValue(true);
    vi.mocked(storageApi.getUploadUrl).mockResolvedValue({
      data: {
        signed_url: 'https://storage.example/upload',
        blob_name: 'match.mp4',
        submission_id: 'sub-1',
      },
    } as never);

    const onCancel = vi.fn();
    const onFailure = vi.fn();

    await runVideoUploadFlow({
      file: new File([''], 'test.mp4', { type: 'video/mp4' }),
      analysisType: 'BATTING',
      storageApi,
      axiosClient: axiosModule.default,
      refreshQuota: refreshQuotaMock,
      setStage: vi.fn(),
      setStatusMessage: vi.fn(),
      setUploadProgress: vi.fn(),
      setSubmissionId: vi.fn(),
      onCancel,
      onFailure,
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    expect(refreshQuotaMock).not.toHaveBeenCalled();
  });
});
