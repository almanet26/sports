import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import api from "../lib/api";

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/matches/upcoming")
      .then(res => setMatches(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="text-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20"
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-calendar text-purple-400"></i>
          Upcoming Matches
        </h1>
        <p className="text-white/70 mt-2 text-sm">
          Matches scheduled in the future
        </p>
      </motion.div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : matches.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass rounded-3xl border border-white/20 text-center py-16"
        >
          <p className="text-white/60">No upcoming matches</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {matches.map((match, i) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                ease: "easeOut",
                delay: i * 0.05,
              }}
              className="glass rounded-2xl p-5 border border-white/20"
            >
              <p className="font-medium">
                {match.team_a} vs {match.team_b}
              </p>
              <p className="text-sm text-white/60">
                {match.match_date} • {match.venue}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
