import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

type ClipType = 'FOURS' | 'SIXES' | 'WICKETS';

interface Highlight {
  id: string;
  type: ClipType;
  over: string;
  ball: number;
  duration: string;
  videoUrl: string;
  thumbnail: string;
  description?: string;
}

export default function HighlightsViewerPage() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ClipType>('SIXES');

  // Mock data - replace with actual API call
  const videoInfo = {
    id: videoId,
    title: 'IND vs AUS - ODI World Cup 2023',
    date: '2023-12-10',
    totalHighlights: 18
  };

  const highlights: Highlight[] = [
    { id: '1', type: 'SIXES', over: '12.3', ball: 3, duration: '0:08', videoUrl: '', thumbnail: '', description: 'Massive six over long-on' },
    { id: '2', type: 'SIXES', over: '15.1', ball: 1, duration: '0:06', videoUrl: '', thumbnail: '', description: 'Straight down the ground' },
    { id: '3', type: 'SIXES', over: '18.4', ball: 4, duration: '0:07', videoUrl: '', thumbnail: '', description: 'Pull shot for six' },
    { id: '4', type: 'FOURS', over: '5.2', ball: 2, duration: '0:05', videoUrl: '', thumbnail: '', description: 'Cover drive boundary' },
    { id: '5', type: 'FOURS', over: '8.6', ball: 6, duration: '0:06', videoUrl: '', thumbnail: '', description: 'Square cut to the fence' },
    { id: '6', type: 'WICKETS', over: '10.5', ball: 5, duration: '0:10', videoUrl: '', thumbnail: '', description: 'Bowled! What a delivery' },
    { id: '7', type: 'WICKETS', over: '14.2', ball: 2, duration: '0:09', videoUrl: '', thumbnail: '', description: 'Caught at mid-off' },
  ];

  const filteredHighlights = highlights.filter(h => h.type === activeTab);

  const tabConfig = {
    FOURS: { 
      label: 'Fours', 
      icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><text x="3" y="16" fontSize="14" fontWeight="bold">4</text></svg>, 
      gradient: 'from-blue-500 to-blue-600' 
    },
    SIXES: { 
      label: 'Sixes', 
      icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><text x="3" y="16" fontSize="14" fontWeight="bold">6</text></svg>, 
      gradient: 'from-emerald-500 to-emerald-600' 
    },
    WICKETS: { 
      label: 'Wickets', 
      icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" /></svg>, 
      gradient: 'from-red-500 to-red-600' 
    }
  };

  const handleDownload = (highlightId: string) => {
    // TODO: Implement download logic
    console.log('Downloading highlight:', highlightId);
  };

  return (
    <DashboardLayout>
      <div>
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/player-dashboard')}
            className="text-slate-400 hover:text-slate-300 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-100">{videoInfo.title}</h1>
              <p className="text-slate-400 mt-1">{videoInfo.date} • {videoInfo.totalHighlights} highlights</p>
            </div>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg font-medium transition">
              Download All
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-8">
          {(Object.keys(tabConfig) as ClipType[]).map((tab) => {
            const config = tabConfig[tab];
            const count = highlights.filter(h => h.type === tab).length;
            const isActive = activeTab === tab;
            
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-6 py-4 rounded-lg font-semibold transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg scale-105`
                    : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                    isActive ? 'bg-white/20' : 'bg-slate-700'
                  }`}>
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Highlights Grid */}
        {filteredHighlights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredHighlights.map((highlight) => (
              <div
                key={highlight.id}
                className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition group"
              >
                {/* Video Player */}
                <div className="aspect-video bg-slate-900 relative">
                  {/* TODO: Replace with actual video player */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="w-16 h-16 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center transition">
                      <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </button>
                  </div>
                  {/* Event Type Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${tabConfig[highlight.type].gradient} text-white shadow-lg flex items-center gap-1`}>
                      <span className="w-4 h-4">{tabConfig[highlight.type].icon}</span>
                      <span>{tabConfig[highlight.type].label}</span>
                    </span>
                  </div>
                  {/* Duration Badge */}
                  <div className="absolute bottom-3 right-3">
                    <span className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs font-mono text-white">
                      {highlight.duration}
                    </span>
                  </div>
                </div>

                {/* Clip Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-slate-100 mb-1">
                        Over {highlight.over}
                      </div>
                      {highlight.description && (
                        <p className="text-sm text-slate-400">{highlight.description}</p>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-slate-700 rounded text-xs font-mono text-slate-300">
                      Ball {highlight.ball}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleDownload(highlight.id)}
                      className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                    <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
            <div className="mb-4 flex justify-center">
              <svg className="w-16 h-16 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              No {tabConfig[activeTab].label} Found
            </h3>
            <p className="text-slate-500">
              This match doesn't have any {tabConfig[activeTab].label.toLowerCase()} highlights.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
