"""Lazy, reusable ESMFold v1 inference wrapper."""

from __future__ import annotations

import os
from dataclasses import dataclass

import torch
from transformers import AutoTokenizer, EsmForProteinFolding
from transformers.models.esm.openfold_utils.feats import atom14_to_atom37
from transformers.models.esm.openfold_utils.protein import Protein, to_pdb


DEFAULT_MODEL_ID = "facebook/esmfold_v1"


class EsmFoldPredictionError(RuntimeError):
    """Raised when ESMFold cannot produce a structure."""


@dataclass(frozen=True)
class EsmFoldPrediction:
    pdb: str
    mean_plddt: float
    ptm: float


class EsmFoldV1Predictor:
    """Load ESMFold once and reuse it for sequential predictions."""

    def __init__(self) -> None:
        requested_device = os.environ.get("ESMFOLD_DEVICE")
        self.device = torch.device(
            requested_device or ("cuda" if torch.cuda.is_available() else "cpu")
        )
        if self.device.type == "cuda" and not torch.cuda.is_available():
            raise EsmFoldPredictionError("ESMFOLD_DEVICE requests CUDA, but CUDA is unavailable.")

        model_id = os.environ.get("ESMFOLD_MODEL_ID", DEFAULT_MODEL_ID)
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = EsmForProteinFolding.from_pretrained(model_id)
        if self.device.type == "cuda":
            self.model.esm = self.model.esm.half()
            torch.backends.cuda.matmul.allow_tf32 = True
        try:
            self.model = self.model.to(self.device).eval()
        except torch.cuda.OutOfMemoryError as exc:
            del self.model
            torch.cuda.empty_cache()
            raise EsmFoldPredictionError(
                "ESMFold could not start because the GPU does not have enough free memory."
            ) from exc

    def predict(self, sequence: str, recycles: int) -> EsmFoldPrediction:
        encoded = self.tokenizer(
            [sequence],
            return_tensors="pt",
            add_special_tokens=False,
        )
        input_ids = encoded["input_ids"].to(self.device)
        attention_mask = encoded["attention_mask"].to(self.device)
        try:
            with torch.inference_mode():
                output = self.model(
                    input_ids,
                    attention_mask=attention_mask,
                    num_recycles=recycles,
                )
            # Transformers 4.43 returns pLDDT on 0-1; PDB B-factors and the UI use 0-100.
            plddt = output["plddt"] * 100.0
            pdb = self._to_pdb(output, plddt)
            mean_plddt = float(plddt[0][:, 1].mean().item())  # C-alpha confidence
            ptm = float(output["ptm"].item())
            return EsmFoldPrediction(pdb=pdb, mean_plddt=mean_plddt, ptm=ptm)
        except torch.cuda.OutOfMemoryError as exc:
            raise EsmFoldPredictionError(
                "ESMFold ran out of GPU memory. Try a shorter sequence."
            ) from exc
        except Exception as exc:
            raise EsmFoldPredictionError(str(exc)) from exc
        finally:
            del encoded, input_ids, attention_mask
            if self.device.type == "cuda":
                torch.cuda.empty_cache()

    @staticmethod
    def _to_pdb(output, plddt: torch.Tensor) -> str:
        atom_positions = atom14_to_atom37(output["positions"][-1], output)
        values = {key: value.detach().cpu().numpy() for key, value in output.items()}
        prediction = Protein(
            aatype=values["aatype"][0],
            atom_positions=atom_positions[0].detach().cpu().numpy(),
            atom_mask=values["atom37_atom_exists"][0],
            residue_index=values["residue_index"][0] + 1,
            b_factors=plddt[0].detach().cpu().numpy(),
            chain_index=(
                values["chain_index"][0] if "chain_index" in values else None
            ),
        )
        return to_pdb(prediction)
