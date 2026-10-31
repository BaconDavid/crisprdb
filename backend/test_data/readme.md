# CRISPRDB protein embeddings and FAISS index

Generated: 2026-10-31 15:38:38 CST

Source: local PostgreSQL `crisprdb.public.protein` (`protein_header`, `sequence`); 1655 proteins.

Model: `facebook/esm2_t33_650M_UR50D`, transformer layer 22, complete-sequence residue mean pooling, 1280-dimensional float32 vectors on CUDA.

Files:
- `crisprdb_protein_embedding.pkl`: protein headers and original, unnormalized embeddings.
- `crisprdb_protein_embedding.faiss`: normalized vectors in an exact cosine-similarity FAISS index with explicit IDs.
- `crisprdb_protein_faiss_map.csv`: `protein_header` to `faiss_id` mapping; also stored in PostgreSQL `public.protein_faiss_map`.

Script: `backend/scripts/build_protein_faiss.py` (run in the `crisprdb` environment).

Database: `public.protein_embedding` now contains these 1655 layer-22 vectors. `backend/scripts/sync_protein_embedding.py` performed the replacement after saving the old table as `protein_embedding_before_layer22_20261031_155653.dump`.

Search: `backend/app/services/embedding_search/embedding_encoding.py` uses the same model and layer. Job results and query vectors are stored under `/tmp/crisprdb_embedding_jobs/<job_id>/`.
