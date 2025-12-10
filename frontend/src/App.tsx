import { useState, useEffect } from 'react'
import './App.css'
import PlayerDashboard from './pages/PlayerDashboard'
import CoachDashboard from './pages/CoachDashboard'
import MatchAnalysisDashboard from './pages/MatchAnalysisDashboard'

export default function App() {
  const [role, setRole] = useState<'player' | 'coach' | 'analysis'>('player')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-900 dark:text-gray-100 flex overflow-x-hidden">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 h-screen bg-white dark:bg-gray-900 shadow-xl border-r border-gray-200 dark:border-gray-800 p-6 space-y-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="inline-block w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg shadow-md"></span>
          <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">CricketVA</span>
        </div>
        <nav className="flex flex-col gap-4">
          <button 
            onClick={() => setRole('player')} 
            className={`text-left px-4 py-3 rounded-xl font-semibold transition-all ${role==='player'?'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105':'hover:bg-slate-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          >
            Player Dashboard
          </button>
          <button 
            onClick={() => setRole('coach')} 
            className={`text-left px-4 py-3 rounded-xl font-semibold transition-all ${role==='coach'?'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg scale-105':'hover:bg-slate-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          >
            Coach Dashboard
          </button>
          <button 
            onClick={() => setRole('analysis')} 
            className={`text-left px-4 py-3 rounded-xl font-semibold transition-all ${role==='analysis'?'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg scale-105':'hover:bg-slate-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          >
            Match Analysis
          </button>
        </nav>  
      </aside>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full">
        <header className="md:hidden flex justify-between items-center p-4 shadow bg-white dark:bg-gray-800">
          <div className="font-bold text-xl">Cricket Video Analytics</div>
          <div className="flex gap-2 items-center">
            <button 
              onClick={() => setRole('player')} 
              className={`px-3 py-1 rounded ${role==='player'?'bg-blue-500 text-white':'bg-gray-200 dark:bg-gray-700'}`}
            >
              Player
            </button>
            <button 
              onClick={() => setRole('coach')} 
              className={`px-3 py-1 rounded ${role==='coach'?'bg-green-500 text-white':'bg-gray-200 dark:bg-gray-700'}`}
            >
              Coach
            </button>
            <button 
              onClick={() => setDark(d => !d)} 
              className="ml-4 px-3 py-1 rounded bg-yellow-400 dark:bg-gray-600 text-black dark:text-white"
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </header>
        <main className="p-4 md:p-10 w-full h-full">
          {role === 'player' ? <PlayerDashboard /> : role === 'coach' ? <CoachDashboard /> : <MatchAnalysisDashboard />}
        </main>
      </div>
    </div>
  )
}