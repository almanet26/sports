import DashboardLayout from '../components/DashboardLayout';

export default function PlayerDashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Player Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Welcome back, Player!</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-sm font-medium transition">Export</button>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">Share</button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Videos</div>
          <div className="text-3xl font-bold mt-2 text-slate-100 font-mono tabular-nums">12</div>
          <div className="text-xs text-emerald-500 mt-1">↑ 3 this week</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Connected Coaches</div>
          <div className="text-3xl font-bold mt-2 text-slate-100 font-mono tabular-nums">3</div>
          <div className="text-xs text-blue-500 mt-1">2 active sessions</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Feedback Received</div>
          <div className="text-3xl font-bold mt-2 text-slate-100 font-mono tabular-nums">8</div>
          <div className="text-xs text-violet-500 mt-1">5 pending review</div>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {/* Upload Zone */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-100">Upload Zone</h2>
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-12 text-center hover:border-blue-500 hover:bg-slate-750 hover:shadow-lg hover:shadow-blue-500/20 transition-all cursor-pointer animate-pulse-slow group">
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🎹</div>
            <div className="text-base font-medium text-slate-300">Drag & drop video here</div>
            <div className="text-sm text-slate-400 mt-2">or click to browse</div>
            <div className="text-xs text-slate-500 mt-4 font-mono">Accepted Formats: MP4, MOV, AVI (max 2GB)</div>
          </div>
        </div>
        
        {/* Coach Directory */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-100">Coach Directory</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            { [
              { name: 'Coach A', specialty: 'Batting', rating: 4.8, exp: '10 years', tags: ['Power Hitting', 'Cover Drive'], price: 75 },
              { name: 'Coach B', specialty: 'Bowling', rating: 4.6, exp: '8 years', tags: ['Leg Spin', 'Fast Bowling'], price: 60 },
              { name: 'Coach C', specialty: 'Fielding', rating: 4.7, exp: '12 years', tags: ['Match Strategy', 'Technique'], price: 90 }
            ].map((coach, i) => (
              <div key={i} className="bg-slate-900 border border-slate-700 p-3 rounded-lg hover:bg-slate-750 hover:border-slate-600 transition">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold text-slate-100">{coach.name}</div>
                    <div className="text-xs text-slate-400 font-mono">⭐ {coach.rating} • {coach.exp}</div>
                  </div>
                  <div className="font-mono text-emerald-400 font-semibold text-sm">${coach.price}/review</div>
                </div>
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {coach.tags.map((tag, j) => (
                    <span key={j} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
                <button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition">Connect</button>
              </div>
            )) }
          </div>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 text-slate-100">Recent Feedback</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-4 p-4 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-750 transition">
            <div className="w-20 h-14 bg-gradient-to-br from-blue-600 to-violet-600 rounded flex items-center justify-center text-white text-xs font-bold">VIDEO</div>
            <div className="flex-1">
              <div className="font-semibold text-slate-100">Match vs Team X - Batting Highlights</div>
              <div className="text-sm text-slate-400">Coach A reviewed your video</div>
              <div className="text-sm text-blue-500 mt-1 cursor-pointer hover:text-blue-400">View Feedback →</div>
            </div>
            <div className="text-xs text-slate-500 font-mono">2h ago</div>
          </div>
          <div className="text-center text-slate-500 py-4 text-sm">No more recent activity</div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
