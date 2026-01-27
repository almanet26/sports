import { useEffect, useState } from "react"
import api from "../lib/api"

export default function PlayerStatsPage() {
    const [stats, setStats] = useState<any>({})

    useEffect(() => {
        api.get("/api/player/stats").then(res => {
            setStats(res.data)
        })
    }, [])

    return (
        <div>
            <h2>My Stats</h2>
            <p>Matches: {stats.matches}</p>
            <p>Runs: {stats.runs}</p>
            <p>Wickets: {stats.wickets}</p>
            <p>Strike Rate: {stats.strike_rate}</p>
        </div>
    )
}
