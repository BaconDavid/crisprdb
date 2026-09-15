"""Persistent Foldseek search jobs for sequence and structure queries."""

from __future__ import annotations

import csv
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.services.utilis.parse_fasta import (
    FastaRecord,
    FastaValidationError,
    MAX_SEQUENCES,
    parse_protein_fasta,
)


DEFAULT_RESULT_DIR = Path(tempfile.gettempdir()) / "crisprdb_foldseek_jobs"
DEFAULT_TARGET_DATABASE = "crisprdb_structures"
ALLOWED_STRUCTURE_SUFFIXES = {".pdb", ".cif", ".mmcif"}
RESULT_FIELDS = (
    "query",
    "target",
    "pident",
    "qcov",
    "tcov",
    "evalue",
    "bits",
    "alnlen",
    "qstart",
    "qend",
    "tstart",
    "tend",
)


class FoldseekJobStateError(RuntimeError):
    """Raised when results are requested before a Foldseek job completes."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class FoldseekSearchService:
    """Create persistent, single-worker Foldseek search jobs."""

    def __init__(self, result_dir: str | Path | None = None) -> None:
        configured_dir = result_dir or os.environ.get("FOLDSEEK_RESULT_DIR")
        self.result_dir = Path(configured_dir or DEFAULT_RESULT_DIR).expanduser().resolve()
        self.result_dir.mkdir(parents=True, exist_ok=True)
        self.foldseek_bin = os.environ.get("FOLDSEEK_PATH", "foldseek")
        self.prostt5_device = os.environ.get("PROSTT5_DEVICE", "cuda")
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="foldseek")
        self._prostt5_lock = threading.Lock()

    def submit_sequence(
        self,
        fasta_content: str | bytes,
        *,
        target_database: str = DEFAULT_TARGET_DATABASE,
        e_value: float = 0.001,
        max_hits: int = 100,
    ) -> dict[str, Any]:
        """Queue a ProstT5 3Di search from protein sequences."""
        records = self._parse_input(fasta_content)
        target_db_path = self._resolve_target_database(target_database)
        self._validate_options(e_value, max_hits)

        metadata, job_dir = self._create_job(
            source="sequence",
            query_ids=[record.identifier for record in records],
            target_database=target_database,
            e_value=e_value,
            max_hits=max_hits,
        )
        (job_dir / "input.fasta").write_text(
            "\n".join(record.to_fasta() for record in records) + "\n",
            encoding="utf-8",
        )
        self._executor.submit(self._run_job, metadata["job_id"], target_db_path)
        return metadata

    def submit_structures(
        self,
        structures: list[tuple[str, Path]],
        *,
        source_job_id: str,
        target_database: str = DEFAULT_TARGET_DATABASE,
        e_value: float = 0.001,
        max_hits: int = 100,
    ) -> dict[str, Any]:
        """Queue a search from PDB files resolved by StructureJobService."""
        if not structures:
            raise ValueError("At least one predicted structure must be selected.")

        target_db_path = self._resolve_target_database(target_database)
        self._validate_options(e_value, max_hits)
        validated_structures: list[tuple[str, Path]] = []
        for query_id, source_path in structures:
            resolved_path = Path(source_path).resolve()
            if not resolved_path.is_file() or resolved_path.suffix.lower() != ".pdb":
                raise ValueError(f"Predicted PDB file was not found: {resolved_path.name}")
            validated_structures.append((query_id, resolved_path))

        metadata, job_dir = self._create_job(
            source="prediction",
            query_ids=[query_id for query_id, _ in validated_structures],
            target_database=target_database,
            e_value=e_value,
            max_hits=max_hits,
            source_job_id=source_job_id,
        )

        # Copy selected structures so the Foldseek job is independent of source cleanup.
        query_dir = job_dir / "query_structures"
        query_dir.mkdir()
        for index, (_, source_path) in enumerate(validated_structures):
            shutil.copy2(source_path, query_dir / f"structure_{index:03d}.pdb")

        self._executor.submit(self._run_job, metadata["job_id"], target_db_path)
        return metadata

    def submit_uploaded_structures(
        self,
        structures: list[tuple[str, bytes]],
        *,
        target_database: str = DEFAULT_TARGET_DATABASE,
        e_value: float = 0.001,
        max_hits: int = 100,
    ) -> dict[str, Any]:
        """Queue a search from user-uploaded PDB or mmCIF files."""
        if not structures:
            raise ValueError("At least one structure file is required.")

        target_db_path = self._resolve_target_database(target_database)
        self._validate_options(e_value, max_hits)

        query_ids: list[str] = []
        prepared: list[tuple[str, str, bytes]] = []
        for index, (filename, content) in enumerate(structures, start=1):
            safe_name = Path(filename).name
            suffix = Path(safe_name).suffix.lower()
            if suffix not in ALLOWED_STRUCTURE_SUFFIXES:
                raise ValueError(f"Unsupported structure file: {safe_name}")
            self._validate_structure_content(safe_name, content)

            query_id = re.sub(r"[^A-Za-z0-9_.-]+", "_", Path(safe_name).stem).strip("._")
            query_id = query_id or f"structure_{index}"
            query_ids.append(query_id)
            prepared.append((query_id, suffix, content))

        if len(set(query_ids)) != len(query_ids):
            raise ValueError("Uploaded structure filenames must be unique.")

        metadata, job_dir = self._create_job(
            source="structure",
            query_ids=query_ids,
            target_database=target_database,
            e_value=e_value,
            max_hits=max_hits,
        )
        query_dir = job_dir / "query_structures"
        query_dir.mkdir()
        for query_id, suffix, content in prepared:
            (query_dir / f"{query_id}{suffix}").write_bytes(content)

        self._executor.submit(self._run_job, metadata["job_id"], target_db_path)
        return metadata

    def get_job(self, job_id: str) -> dict[str, Any]:
        return self._read_json(self._job_dir(job_id) / "metadata.json")

    def get_results(self, job_id: str) -> dict[str, Any]:
        metadata = self.get_job(job_id)
        if metadata["status"] != "completed":
            raise FoldseekJobStateError(
                f"Foldseek job is not complete; current status is '{metadata['status']}'."
            )

        return {
            "job_id": metadata["job_id"],
            "status": metadata["status"],
            "source": metadata["source"],
            "target_database": metadata["target_database"],
            "hits": self._read_json(self._job_dir(job_id) / "results.json"),
        }

    def _create_job(
        self,
        *,
        source: str,
        query_ids: list[str],
        target_database: str,
        e_value: float,
        max_hits: int,
        source_job_id: str | None = None,
    ) -> tuple[dict[str, Any], Path]:
        job_id = str(uuid.uuid4())
        job_dir = self.result_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=False)
        metadata: dict[str, Any] = {
            "job_id": job_id,
            "status": "queued",
            "source": source,
            "source_job_id": source_job_id,
            "query_count": len(query_ids),
            "query_ids": query_ids,
            "target_database": target_database,
            "e_value": e_value,
            "max_hits": max_hits,
            "progress": 0,
            "created_at": utc_now(),
        }
        self._write_json(job_dir / "metadata.json", metadata)
        return metadata, job_dir

    def _run_job(self, job_id: str, target_db_path: Path) -> None:
        job_dir = self._job_dir(job_id)
        metadata = self._read_json(job_dir / "metadata.json")
        metadata.update(status="running", stage="creating_query_db", progress=10)
        metadata["started_at"] = utc_now()
        self._write_json(job_dir / "metadata.json", metadata)

        try:
            query_db = job_dir / "query_db"
            if metadata["source"] == "sequence":
                self._create_sequence_query_db(job_dir, query_db)
            else:
                self._create_structure_query_db(job_dir, query_db)

            metadata.update(stage="searching", progress=60)
            self._write_json(job_dir / "metadata.json", metadata)
            hits = self._search(
                query_db=query_db,
                target_db=target_db_path,
                output_path=job_dir / "results.tsv",
                temporary_dir=job_dir / "tmp",
                e_value=metadata["e_value"],
                max_hits=metadata["max_hits"],
            )
            self._write_json(job_dir / "results.json", hits)
            metadata.update(
                status="completed",
                stage="completed",
                progress=100,
                hit_count=len(hits),
                completed_at=utc_now(),
            )
        except Exception as exc:
            metadata.update(
                status="failed",
                stage="failed",
                error=self._error_message(exc),
                failed_at=utc_now(),
            )
        self._write_json(job_dir / "metadata.json", metadata)

    def _create_sequence_query_db(self, job_dir: Path, query_db: Path) -> None:
        records = parse_protein_fasta((job_dir / "input.fasta").read_text(encoding="utf-8"))
        encoder_class = self._load_prostt5_encoder()

        with self._prostt5_lock:
            predictions = encoder_class(device=self.prostt5_device).inference(
                job_dir / "input.fasta"
            )
        if len(predictions) != len(records):
            raise RuntimeError("ProstT5 returned an unexpected number of 3Di sequences.")

        with tempfile.TemporaryDirectory(dir=job_dir) as temporary:
            temporary_dir = Path(temporary)
            aa_tsv = temporary_dir / "aa.tsv"
            three_di_tsv = temporary_dir / "3di.tsv"
            header_tsv = temporary_dir / "header.tsv"
            aa_tsv.write_text(
                "".join(
                    f"{index}\t{record.sequence}\n"
                    for index, record in enumerate(records, start=1)
                ),
                encoding="utf-8",
            )
            three_di_tsv.write_text(
                "".join(
                    f"{index}\t{prediction[2]}\n"
                    for index, prediction in enumerate(predictions, start=1)
                ),
                encoding="utf-8",
            )
            header_tsv.write_text(
                "".join(
                    f"{index}\t{record.identifier}\n"
                    for index, record in enumerate(records, start=1)
                ),
                encoding="utf-8",
            )

            for input_path, suffix, db_type in (
                (aa_tsv, "", "0"),
                (three_di_tsv, "_ss", "0"),
                (header_tsv, "_h", "12"),
            ):
                self._run_command(
                    self.foldseek_bin,
                    "tsv2db",
                    input_path,
                    f"{query_db}{suffix}",
                    "--output-dbtype",
                    db_type,
                )

    def _create_structure_query_db(self, job_dir: Path, query_db: Path) -> None:
        self._run_command(
            self.foldseek_bin,
            "createdb",
            job_dir / "query_structures",
            query_db,
            "--threads",
            "1",
        )

    def _search(
        self,
        *,
        query_db: Path,
        target_db: Path,
        output_path: Path,
        temporary_dir: Path,
        e_value: float,
        max_hits: int,
    ) -> list[dict[str, Any]]:
        alignment_db = output_path.with_suffix(".db")
        self._run_command(
            self.foldseek_bin,
            "search",
            query_db,
            target_db,
            alignment_db,
            temporary_dir,
            "-e",
            str(e_value),
            "--max-seqs",
            str(max_hits),
            "--threads",
            "1",
        )
        self._run_command(
            self.foldseek_bin,
            "convertalis",
            query_db,
            target_db,
            alignment_db,
            output_path,
            "--format-output",
            ",".join(RESULT_FIELDS),
        )
        return self._parse_results(output_path)

    @staticmethod
    def _parse_results(path: Path) -> list[dict[str, Any]]:
        if not path.exists() or path.stat().st_size == 0:
            return []

        hits: list[dict[str, Any]] = []
        with path.open(encoding="utf-8", newline="") as handle:
            rows = csv.DictReader(handle, delimiter="\t", fieldnames=RESULT_FIELDS)
            for row in rows:
                hits.append(
                    {
                        "query": row["query"],
                        "target": row["target"],
                        "description": "",
                        "identity": float(row["pident"]) / 100,
                        "query_coverage": float(row["qcov"]),
                        "target_coverage": float(row["tcov"]),
                        "evalue": row["evalue"],
                        "bit_score": float(row["bits"]),
                        "aligned_length": int(row["alnlen"]),
                        "query_start": int(row["qstart"]),
                        "query_end": int(row["qend"]),
                        "target_start": int(row["tstart"]),
                        "target_end": int(row["tend"]),
                    }
                )
        return hits

    def _resolve_target_database(self, name: str) -> Path:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
            raise ValueError("Invalid Foldseek target database name.")

        environment_name = f"FOLDSEEK_DB_{name.upper().replace('-', '_')}"
        configured_path = os.environ.get(environment_name)
        if name == DEFAULT_TARGET_DATABASE:
            configured_path = (
                configured_path
                or os.environ.get("FOLDSEEK_TARGET_DB")
                or os.environ.get("FOLDSEEK_DATABASE")
            )
        if not configured_path:
            raise ValueError(
                f"Foldseek database '{name}' is not configured. Set {environment_name}."
            )

        # Accept a path accidentally wrapped in shell-style square brackets.
        configured_path = configured_path.strip().removeprefix("[").removesuffix("]")
        database_path = Path(configured_path).expanduser().resolve()
        if not database_path.exists() and not Path(f"{database_path}.dbtype").exists():
            raise ValueError(f"Foldseek database '{name}' was not found on the server.")
        return database_path

    @staticmethod
    def _validate_options(e_value: float, max_hits: int) -> None:
        if e_value <= 0:
            raise ValueError("e_value must be greater than zero.")
        if not 1 <= max_hits <= 1000:
            raise ValueError("max_hits must be between 1 and 1000.")

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
        return parse_protein_fasta(text, max_sequences=MAX_SEQUENCES)

    @staticmethod
    def _validate_structure_content(filename: str, content: bytes) -> None:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValueError(f"'{filename}' must be a UTF-8 text structure file.") from exc

        suffix = Path(filename).suffix.lower()
        if suffix == ".pdb" and not any(
            line.startswith(("ATOM  ", "HETATM")) for line in text.splitlines()
        ):
            raise ValueError(f"'{filename}' does not contain PDB atom records.")
        if suffix in {".cif", ".mmcif"} and "_atom_site." not in text:
            raise ValueError(f"'{filename}' does not contain an mmCIF atom table.")

    @staticmethod
    def _load_prostt5_encoder() -> type:
        """Load ProstT5 lazily from the configured script or local fallback."""
        configured_path = os.environ.get("PROSTT5_CNN_PATH")
        if not configured_path:
            from app.services.structure.models.prott5 import ProstT5CNNEncoder

            return ProstT5CNNEncoder

        script_path = Path(configured_path).expanduser()
        if not script_path.suffix:
            script_path = script_path.with_suffix(".py")
        script_path = script_path.resolve()
        if not script_path.is_file():
            raise RuntimeError(f"ProstT5 script was not found: {script_path}")

        spec = importlib.util.spec_from_file_location("crisprdb_prostt5", script_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Unable to load the ProstT5 script: {script_path}")

        module = importlib.util.module_from_spec(spec)
        # The configured script imports sibling packages such as func_tools.
        # Add its project root only for the duration of module loading.
        script_root = str(script_path.parent.parent)
        added_to_path = script_root not in sys.path
        if added_to_path:
            sys.path.insert(0, script_root)
        try:
            spec.loader.exec_module(module)
        finally:
            if added_to_path:
                sys.path.remove(script_root)
        encoder_class = getattr(module, "ProstT5CNNEncoder", None)
        if encoder_class is None:
            raise RuntimeError("The ProstT5 script does not define ProstT5CNNEncoder.")
        return encoder_class

    @staticmethod
    def _run_command(*parts: str | Path) -> None:
        command = [str(part) for part in parts]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            detail = result.stderr.strip() or result.stdout.strip()
            raise RuntimeError(detail or f"Command failed with exit code {result.returncode}.")

    def _job_dir(self, job_id: str) -> Path:
        try:
            safe_job_id = str(uuid.UUID(job_id))
        except ValueError as exc:
            raise KeyError("Invalid Foldseek job ID.") from exc
        job_dir = self.result_dir / safe_job_id
        if not job_dir.is_dir():
            raise KeyError(f"Foldseek job was not found: {job_id}")
        return job_dir

    @staticmethod
    def _error_message(error: Exception) -> str:
        return str(error).strip() or error.__class__.__name__

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(value, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temporary.replace(path)

    @staticmethod
    def _read_json(path: Path) -> Any:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
