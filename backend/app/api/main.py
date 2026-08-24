from fastapi import APIRouter

from app.api.routes import genome
from app.api.routes.browse import browse_operon, browse_protein
from app.api.routes.stats import home
from app.api.routes.analysis import blastp

api_router = APIRouter()
api_router.include_router(home.router)
api_router.include_router(genome.router)
api_router.include_router(blastp.router)
api_router.include_router(browse_operon.router)
api_router.include_router(browse_protein.router)
