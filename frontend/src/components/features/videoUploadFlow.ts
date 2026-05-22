import axios, { type AxiosError, type CancelTokenSource } from 'axios';
import type { UploadStage } from './VideoUploader';

type StorageApi = {
  getUploadUrl: (filename: string, contentType: string, analysisType?: string) => Promise<{
    data: {
      signed_url: string;
      blob_name: string;
      submission_id: string;
    };
  }>;
  confirmUpload: (submissionId: string) => Promise<unknown>;
  startProcessing: (submissionId: string) => Promise<unknown>;
};

type AxiosClient = {
  put: typeof axios.put;
  isCancel: typeof axios.isCancel;
  CancelToken: { source: () => CancelTokenSource };
};

export function isUploadingStage(stage: UploadStage): boolean {
  return !['idle', 'done', 'error'].includes(stage);
}

interface VideoUploadFlowArgs {
  file: File;
  analysisType: 'BATTING' | 'BOWLING';
  storageApi: StorageApi;
  axiosClient: AxiosClient;
  refreshQuota: () => Promise<void>;
  setStage: (stage: UploadStage) => void;
  setStatusMessage: (message: string) => void;
  setUploadProgress: (progress: number) => void;
  setSubmissionId: (submissionId: string | null) => void;
  onUploadComplete?: (submissionId: string) => void;
  onCancel?: () => void;
  onFailure?: (message: string, detail: string) => void;
}

export async function runVideoUploadFlow({
  file,
  analysisType,
  storageApi,
  axiosClient,
  refreshQuota,
  setStage,
  setStatusMessage,
  setUploadProgress,
  setSubmissionId,
  onUploadComplete,
  onCancel,
  onFailure,
}: VideoUploadFlowArgs): Promise<void> {
  try {
    setStage('requesting');
    setStatusMessage('Requesting secure upload link…');
    setUploadProgress(0);

    const { data: urlData } = await storageApi.getUploadUrl(
      file.name,
      file.type,
      analysisType,
    );

    const { signed_url, submission_id } = urlData;
    setSubmissionId(submission_id);

    setStage('uploading');
    setStatusMessage('Uploading to cloud…');

    const source = axiosClient.CancelToken.source();

    await axiosClient.put(signed_url, file, {
      headers: { 'Content-Type': file.type },
      cancelToken: source.token,
      onUploadProgress: (evt) => {
        if (evt.total) {
          const pct = Math.round((evt.loaded * 100) / evt.total);
          setUploadProgress(pct);
          setStatusMessage(`Uploading to cloud: ${pct}%`);
        }
      },
    });

    setStage('confirming');
    setStatusMessage('Verifying upload…');
    setUploadProgress(100);

    await storageApi.confirmUpload(submission_id);

    setStage('queuing');
    setStatusMessage('Queuing video for analysis…');

    await storageApi.startProcessing(submission_id);
    await refreshQuota();

    setStage('done');
    setStatusMessage('Upload complete — processing started!');
    onUploadComplete?.(submission_id);
  } catch (err) {
    if (axiosClient.isCancel(err)) {
      onCancel?.();
      return;
    }

    const axiosErr = err as AxiosError<{ detail?: string }>;
    const status = axiosErr.response?.status;
    const detail = axiosErr.response?.data?.detail || axiosErr.message || 'Unknown error';

    if (status === 429) {
      onFailure?.('Monthly quota reached - upgrade your plan to continue.', detail);
      await refreshQuota();
    } else if (status === 403 || status === 400) {
      onFailure?.('Upload link expired — please try again.', detail);
    } else if (status === 503) {
      onFailure?.('Cloud storage is not configured on this server.', detail);
    } else {
      onFailure?.('Something went wrong. Please try again.', detail);
    }
  }
}