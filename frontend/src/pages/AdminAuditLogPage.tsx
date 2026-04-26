import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { adminApi } from '../lib/api';
import { useThemeStore } from '../store/themeStore';

interface AuditEntry {
  id: string;
  admin_id: string | null;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, string> = {
  update_plan:           'fa-tags',
  override_subscription: 'fa-id-card',
  impersonate:           'fa-user-secret',
};

const ACTION_COLORS: Record<string, string> = {
  update_plan:           'from-yellow-500 to-orange-500',
  override_subscription: 'from-blue-500 to-cyan-500',
  impersonate:           'from-red-500 to-pink-500',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function JsonPreview({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <span className="text-white/30 text-xs">—</span>;
  return (
    <pre className="text-xs text-white/60 bg-white/5 rounded-lg p-2 overflow-x-auto max-w-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function AdminAuditLogPage() {
  const { theme } = useThemeStore();
  const th = theme === 'dark';

  const [entries, setEntries]     = useState<AuditEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getAuditLog(page, 50);
      setEntries(data.entries);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  return (
    <div className={th ? 'text-white' : 'text-gray-900'}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 mb-8 border ${th ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-clipboard-list text-purple-400"></i>
              Admin Audit Log
            </h1>
            <p className={`mt-1 text-sm ${th ? 'text-white/50' : 'text-gray-500'}`}>
              {total} total entries — all plan edits, subscription overrides, and impersonations
            </p>
          </div>
          <button
            onClick={fetchLog}
            className="px-4 py-2 rounded-xl glass border border-white/20 hover:bg-white/10 transition-all text-sm flex items-center gap-2"
          >
            <i className="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
      </motion.div>

      {/* Log table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`rounded-3xl p-6 border ${th ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'}`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <i className={`fas fa-clipboard text-4xl mb-3 ${th ? 'text-white/20' : 'text-gray-300'}`}></i>
            <p className={th ? 'text-white/50' : 'text-gray-500'}>No audit entries yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const icon  = ACTION_ICONS[entry.action]  ?? 'fa-cog';
              const color = ACTION_COLORS[entry.action] ?? 'from-gray-500 to-gray-600';
              const open  = expanded === entry.id;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`rounded-2xl border transition-all ${
                    th ? 'glass border-white/10 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Summary row */}
                  <button
                    className="w-full text-left px-5 py-4 flex items-center gap-4"
                    onClick={() => setExpanded(open ? null : entry.id)}
                  >
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-r ${color} flex items-center justify-center flex-shrink-0`}>
                      <i className={`fas ${icon} text-white text-sm`}></i>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{entry.action}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-white/10 ${th ? 'text-white/50' : 'text-gray-500'} font-mono`}>
                          {entry.target_type}
                        </span>
                        {entry.target_id && (
                          <span className={`text-xs font-mono ${th ? 'text-white/30' : 'text-gray-400'} truncate max-w-[160px]`}>
                            {entry.target_id}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs mt-0.5 ${th ? 'text-white/40' : 'text-gray-500'}`}>
                        by <span className="font-medium">{entry.admin_email}</span>
                        {' · '}
                        {fmt(entry.created_at)}
                      </div>
                    </div>

                    <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-xs ${th ? 'text-white/30' : 'text-gray-400'}`}></i>
                  </button>

                  {/* Expanded diff */}
                  {open && (
                    <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/10">
                      <div>
                        <p className={`text-xs font-medium mb-1.5 ${th ? 'text-white/40' : 'text-gray-500'}`}>Before</p>
                        <JsonPreview data={entry.before_value} />
                      </div>
                      <div>
                        <p className={`text-xs font-medium mb-1.5 ${th ? 'text-white/40' : 'text-gray-500'}`}>After</p>
                        <JsonPreview data={entry.after_value} />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-4 py-2 rounded-xl border transition-all ${
                page === 1
                  ? 'opacity-40 cursor-not-allowed'
                  : th ? 'glass border-white/20 hover:bg-white/10' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
              }`}
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <span className={`px-4 py-2 text-sm ${th ? 'text-white/60' : 'text-gray-600'}`}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`px-4 py-2 rounded-xl border transition-all ${
                page === totalPages
                  ? 'opacity-40 cursor-not-allowed'
                  : th ? 'glass border-white/20 hover:bg-white/10' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
              }`}
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
