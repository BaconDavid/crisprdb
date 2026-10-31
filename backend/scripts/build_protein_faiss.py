"""Encode the local crisprdb protein table with ESM-2 and build a FAISS index."""

from __future__ import annotations

import csv
import pickle
from datetime import datetime
from pathlib import Path

import faiss
import numpy as np
import psycopg2
from psycopg2.extras import execute_values
import torch
from transformers import AutoModel, AutoTokenizer


MODEL_NAME = "facebook/esm2_t33_650M_UR50D"
LAYER = 22  # Hugging Face hidden_states[22] = ESM-2 transformer layer 22.
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "test_data"
DB_SOCKET = "/var/run/postgresql"  # Match the local server used by psql.


def read_proteins() -> list[tuple[str, str]]:
    """Read a stable snapshot of all protein sequences from local PostgreSQL."""
    with psycopg2.connect(dbname="crisprdb", host=DB_SOCKET) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT protein_header, sequence "
                "FROM public.protein ORDER BY protein_header"
            )
            proteins = cursor.fetchall()
    if not proteins or any(not header or not sequence for header, sequence in proteins):
        raise ValueError("The protein table is empty or contains missing data.")
    return proteins


def batches(proteins: list[tuple[str, str]], token_budget: int = 2048):
    """Group similar lengths to limit padding and GPU memory use."""
    group: list[int] = []
    for row in sorted(range(len(proteins)), key=lambda i: len(proteins[i][1])):
        padded_tokens = len(proteins[row][1]) + 2  # <cls> and <eos>
        if group and (len(group) + 1) * padded_tokens > token_budget:
            yield group
            group = []
        group.append(row)
    if group:
        yield group


def encode(proteins: list[tuple[str, str]]) -> np.ndarray:
    """Mean-pool all residues of ESM-2 layer 22; never truncate sequences."""
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU is required for this embedding run.")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME, add_pooling_layer=False)
    model = model.to("cuda").eval()
    vectors = np.empty((len(proteins), model.config.hidden_size), dtype=np.float32)

    done = 0
    with torch.inference_mode():
        for group in batches(proteins):
            sequences = [proteins[row][1] for row in group]
            tokens = tokenizer(sequences, padding=True, return_tensors="pt").to("cuda")
            hidden = model(**tokens, output_hidden_states=True).hidden_states[LAYER]
            for batch_row, source_row in enumerate(group):
                length = len(sequences[batch_row])
                # Skip <cls>, <eos>, and padding; retain the complete sequence.
                vectors[source_row] = hidden[batch_row, 1 : length + 1].mean(0).cpu().numpy()
            done += len(group)
            if done % 50 < len(group) or done == len(proteins):
                print(f"Encoded {done}/{len(proteins)} proteins", flush=True)

    return vectors


def save_files(proteins: list[tuple[str, str]], vectors: np.ndarray) -> None:
    """Write raw vectors, cosine-search index, and the explicit ID mapping."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    headers = [header for header, _ in proteins]
    ids = np.arange(len(headers), dtype=np.int64)

    # The pickle preserves unnormalized vectors; FAISS uses unit vectors so
    # inner product equals cosine similarity.
    with (OUTPUT_DIR / "crisprdb_protein_embedding.pkl").open("wb") as handle:
        pickle.dump(
            {"model": MODEL_NAME, "layer": LAYER, "pooling": "mean",
             "protein_headers": headers, "embeddings": vectors},
            handle,
            protocol=pickle.HIGHEST_PROTOCOL,
        )

    normalized = np.ascontiguousarray(vectors.copy())
    faiss.normalize_L2(normalized)
    index = faiss.IndexIDMap2(faiss.IndexFlatIP(vectors.shape[1]))
    index.add_with_ids(normalized, ids)
    faiss.write_index(index, str(OUTPUT_DIR / "crisprdb_protein_embedding.faiss"))

    with (OUTPUT_DIR / "crisprdb_protein_faiss_map.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(("protein_header", "faiss_id"))
        writer.writerows(zip(headers, ids.tolist()))


def save_database_mapping(proteins: list[tuple[str, str]]) -> None:
    """Create the two-column mapping table without changing existing tables."""
    rows = [(header, index) for index, (header, _) in enumerate(proteins)]
    with psycopg2.connect(dbname="crisprdb", host=DB_SOCKET) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "CREATE TABLE IF NOT EXISTS public.protein_faiss_map ("
                "protein_header varchar PRIMARY KEY REFERENCES public.protein(protein_header), "
                "faiss_id bigint NOT NULL UNIQUE)"
            )
            cursor.execute("SELECT count(*) FROM public.protein_faiss_map")
            if cursor.fetchone()[0]:
                raise RuntimeError("protein_faiss_map already contains rows; refusing to overwrite it.")
            execute_values(
                cursor,
                "INSERT INTO public.protein_faiss_map (protein_header, faiss_id) VALUES %s",
                rows,
            )


def save_readme(count: int, dimensions: int) -> None:
    timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    (OUTPUT_DIR / "readme.md").write_text(
        "# CRISPRDB protein embeddings and FAISS index\n\n"
        f"Generated: {timestamp}\n\n"
        f"Source: local PostgreSQL `crisprdb.public.protein` (`protein_header`, `sequence`); {count} proteins.\n\n"
        f"Model: `{MODEL_NAME}`, transformer layer {LAYER}, complete-sequence residue mean pooling, {dimensions}-dimensional float32 vectors on CUDA.\n\n"
        "Files:\n"
        "- `crisprdb_protein_embedding.pkl`: protein headers and original, unnormalized embeddings.\n"
        "- `crisprdb_protein_embedding.faiss`: normalized vectors in an exact cosine-similarity FAISS index with explicit IDs.\n"
        "- `crisprdb_protein_faiss_map.csv`: `protein_header` to `faiss_id` mapping; also stored in PostgreSQL `public.protein_faiss_map`.\n\n"
        "Script: `backend/scripts/build_protein_faiss.py` (run in the `crisprdb` environment).\n",
        encoding="utf-8",
    )


def main() -> None:
    outputs = (
        "crisprdb_protein_embedding.pkl",
        "crisprdb_protein_embedding.faiss",
        "crisprdb_protein_faiss_map.csv",
    )
    if any((OUTPUT_DIR / name).exists() for name in outputs):
        raise FileExistsError("Output already exists; inspect it before rebuilding.")

    proteins = read_proteins()
    print(f"Encoding {len(proteins)} proteins on {torch.cuda.get_device_name(0)}", flush=True)
    vectors = encode(proteins)
    save_files(proteins, vectors)
    save_database_mapping(proteins)
    save_readme(len(proteins), vectors.shape[1])
    print(f"Saved {len(proteins)} embeddings and FAISS IDs to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
