from fastapi import APIRouter

from app.api.routes import genome
from crisprdb.backend.app.api.routes.stats import home

api_router = APIRouter()
api_router.include_router(home.router)
api_router.include_router(genome.router)
