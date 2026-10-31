"""Replace crisprdb protein embeddings with the verified ESM-2 layer-22 vectors."""

from __future__ import annotations

import pickle
import subprocess
from datetime import datetime
from pathlib import Path

import numpy as np
import psycopg2
from psycopg2.extras import execute_values


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "test_data"
EMBEDDING_FILE = DATA_DIR / "crisprdb_protein_embedding.pkl"
DB_SOCKET = "/var/run/postgresql"


def load_embeddings() -> tuple[list[str], np.ndarray]:
    """Reject files that do not match the model, layer, or expected shape."""
    with EMBEDDING_FILE.open("rb") as handle:
        data = pickle.load(handle)  # This file was generated locally by build_protein_faiss.py.

    headers = data["protein_headers"]
    vectors = data["embeddings"]
    if (data["model"], data["layer"], data["pooling"]) != (
        "facebook/esm2_t33_650M_UR50D", 22, "mean"
    ):
        raise ValueError("Embedding metadata does not describe ESM-2 layer 22.")
    if (not isinstance(vectors, np.ndarray) or vectors.dtype != np.float32
            or vectors.shape != (len(headers), 1280) or not np.isfinite(vectors).all()
            or len(set(headers)) != len(headers)):
        raise ValueError("Embedding headers or vectors are invalid.")
    return headers, vectors


def main() -> None:
    headers, vectors = load_embeddings()
    with psycopg2.connect(dbname="crisprdb", host=DB_SOCKET) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT protein_header FROM public.protein_embedding")
            existing = {row[0] for row in cursor.fetchall()}
            if existing != set(headers):
                raise ValueError("Database protein headers do not match the embedding file.")

    # Keep a restorable copy before changing any row. pg_dump writes to a new file.
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = DATA_DIR / f"protein_embedding_before_layer22_{stamp}.dump"
    if backup.exists():
        raise FileExistsError(backup)
    subprocess.run(
        ["pg_dump", "-Fc", "-h", DB_SOCKET, "-d", "crisprdb",
         "-t", "public.protein_embedding", "-f", str(backup)],
        check=True,
    )
    if not backup.is_file() or backup.stat().st_size == 0:
        raise RuntimeError("Database backup is missing or empty; no rows were changed.")

    # Update inside one transaction; any failure rolls the entire replacement back.
    with psycopg2.connect(dbname="crisprdb", host=DB_SOCKET) as connection:
        with connection.cursor() as cursor:
            rows = ((header, vector.tolist()) for header, vector in zip(headers, vectors))
            for start in range(0, len(headers), 50):
                chunk = [next(rows) for _ in range(min(50, len(headers) - start))]
                execute_values(
                    cursor,
                    "UPDATE public.protein_embedding AS target "
                    "SET embedding = source.embedding::real[] "
                    "FROM (VALUES %s) AS source(protein_header, embedding) "
                    "WHERE target.protein_header = source.protein_header",
                    chunk,
                )

            cursor.execute(
                "SELECT protein_header, embedding FROM public.protein_embedding "
                "ORDER BY protein_header"
            )
            saved = cursor.fetchall()
            expected = dict(zip(headers, vectors))
            if len(saved) != len(headers) or any(
                not np.array_equal(np.asarray(value, dtype=np.float32), expected[header])
                for header, value in saved
            ):
                raise RuntimeError("Database verification failed; replacement rolled back.")

    print(f"Verified {len(headers)} layer-22 embeddings in public.protein_embedding.")
    print(f"Previous table backup: {backup}")


if __name__ == "__main__":
    main()
