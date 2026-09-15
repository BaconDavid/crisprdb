"""BLASTP HTTP endpoints."""

from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.services.blastp.blastp import (
    BlastpExecutionError,
    BlastpService,
    FastaValidationError,
)


router = APIRouter(prefix="/analysis/blastp", tags=["BLASTP"])
service = BlastpService()

# Literal types keep client-selectable values within the server-side whitelist.
MatrixName = Literal["BLOSUM62", "BLOSUM45"]
DatabaseName = Literal["test_blastp_db"]


class BlastpTextRequest(BaseModel):
    fasta_content: str
    database: DatabaseName = "test_blastp_db"
    e_value: float = Field(default=0.01, gt=0)
    max_targets: int = Field(default=50, ge=1, le=500)
    matrix: MatrixName = "BLOSUM62"


def run_search(
    fasta_content: str | bytes,
    e_value: float,
    max_targets: int,
    matrix: str,
) -> dict:
    """Run the shared service and translate service errors into HTTP errors."""
    try:
        return service.run(
            fasta_content,
            e_value=e_value,
            max_targets=max_targets,
            matrix=matrix,
        )
    except FastaValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (BlastpExecutionError, FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/text")
def submit_text(request: BlastpTextRequest) -> dict:
    """Accept FASTA pasted into the text input as JSON."""
    return run_search(
        request.fasta_content,
        request.e_value,
        request.max_targets,
        request.matrix,
    )


@router.post("/upload")
async def upload_fasta(
    file: UploadFile = File(...),
    database: DatabaseName = Form(default="test_blastp_db"),
    e_value: float = Form(default=0.01, gt=0),
    max_targets: int = Form(default=50, ge=1, le=500),
    matrix: MatrixName = Form(default="BLOSUM62"),
) -> dict:
    """Accept an uploaded FASTA file as multipart/form-data."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="A FASTA file is required.")
    if not file.filename.lower().endswith((".fa", ".fasta", ".faa")):
        raise HTTPException(
            status_code=400,
            detail="Only .fa, .fasta, and .faa files are allowed.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    # BLASTP is a blocking process, so it must not block the async event loop.
    return await run_in_threadpool(
        run_search,
        content,
        e_value,
        max_targets,
        matrix,
    )


@router.get("/jobs/{job_id}/results")
def get_results(job_id: str) -> dict:
    """Return hit summaries without the aligned sequences."""
    try:
        return service.get_results(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BlastpExecutionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/jobs/{job_id}/hits/{hit_id}/alignment")
def get_alignment(job_id: str, hit_id: int) -> dict:
    """Return aligned sequences for one expanded hit."""
    try:
        return service.get_alignment(job_id, hit_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BlastpExecutionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
