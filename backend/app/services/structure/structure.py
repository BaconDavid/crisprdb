"""Persistent, single-worker ESMFold structure prediction jobs."""

from __future__ import annotations

import json
import os
import tempfile
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from app.services.structure.models.esmfoldv1 import (
    EsmFoldPrediction,
    EsmFoldV1Predictor,
)
from app.services.utilis.parse_fasta import FastaRecord, FastaValidationError, parse_protein_fasta


MAX_STRUCTURE_SEQUENCES = 10
MAX_SEQUENCE_LENGTH = 1500
DEFAULT_RESULT_DIR = Path(tempfile.gettempdir()) / "crisprdb_structure_jobs"


class StructureJobStateError(RuntimeError):
    """Raised when results are requested before a job completes."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class StructureJobService:
    """Queue predictions, persist state, and expose completed PDB files."""

    def __init__(
        self,
        result_dir: str | Path | None = None,
        predictor_factory: Callable[[], EsmFoldV1Predictor] = EsmFoldV1Predictor,
    ) -> None:
        configured_dir = result_dir or os.environ.get("STRUCTURE_RESULT_DIR")
        self.result_dir = Path(configured_dir or DEFAULT_RESULT_DIR).expanduser().resolve()
        self.result_dir.mkdir(parents=True, exist_ok=True)
        self.predictor_factory = predictor_factory
        self._predictor: EsmFoldV1Predictor | None = None
        self._predictor_lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="esmfold")

    def submit(self, fasta_content: str | bytes, *, recycles: int = 4) -> dict[str, Any]:
        records = self._parse_input(fasta_content)
        if not 1 <= recycles <= 12:
            raise FastaValidationError("recycles must be between 1 and 12.")

        job_id = str(uuid.uuid4())
        job_dir = self.result_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=False)
        (job_dir / "input.fasta").write_text(
            "\n".join(record.to_fasta() for record in records) + "\n",
            encoding="utf-8",
        )

        metadata: dict[str, Any] = {
            "job_id": job_id,
            "status": "queued",
            "model": "esmfold_v1",
            "recycles": recycles,
            "query_count": len(records),
            "query_ids": [record.identifier for record in records],
            "progress": 0,
            "completed_count": 0,
            "created_at": utc_now(),
            "structures": [],
        }
        self._write_json(job_dir / "metadata.json", metadata)
        self._executor.submit(self._run_job, job_id, records, recycles)
        return metadata

    def get_job(self, job_id: str) -> dict[str, Any]:
        return self._read_json(self._job_dir(job_id) / "metadata.json")

    def get_results(self, job_id: str) -> dict[str, Any]:
        metadata = self.get_job(job_id)
        if metadata["status"] != "completed":
            raise StructureJobStateError(
                f"Structure job is not complete; current status is '{metadata['status']}'."
            )
        return {
            "job_id": metadata["job_id"],
            "status": metadata["status"],
            "model": metadata["model"],
            "structures": metadata["structures"],
        }

    def get_pdb(self, job_id: str, result_index: int) -> tuple[str, str]:
        job_dir = self._job_dir(job_id)
        metadata = self.get_job(job_id)
        if metadata["status"] != "completed":
            raise StructureJobStateError(
                f"Structure job is not complete; current status is '{metadata['status']}'."
            )
        structures = metadata["structures"]
        if not 0 <= result_index < len(structures):
            raise KeyError(f"Structure result {result_index} was not found in job {job_id}.")
        entry = structures[result_index]
        pdb_path = job_dir / f"structure_{result_index:03d}.pdb"
        return entry["query_id"], pdb_path.read_text(encoding="utf-8")

    def get_pdb_paths(
        self,
        job_id: str,
        result_indexes: list[int],
    ) -> list[tuple[str, Path]]:
        """Resolve selected prediction results to server-side PDB paths."""
        job_dir = self._job_dir(job_id)
        metadata = self.get_job(job_id)
        if metadata["status"] != "completed":
            raise StructureJobStateError(
                f"Structure job is not complete; current status is '{metadata['status']}'."
            )

        structures = metadata["structures"]
        selected: list[tuple[str, Path]] = []
        for result_index in dict.fromkeys(result_indexes):
            if not 0 <= result_index < len(structures):
                raise KeyError(
                    f"Structure result {result_index} was not found in job {job_id}."
                )

            pdb_path = job_dir / f"structure_{result_index:03d}.pdb"
            if not pdb_path.is_file():
                raise KeyError(
                    f"Structure file {result_index} was not found in job {job_id}."
                )
            selected.append((structures[result_index]["query_id"], pdb_path))

        if not selected:
            raise ValueError("At least one structure result must be selected.")
        return selected

    def _run_job(self, job_id: str, records: list[FastaRecord], recycles: int) -> None:
        job_dir = self._job_dir(job_id)
        metadata = self._read_json(job_dir / "metadata.json")
        metadata.update(status="running", started_at=utc_now())
        self._write_json(job_dir / "metadata.json", metadata)

        try:
            predictor = self._get_predictor()
            structures: list[dict[str, Any]] = []
            for index, record in enumerate(records):
                metadata.update(
                    current_query=record.identifier,
                    progress=round((index / len(records)) * 100),
                )
                self._write_json(job_dir / "metadata.json", metadata)

                prediction = predictor.predict(record.sequence, recycles)
                (job_dir / f"structure_{index:03d}.pdb").write_text(
                    prediction.pdb,
                    encoding="utf-8",
                )
                structures.append(self._result_entry(index, record, prediction))
                metadata.update(
                    structures=structures,
                    completed_count=index + 1,
                    progress=round(((index + 1) / len(records)) * 100),
                )
                self._write_json(job_dir / "metadata.json", metadata)

            metadata.update(
                status="completed",
                progress=100,
                completed_at=utc_now(),
            )
            metadata.pop("current_query", None)
        except Exception as exc:
            metadata.update(status="failed", error=str(exc), failed_at=utc_now())
        self._write_json(job_dir / "metadata.json", metadata)

    def _get_predictor(self) -> EsmFoldV1Predictor:
        if self._predictor is None:
            with self._predictor_lock:
                if self._predictor is None:
                    self._predictor = self.predictor_factory()
        return self._predictor

    @staticmethod
    def _result_entry(
        index: int,
        record: FastaRecord,
        prediction: EsmFoldPrediction,
    ) -> dict[str, Any]:
        return {
            "index": index,
            "query_id": record.identifier,
            "description": record.description,
            "sequence_length": len(record.sequence),
            "mean_plddt": round(prediction.mean_plddt, 3),
            "ptm": round(prediction.ptm, 4),
        }

    @staticmethod
    def _parse_input(content: str | bytes) -> list[FastaRecord]:
        if isinstance(content, bytes):
            try:
                text = content.decode("utf-8-sig")
            except UnicodeDecodeError as exc:
                raise FastaValidationError("The FASTA file must be UTF-8 encoded.") from exc
        else:
            text = content

        if not text.strip().startswith(">"):
            text = f">query_1\n{text}"
        records = parse_protein_fasta(text, max_sequences=MAX_STRUCTURE_SEQUENCES)
        too_long = [record.identifier for record in records if len(record.sequence) > MAX_SEQUENCE_LENGTH]
        if too_long:
            raise FastaValidationError(
                f"ESMFold accepts at most {MAX_SEQUENCE_LENGTH} residues per sequence. "
                f"Too long: {', '.join(too_long)}."
            )
        return records

    def _job_dir(self, job_id: str) -> Path:
        try:
            safe_job_id = str(uuid.UUID(job_id))
        except ValueError as exc:
            raise KeyError("Invalid structure job ID.") from exc
        job_dir = self.result_dir / safe_job_id
        if not job_dir.is_dir():
            raise KeyError(f"Structure job was not found: {job_id}")
        return job_dir

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    @staticmethod
    def _read_json(path: Path) -> Any:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
