from pydantic import BaseModel

class HomeStatisticData(BaseModel):
    total_projects: int

