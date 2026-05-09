import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { notificationsApi, type NotificationItem } from "../lib/api";

type FilterKey = "all" | "unread" | "match" | "report" | "message" | "request" | "system";

interface CategoryConfig {
  icon: string;
  gradient: string;
  label: string;
  filter: FilterKey;
}

const CATEGORY_MAP: Record<string, CategoryConfig> = {
  match:   { icon: "fas fa-calendar-alt",   gradient: "from-blue-500 to-cyan-500",    label: "Match",    filter: "match"   },
  report:  { icon: "fas fa-chart-bar",       gradient: "from-purple-500 to-pink-500",  label: "Report",   filter: "report"  },
  message: { icon: "fas fa-comment-dots",    gradient: "from-green-500 to-emerald-500",label: "Message",  filter: "message" },
  request: { icon: "fas fa-paper-plane",     gradient: "from-orange-500 to-red-500",   label: "Request",  filter: "request" },
  system:  { icon: "fas fa-shield-alt",      gradient: "from-slate-500 to-slate-600",  label: "System",   filter: "system"  },
  info:    { icon: "fas fa-info-circle",     gradient: "from-slate-500 to-slate-600",  label: "System",   filter: "system"  },
};

const DEFAULT_CAT: CategoryConfig = {
  icon: "fas fa-bell",
  gradient: "from-blue-500 to-purple-500",
  label: "General",
  filter: "all",
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",     label: "All"      },
  { key: "unread",  label: "Unread"   },
  { key: "match",   label: "Matches"  },
  { key: "report",  label: "Reports"  },
  { key: "message", label: "Messages" },
  { key: "request", label: "Requests" },
  { key: "system",  label: "System"   },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function getCat(type: string): CategoryConfig {
  return CATEGORY_MAP[type?.toLowerCase()] ?? DEFAULT_CAT;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState<FilterKey>("all");
  const [deletingId, setDeletingId]       = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.getAll();
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unread_count);
    } catch {
      // silently fail — empty state shown
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all")    return notifications;
    if (filter === "unread") return notifications.filter(n => !n.is_read);
    return notifications.filter(n => getCat(n.type).filter === filter);
  }, [notifications, filter]);

  const handleMarkRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    await notificationsApi.markRead(id).catch(() => fetchNotifications());
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await notificationsApi.markAllRead().catch(() => fetchNotifications());
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await notificationsApi.delete(id);
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id);
        if (removed && !removed.is_read) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n.id !== id);
      });
    } catch {
      fetchNotifications();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="text-white space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass rounded-3xl p-6 border border-white/20"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <i className="fas fa-bell text-white text-xl"></i>
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-[#0A0F1C]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Notifications</h1>
              <p className="text-white/50 text-sm mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-400/20 text-blue-300 hover:bg-blue-500/20 transition-all text-sm font-medium"
            >
              <i className="fas fa-check-double"></i>
              Mark all as read
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex gap-2 flex-wrap"
      >
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              filter === f.key
                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border-white/20"
                : "text-white/50 border-white/10 hover:text-white hover:bg-white/5"
            }`}
          >
            {f.label}
            {f.key === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500/80 text-white text-xs">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="glass rounded-3xl border border-white/10 flex flex-col items-center justify-center py-20 gap-4"
        >
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <i className="fas fa-bell-slash text-white/20 text-3xl"></i>
          </div>
          <p className="text-white/50 text-lg font-medium">No notifications yet</p>
          <p className="text-white/30 text-sm">
            {filter === "all" ? "You're all caught up!" : `No ${filter} notifications`}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((n, i) => {
              const cat = getCat(n.type);
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                  className={`group relative glass rounded-2xl p-5 border transition-all duration-200 cursor-pointer ${
                    n.is_read
                      ? "border-white/10 hover:border-white/20"
                      : "border-blue-400/20 bg-blue-500/[0.04] hover:border-blue-400/30"
                  }`}
                >
                  {!n.is_read && (
                    <span className="absolute top-4 right-12 w-2 h-2 rounded-full bg-blue-400" />
                  )}

                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-r ${cat.gradient} flex items-center justify-center`}>
                      <i className={`${cat.icon} text-white text-sm`}></i>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-semibold text-sm leading-snug ${n.is_read ? "text-white/70" : "text-white"}`}>
                          {n.title}
                        </p>
                        <span className="flex-shrink-0 text-xs text-white/35 mt-0.5">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-white/50 text-sm mt-1 leading-relaxed">{n.message}</p>
                      <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${cat.gradient} bg-opacity-10 text-white/60 border border-white/10`}>
                        {cat.label}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                    disabled={deletingId === n.id}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    {deletingId === n.id
                      ? <i className="fas fa-spinner fa-spin text-xs"></i>
                      : <i className="fas fa-times text-xs"></i>
                    }
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
