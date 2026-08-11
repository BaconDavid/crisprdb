from pydantic import BaseModel


class HomeStatisticData(BaseModel):
    total_projects: int
    subtypes: dict[str, int]
    countries: dict[str, int]
