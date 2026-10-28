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

