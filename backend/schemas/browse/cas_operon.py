from pydantic import BaseModel, Field


class CasOperonGene(BaseModel):
    protein_header: str
    annotation_name: str | None = None
    start_pos: int
    end_pos: int
    strand: int
    length: int


class CasOperonData(BaseModel):
    operon_header: str
    n_genes: int
    crispr_class: int | None = None
    crispr_type: str | None = None
    crispr_subtype: str | None = None
    annotated_by: str | None = None
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
    genes: list[CasOperonGene] = Field(default_factory=list)


class CasOperonListResponse(BaseModel):
    items: list[CasOperonData]
    total: int
    page: int
    page_size: int


class GeneCountRange(BaseModel):
    minimum: int
    maximum: int


class CasOperonFilterData(BaseModel):
    facets: dict[str, dict[str, int]]
    gene_count: GeneCountRange
