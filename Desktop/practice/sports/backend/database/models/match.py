class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True)
    team_a = Column(String)
    team_b = Column(String)
    match_date = Column(String)
    venue = Column(String)
