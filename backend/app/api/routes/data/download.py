"""Data listing and download endpoints."""

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from yaml import safe_load


router = APIRouter(prefix="/data/download", tags=["Data Download"])

DEFAULT_DATA_INFO_PATH = Path(__file__).resolve().parents[3] / "config" / "data.yaml"
DATA_INFO_PATH = Path(os.getenv("DATA_INFO_PATH", DEFAULT_DATA_INFO_PATH))


def load_available_data() -> dict:
    with DATA_INFO_PATH.open("r", encoding="utf-8") as file:
        return safe_load(file).get("available_data", {})


@router.get("/available_data")
def get_available_data():
    """Return metadata for files that are currently available."""

    available_data = []
    for data_name, metadata in load_available_data().items():
        if Path(metadata["storage_path"]).is_file():
            available_data.append(
                {
                    "data_name": data_name,
                    "title": metadata["title"],
                    "description": metadata["description"],
                    "source": metadata.get("source"),
                    "version": metadata["version"],
                }
            )

    return {"available_data": available_data}


@router.get("")
def download_data(data_name: str):
    """Download one available file by its data name."""

    metadata = load_available_data().get(data_name)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Data not found")

    file_path = Path(metadata["storage_path"])
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Data file is unavailable")

    return FileResponse(
        path=file_path,
        filename=data_name,
        media_type="application/gzip",
    )
