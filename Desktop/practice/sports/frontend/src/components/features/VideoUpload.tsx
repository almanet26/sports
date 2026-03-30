import React from "react";
import HeavyVideoUploader from "./HeavyVideoUploader";

type AnalysisType = "FULL_MATCH" | "BATTING" | "BOWLING";

interface VideoUploadProps {
  className?: string;
  analysisType?: AnalysisType;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ analysisType = "FULL_MATCH" }) => {
  return <HeavyVideoUploader analysisType={analysisType} />;
};
