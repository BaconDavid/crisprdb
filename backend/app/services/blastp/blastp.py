"""Validate protein FASTA input, run BLASTP, and store results for later retrieval."""

from __future__ import annotations
from app.services.utilis.parse_fasta import (
    FastaValidationError,
    parse_protein_fasta,
)

import csv
import json
import os
import re
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from Bio.Align import substitution_matrices


MAX_SEQUENCES = 30
ALLOWED_AMINO_ACIDS = frozenset("ACDEFGHIKLMNPQRSTVWYBXZJUO")
# Keep the matrix whitelist small and identical to the frontend options.
ALLOWED_MATRICES = frozenset({"BLOSUM62", "BLOSUM45"})
BLAST_FIELDS = (
    "qseqid",
    "sseqid",
    "stitle",
    "nident",
    "pident",
    "qlen",
    "length",
    "qcovhsp",
    "gaps",
    "gapopen",
    "mismatch",
    "positive",
    "ppos",
    "qstart",
    "qend",
    "sstart",
    "send",
    "score",
    "evalue",
    "bitscore",
    "qseq",
    "sseq",
)

INTEGER_FIELDS = {
    "nident",
    "qlen",
    "length",
    "gaps",
    "gapopen",
    "mismatch",
    "positive",
    "qstart",
    "qend",
    "sstart",
    "send",
    "score",
}
FLOAT_FIELDS = {"pident", "qcovhsp", "ppos", "evalue", "bitscore"}

BACKEND_DIR = Path(__file__).resolve().parents[3]
DEFAULT_DATABASE = BACKEND_DIR / "test_data" / "test_blastp_db"
DEFAULT_RESULT_DIR = Path(tempfile.gettempdir()) / "crisprdb_blast_jobs"


class BlastpExecutionError(RuntimeError):
    """Raised when BLASTP cannot complete successfully."""


class BlastpService:
    """Run BLASTP jobs and expose summaries and alignments separately."""

    def __init__(
        self,
        database: str | Path = DEFAULT_DATABASE,
        blastp_path: str | Path | None = None,
        result_dir: str | Path = DEFAULT_RESULT_DIR,
        timeout_seconds: int = 300,
    ) -> None:
        self.database = Path(database).expanduser().resolve()
        self.blastp_path = str(
            blastp_path or os.environ.get("BLASTP_PATH", "blastp")
        )
        self.result_dir = Path(result_dir).expanduser().resolve()
        self.timeout_seconds = timeout_seconds

    def run(
        self,
        fasta_content: str | bytes,
        *,
        e_value: float = 10.0,
        max_targets: int = 50,
        matrix: str = "BLOSUM62",
    ) -> dict[str, Any]:
        """Validate input, run BLASTP, and return job metadata without hit rows."""
        records = parse_protein_fasta(fasta_content)
        matrix = matrix.upper()
        self._validate_options(e_value, max_targets, matrix)
        self._validate_database()

        job_id = str(uuid.uuid4())
        job_dir = self.result_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=False)

        query_path = job_dir / "query.fasta"
        output_path = job_dir / "blast_results.tsv"
        hits_path = job_dir / "hits.json"
        query_path.write_text(
            "\n".join(record.to_fasta() for record in records) + "\n",
            encoding="utf-8",
        )

        metadata: dict[str, Any] = {
            "job_id": job_id,
            "status": "running",
            "query_count": len(records),
            "query_ids": [record.identifier for record in records],
            "database": self.database.name,
            "e_value": e_value,
            "max_targets": max_targets,
            "matrix": matrix,
        }
        self._write_json(job_dir / "metadata.json", metadata)

        command = [
            self.blastp_path,
            "-query",
            str(query_path),
            "-db",
            str(self.database),
            "-evalue",
            str(e_value),
            "-max_target_seqs",
            str(max_targets),
            "-matrix",
            matrix,
            "-outfmt",
            f"6 {' '.join(BLAST_FIELDS)}",
            "-out",
            str(output_path),
        ]

        started_at = time.perf_counter()
        try:
            completed = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
            )
            if completed.returncode != 0:
                message = completed.stderr.strip() or "BLASTP returned an error."
                raise BlastpExecutionError(message)

            hits = self._parse_output(output_path)
            self._write_json(hits_path, hits)
            metadata.update(
                status="completed",
                hit_count=len(hits),
                duration_seconds=round(time.perf_counter() - started_at, 3),
            )
            self._write_json(job_dir / "metadata.json", metadata)
            return metadata

        except (OSError, subprocess.TimeoutExpired, BlastpExecutionError) as exc:
            metadata.update(
                status="failed",
                error=str(exc),
                duration_seconds=round(time.perf_counter() - started_at, 3),
            )
            self._write_json(job_dir / "metadata.json", metadata)
            raise BlastpExecutionError(str(exc)) from exc

    def run_file(
        self,
        fasta_path: str | Path,
        *,
        e_value: float = 10.0,
        max_targets: int = 50,
        matrix: str = "BLOSUM62",
    ) -> dict[str, Any]:
        """Run BLASTP with FASTA content read from an uploaded file."""
        path = Path(fasta_path)
        if not path.is_file():
            raise FastaValidationError(f"FASTA file does not exist: {path}")
        return self.run(
            path.read_bytes(),
            e_value=e_value,
            max_targets=max_targets,
            matrix=matrix,
        )

    def get_results(self, job_id: str) -> dict[str, list[dict[str, Any]]]:
        """Return all hit summaries grouped by query, excluding alignments."""
        job_dir = self._get_job_dir(job_id)
        metadata = self._read_json(job_dir / "metadata.json")
        hits = self._read_completed_hits(job_dir)
        grouped: dict[str, list[dict[str, Any]]] = {
            query_id: [] for query_id in metadata["query_ids"]
        }

        for hit in hits:
            summary = {
                key: value
                for key, value in hit.items()
                if key not in {"qseq", "sseq"}
            }
            grouped.setdefault(hit["qseqid"], []).append(summary)

        return grouped

    def get_alignment(self, job_id: str, hit_id: int) -> dict[str, Any]:
        """Return alignment data for one hit selected by its stable hit ID."""
        job_dir = self._get_job_dir(job_id)
        hits = self._read_completed_hits(job_dir)
        metadata = self._read_json(job_dir / "metadata.json")

        for hit in hits:
            if hit["hit_id"] == hit_id:
                return {
                    "hit_id": hit_id,
                    "query_id": hit["qseqid"],
                    "target_id": hit["sseqid"],
                    "query_start": hit["qstart"],
                    "query_end": hit["qend"],
                    "subject_start": hit["sstart"],
                    "subject_end": hit["send"],
                    "query_sequence": hit["qseq"],
                    "subject_sequence": hit["sseq"],
                    "match_line": self._make_match_line(
                        hit["qseq"],
                        hit["sseq"],
                        metadata["matrix"],
                    ),
                }

        raise KeyError(f"Hit {hit_id} was not found in job {job_id}.")

    @staticmethod
    def _validate_options(e_value: float, max_targets: int, matrix: str) -> None:
        if e_value <= 0:
            raise ValueError("e_value must be greater than zero.")
        if not 1 <= max_targets <= 500:
            raise ValueError("max_targets must be between 1 and 500.")
        if matrix not in ALLOWED_MATRICES:
            raise ValueError(f"Unsupported substitution matrix: {matrix}.")

    def _validate_database(self) -> None:
        if not Path(f"{self.database}.pin").is_file():
            raise FileNotFoundError(
                f"Protein BLAST database was not found: {self.database}"
            )

    @staticmethod
    def _parse_output(output_path: Path) -> list[dict[str, Any]]:
        hits: list[dict[str, Any]] = []
        if not output_path.exists():
            raise BlastpExecutionError("BLASTP did not create an output file.")

        with output_path.open(encoding="utf-8", newline="") as handle:
            reader = csv.reader(handle, delimiter="\t")
            for hit_id, values in enumerate(reader):
                if len(values) != len(BLAST_FIELDS):
                    raise BlastpExecutionError(
                        "BLASTP returned an unexpected tabular output format."
                    )

                hit: dict[str, Any] = {"hit_id": hit_id}
                for field, value in zip(BLAST_FIELDS, values):
                    if field in INTEGER_FIELDS:
                        hit[field] = int(value)
                    elif field in FLOAT_FIELDS:
                        hit[field] = float(value)
                    else:
                        hit[field] = value
                hits.append(hit)

        return hits

    def _get_job_dir(self, job_id: str) -> Path:
        try:
            safe_job_id = str(uuid.UUID(job_id))
        except ValueError as exc:
            raise KeyError("Invalid BLASTP job ID.") from exc

        job_dir = self.result_dir / safe_job_id
        if not job_dir.is_dir():
            raise KeyError(f"BLASTP job was not found: {job_id}")
        return job_dir

    def _read_completed_hits(self, job_dir: Path) -> list[dict[str, Any]]:
        metadata = self._read_json(job_dir / "metadata.json")
        if metadata["status"] != "completed":
            raise BlastpExecutionError(
                f"BLASTP job is not complete; current status is "
                f"'{metadata['status']}'."
            )
        return self._read_json(job_dir / "hits.json")

    @staticmethod
    def _make_match_line(query: str, subject: str, matrix_name: str) -> str:
        """Mark identities with letters and positive substitutions with '+'."""
        matrix = substitution_matrices.load(matrix_name)
        match_line = []

        for residue, target in zip(query, subject):
            # Gaps and non-positive substitutions remain blank in BLAST style.
            if residue == "-" or target == "-":
                match_line.append(" ")
            elif residue == target:
                match_line.append(residue)
            else:
                try:
                    match_line.append("+" if matrix[residue, target] > 0 else " ")
                except KeyError:
                    match_line.append(" ")

        return "".join(match_line)

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @staticmethod
    def _read_json(path: Path) -> Any:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)


def run_blastp(
    fasta_file: str | Path,
    e_value: float,
    max_target: int,
    db_path: str | Path = DEFAULT_DATABASE,
    matrix: str = "BLOSUM62",
) -> dict[str, Any]:
    """Compatibility wrapper for running BLASTP from a FASTA file path."""
    return BlastpService(database=db_path).run_file(
        fasta_file,
        e_value=e_value,
        max_targets=max_target,
        matrix=matrix,
    )
