from fastapi import APIRouter

router = APIRouter(prefix="/home", tags=["home"])

@router.get("/")
def get_home():
    return {
        "message": "home data"
    }