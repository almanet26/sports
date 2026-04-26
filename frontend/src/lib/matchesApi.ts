import api from "./api";

export interface MatchStatistics {
  runs: number;
  wickets: number;
  catches: number;
  result: "Won" | "Lost";
}

export interface Match {
  id: number;
  created_by: string;
  opponent: string;
  match_type: "Practice" | "Tournament" | "Friendly";
  match_status: "Upcoming" | "Today" | "Completed" | "Cancelled" | "Rescheduled";
  match_date: string;
  match_time: string;
  venue: string;
  location_type: "Home" | "Away" | "Neutral";
  player_role?: string;
  notes?: string;
  statistics?: MatchStatistics;
  reminder?: "1 Day Before" | "2 Hours Before" | "30 Minutes Before";
  created_at: string;
  updated_at?: string;
}

export interface CreateMatchData {
  opponent: string;
  match_type: "Practice" | "Tournament" | "Friendly";
  match_date: string;
  match_time: string;
  venue: string;
  location_type?: "Home" | "Away" | "Neutral";
  player_role?: string;
  notes?: string;
  reminder?: "1 Day Before" | "2 Hours Before" | "30 Minutes Before";
}

export interface UpdateMatchData {
  opponent?: string;
  match_type?: "Practice" | "Tournament" | "Friendly";
  match_status?: "Upcoming" | "Today" | "Completed" | "Cancelled" | "Rescheduled";
  match_date?: string;
  match_time?: string;
  venue?: string;
  location_type?: "Home" | "Away" | "Neutral";
  player_role?: string;
  notes?: string;
  reminder?: "1 Day Before" | "2 Hours Before" | "30 Minutes Before";
  statistics?: MatchStatistics;
}
class MatchesAPI {
  async getAllMatches(): Promise<Match[]> {
    const response = await api.get<Match[]>("/matches/");
    return response.data;
  }

  async getUpcomingMatches(): Promise<Match[]> {
    const response = await api.get<Match[]>("/matches/upcoming");
    return response.data;
  }

  async getMatch(matchId: number): Promise<Match> {
    const response = await api.get<Match>(`/matches/${matchId}`);
    return response.data;
  }

  async createMatch(data: CreateMatchData): Promise<Match> {
    const response = await api.post<Match>("/matches/", data);
    return response.data;
  }

  async updateMatch(matchId: number, data: UpdateMatchData): Promise<Match> {
    const response = await api.put<Match>(`/matches/${matchId}`, data);
    return response.data;
  }

  async deleteMatch(matchId: number): Promise<void> {
    await api.delete(`/matches/${matchId}`);
  }
}

export const matchesAPI = new MatchesAPI();
