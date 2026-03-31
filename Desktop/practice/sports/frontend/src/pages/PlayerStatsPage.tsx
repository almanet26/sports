import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import api from "../lib/api";

type PlayerStats = {
  matches?: number | null;
  runs?: number | null;
  wickets?: number | null;
  strike_rate?: number | null;
};

export default function PlayerStatsPage() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/player/stats")
      .then((res) => setStats(res.data))
      .finally(() => setLoading(false));
  }, []);

  const hasStatsData = useMemo(() => {
    if (!stats) return false;

    return ["matches", "runs", "wickets", "strike_rate"].some((key) => {
      const value = stats[key as keyof PlayerStats];
      return value !== null && value !== undefined;
    });
  }, [stats]);

  const statItems = [
    {
      label: "Matches",
      value: stats?.matches,
      emptyText: "No matches yet",
      icon: "fas fa-calendar-xmark",
    },
    {
      label: "Runs",
      value: stats?.runs,
      emptyText: "No runs recorded",
      icon: "fas fa-baseball",
    },
    {
      label: "Wickets",
      value: stats?.wickets,
      emptyText: "No wickets recorded",
      icon: "fas fa-bullseye",
    },
    {
      label: "Strike Rate",
      value: stats?.strike_rate,
      emptyText: "No stats available",
      icon: "fas fa-chart-line",
    },
  ];

  return (
    <div className="space-y-8 text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass rounded-3xl border border-white/20 p-6"
      >
        <h1 className="text-3xl font-bold gradient-text">My Stats</h1>
        <p className="mt-2 text-sm text-white/60">
          {hasStatsData ? "Your personal performance overview" : "No data yet"}
        </p>
      </motion.div>

      {!loading && !hasStatsData && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass flex flex-col gap-4 rounded-3xl border border-white/20 p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-lg font-semibold text-white">No data yet</p>
            <p className="mt-1 text-sm text-white/60">Upload matches to see stats</p>
          </div>
          <Link
            to="/library"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/15 hover:text-cyan-200"
          >
            <i className="fas fa-cloud-upload-alt text-xs"></i>
            Upload Match Video
          </Link>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {statItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.08 }}
            className="glass flex min-h-[180px] items-center justify-center rounded-3xl border border-white/20 p-6 text-center"
          >
            {loading ? (
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500/30 border-t-blue-500" />
            ) : (
              <div className="max-w-[18rem]">
                <p className="mb-2 text-sm text-white/60">{item.label}</p>
                {item.value !== null && item.value !== undefined ? (
                  <p className="text-3xl font-bold">{item.value}</p>
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-cyan-300">
                      <i className={item.icon}></i>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">No data yet</p>
                      <p className="mt-1 text-sm text-white/60">{item.emptyText}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
