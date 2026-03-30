declare module '../components/features/HeavyVideoUploader' {
  import * as React from 'react';

  interface HeavyVideoUploaderProps {
    analysisType?: 'FULL_MATCH' | 'BOWLING' | 'BATTING';
    sessionPath?: string;
    startProcessingPath?: string;
    onUploadComplete?: (payload: { submissionId: string; filename: string }) => void;
  }

  const HeavyVideoUploader: React.ComponentType<HeavyVideoUploaderProps>;
  export default HeavyVideoUploader;
}
