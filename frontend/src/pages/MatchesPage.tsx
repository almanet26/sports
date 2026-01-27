import { useEffect, useState } from "react"
import api from "../lib/api"

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([])

  useEffect(() => {
    api.get("/api/matches/upcoming").then(res => {
      setMatches(res.data)
    })
  }, [])

  return (
    <div>
      <h2>Upcoming Matches</h2>

      {matches.map(match => (
        <div key={match.id}>
          <p>{match.team_a} vs {match.team_b}</p>
          <p>{match.match_date} | {match.venue}</p>
        </div>
      ))}
    </div>
  )
}
