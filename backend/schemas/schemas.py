from typing import Any

from pydantic import BaseModel


class GenomeRead(BaseModel):
    genome_header: str
    bioproject: str | None = None
    tax_phylum: str | None = None
    tax_class: str | None = None
    tax_order: str | None = None
    tax_family: str | None = None
    tax_genus: str | None = None
    tax_species: str | None = None
    strain: str | None = None
    tax_domain: str | None = None

    model_config = {"from_attributes": True}


class OperonRead(BaseModel):
    operon_header: str
    n_genes: int | None = None
    crispr_subtype: str | None = None
    genome_header: str | None = None
    annotated_by: str | None = None

    model_config = {"from_attributes": True}


class EnvironmentRead(BaseModel):
    genome_header: str
    country: str | None = None
    host: str | None = None
    source: str | None = None

    model_config = {"from_attributes": True}


class CrisprSystemRead(BaseModel):
    crispr_subtype: str
    crispr_type: str | None = None
    crispr_class: int | None = None

    model_config = {"from_attributes": True}


class AnnotationRead(BaseModel):
    annotation_id: int
    protein_header: str | None = None
    source_db: str | None = None
    annotation_software: str | None = None
    annotation_acc: str | None = None
    annotation_name: str | None = None
    e_value: float | None = None
    bitscore: float | None = None
    start_pos: int | None = None
    end_pos: int | None = None
    extra: Any | None = None

    model_config = {"from_attributes": True}


class CrisprArrayRead(BaseModel):
    array_id: int
    genome_header: str | None = None
    start: int | None = None
    end: int | None = None
    consensus_repeat: str | None = None
    n_repeats: int | None = None
    n_spacer: int | None = None
    average_repeat_length: int | None = None
    average_spacer_length: int | None = None
    annotation_software: str | None = None
    CRISPR: str | None = None

    model_config = {"from_attributes": True}


class OperonProteinRead(BaseModel):
    operon_pro_id: int
    operon_header: str
    protein_header: str

    model_config = {"from_attributes": True}


class ProteinRead(BaseModel):
    protein_header: str
    genome_header: str
    start_pos: int
    end_pos: int
    strand: int
    length: int
    sequence: str

    model_config = {"from_attributes": True}


class RepeatRead(BaseModel):
    id: int
    array_id: int | None = None
    repeat_sequence: str | None = None
    start: int | None = None
    end: int | None = None
    CRISPR: str | None = None
    genome_header: str | None = None
    annotated_by: str | None = None
    length: int | None = None
    strand: str | None = None

    model_config = {"from_attributes": True}


class SpacerRead(BaseModel):
    id: int
    array_id: int | None = None
    spacer_sequence: str | None = None
    start: int | None = None
    end: int | None = None
    CRISPR: str | None = None
    genome_header: str | None = None
    annotated_by: str | None = None
    length: int | None = None
    strand: str | None = None

    model_config = {"from_attributes": True}


class StructureRead(BaseModel):
    structure_id: str
    protein_header: str | None = None
    predicted_by: str
    mean_plddt: float
    structure_path: str | None = None

    model_config = {"from_attributes": True}


class UserRead(BaseModel):
    username: str

    model_config = {"from_attributes": True}
