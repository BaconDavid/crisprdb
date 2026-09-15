"""
given a sequence to predict the structure of the protein
"""

import os
from models import (
    esmfoldv1,
    prott5,
    colabfold
)



class StructurePredictionService:
    def __init__(self):
        self.colabfold_path = os.environ.get("COLABFOLD_PATH")
        if not self.colabfold_path:
            raise ValueError("COLABFOLD_PATH environment variable is not set.")
    
    def predict(self, 
                sequence: dict[str, str],
                model: str = "esmfoldv1",):
        if model == "colabfold":
            return self._predict_with_colabfold(sequence)
        elif model == "esmfoldv1":
            return self._predict_with_esmfold(sequence)
        else:
            raise ValueError(f"Unknown prediction model: {model}")

    def _predict_with_colabfold(self, sequence: dict[str, str]):
        return colabfold(sequence)

    def _predict_with_esmfold(self, sequence: dict[str, str]):
        return esmfoldv1(sequence)
    
