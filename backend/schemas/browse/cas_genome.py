from pydantic import BaseModel, Field

from schemas.browse.cas_operon import CasOperonData


class OperonCountRange(BaseModel):
    minimum: int
    maximum: int


class CasGenomeData(BaseModel):
    genome_header: str
    source: str | None = None
    country: str | None = None
    host: str | None = None
    bioproject: str | None = None
    contig_length: int | None = None
    n_operons: int
    lineage_domain: str | None = None
    lineage_phylum: str | None = None
    lineage_class: str | None = None
    lineage_order: str | None = None
    lineage_family: str | None = None
    lineage_genus: str | None = None
    lineage_species: str | None = None
    lineage_strain: str | None = None
    operons: list[CasOperonData] = Field(default_factory=list)


class CasGenomeListResponse(BaseModel):
    items: list[CasGenomeData]
    total: int
    page: int
    page_size: int


class CasGenomeFilterData(BaseModel):
    facets: dict[str, dict[str, int]]
    operon_count: OperonCountRange
