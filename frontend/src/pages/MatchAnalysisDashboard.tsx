export default function MatchAnalysisDashboard() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      {/* Far Left - Minimal Icon Navigation */}
      <aside className="w-16 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-6 gap-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">CV</div>
        <nav className="flex flex-col gap-4">
          <button className="w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition" title="Dashboard">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-slate-800 flex items-center justify-center transition" title="Upload">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z"/></svg>
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-slate-800 flex items-center justify-center transition" title="Marketplace">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-slate-800 flex items-center justify-center transition mt-auto" title="Settings">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>
          </button>
        </nav>
      </aside>

      {/* Left Sidebar - Player Stats */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">PLAYER STATS</h3>
          <div className="flex justify-around mb-4">
            {/* Radial Gauge - Bat Speed */}
            <div className="flex flex-col items-center">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-700"/>
                  <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="201" strokeDashoffset="50" className="text-emerald-500"/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xl font-bold font-mono text-emerald-400">92</div>
                  </div>
                </div>
              </div>
              <div className="text-center mt-1">
                <span className="text-xs text-slate-400">Bat Speed</span>
                <div className="text-[10px] text-slate-500 font-mono">km/h</div>
              </div>
            </div>
            {/* Radial Gauge - Reaction Time */}
            <div className="flex flex-col items-center">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-700"/>
                  <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="201" strokeDashoffset="80" className="text-blue-500"/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xl font-bold font-mono text-blue-400">0.42</div>
                  </div>
                </div>
              </div>
              <div className="text-center mt-1">
                <span className="text-xs text-slate-400">Reaction Time</span>
                <div className="text-[10px] text-slate-500 font-mono">seconds</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Clips */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex-1">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">RECENT CLIPS</h3>
          <div className="space-y-1.5 overflow-y-auto max-h-96">
            {[
              { time: '12:34', type: 'Cover Drive', color: 'bg-emerald-500' },
              { time: '14:22', type: 'Miss', color: 'bg-amber-500' },
              { time: '16:45', type: 'Wicket', color: 'bg-red-500' },
              { time: '18:12', type: 'Defense', color: 'bg-blue-500' },
              { time: '20:05', type: 'Pull Shot', color: 'bg-emerald-500' },
              { time: '22:34', type: 'Edge', color: 'bg-amber-500' },
            ].map((clip, i) => (
              <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-700 cursor-pointer transition">
                <div className="w-14 h-10 bg-slate-950 rounded flex items-center justify-center text-[10px] font-mono text-slate-500">
                  {clip.time}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${clip.color}`}></span>
                    <span className="text-xs font-medium">{clip.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content - Video Player & Timeline */}
      <main className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Match vs Team X - Session 1</h1>
            <p className="text-sm text-slate-400">December 10, 2025 • 45:23 duration</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-sm font-medium transition">Export</button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">Share Analysis</button>
          </div>
        </div>

        {/* Video Player with CV Overlays */}
        <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden">
          {/* Video Container */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              {/* Simulated Video Frame */}
              <div className="relative w-4/5 h-4/5">
                {/* Green Bounding Box - Batsman Detection (refined) */}
                <div className="absolute top-1/4 left-1/3 w-32 h-48 border border-emerald-400/80 rounded">
                  <span className="absolute -top-5 left-0 text-[10px] bg-emerald-500/70 backdrop-blur-sm px-1.5 py-0.5 rounded font-semibold">BATSMAN</span>
                </div>
                {/* Ball Trajectory Line with Data Label */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <path d="M 100 300 Q 300 150 500 250" stroke="#3b82f6" strokeWidth="2" fill="none" strokeDasharray="5,5"/>
                  <circle cx="500" cy="250" r="5" fill="#3b82f6"/>
                  {/* Data point label */}
                  <foreignObject x="290" y="135" width="100" height="25">
                    <div className="bg-blue-600/90 backdrop-blur-sm text-white px-2 py-1 rounded text-[10px] font-mono font-semibold whitespace-nowrap">
                      135 kph • 14°
                    </div>
                  </foreignObject>
                </svg>
                {/* Pitch Grid Overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 border-t border-slate-600 opacity-30">
                  <div className="grid grid-cols-8 h-full">
                    {[...Array(8)].map((_, i) => <div key={i} className="border-r border-slate-600"></div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Video Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 to-transparent p-4">
            <div className="flex items-center gap-4">
              <button className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
              </button>
              <div className="text-xs font-mono text-slate-400 tabular-nums">12:34 / 45:23</div>
              <div className="flex-1"></div>
              <button className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center transition text-xs">1x</button>
              <button className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center transition">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Timeline Editor with Event Blocks */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-4 mb-3">
            <h3 className="text-sm font-semibold text-slate-400">TIMELINE</h3>
            <button className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition">Add Marker</button>
          </div>
          {/* Ruler time markers */}
          <div className="flex text-[9px] text-slate-500 font-mono mb-1.5 px-2 tabular-nums">
            <span className="w-1/4 text-left">0:00</span>
            <span className="w-1/4 text-center">15:00</span>
            <span className="w-1/4 text-center">30:00</span>
            <span className="w-1/4 text-right">45:23</span>
          </div>
          <div className="relative h-16 bg-slate-900 rounded-lg overflow-hidden">
            {/* Tick marks for precision */}
            <div className="absolute inset-0 flex">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="flex-1 border-r border-slate-700/40" style={{ opacity: i % 4 === 0 ? 1 : 0.3 }} />
              ))}
            </div>
            {/* Event Blocks */}
            <div className="absolute inset-0 flex items-center px-2">
              <div className="absolute left-[10%] w-[8%] h-10 bg-emerald-500 rounded hover:bg-emerald-400 cursor-pointer transition flex items-center justify-center" title="Cover Drive">
                <span className="text-white text-[10px] font-semibold">Cover Drive</span>
              </div>
              <div className="absolute left-[25%] w-[5%] h-10 bg-amber-500 rounded hover:bg-amber-400 cursor-pointer transition flex items-center justify-center" title="Miss">
                <span className="text-white text-[10px]">Miss</span>
              </div>
              <div className="absolute left-[45%] w-[6%] h-full bg-red-500 rounded hover:bg-red-400 cursor-pointer transition flex items-center justify-center text-xs font-semibold" title="Wicket">
                <span className="text-white text-[10px]">Wicket</span>
              </div>
              <div className="absolute left-[60%] w-[7%] h-full bg-blue-500 rounded hover:bg-blue-400 cursor-pointer transition flex items-center justify-center text-xs font-semibold" title="Defense">
                <span className="text-white text-[10px]">Defense</span>
              </div>
              <div className="absolute left-[75%] w-[8%] h-full bg-emerald-500 rounded hover:bg-emerald-400 cursor-pointer transition flex items-center justify-center text-xs font-semibold" title="Pull Shot">
                <span className="text-white text-[10px]">Pull</span>
              </div>
            </div>
            {/* Playhead */}
            <div className="absolute left-[27%] top-0 bottom-0 w-0.5 bg-white shadow-lg">
              <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
      </main>

      {/* Right Sidebar - Coach's Feedback */}
      <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-400">COACH'S FEEDBACK</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Feedback Messages */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">CA</div>
            <div className="flex-1">
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold">Coach A</span>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">@ 12:34</span>
                </div>
                <p className="text-sm text-slate-300">Great cover drive! Notice how your front foot is perfectly aligned. Keep this technique consistent.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">CB</div>
            <div className="flex-1">
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold">Coach B</span>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">@ 14:22</span>
                </div>
                <p className="text-sm text-slate-300">On this delivery, you were a bit late. Work on reading the bowler's hand earlier.</p>
                {/* Voice Note */}
                <div className="mt-2 flex items-center gap-2 bg-slate-900 rounded-lg p-2">
                  <button className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                  </button>
                  <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="w-1/3 h-full bg-blue-600"></div>
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">0:45</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">CA</div>
            <div className="flex-1">
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold">Coach A</span>
                  <span className="text-xs text-slate-500">@ 16:45</span>
                </div>
                <p className="text-sm text-slate-300">Unlucky dismissal. Your footwork was good, but you got a beauty there. Review the ball trajectory analysis.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Input */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Add feedback at current timestamp..." 
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
            </button>
          </div>
          <button className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/></svg>
            Record Voice Note
          </button>
        </div>
      </aside>
    </div>
  );
}
