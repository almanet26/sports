import VideoUpload from '../components/VideoUpload';

export default function UploadPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Match Video</h1>
        <p className="text-slate-400 mt-1">
          Upload a cricket match video to automatically extract highlights (4s, 6s, Wickets)
        </p>
      </div>

      {/* Upload Component */}
      <VideoUpload />
    </div>
  );
}
