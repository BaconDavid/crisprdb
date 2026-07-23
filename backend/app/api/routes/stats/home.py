from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from crud.crud import get_genomes
from db.session import get_db
from schemas.home import HomeStatisticData

router = APIRouter(prefix="/home", tags=["home"])


@router.get("/")
def get_home():
    return {
        "message": "home data"
    }


@router.get("/home_statistic_data", response_model=HomeStatisticData)
def get_home_statistic_data(db: Session = Depends(get_db)):
    genomes_data = get_genomes(db, limit=100000)
    total_projects = len({genome.bioproject for genome in genomes_data if genome.bioproject})

    return {"total_projects": total_projects}
