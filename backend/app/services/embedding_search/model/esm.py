"""
Encode protein sequences into embeddings with ESM-2.
"""

import torch
from tqdm import tqdm
from typing import Literal, Sequence, Tuple
from transformers import AutoTokenizer, AutoModel

from func_tools.model_batch_converter import FastaBatchedDataset

toks_per_batch = 12290


class ESMBatchDataset(FastaBatchedDataset):

    def __init__(self, sequence_labels, sequence_strs):
        self.sequence_labels = list(sequence_labels)
        self.sequence_strs = list(sequence_strs)

    @classmethod
    def _from_lines(cls, lines):
        """Shared FASTA parser. `lines` is any iterable of lines."""
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

        for line_idx, line in enumerate(lines):
            if line.startswith(">"):                      # label line
                _flush_current_seq()
                line = line[1:].strip()
                if len(line) > 0:
                    cur_seq_label = line.split("#")[0].strip()
                else:
                    cur_seq_label = f"seqnum{line_idx:09d}"
            else:                                         # sequence line
                buf.append(line.strip())

        _flush_current_seq()

        assert len(sequence_labels) > 0, "No sequence found, is the FASTA header missing?"
        assert len(set(sequence_labels)) == len(sequence_labels), \
            "Found duplicate sequence labels"

        return cls(sequence_labels, sequence_strs)

    @classmethod
    def from_sequence(cls, fasta_seq: str):
        """Parse a FASTA string pasted in directly."""
        return cls._from_lines(fasta_seq.splitlines())

    @classmethod
    def from_file(cls, fasta_file: str):
        """Parse a FASTA file on disk."""
        with open(fasta_file, "r") as infile:
            return cls._from_lines(infile)


class ESMBatchConverter(object):
    """Convert a raw (labels + strings) batch into (labels, strs, tokens)."""

    def __init__(self, tokenizer):
        self.tokenizer = tokenizer

    def __call__(self, raw_batch: Sequence[Tuple[str, str]]):
        labels, strs = zip(*raw_batch)
        tokens = self.tokenizer(
            list(strs),
            return_tensors="pt",
            padding="longest",
            add_special_tokens=True,
        )
        return list(labels), list(strs), tokens


class ESMEncoder:

    def __init__(self, model_name: str = "esm2_t33_650M_UR50D", device: str = "cuda"):
        self.model_name = model_name
        self.device = device

    def get_tokenizer(self):
        return AutoTokenizer.from_pretrained(f"facebook/{self.model_name}")

    def get_model(self):
        return AutoModel.from_pretrained(f"facebook/{self.model_name}").to(self.device)

    def get_dataloader(self, dataset):
        batches = dataset.get_batch_indices(toks_per_batch, extra_toks_per_seq=2)
        return torch.utils.data.DataLoader(
            dataset,
            collate_fn=ESMBatchConverter(self.get_tokenizer()),
            batch_sampler=batches,
        )

    def inference(self, dataset,
                  level: Literal["mean", "residue"] = "mean",
                  layer: int = -1):
        """
        level: 'mean' gives one vector per protein, 'residue' gives per-residue.
        layer: which transformer block output to take.
               0 = first block, -1 = last block (default, same as before).
        """
        dataloader = self.get_dataloader(dataset)
        model = self.get_model()
        model.eval()

        sequence_representations = []
        with torch.no_grad():
            for labels, strs, toks in tqdm(dataloader, total=len(dataloader)):
                toks = toks.to(self.device)
                out = model(
                    input_ids=toks["input_ids"],
                    attention_mask=toks["attention_mask"],
                    output_hidden_states=True,
                )
                # hidden_states[0] is the embedding layer output;
                # slicing [1:] makes index 0 line up with the first block
                hidden = out.hidden_states[1:][layer]

                for i, label in enumerate(labels):
                    seq_len = len(strs[i])
                    emb = hidden[i, 1:seq_len + 1]        # strip <cls> and padding
                    if level == "mean":
                        emb = emb.mean(0)
                    sequence_representations.append(
                        (label, strs[i], emb.detach().cpu().numpy())
                    )

        return sequence_representations

    def inference_from_file(self, fasta_file: str, level="mean", layer: int = -1):
        return self.inference(ESMBatchDataset.from_file(fasta_file), level, layer)

    def inference_from_sequence(self, fasta_seq: str, level="mean", layer: int = -1):
        return self.inference(ESMBatchDataset.from_sequence(fasta_seq), level, layer)