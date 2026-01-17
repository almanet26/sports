import { DashboardLayout } from '../components/layout/DashboardLayout';

export default function CoachDashboard() {
  return (
    <DashboardLayout>
    <div className="space-y-6 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Coach Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Welcome back, Coach!</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-sm font-medium transition">Export</button>
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">New Session</button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Connected Players</div>
          <div className="text-3xl font-bold mt-2 text-slate-100 font-mono tabular-nums">15</div>
          <div className="text-xs text-emerald-500 mt-1">↑ 2 new this week</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Videos Analyzed</div>
          <div className="text-3xl font-bold mt-2 text-slate-100 font-mono tabular-nums">42</div>
          <div className="text-xs text-blue-500 mt-1">8 this week</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pending Requests</div>
          <div className="text-3xl font-bold mt-2 text-slate-100 font-mono tabular-nums">5</div>
          <div className="text-xs text-amber-500 mt-1">Requires attention</div>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {/* Activity Feed / Inbox */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-100">Recent Uploads Needing Review</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {[
              { player: 'Rahul Kumar', video: 'Match vs Team B - Batting', uploaded: '2 hours ago', status: 'pending' },
              { player: 'Priya Singh', video: 'Training Session #12', uploaded: '5 hours ago', status: 'pending' },
              { player: 'Arjun Patel', video: 'Tournament Final - Highlights', uploaded: '1 day ago', status: 'in-progress' },
              { player: 'Sneha Reddy', video: 'Practice Nets - Cover Drive', uploaded: '1 day ago', status: 'pending' },
            ].map((upload, i) => (
              <div key={i} className="bg-slate-900 border border-slate-700 p-3 rounded-lg hover:bg-slate-750 hover:border-slate-600 transition group">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-100 text-sm">{upload.player}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{upload.video}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-mono text-xs text-slate-500">{upload.uploaded}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        upload.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {upload.status === 'pending' ? '⏱ Pending' : '🔄 In Progress'}
                      </span>
                    </div>
                  </div>
                  <button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition opacity-0 group-hover:opacity-100">Review</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Connection Requests */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-100">Connection Requests</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {[
              { name: 'Player X', team: 'Team A', jersey: 12 },
              { name: 'Player Y', team: 'Team B', jersey: 7 },
              { name: 'Player Z', team: 'Team C', jersey: 22 }
            ].map((player, i) => (
              <div key={i} className="bg-slate-900 border border-slate-700 p-4 rounded-lg hover:bg-slate-750 hover:border-slate-600 transition">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold text-slate-100">{player.name}</div>
                    <div className="text-xs text-slate-400">{player.team} • Jersey #{player.jersey}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition">Accept</button>
                  <button className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Analysis Studio */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 text-slate-100">Analysis Studio</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { player: 'Player X', video: 'Batting Practice', status: 'Ready for Review' },
            { player: 'Player Y', video: 'Match Highlights', status: 'Processing' }
          ].map((item, i) => (
            <div key={i} className="bg-slate-900 border border-slate-700 p-4 rounded-lg hover:bg-slate-750 hover:border-slate-600 transition">
              <div className="w-full h-28 bg-gradient-to-br from-violet-600 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold mb-3">VIDEO</div>
              <div className="font-semibold text-slate-100">{item.player}</div>
              <div className="text-sm text-slate-400">{item.video}</div>
              <div className="text-xs text-blue-500 mt-2">{item.status}</div>
              <button className="mt-3 w-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition">Analyze</button>
            </div>
          ))}
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
