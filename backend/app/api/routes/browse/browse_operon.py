"""Browse CRISPR-Cas operons with filters and pagination."""

from collections import defaultdict
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Query as SqlAlchemyQuery
from sqlalchemy.orm import Session

from db.session import get_db
from models.models import (
    Annotation,
    CrisprSystem,
    Environment,
    Genome,
    Operon,
    OperonProtein,
    Protein,
)
from schemas.browse.cas_operon import (
    CasOperonData,
    CasOperonFilterData,
    CasOperonGene,
    CasOperonListResponse,
    GeneCountRange,
)


router = APIRouter(prefix="/browse/cas-operons", tags=["browse"])

FACET_COLUMNS = {
    "crispr_class": CrisprSystem.crispr_class,
    "crispr_type": CrisprSystem.crispr_type,
    "crispr_subtype": Operon.crispr_subtype,
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

FACET_HIERARCHIES = (
    ("crispr_class", "crispr_type", "crispr_subtype"),
    (
        "lineage_domain",
        "lineage_phylum",
        "lineage_class",
        "lineage_order",
        "lineage_family",
        "lineage_genus",
        "lineage_species",
        "lineage_strain",
    ),
)


def filters_for_facet(
    filters: dict[str, list[str] | list[int] | None],
    field: str,
) -> dict[str, list[str] | list[int] | None]:
    """Keep facet dependencies directional: parent selections narrow children only."""
    facet_filters = {**filters, field: None}
    for hierarchy in FACET_HIERARCHIES:
        if field not in hierarchy:
            continue
        field_index = hierarchy.index(field)
        for descendant in hierarchy[field_index + 1 :]:
            facet_filters[descendant] = None
        break
    return facet_filters


def operon_query(db: Session) -> SqlAlchemyQuery:
    """Build the shared query used by list, detail, and facet endpoints."""
    return (
        db.query(Operon, Genome, Environment, CrisprSystem)
        .join(Genome, Genome.genome_header == Operon.genome_header)
        .outerjoin(Environment, Environment.genome_header == Genome.genome_header)
        .outerjoin(CrisprSystem, CrisprSystem.crispr_subtype == Operon.crispr_subtype)
    )


def apply_filters(
    query: SqlAlchemyQuery,
    filters: dict[str, list[str] | list[int] | None],
    min_genes: int | None,
    max_genes: int | None,
) -> SqlAlchemyQuery:
    for field, values in filters.items():
        if values:
            query = query.filter(FACET_COLUMNS[field].in_(values))

    if min_genes is not None:
        query = query.filter(Operon.n_genes >= min_genes)
    if max_genes is not None:
        query = query.filter(Operon.n_genes <= max_genes)

    return query


def genes_for_operons(db: Session, operon_headers: list[str]) -> dict[str, list[CasOperonGene]]:
    """Load all proteins for the current page in one database query."""
    if not operon_headers:
        return {}

    rows = (
        db.query(OperonProtein.operon_header, Protein)
        .join(Protein, Protein.protein_header == OperonProtein.protein_header)
        .filter(OperonProtein.operon_header.in_(operon_headers))
        .order_by(OperonProtein.operon_header, Protein.start_pos)
        .all()
    )

    protein_headers = [protein.protein_header for _, protein in rows]
    annotation_names: dict[str, str] = {}
    if protein_headers:
        annotations = (
            db.query(Annotation)
            .filter(
                Annotation.protein_header.in_(protein_headers),
                Annotation.source_db == "cctyper",
            )
            .order_by(Annotation.protein_header, Annotation.annotation_id)
            .all()
        )
        for annotation in annotations:
            if annotation.annotation_name:
                annotation_names.setdefault(annotation.protein_header, annotation.annotation_name)

    grouped: dict[str, list[CasOperonGene]] = defaultdict(list)
    for operon_header, protein in rows:
        grouped[operon_header].append(
            CasOperonGene(
                protein_header=protein.protein_header,
                annotation_name=annotation_names.get(protein.protein_header),
                start_pos=protein.start_pos,
                end_pos=protein.end_pos,
                strand=protein.strand,
                length=protein.length,
            )
        )
    return dict(grouped)


def serialize_operon(row, genes: list[CasOperonGene]) -> CasOperonData:
    operon, genome, environment, crispr_system = row
    return CasOperonData(
        operon_header=operon.operon_header,
        n_genes=operon.n_genes or len(genes),
        crispr_class=crispr_system.crispr_class if crispr_system else None,
        crispr_type=crispr_system.crispr_type if crispr_system else None,
        crispr_subtype=operon.crispr_subtype,
        annotated_by=operon.annotated_by,
        genome_header=genome.genome_header,
        country=environment.country if environment else None,
        host=environment.host if environment else None,
        source=environment.source if environment else None,
        lineage_domain=genome.tax_domain,
        lineage_phylum=genome.tax_phylum,
        lineage_class=genome.tax_class,
        lineage_order=genome.tax_order,
        lineage_family=genome.tax_family,
        lineage_genus=genome.tax_genus,
        lineage_species=genome.tax_species,
        lineage_strain=genome.strain,
        genes=genes,
    )


def operon_sort_expression(sort_by: str):
    """Return a safe database expression for the requested table column."""
    if sort_by == "n_genes":
        return func.coalesce(Operon.n_genes, 0)
    if sort_by == "cas_pro_component":
        selected_annotation = (
            select(Annotation.annotation_name)
            .where(
                Annotation.protein_header == Protein.protein_header,
                Annotation.source_db == "cctyper",
                Annotation.annotation_name.is_not(None),
            )
            .order_by(Annotation.annotation_id)
            .limit(1)
            .correlate(Protein)
            .scalar_subquery()
        )
        return (
            select(func.coalesce(selected_annotation, Protein.protein_header))
            .select_from(OperonProtein)
            .join(Protein, Protein.protein_header == OperonProtein.protein_header)
            .where(OperonProtein.operon_header == Operon.operon_header)
            .order_by(Protein.start_pos)
            .limit(1)
            .correlate(Operon)
            .scalar_subquery()
        )
    return Operon.operon_header


@router.get("/filters", response_model=CasOperonFilterData)
def get_operon_filters(
    crispr_class: list[int] | None = Query(None),
    crispr_type: list[str] | None = Query(None),
    crispr_subtype: list[str] | None = Query(None),
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
    min_genes: int | None = Query(None, ge=0),
    max_genes: int | None = Query(None, ge=0),
    db: Session = Depends(get_db),
):
    filters = {
        "crispr_class": crispr_class,
        "crispr_type": crispr_type,
        "crispr_subtype": crispr_subtype,
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
    facets: dict[str, dict[str, int]] = {}

    for field, column in FACET_COLUMNS.items():
        other_filters = filters_for_facet(filters, field)
        rows = (
            apply_filters(operon_query(db), other_filters, min_genes, max_genes)
            .with_entities(column, func.count(Operon.operon_header))
            .filter(column.isnot(None))
            .group_by(column)
            .order_by(func.count(Operon.operon_header).desc())
            .all()
        )
        facets[field] = {str(value): count for value, count in rows}

    minimum, maximum = db.query(func.min(Operon.n_genes), func.max(Operon.n_genes)).one()
    return CasOperonFilterData(
        facets=facets,
        gene_count=GeneCountRange(minimum=minimum or 0, maximum=maximum or 0),
    )


@router.get("/", response_model=CasOperonListResponse)
def list_operons(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    crispr_class: list[int] | None = Query(None),
    crispr_type: list[str] | None = Query(None),
    crispr_subtype: list[str] | None = Query(None),
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
    min_genes: int | None = Query(None, ge=0),
    max_genes: int | None = Query(None, ge=0),
    sort_by: Literal["operon_header", "n_genes", "cas_pro_component"] = Query(
        "operon_header"
    ),
    sort_direction: Literal["asc", "desc"] = Query("asc"),
    db: Session = Depends(get_db),
):
    filters = {
        "crispr_class": crispr_class,
        "crispr_type": crispr_type,
        "crispr_subtype": crispr_subtype,
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
    query = apply_filters(operon_query(db), filters, min_genes, max_genes)
    total = query.with_entities(func.count(Operon.operon_header)).scalar() or 0
    sort_expression = operon_sort_expression(sort_by)
    sort_order = (
        sort_expression.desc().nullslast()
        if sort_direction == "desc"
        else sort_expression.asc().nullslast()
    )
    rows = (
        query.order_by(sort_order, Operon.operon_header.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    headers = [row[0].operon_header for row in rows]
    genes = genes_for_operons(db, headers)
    items = [serialize_operon(row, genes.get(row[0].operon_header, [])) for row in rows]

    return CasOperonListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{operon_header}", response_model=CasOperonData)
def get_operon(operon_header: str, db: Session = Depends(get_db)):
    row = operon_query(db).filter(Operon.operon_header == operon_header).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Cas operon not found")

    genes = genes_for_operons(db, [operon_header]).get(operon_header, [])
    return serialize_operon(row, genes)
