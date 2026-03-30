import HeavyVideoUploader from "./features/HeavyVideoUploader";

type AnalysisType = "FULL_MATCH" | "BATTING" | "BOWLING";

interface VideoUploadProps {
  analysisType?: AnalysisType;
}

export default function VideoUpload({ analysisType = "FULL_MATCH" }: VideoUploadProps) {
  return <HeavyVideoUploader analysisType={analysisType} />;
}
