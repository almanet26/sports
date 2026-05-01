import { useState, useEffect, useCallback } from 'react';
import { scoutingApi } from '../lib/api';
import type { ScoutingPlayerSummary, ScoutingFilters } from '../lib/api';
import PlayerCard from '../components/scouting/PlayerCard';
import PlayerDetailPanel from '../components/scouting/PlayerDetailPanel';

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="glass rounded-2xl border border-white/10 p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-white/10 rounded-xl" />)}
      </div>
      <div className="flex gap-2">
        <div className="flex-1 h-9 bg-white/10 rounded-xl" />
        <div className="w-20 h-9 bg-white/10 rounded-xl" />
      </div>
    </div>
  );
}

// ── Indian states list ─────────────────────────────────────────────────────────
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Puducherry',
];

const SORT_OPTIONS = [
  { value: 'analyses_last_updated', label: 'Most Recently Active' },
  { value: 'total_analyses', label: 'Most Analyses' },
  { value: 'avg_bat_speed', label: 'Highest Bat Speed' },
  { value: 'avg_wrist_speed', label: 'Highest Wrist Speed' },
  { value: 'best_release_consistency', label: 'Best Release Consistency' },
  { value: 'best_shoulder_rotation', label: 'Best Shoulder Rotation' },
  { value: 'city', label: 'Location (A–Z)' },
];

type Tab = 'directory' | 'shortlist';

export default function ScoutingPage() {
  const [tab, setTab] = useState<Tab>('directory');

  // Directory state
  const [players, setPlayers] = useState<ScoutingPlayerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Shortlist state
  const [shortlist, setShortlist] = useState<Array<{ player: ScoutingPlayerSummary; note: string | null; added_at: string }>>([]);
  const [shortlistLoading, setShortlistLoading] = useState(false);

  // Detail panel
  const [selectedPlayer, setSelectedPlayer] = useState<ScoutingPlayerSummary | null>(null);

  // Filters
  const [filters, setFilters] = useState<ScoutingFilters>({
    sort_by: 'analyses_last_updated',
    sort_order: 'desc',
    page_size: 20,
  });
  const [draft, setDraft] = useState<ScoutingFilters>({ ...filters });
  const [filtersOpen, setFiltersOpen] = useState(true);

  // ── Load directory ─────────────────────────────────────────────────────────
  const loadDirectory = useCallback(async (f: ScoutingFilters, p = 1, append = false) => {
    if (!append) setLoading(true); else setLoadingMore(true);
    try {
      const { data } = await scoutingApi.listPlayers({ ...f, page: p });
      setPlayers((prev) => append ? [...prev, ...data.players] : data.players);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.total_pages);
    } catch { /* errors shown via empty state */ }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  // ── Load shortlist ──────────────────────────────────────────────────────────
  const loadShortlist = useCallback(async () => {
    setShortlistLoading(true);
    try {
      const { data } = await scoutingApi.getShortlist();
      setShortlist((data as any).shortlist || []);
    } catch { /* ignore */ }
    finally { setShortlistLoading(false); }
  }, []);

  useEffect(() => { loadDirectory(filters, 1); }, []);
  useEffect(() => { if (tab === 'shortlist') loadShortlist(); }, [tab]);

  const applyFilters = () => {
    setFilters(draft);
    setPlayers([]);
    loadDirectory(draft, 1);
  };

  const clearFilters = () => {
    const reset: ScoutingFilters = { sort_by: 'analyses_last_updated', sort_order: 'desc', page_size: 20 };
    setDraft(reset);
    setFilters(reset);
    setPlayers([]);
    loadDirectory(reset, 1);
  };

  const loadMore = () => loadDirectory(filters, page + 1, true);

  const handleShortlistChange = (playerId: string, isShortlisted: boolean) => {
    if (!isShortlisted) {
      setShortlist((prev) => prev.filter((e) => e.player.user_id !== playerId));
    }
  };

  const removeFromShortlist = async (playerId: string) => {
    try {
      await scoutingApi.removeFromShortlist(playerId);
      setShortlist((prev) => prev.filter((e) => e.player.user_id !== playerId));
    } catch { /* ignore */ }
  };

  const inputCls = 'w-full px-3 py-2 glass border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 bg-transparent';
  const selectCls = `${inputCls} [&>option]:bg-gray-900`;

  return (
    <div className="text-white">
      {/* ── Page header ── */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-search text-blue-400" /> Player Scouting
            </h1>
            <p className="text-white/50 mt-1 text-sm">Discover and evaluate talent across the platform</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 glass border border-white/10 rounded-xl text-sm text-white/60">
              <i className="fas fa-users mr-1.5 text-blue-400" />
              {total.toLocaleString()} player{total !== 1 ? 's' : ''} {tab === 'shortlist' ? 'shortlisted' : 'available'}
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-5 p-1 glass rounded-2xl border border-white/10 w-fit">
          {(['directory', 'shortlist'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                tab === t
                  ? 'bg-gradient-to-r from-blue-500/30 to-purple-500/30 border border-white/20 text-white'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {t === 'directory' ? <><i className="fas fa-th-large mr-1.5" />Directory</> : <><i className="fas fa-star mr-1.5" />My Shortlist</>}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════ DIRECTORY TAB ══════════════ */}
      {tab === 'directory' && (
        <div className="flex gap-6">
          {/* ── Filter Panel ── */}
          <aside className={`flex-shrink-0 transition-all duration-300 ${filtersOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
            <div className="glass rounded-2xl border border-white/10 p-4 space-y-5 sticky top-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-white/80">Filters</p>
                <button onClick={() => setFiltersOpen(false)} className="text-white/30 hover:text-white text-xs">
                  <i className="fas fa-chevron-left" />
                </button>
              </div>

              {/* Location */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Location</p>
                <div className="space-y-2">
                  <input type="text" placeholder="City…" value={draft.city || ''} onChange={(e) => setDraft({ ...draft, city: e.target.value || undefined })} className={inputCls} />
                  <select value={draft.state || ''} onChange={(e) => setDraft({ ...draft, state: e.target.value || undefined })} className={selectCls}>
                    <option value="">All States</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Cricket Role */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Role</p>
                <div className="space-y-1.5">
                  {[['batsman','Batsman'],['bowler','Bowler'],['all_rounder','All-rounder'],['wicket_keeper','Wicket-keeper']].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" name="role" value={v} checked={draft.cricket_role === v}
                        onChange={() => setDraft({ ...draft, cricket_role: v })}
                        className="accent-blue-500" />
                      <span className="text-sm text-white/60 group-hover:text-white transition-colors">{l}</span>
                    </label>
                  ))}
                  {draft.cricket_role && (
                    <button onClick={() => setDraft({ ...draft, cricket_role: undefined })} className="text-xs text-white/30 hover:text-white mt-1">
                      Clear role
                    </button>
                  )}
                </div>
              </div>

              {/* Experience */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Experience</p>
                <select value={draft.experience_level || ''} onChange={(e) => setDraft({ ...draft, experience_level: e.target.value || undefined })} className={selectCls}>
                  <option value="">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="professional">Professional</option>
                </select>
              </div>

              {/* Format */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Format</p>
                <select value={draft.preferred_format || ''} onChange={(e) => setDraft({ ...draft, preferred_format: e.target.value || undefined })} className={selectCls}>
                  <option value="">All Formats</option>
                  <option value="T20">T20</option>
                  <option value="ODI">ODI</option>
                  <option value="Test">Test</option>
                  <option value="All">All Formats</option>
                </select>
              </div>

              {/* Min analyses */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Min Analyses: <span className="text-white/70">{draft.min_analyses ?? 0}</span>
                </p>
                <input type="range" min={0} max={50} value={draft.min_analyses ?? 0}
                  onChange={(e) => setDraft({ ...draft, min_analyses: parseInt(e.target.value) || undefined })}
                  className="w-full accent-blue-500" />
              </div>

              {/* Sort */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Sort By</p>
                <select value={draft.sort_by || 'analyses_last_updated'} onChange={(e) => setDraft({ ...draft, sort_by: e.target.value })} className={selectCls}>
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="flex gap-2 mt-2">
                  {(['desc', 'asc'] as const).map((o) => (
                    <button key={o} onClick={() => setDraft({ ...draft, sort_order: o })}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                        draft.sort_order === o ? 'border-blue-500/50 bg-blue-500/20 text-blue-300' : 'border-white/10 text-white/40 hover:text-white'
                      }`}>
                      {o === 'desc' ? '↓ Desc' : '↑ Asc'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button onClick={applyFilters}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl text-sm transition-all">
                  Apply Filters
                </button>
                <button onClick={clearFilters}
                  className="w-full py-2 text-sm text-white/40 hover:text-white border border-white/10 rounded-xl transition-all">
                  Clear All
                </button>
              </div>
            </div>
          </aside>

          {/* Toggle filter button when closed */}
          {!filtersOpen && (
            <button onClick={() => setFiltersOpen(true)}
              className="self-start flex-shrink-0 px-3 py-2 glass border border-white/10 rounded-xl text-white/50 hover:text-white transition-all text-sm">
              <i className="fas fa-sliders-h mr-1" /> Filters
            </button>
          )}

          {/* ── Player grid ── */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : players.length === 0 ? (
              <div className="glass rounded-2xl border border-white/10 p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-search text-white/20 text-2xl" />
                </div>
                <p className="text-white/50 font-medium mb-1">No players match your filters</p>
                <p className="text-white/30 text-sm mb-4">Try removing some filters to see more players.</p>
                <button onClick={clearFilters}
                  className="px-4 py-2 glass border border-white/10 rounded-xl text-white/60 hover:text-white text-sm transition-all">
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {players.map((p) => (
                    <PlayerCard
                      key={p.user_id}
                      player={p}
                      onViewProfile={setSelectedPlayer}
                    />
                  ))}
                </div>

                {/* Load more */}
                {page < totalPages && (
                  <div className="mt-6 text-center">
                    <button onClick={loadMore} disabled={loadingMore}
                      className="px-8 py-3 glass border border-white/10 rounded-xl text-white/70 hover:text-white text-sm font-medium transition-all hover:border-white/20 disabled:opacity-50">
                      {loadingMore
                        ? <><i className="fas fa-spinner animate-spin mr-2" />Loading…</>
                        : <><i className="fas fa-chevron-down mr-2" />Load More Players</>
                      }
                    </button>
                    <p className="text-xs text-white/30 mt-2">
                      Showing {players.length} of {total} players
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ SHORTLIST TAB ══════════════ */}
      {tab === 'shortlist' && (
        <div>
          {shortlistLoading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : shortlist.length === 0 ? (
            <div className="glass rounded-2xl border border-white/10 p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-star text-amber-400/40 text-2xl" />
              </div>
              <p className="text-white/50 font-medium mb-1">No players shortlisted yet</p>
              <p className="text-white/30 text-sm mb-4">Browse the directory and click "Save" on players you want to follow up with.</p>
              <button onClick={() => setTab('directory')}
                className="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-white/10 rounded-xl text-white text-sm transition-all">
                <i className="fas fa-search mr-1.5" /> Browse Directory
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {shortlist.map(({ player, note }) => (
                <div key={player.user_id} className="relative">
                  <PlayerCard
                    player={player}
                    onViewProfile={setSelectedPlayer}
                    initialShortlisted={true}
                  />
                  {/* Note preview */}
                  {note && (
                    <div className="mx-1 px-4 py-2.5 glass border border-t-0 border-amber-500/20 rounded-b-2xl -mt-3 pt-5">
                      <p className="text-xs text-amber-400/70 flex items-center gap-1 mb-1">
                        <i className="fas fa-lock text-[10px]" /> Private note
                      </p>
                      <p className="text-xs text-white/50 line-clamp-2">{note}</p>
                    </div>
                  )}
                  {/* Remove button */}
                  <button
                    onClick={() => removeFromShortlist(player.user_id)}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 flex items-center justify-center text-xs transition-all"
                    title="Remove from shortlist"
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Player detail panel ── */}
      <PlayerDetailPanel
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        onShortlistChange={handleShortlistChange}
      />
    </div>
  );
}
