from pydantic import BaseModel


class PlayerStatsResponse(BaseModel):
    player_id: str
    matches: int
    runs: int
    balls_faced: int
    highest_score: int
    average: float
    strike_rate: float
    wickets: int
    economy_rate: float
    catches: int
    run_outs: int

    class Config:
        from_attributes = True
        