# -*- coding: utf-8 -*-
"""
Created on Fri Jun 16 14:27:44 2023

@author: mheinzinger
"""

import argparse
import time
import re
from pathlib import Path

from urllib import request
import shutil
from typing import Sequence, Tuple
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from tqdm import tqdm
from transformers import T5Tokenizer, AutoModelForSeq2SeqLM, T5EncoderModel
from func_tools.model_batch_converter import FastaBatchedDataset

from transformers import AutoTokenizer, EsmForProteinFolding
from accelerate.test_utils.testing import get_backend


tokenizer = T5Tokenizer.from_pretrained(
        "Rostlab/ProstT5_fp16", do_lower_case=False)
# Load the model
print("Loading T5")
model = T5EncoderModel.from_pretrained(
    "Rostlab/ProstT5_fp16")
model = model.eval()
toks_per_batch = 12290

SS_MAPPING = {
    0: "A", 1: "C", 2: "D", 3: "E", 4: "F",
    5: "G", 6: "H", 7: "I", 8: "K", 9: "L",
    10: "M", 11: "N", 12: "P", 13: "Q", 14: "R",
    15: "S", 16: "T", 17: "V", 18: "W", 19: "Y",
}
 



class ProstT5BatchDataset(FastaBatchedDataset):
    """
    Dataset for ProstT5 model with <AA2fold> prefix.
    """
    def __init__(self, sequence_labels, sequence_strs):
        self.sequence_labels = list(sequence_labels)
        self.sequence_strs = list(sequence_strs)
 
    @classmethod
    def from_file(cls, fasta_file):
        sequence_labels, sequence_strs = [], []
        cur_seq_label = None
        buf = []
 
        def _flush_current_seq():
            nonlocal cur_seq_label, buf
            if cur_seq_label is None:
                return
            sequence_labels.append(cur_seq_label)
            sequence_strs.append("".join(buf))
            cur_seq_label = None
            buf = []
 
        with open(fasta_file, "r") as infile:
            for line_idx, line in enumerate(infile):
                if line.startswith(">"):
                    _flush_current_seq()
                    line = line[1:].strip()
                    if len(line) > 0:
                        cur_seq_label = line.split("#")[0].strip()
                    else:
                        cur_seq_label = f"seqnum{line_idx:09d}"
                else:
                    buf.append(line.strip())
 
        _flush_current_seq()
 
        assert len(set(sequence_labels)) == len(
            sequence_labels
        ), "Found duplicate sequence labels"
 
        return cls(sequence_labels, sequence_strs)

class ProstT5BatchConverter(object):
    """Callable to convert an unprocessed (labels + strings) batch to a
    processed (labels + tensor) batch, with <AA2fold> prefix for ProstT5.
    """
 
    def __init__(self, tokenizer):
        self.tokenizer = tokenizer
 
    def __call__(self, raw_batch: Sequence[Tuple[str, str]]):
        batch_labels, seq_str_list = zip(*raw_batch)
 
        standard_aa = set("ACDEFGHIKLMNPQRSTVWY")
        seq_str_list = [
            "<AA2fold> " + " ".join(
                aa if aa in standard_aa else "X"
                for aa in seq.upper()
            )
            for seq in seq_str_list
        ]
 
        tokens = self.tokenizer(
            seq_str_list,
            return_tensors="pt",
            padding="longest",
            add_special_tokens=True,
        )
 
        labels = list(batch_labels)
        strs = list(seq_str_list)
 
        return labels, strs, tokens



# Convolutional neural network (two convolutional layers)

class CNN(nn.Module):
    def __init__(self):
        super(CNN, self).__init__()
        self.classifier = nn.Sequential(
            nn.Conv2d(1024, 32, kernel_size=(7, 1), padding=(3, 0)),
            nn.ReLU(),
            nn.Dropout(0.0),
            nn.Conv2d(32, 20, kernel_size=(7, 1), padding=(3, 0)),
        )
 
    def forward(self, x):
        """
            L = protein length
            B = batch-size
            F = number of features (1024 for embeddings)
            N = number of classes (20 for 3Di)
        """
        x = x.permute(0, 2, 1).unsqueeze(dim=-1)
        Yhat = self.classifier(x)
        Yhat = Yhat.squeeze(dim=-1)
        return Yhat
 

class ProstT5CNNEncoder:
 
    def __init__(self, model_name: str = "ProstT5", device: str = "cuda"):
        self.model_name = "Rostlab/" + model_name
        self.device = device
 
    def get_model(self):
        model = T5EncoderModel.from_pretrained(self.model_name).to(self.device).eval()
        return model
 
    def get_predictor(self, weights_link="https://github.com/mheinzinger/ProstT5/raw/main/cnn_chkpnt/model.pt"):
        predictor = CNN()
        
        # 放到 HuggingFace 缓存里，和 ProstT5 模型权重在一起
        from huggingface_hub import hf_hub_download
        import os
        
        cache_dir = os.path.join(
            torch.hub.get_dir().replace("torch/hub", "huggingface/hub"),
            "models--Rostlab--ProstT5",
            "cnn_chkpnt"
        )
        checkpoint_p = Path(cache_dir) / "model.pt"
        
        if not checkpoint_p.exists():
            checkpoint_p.parent.mkdir(parents=True, exist_ok=True)
            req = request.Request(weights_link, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64)"
            })
            with request.urlopen(req) as response, open(checkpoint_p, "wb") as outfile:
                shutil.copyfileobj(response, outfile)

        state = torch.load(checkpoint_p, map_location=self.device)
        predictor.load_state_dict(state["state_dict"])
        predictor = predictor.eval().to(self.device)
        return predictor 
    
    def get_dataloader(self, fasta_file):
        dataset = ProstT5BatchDataset.from_file(fasta_file)
        batches = dataset.get_batch_indices(toks_per_batch, extra_toks_per_seq=1)
        dataloader = torch.utils.data.DataLoader(
            dataset,
            collate_fn=ProstT5BatchConverter(tokenizer),
            batch_sampler=batches,
        )
        return dataloader
 
    def inference(self, fasta_file: str, level: str = "residue"):
        if level != 'residue':
            raise ValueError("Only residue-level inference is supported for ProstT5CNNEncoder.")
        
        dataloader = self.get_dataloader(fasta_file)
        model = self.get_model()
        predictor = self.get_predictor()
        model.to(self.device)
        predictor.to(self.device)
 
        sequence_representations = []
 
        with torch.no_grad():
            for batch_idx, (labels, strs, toks) in tqdm(enumerate(dataloader), total=len(dataloader)):
                toks = toks.to(self.device)
                embedding_repr = model(
                    input_ids=toks["input_ids"],
                    attention_mask=toks["attention_mask"],
                )
 
                # Mask out special token at end of each sequence
                for idx, s in enumerate(strs):
                    seq_len = len(s.replace("<AA2fold> ", "").replace(" ", ""))
                    toks["attention_mask"][idx, seq_len + 1] = 0
 
                residue_embedding = embedding_repr.last_hidden_state.detach()
                residue_embedding = residue_embedding * toks["attention_mask"].unsqueeze(dim=-1)
                # Slice off prefix token
                residue_embedding = residue_embedding[:, 1:]
 
                # 3Di prediction
                prediction = predictor(residue_embedding)
                # Per-residue max probability (confidence)
                probabilities = torch.max(
                    F.softmax(prediction, dim=1), dim=1, keepdim=True
                )[0].detach().cpu().squeeze(dim=-1).numpy()
                prediction_idx = torch.max(prediction, dim=1)[1]
 
                for i, label in enumerate(labels):
                    seq_len = len(strs[i].replace("<AA2fold> ", "").replace(" ", ""))
                    pred_3di = prediction_idx[i, :seq_len].detach().cpu().numpy()
                    pred_str = "".join(SS_MAPPING[int(y)] for y in pred_3di)
                    # Average confidence (0-100)
                    # # Per-residue confidence (0-100)
                    per_residue_prob = (100 * probabilities[i, :seq_len]).astype(np.int8)


                    sequence_representations.append(
                    (label, strs[i].replace("<AA2fold> ", "").replace(" ", ""), pred_str, per_residue_prob)
                    )

        return sequence_representations








