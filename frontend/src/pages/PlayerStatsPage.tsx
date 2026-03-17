import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import api from "../lib/api";

export default function PlayerStatsPage() {
    const [stats, setStats] = useState<{ matches: number; runs: number; wickets: number; strike_rate: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/api/player/stats")
            .then(res => setStats(res.data))
            .finally(() => setLoading(false));
    }, []);

    const statItems = [
        { label: "Matches", value: stats?.matches },
        { label: "Runs", value: stats?.runs },
        { label: "Wickets", value: stats?.wickets },
        { label: "Strike Rate", value: stats?.strike_rate },
    ];

    return (
        <div className="text-white space-y-8">
            {/* Header — SAME animation as Requests */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="glass rounded-3xl p-6 border border-white/20"
            >
                <h1 className="text-3xl font-bold gradient-text">My Stats</h1>
                <p className="text-white/60 text-sm mt-2">
                    Your personal performance overview
                </p>
            </motion.div>

            {/* Stats Grid — 4 separate blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {statItems.map((item, index) => (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.08 }}
                        className="
              glass rounded-3xl border border-white/20
              min-h-[160px]
              flex items-center justify-center
              text-center
              p-6
            "
                    >
                        {loading ? (
                            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        ) : (
                            <div>
                                <p className="text-white/60 text-sm mb-2">
                                    {item.label}
                                </p>
                                <p className="text-3xl font-bold">
                                    {item.value ?? "-"}
                                </p>
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
