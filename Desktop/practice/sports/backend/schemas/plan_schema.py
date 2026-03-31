from pydantic import BaseModel

class PlanCreate(BaseModel):
    name: str
    monthly_price: int
    yearly_price: int
    features: str


class PlanResponse(BaseModel):
    id: int
    name: str
    monthly_price: int
    yearly_price: int
    features: str

    class Config:
        orm_mode = True
        