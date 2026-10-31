"""Encode uploaded proteins with ESM-2 layer 22 and search the local FAISS index."""

from __future__ import annotations

import csv
import json
import tempfile
import uuid
from pathlib import Path

import faiss
import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

from app.services.utilis.parse_fasta import parse_protein_fasta


MODEL = "facebook/esm2_t33_650M_UR50D"
# Hugging Face hidden_states[0] is the input embedding; [22] is block 22.
LAYER = 22
DATA_DIR = Path(__file__).resolve().parents[3] / "test_data"
INDEX_FILE = DATA_DIR / "crisprdb_protein_embedding.faiss"
MAPPING_FILE = DATA_DIR / "crisprdb_protein_faiss_map.csv"
RESULT_DIR = Path(tempfile.gettempdir()) / "crisprdb_embedding_jobs"


class EmbeddingService:
    """Use the same model, layer, and mean pooling as build_protein_faiss.py."""

    def __init__(
        self,
        index_file: Path = INDEX_FILE,
        mapping_file: Path = MAPPING_FILE,
        result_dir: Path = RESULT_DIR,
    ):
        self.index_file = Path(index_file)
        self.mapping_file = Path(mapping_file)
        self.result_dir = Path(result_dir)
        self._tokenizer = None
        self._model = None

    def encoding(self, fasta_content: str | bytes) -> list[tuple[str, np.ndarray]]:
        """Return (query ID, unnormalized layer-22 vector) for each FASTA record."""
        records = parse_protein_fasta(fasta_content)
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA GPU is required for ESM-2 embedding search.")

        if self._model is None:
            self._tokenizer = AutoTokenizer.from_pretrained(MODEL)
            self._model = AutoModel.from_pretrained(
                MODEL, add_pooling_layer=False
            ).to("cuda").eval()

        results = []
        with torch.inference_mode():
            for record in records:
                # Encode separately to avoid padding long sequences up to 30 times.
                tokens = self._tokenizer(record.sequence, return_tensors="pt").to("cuda")
                hidden = self._model(
                    **tokens, output_hidden_states=True
                ).hidden_states[LAYER]
                vector = hidden[0, 1 : len(record.sequence) + 1].mean(0)
                results.append((record.identifier, vector.cpu().numpy().astype(np.float32)))
        return results

    def search(self, fasta_content: str | bytes, top_k: int = 10) -> list[dict]:
        """Return cosine-similarity hits identified by protein_header for each query."""
        return self._search_embeddings(self.encoding(fasta_content), top_k)

    def _search_embeddings(
        self, queries: list[tuple[str, np.ndarray]], top_k: int
    ) -> list[dict]:
        """Search vectors already encoded by this service."""
        if top_k < 1:
            raise ValueError("top_k must be at least 1.")
        index = faiss.read_index(str(self.index_file))
        with self.mapping_file.open(newline="", encoding="utf-8") as handle:
            mapping = {
                int(row["faiss_id"]): row["protein_header"]
                for row in csv.DictReader(handle)
            }
        if len(mapping) != index.ntotal:
            raise RuntimeError("FAISS index and protein ID mapping have different sizes.")

        vectors = np.ascontiguousarray(np.stack([vector for _, vector in queries]))
        faiss.normalize_L2(vectors)
        scores, ids = index.search(vectors, min(top_k, index.ntotal))
        return [
            {
                "query_id": query_id,
                "hits": [
                    {"protein_header": mapping[int(faiss_id)],
                     "faiss_id": int(faiss_id), "score": float(score)}
                    for faiss_id, score in zip(ids[row], scores[row])
                ],
            }
            for row, (query_id, _) in enumerate(queries)
        ]

    def run(self, fasta_content: str | bytes, top_k: int = 10) -> dict:
        """Save query embeddings and hits under a new job ID for later retrieval."""
        if top_k < 1:
            raise ValueError("top_k must be at least 1.")
        queries = self.encoding(fasta_content)
        results = self._search_embeddings(queries, top_k)
        job_id = str(uuid.uuid4())
        job_dir = self.result_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=False)

        np.savez_compressed(
            job_dir / "query_embeddings.npz",
            query_ids=[query_id for query_id, _ in queries],
            embeddings=np.stack([vector for _, vector in queries]),
        )
        (job_dir / "results.json").write_text(
            json.dumps(results, ensure_ascii=False), encoding="utf-8"
        )
        return {"job_id": job_id, "status": "completed", "query_count": len(queries)}

    def get_result(self, job_id: str) -> list[dict]:
        """Read a completed job; UUID validation prevents path traversal."""
        safe_id = str(uuid.UUID(job_id))
        return json.loads((self.result_dir / safe_id / "results.json").read_text(
            encoding="utf-8"
        ))
