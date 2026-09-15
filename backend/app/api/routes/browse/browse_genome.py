"""Browse genomes and contigs with filters, operon counts, and pagination."""

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Query as SqlAlchemyQuery
from sqlalchemy.orm import Session

from app.api.routes.browse.browse_operon import (
    genes_for_operons,
    operon_query,
    serialize_operon,
)
from db.session import get_db
from models.models import CrisprArray, Environment, Genome, Operon, Protein
from schemas.browse.cas_genome import (
    CasGenomeData,
    CasGenomeFilterData,
    CasGenomeListResponse,
    OperonCountRange,
)
from schemas.browse.cas_operon import CasOperonData


router = APIRouter(prefix="/browse/genomes", tags=["browse"])

SOURCE_DATABASE = case(
    (or_(Genome.genome_header.startswith("GCA_"), Genome.genome_header.startswith("GCF_")), "NCBI"),
    (Genome.genome_header.startswith("EMBL_"), "EMBL"),
    (Genome.genome_header.startswith("IMG_"), "IMG"),
    (Genome.genome_header.like("MGYG%"), "MGnify"),
    (Genome.genome_header.like("Ga%"), "JGI GOLD"),
    else_="Other",
).label("source_database")

FACET_COLUMNS = {
    "source": SOURCE_DATABASE,
    "country": Environment.country,
    "host": Environment.host,
    "lineage_domain": Genome.tax_domain,
    "lineage_phylum": Genome.tax_phylum,
    "lineage_class": Genome.tax_class,
    "lineage_order": Genome.tax_order,
    "lineage_family": Genome.tax_family,
    "lineage_genus": Genome.tax_genus,
    "lineage_species": Genome.tax_species,
    "lineage_strain": Genome.strain,
}

TAXONOMY_HIERARCHY = (
    "lineage_domain",
    "lineage_phylum",
    "lineage_class",
    "lineage_order",
    "lineage_family",
    "lineage_genus",
    "lineage_species",
    "lineage_strain",
)


def filters_for_facet(
    filters: dict[str, list[str] | None],
    field: str,
) -> dict[str, list[str] | None]:
    """Let higher taxonomic ranks narrow lower ranks, never the reverse."""
    facet_filters = {**filters, field: None}
    if field in TAXONOMY_HIERARCHY:
        field_index = TAXONOMY_HIERARCHY.index(field)
        for descendant in TAXONOMY_HIERARCHY[field_index + 1 :]:
            facet_filters[descendant] = None
    return facet_filters


def genome_query(db: Session) -> SqlAlchemyQuery:
    """Build one row per genome with derived operon count and contig length."""
    operon_counts = (
        select(
            Operon.genome_header.label("genome_header"),
            func.count(Operon.operon_header).label("n_operons"),
        )
        .group_by(Operon.genome_header)
        .subquery()
    )
    protein_ends = (
        select(
            Protein.genome_header.label("genome_header"),
            func.max(Protein.end_pos).label("maximum_end"),
        )
        .group_by(Protein.genome_header)
        .subquery()
    )
    array_ends = (
        select(
            CrisprArray.genome_header.label("genome_header"),
            func.max(CrisprArray.end).label("maximum_end"),
        )
        .group_by(CrisprArray.genome_header)
        .subquery()
    )

    n_operons = func.coalesce(operon_counts.c.n_operons, 0).label("n_operons")
    contig_length = func.nullif(
        func.greatest(
            func.coalesce(protein_ends.c.maximum_end, 0),
            func.coalesce(array_ends.c.maximum_end, 0),
        ),
        0,
    ).label("contig_length")

    return (
        db.query(Genome, Environment, SOURCE_DATABASE, n_operons, contig_length)
        .outerjoin(Environment, Environment.genome_header == Genome.genome_header)
        .outerjoin(operon_counts, operon_counts.c.genome_header == Genome.genome_header)
        .outerjoin(protein_ends, protein_ends.c.genome_header == Genome.genome_header)
        .outerjoin(array_ends, array_ends.c.genome_header == Genome.genome_header)
    )


def apply_filters(
    query: SqlAlchemyQuery,
    filters: dict[str, list[str] | None],
    min_operons: int | None,
    max_operons: int | None,
) -> SqlAlchemyQuery:
    for field, values in filters.items():
        if values:
            query = query.filter(FACET_COLUMNS[field].in_(values))

    n_operons = query.column_descriptions[3]["expr"]
    if min_operons is not None:
        query = query.filter(n_operons >= min_operons)
    if max_operons is not None:
        query = query.filter(n_operons <= max_operons)
    return query


def operons_for_genomes(
    db: Session,
    genome_headers: list[str],
) -> dict[str, list[CasOperonData]]:
    if not genome_headers:
        return {}

    rows = (
        operon_query(db)
        .filter(Operon.genome_header.in_(genome_headers))
        .order_by(Operon.genome_header, Operon.operon_header)
        .all()
    )
    operon_headers = [row[0].operon_header for row in rows]
    genes = genes_for_operons(db, operon_headers)
    grouped: dict[str, list[CasOperonData]] = defaultdict(list)
    for row in rows:
        operon = row[0]
        grouped[operon.genome_header].append(
            serialize_operon(row, genes.get(operon.operon_header, []))
        )
    return dict(grouped)


def serialize_genome(
    row,
    operons: list[CasOperonData],
) -> CasGenomeData:
    genome, environment, source_database, n_operons, contig_length = row
    return CasGenomeData(
        genome_header=genome.genome_header,
        source=source_database,
        country=environment.country if environment else None,
        host=environment.host if environment else None,
        bioproject=genome.bioproject,
        contig_length=contig_length,
        n_operons=n_operons,
        lineage_domain=genome.tax_domain,
        lineage_phylum=genome.tax_phylum,
        lineage_class=genome.tax_class,
        lineage_order=genome.tax_order,
        lineage_family=genome.tax_family,
        lineage_genus=genome.tax_genus,
        lineage_species=genome.tax_species,
        lineage_strain=genome.strain,
        operons=operons,
    )


def genome_filters(
    source: list[str] | None,
    country: list[str] | None,
    host: list[str] | None,
    lineage_domain: list[str] | None,
    lineage_phylum: list[str] | None,
    lineage_class: list[str] | None,
    lineage_order: list[str] | None,
    lineage_family: list[str] | None,
    lineage_genus: list[str] | None,
    lineage_species: list[str] | None,
    lineage_strain: list[str] | None,
) -> dict[str, list[str] | None]:
    return {
        "source": source,
        "country": country,
        "host": host,
        "lineage_domain": lineage_domain,
        "lineage_phylum": lineage_phylum,
        "lineage_class": lineage_class,
        "lineage_order": lineage_order,
        "lineage_family": lineage_family,
        "lineage_genus": lineage_genus,
        "lineage_species": lineage_species,
        "lineage_strain": lineage_strain,
    }


@router.get("/filters", response_model=CasGenomeFilterData)
def get_genome_filters(
    source: list[str] | None = Query(None),
    country: list[str] | None = Query(None),
    host: list[str] | None = Query(None),
    lineage_domain: list[str] | None = Query(None),
    lineage_phylum: list[str] | None = Query(None),
    lineage_class: list[str] | None = Query(None),
    lineage_order: list[str] | None = Query(None),
    lineage_family: list[str] | None = Query(None),
    lineage_genus: list[str] | None = Query(None),
    lineage_species: list[str] | None = Query(None),
    lineage_strain: list[str] | None = Query(None),
    min_operons: int | None = Query(None, ge=0),
    max_operons: int | None = Query(None, ge=0),
    db: Session = Depends(get_db),
):
    filters = genome_filters(
        source,
        country,
        host,
        lineage_domain,
        lineage_phylum,
        lineage_class,
        lineage_order,
        lineage_family,
        lineage_genus,
        lineage_species,
        lineage_strain,
    )
    facets: dict[str, dict[str, int]] = {}

    for field, column in FACET_COLUMNS.items():
        other_filters = filters_for_facet(filters, field)
        rows = (
            apply_filters(genome_query(db), other_filters, min_operons, max_operons)
            .with_entities(column, func.count(Genome.genome_header))
            .filter(column.isnot(None))
            .group_by(column)
            .order_by(func.count(Genome.genome_header).desc())
            .all()
        )
        facets[field] = {str(value): count for value, count in rows}

    count_query = genome_query(db)
    n_operons = count_query.column_descriptions[3]["expr"]
    minimum, maximum = count_query.with_entities(
        func.min(n_operons),
        func.max(n_operons),
    ).one()
    return CasGenomeFilterData(
        facets=facets,
        operon_count=OperonCountRange(minimum=minimum or 0, maximum=maximum or 0),
    )


@router.get("/", response_model=CasGenomeListResponse)
def list_genomes(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    source: list[str] | None = Query(None),
    country: list[str] | None = Query(None),
    host: list[str] | None = Query(None),
    lineage_domain: list[str] | None = Query(None),
    lineage_phylum: list[str] | None = Query(None),
    lineage_class: list[str] | None = Query(None),
    lineage_order: list[str] | None = Query(None),
    lineage_family: list[str] | None = Query(None),
    lineage_genus: list[str] | None = Query(None),
    lineage_species: list[str] | None = Query(None),
    lineage_strain: list[str] | None = Query(None),
    min_operons: int | None = Query(None, ge=0),
    max_operons: int | None = Query(None, ge=0),
    db: Session = Depends(get_db),
):
    filters = genome_filters(
        source,
        country,
        host,
        lineage_domain,
        lineage_phylum,
        lineage_class,
        lineage_order,
        lineage_family,
        lineage_genus,
        lineage_species,
        lineage_strain,
    )
    query = apply_filters(genome_query(db), filters, min_operons, max_operons)
    total = query.with_entities(func.count(Genome.genome_header)).scalar() or 0
    rows = (
        query.order_by(Genome.genome_header)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    genome_headers = [row[0].genome_header for row in rows]
    operons = operons_for_genomes(db, genome_headers)
    items = [
        serialize_genome(row, operons.get(row[0].genome_header, [])) for row in rows
    ]
    return CasGenomeListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{genome_header}", response_model=CasGenomeData)
def get_genome(genome_header: str, db: Session = Depends(get_db)):
    row = genome_query(db).filter(Genome.genome_header == genome_header).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Genome or contig not found")

    operons = operons_for_genomes(db, [genome_header]).get(genome_header, [])
    return serialize_genome(row, operons)
