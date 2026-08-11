from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from crud.crud import get_genomes, get_operons, get_environments
from db.session import get_db
from schemas.home import HomeStatisticData

from collections import Counter
router = APIRouter(prefix="/home", tags=["home"])


@router.get("/")
def get_home():
    return {
        "message": "home data"
    }


@router.get("/home_statistic_data", response_model=HomeStatisticData)
def get_home_statistic_data(db: Session = Depends(get_db)):
    genomes_data = get_genomes(db, limit=100000)
    operons_data = get_operons(db, limit=100000)
    environment_data = get_environments(db, limit=100000)
    
    total_projects = len({genome.bioproject for genome in genomes_data if genome.bioproject})
    subtype_distribution = Counter(operon.crispr_subtype for operon in operons_data if operon.crispr_subtype)
    countries_distribution = Counter(env.country for env in environment_data if env.country)

    return {"total_projects": total_projects,
            "subtypes": dict(subtype_distribution),
            "countries": dict(countries_distribution)}
