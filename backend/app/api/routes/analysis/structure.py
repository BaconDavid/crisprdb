"""Structure prediction and Foldseek job endpoints."""

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field

from app.services.structure.foldseek import (
    FoldseekJobStateError,
    FoldseekSearchService,
)
from app.services.structure.structure import (
    StructureJobService,
    StructureJobStateError,
)
from app.services.utilis.parse_fasta import FastaValidationError


MAX_STRUCTURE_FILES = 10
MAX_STRUCTURE_FILE_SIZE = 20 * 1024 * 1024
STRUCTURE_SUFFIXES = (".pdb", ".cif", ".mmcif")

router = APIRouter(
    prefix="/analysis/structure",
    tags=["Structure Analysis"],
)

structure_service = StructureJobService()
foldseek_service = FoldseekSearchService()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class StructureTextRequest(BaseModel):
    fasta_content: str = Field(min_length=1)
    recycles: int = Field(default=4, ge=1, le=12)


class FoldseekOptions(BaseModel):
    target_database: str = Field(default="crisprdb_structures")
    e_value: float = Field(default=0.001, gt=0)
    max_hits: int = Field(default=100, ge=1, le=1000)


class FoldseekSequenceRequest(FoldseekOptions):
    fasta_content: str = Field(min_length=1)


class FoldseekPredictionRequest(FoldseekOptions):
    prediction_job_id: str
    result_indexes: list[int] = Field(min_length=1)


# ---------------------------------------------------------------------------
# Structure prediction
# ---------------------------------------------------------------------------

def submit_structure_prediction_job(
    fasta_content: str | bytes,
    recycles: int,
) -> dict:
    try:
        return structure_service.submit(
            fasta_content,
            recycles=recycles,
        )
    except FastaValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/jobs/text", status_code=status.HTTP_202_ACCEPTED)
def submit_text(request: StructureTextRequest) -> dict:
    return submit_structure_prediction_job(
        request.fasta_content,
        request.recycles,
    )


@router.post("/jobs/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_fasta(
    file: Annotated[UploadFile, File()],
    recycles: Annotated[int, Form(ge=1, le=12)] = 4,
) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="A FASTA file is required.")

    if not file.filename.lower().endswith((".fa", ".fasta", ".faa")):
        raise HTTPException(
            status_code=400,
            detail="Only .fa, .fasta, and .faa files are allowed.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    return submit_structure_prediction_job(content, recycles)


@router.get("/jobs/{job_id}")
def get_structure_job(job_id: str) -> dict:
    try:
        return structure_service.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/jobs/{job_id}/results")
def get_structure_results(job_id: str) -> dict:
    try:
        return structure_service.get_results(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except StructureJobStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/jobs/{job_id}/structures/{result_index}")
def get_structure(
    job_id: str,
    result_index: int,
) -> Response:
    try:
        query_id, pdb = structure_service.get_pdb(job_id, result_index)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except StructureJobStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return Response(
        content=pdb,
        media_type="chemical/x-pdb",
        headers={
            "Content-Disposition": f'inline; filename="{query_id}.pdb"',
        },
    )


# ---------------------------------------------------------------------------
# Foldseek: sequence -> ProstT5 -> query DB -> search
# ---------------------------------------------------------------------------

@router.post(
    "/foldseek/jobs/sequence",
    status_code=status.HTTP_202_ACCEPTED,
)
def submit_foldseek_sequence(
    request: FoldseekSequenceRequest,
) -> dict:
    try:
        return foldseek_service.submit_sequence(
            fasta_content=request.fasta_content,
            target_database=request.target_database,
            e_value=request.e_value,
            max_hits=request.max_hits,
        )
    except FastaValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/foldseek/jobs/sequence/upload",
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_foldseek_sequence(
    file: Annotated[UploadFile, File()],
    target_database: Annotated[str, Form()] = "crisprdb_structures",
    e_value: Annotated[float, Form(gt=0)] = 0.001,
    max_hits: Annotated[int, Form(ge=1, le=1000)] = 100,
) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="A FASTA file is required.")

    if not file.filename.lower().endswith((".fa", ".fasta", ".faa")):
        raise HTTPException(
            status_code=400,
            detail="Only .fa, .fasta, and .faa files are allowed.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    try:
        return foldseek_service.submit_sequence(
            fasta_content=content,
            target_database=target_database,
            e_value=e_value,
            max_hits=max_hits,
        )
    except FastaValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Foldseek: predicted PDB -> query DB -> search
# ---------------------------------------------------------------------------

@router.post(
    "/foldseek/jobs/structure/upload",
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_foldseek_structures(
    files: Annotated[list[UploadFile], File()],
    target_database: Annotated[str, Form()] = "crisprdb_structures",
    e_value: Annotated[float, Form(gt=0)] = 0.001,
    max_hits: Annotated[int, Form(ge=1, le=1000)] = 100,
) -> dict:
    """Create a Foldseek job from uploaded PDB or mmCIF structures."""
    if not files:
        raise HTTPException(status_code=400, detail="At least one structure file is required.")
    if len(files) > MAX_STRUCTURE_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"A maximum of {MAX_STRUCTURE_FILES} structure files is allowed.",
        )

    structures: list[tuple[str, bytes]] = []
    for file in files:
        filename = file.filename or ""
        if not filename.lower().endswith(STRUCTURE_SUFFIXES):
            raise HTTPException(
                status_code=400,
                detail="Only .pdb, .cif, and .mmcif structure files are allowed.",
            )

        # Read one extra byte so oversized files can be rejected without
        # keeping an unlimited upload in memory.
        content = await file.read(MAX_STRUCTURE_FILE_SIZE + 1)
        if not content:
            raise HTTPException(status_code=400, detail=f"'{filename}' is empty.")
        if len(content) > MAX_STRUCTURE_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"'{filename}' exceeds the 20 MB file limit.",
            )
        structures.append((filename, content))

    try:
        return foldseek_service.submit_uploaded_structures(
            structures=structures,
            target_database=target_database,
            e_value=e_value,
            max_hits=max_hits,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.post(
    "/foldseek/jobs/prediction",
    status_code=status.HTTP_202_ACCEPTED,
)
def submit_foldseek_prediction(
    request: FoldseekPredictionRequest,
) -> dict:
    try:
        # Resolve server-owned PDB paths from stable identifiers. The browser
        # never sends or receives an absolute server path.
        structures = structure_service.get_pdb_paths(
            job_id=request.prediction_job_id,
            result_indexes=request.result_indexes,
        )

        return foldseek_service.submit_structures(
            structures=structures,
            source_job_id=request.prediction_job_id,
            target_database=request.target_database,
            e_value=request.e_value,
            max_hits=request.max_hits,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except StructureJobStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Foldseek job status and results
# ---------------------------------------------------------------------------

@router.get("/foldseek/jobs/{job_id}")
def get_foldseek_job(job_id: str) -> dict:
    try:
        return foldseek_service.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/foldseek/jobs/{job_id}/results")
def get_foldseek_results(job_id: str) -> dict:
    try:
        return foldseek_service.get_results(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FoldseekJobStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
