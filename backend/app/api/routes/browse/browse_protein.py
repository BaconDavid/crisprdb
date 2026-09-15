"""Browse CRISPR-Cas proteins with filters and pagination."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Float, cast, func, select
from sqlalchemy.orm import Query as SqlAlchemyQuery
from sqlalchemy.orm import Session, aliased

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
from schemas.browse.cas_protein import (
    CasProteinData,
    CasProteinFilterData,
    CasProteinListResponse,
    ProteinAnnotationData,
)


router = APIRouter(prefix="/browse/cas-proteins", tags=["browse"])

SelectedAnnotation = aliased(Annotation, name="selected_annotation")

FACET_COLUMNS = {
    "crispr_class": CrisprSystem.crispr_class,
    "crispr_type": CrisprSystem.crispr_type,
    "crispr_subtype": Operon.crispr_subtype,
    "protein_name": SelectedAnnotation.annotation_name,
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
    """Let parent facets narrow descendants without reverse filtering parents."""
    facet_filters = {**filters, field: None}
    for hierarchy in FACET_HIERARCHIES:
        if field not in hierarchy:
            continue
        field_index = hierarchy.index(field)
        for descendant in hierarchy[field_index + 1 :]:
            facet_filters[descendant] = None
        break
    return facet_filters


def protein_query(
    db: Session,
    annotation_source: str = "cctyper",
) -> SqlAlchemyQuery:
    """Build one row per protein using the source's highest-bitscore hit."""

    annotation_bitscore = func.coalesce(
        cast(Annotation.extra["bitscore"].astext, Float),
        Annotation.bitscore,
    )
    selected_annotations = (
        select(Annotation.protein_header, Annotation.annotation_id)
        .where(
            Annotation.source_db == annotation_source,
            Annotation.annotation_name.is_not(None),
            Annotation.annotation_name != "",
        )
        .distinct(Annotation.protein_header)
        .order_by(
            Annotation.protein_header,
            annotation_bitscore.desc().nullslast(),
            Annotation.annotation_id,
        )
        .subquery()
    )

    return (
        db.query(
            Protein,
            Genome,
            Environment,
            Operon,
            CrisprSystem,
            SelectedAnnotation,
        )
        .join(Genome, Genome.genome_header == Protein.genome_header)
        .join(OperonProtein, OperonProtein.protein_header == Protein.protein_header)
        .join(Operon, Operon.operon_header == OperonProtein.operon_header)
        .outerjoin(Environment, Environment.genome_header == Genome.genome_header)
        .outerjoin(CrisprSystem, CrisprSystem.crispr_subtype == Operon.crispr_subtype)
        .outerjoin(
            selected_annotations,
            selected_annotations.c.protein_header == Protein.protein_header,
        )
        .outerjoin(
            SelectedAnnotation,
            SelectedAnnotation.annotation_id == selected_annotations.c.annotation_id,
        )
    )


def apply_filters(
    query: SqlAlchemyQuery,
    filters: dict[str, list[str] | list[int] | None],
) -> SqlAlchemyQuery:
    for field, values in filters.items():
        if values:
            query = query.filter(FACET_COLUMNS[field].in_(values))
    return query


def annotations_for_protein(db: Session, protein_header: str) -> list[ProteinAnnotationData]:
    
    #return each annotation row that annotated by interproscan
    rows = (
        db.query(Annotation)
        .filter(
            Annotation.protein_header == protein_header,
            Annotation.annotation_software.ilike("interproscan%"),
        )
        .order_by(Annotation.source_db, Annotation.start_pos, Annotation.annotation_id)
        .all()
    )
    return [
        ProteinAnnotationData(
            annotation_software=row.annotation_software,
            source_db=row.source_db,
            annotation_acc=row.annotation_acc,
            annotation_name=row.annotation_name,
            e_value=annotation_e_value(row),
            bitscore=annotation_bitscore(row),
            start_pos=row.start_pos,
            end_pos=row.end_pos,
            extra=row.extra,
        )
        for row in rows
    ]


def annotation_bitscore(annotation: Annotation | None) -> float | None:
    if annotation is None:
        return None
    if isinstance(annotation.extra, dict) and annotation.extra.get("bitscore") is not None:
        return float(annotation.extra["bitscore"])
    return annotation.bitscore


def annotation_e_value(annotation: Annotation | None) -> float | None:
    if annotation is None:
        return None
    if isinstance(annotation.extra, dict) and annotation.extra.get("full_seq_e_value") is not None:
        return float(annotation.extra["full_seq_e_value"])
    return annotation.e_value


def serialize_protein(
    row,
    annotation_source: str,
    annotations: list[ProteinAnnotationData] | None = None,
) -> CasProteinData:
    protein, genome, environment, operon, crispr_system, annotation = row
    return CasProteinData(
        protein_header=protein.protein_header,
        annotation_name=annotation.annotation_name if annotation else None,
        annotation_source=annotation_source,
        annotation_acc=annotation.annotation_acc if annotation else None,
        annotation_e_value=annotation_e_value(annotation),
        annotation_bitscore=annotation_bitscore(annotation),
        start_pos=protein.start_pos,
        end_pos=protein.end_pos,
        strand=protein.strand,
        length=protein.length,
        sequence=protein.sequence,
        operon_header=operon.operon_header,
        crispr_class=crispr_system.crispr_class if crispr_system else None,
        crispr_type=crispr_system.crispr_type if crispr_system else None,
        crispr_subtype=operon.crispr_subtype,
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
        annotations=annotations or [],
    )


@router.get("/filters", response_model=CasProteinFilterData)
def get_protein_filters(
    annotation_source: str = Query("cctyper", min_length=1),
    crispr_class: list[int] | None = Query(None),
    crispr_type: list[str] | None = Query(None),
    crispr_subtype: list[str] | None = Query(None),
    protein_name: list[str] | None = Query(None),
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
    db: Session = Depends(get_db),
):
    filters = {
        "crispr_class": crispr_class,
        "crispr_type": crispr_type,
        "crispr_subtype": crispr_subtype,
        "protein_name": protein_name,
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
            apply_filters(protein_query(db, annotation_source), other_filters)
            .with_entities(column, func.count(Protein.protein_header))
            .filter(column.isnot(None))
            .group_by(column)
            .order_by(func.count(Protein.protein_header).desc())
            .all()
        )
        facets[field] = {str(value): count for value, count in rows}

    return CasProteinFilterData(
        facets=facets,
        annotation_source=annotation_source,
    )


@router.get("/", response_model=CasProteinListResponse)
def list_proteins(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    annotation_source: str = Query("cctyper", min_length=1),
    crispr_class: list[int] | None = Query(None),
    crispr_type: list[str] | None = Query(None),
    crispr_subtype: list[str] | None = Query(None),
    protein_name: list[str] | None = Query(None),
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
    db: Session = Depends(get_db),
):
    filters = {
        "crispr_class": crispr_class,
        "crispr_type": crispr_type,
        "crispr_subtype": crispr_subtype,
        "protein_name": protein_name,
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
    query = apply_filters(protein_query(db, annotation_source), filters)
    total = query.with_entities(func.count(Protein.protein_header)).scalar() or 0
    rows = (
        query.order_by(Protein.protein_header)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [serialize_protein(row, annotation_source) for row in rows]
    return CasProteinListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        annotation_source=annotation_source,
    )


@router.get("/{protein_header}", response_model=CasProteinData)
def get_protein(
    protein_header: str,
    annotation_source: str = Query("cctyper", min_length=1),
    db: Session = Depends(get_db),
):
    row = (
        protein_query(db, annotation_source)
        .filter(Protein.protein_header == protein_header)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Cas protein not found")

    annotations = annotations_for_protein(db, protein_header)
    return serialize_protein(row, annotation_source, annotations)
