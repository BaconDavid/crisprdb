from pydantic import BaseModel


class HomeStatisticData(BaseModel):
    total_projects: int
    total_operons: int
    total_proteins: int
    subtypes: dict[str, int]
    countries: dict[str, int]
