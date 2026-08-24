from typing import Any

from pydantic import BaseModel, Field


class ProteinAnnotationData(BaseModel):
    annotation_software: str | None = None
    source_db: str | None = None
    annotation_acc: str | None = None
    annotation_name: str | None = None
    e_value: float | None = None
    bitscore: float | None = None
    start_pos: int | None = None
    end_pos: int | None = None
    extra: dict[str, Any] | None = None


class CasProteinData(BaseModel):
    protein_header: str
    annotation_name: str | None = None
    annotation_source: str
    annotation_acc: str | None = None
    annotation_e_value: float | None = None
    annotation_bitscore: float | None = None
    start_pos: int
    end_pos: int
    strand: int
    length: int
    sequence: str
    operon_header: str
    crispr_class: int | None = None
    crispr_type: str | None = None
    crispr_subtype: str | None = None
    genome_header: str
    country: str | None = None
    host: str | None = None
    source: str | None = None
    lineage_domain: str | None = None
    lineage_phylum: str | None = None
    lineage_class: str | None = None
    lineage_order: str | None = None
    lineage_family: str | None = None
    lineage_genus: str | None = None
    lineage_species: str | None = None
    lineage_strain: str | None = None
    annotations: list[ProteinAnnotationData] = Field(default_factory=list)


class CasProteinListResponse(BaseModel):
    items: list[CasProteinData]
    total: int
    page: int
    page_size: int
    annotation_source: str


class CasProteinFilterData(BaseModel):
    facets: dict[str, dict[str, int]]
    annotation_source: str
