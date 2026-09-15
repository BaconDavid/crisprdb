"""Parse and normalize protein FASTA input."""

import re
from dataclasses import dataclass


MAX_SEQUENCES = 30
ALLOWED_AMINO_ACIDS = frozenset("ACDEFGHIKLMNPQRSTVWYBXZJUO")


class FastaValidationError(ValueError):
    """Raised when submitted FASTA content is invalid."""

@dataclass(frozen=True)
class FastaRecord:
    """A normalized protein FASTA record."""

    identifier: str
    description: str
    sequence: str

    def to_fasta(self, line_width: int = 60) -> str:
        header = self.identifier
        if self.description:
            header += f" {self.description}"

        lines = [
            self.sequence[start : start + line_width]
            for start in range(0, len(self.sequence), line_width)
        ]
        return f">{header}\n" + "\n".join(lines)


def parse_protein_fasta(
    content: str | bytes,
    max_sequences: int = MAX_SEQUENCES,
) -> list[FastaRecord]:
    """Parse and normalize protein FASTA content.

    Blank lines and whitespace inside sequence lines are removed. Headers and
    sequences must be non-empty, identifiers must be unique, and a terminal
    stop symbol is removed when present.
    """
    if isinstance(content, bytes):
        try:
            content = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise FastaValidationError("The FASTA file must be UTF-8 encoded.") from exc

    records: list[FastaRecord] = []
    identifiers: set[str] = set()
    current_header: str | None = None
    sequence_parts: list[str] = []

    def finish_record() -> None:
        if current_header is None:
            return

        sequence = "".join(sequence_parts).upper()
        if sequence.endswith("*"):
            sequence = sequence[:-1]
        if not sequence:
            raise FastaValidationError(
                f"Sequence '{current_header.split()[0]}' is empty."
            )

        invalid = sorted(set(sequence) - ALLOWED_AMINO_ACIDS)
        if invalid:
            invalid_text = ", ".join(invalid)
            raise FastaValidationError(
                f"Sequence '{current_header.split()[0]}' contains invalid "
                f"amino-acid characters: {invalid_text}."
            )

        identifier, _, description = current_header.partition(" ")
        if identifier in identifiers:
            raise FastaValidationError(
                f"Duplicate FASTA identifier: '{identifier}'."
            )

        identifiers.add(identifier)
        records.append(FastaRecord(identifier, description, sequence))

    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        if line.startswith(">"):
            finish_record()
            if len(records) >= max_sequences:
                raise FastaValidationError(
                    f"A maximum of {max_sequences} protein sequences is allowed."
                )

            current_header = " ".join(line[1:].split())
            sequence_parts = []
            if not current_header:
                raise FastaValidationError(
                    f"FASTA header on line {line_number} is empty."
                )
            continue

        if current_header is None:
            raise FastaValidationError(
                f"Sequence data on line {line_number} appears before a FASTA header."
            )

        # Remove spaces and tabs introduced by copying or line wrapping.
        sequence_parts.append(re.sub(r"\s+", "", line))

    finish_record()

    if not records:
        raise FastaValidationError(
            "No FASTA records were found. Input must start with '>'."
        )

    return records


def normalize_protein_fasta(content: str | bytes) -> str:
    """Return validated FASTA content with normalized headers and line wrapping."""
    records = parse_protein_fasta(content)
    return "\n".join(record.to_fasta() for record in records) + "\n"


