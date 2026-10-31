from fastapi import APIRouter
import uvicorn
from app.api.routes import genome
from app.api.routes.browse import browse_genome, browse_operon, browse_protein
from app.api.routes.stats import home
from app.api.routes.analysis import blastp, structure
from app.api.routes.data import download

api_router = APIRouter()
api_router.include_router(home.router)
api_router.include_router(genome.router)
api_router.include_router(blastp.router)
api_router.include_router(structure.router)
api_router.include_router(browse_operon.router)
api_router.include_router(browse_protein.router)
api_router.include_router(browse_genome.router)
api_router.include_router(download.router)
