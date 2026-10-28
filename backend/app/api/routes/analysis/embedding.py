"""
embedding endpoints
"""

from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool


from app.services.structure.foldseek import (
    FoldseekJobStateError,
    FoldseekSearchService,
)
from app.services.utilis.parse_fasta import FastaValidationError


from app.services.structure.embedding import EmbeddingService

embedding_service = EmbeddingService()

def submit_embedding_job(
    fasta_content: str | bytes,
) -> dict:
    try:
        return embedding_service.submit(
            fasta_content,
        )
    except FastaValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
