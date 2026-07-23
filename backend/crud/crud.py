from typing import Any, TypeVar

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.models import (
    Annotation,
    CrisprArray,
    CrisprSystem,
    Environment,
    Genome,
    Operon,
    OperonProtein,
    Protein,
    Repeat,
    Spacer,
    Structure,
    Users,
)

ModelT = TypeVar("ModelT")


def _apply_filters(query: Any, model: type[ModelT], filters: dict[str, Any] | None):
    # Apply simple equality filters and skip empty values.
    if not filters:
        return query

    for field_name, value in filters.items():
        if value is None:
            continue
        if not hasattr(model, field_name):
            raise HTTPException(status_code=400, detail=f"Unknown filter field: {field_name}")
        query = query.filter(getattr(model, field_name) == value)

    return query


def _list_records(
    db: Session,
    model: type[ModelT],
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[ModelT]:
    # Build one simple list query for any table model.
    query = _apply_filters(db.query(model), model, filters)
    return query.limit(limit).all()


def _get_record_or_404(
    db: Session,
    model: type[ModelT],
    field_name: str,
    value: Any,
    detail: str,
) -> ModelT:
    # Fetch one record by its primary lookup field.
    record = db.query(model).filter(getattr(model, field_name) == value).first()
    if record is None:
        raise HTTPException(status_code=404, detail=detail)
    return record


def get_genomes(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Genome]:
    return _list_records(db, Genome, filters=filters, limit=limit)


def get_genome_by_header(db: Session, genome_header: str) -> Genome:
    return _get_record_or_404(db, Genome, "genome_header", genome_header, "Genome not found")


def get_operons(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Operon]:
    return _list_records(db, Operon, filters=filters, limit=limit)


def get_operon_by_header(db: Session, operon_header: str) -> Operon:
    return _get_record_or_404(db, Operon, "operon_header", operon_header, "Operon not found")


def get_operon_by_id(db: Session, operon_id: str) -> Operon:
    return get_operon_by_header(db, operon_id)


def get_environments(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Environment]:
    return _list_records(db, Environment, filters=filters, limit=limit)


def get_environment_by_genome_header(db: Session, genome_header: str) -> Environment:
    return _get_record_or_404(db, Environment, "genome_header", genome_header, "Environment not found")


def get_crispr_systems(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[CrisprSystem]:
    return _list_records(db, CrisprSystem, filters=filters, limit=limit)


def get_crispr_system_by_subtype(db: Session, crispr_subtype: str) -> CrisprSystem:
    return _get_record_or_404(
        db,
        CrisprSystem,
        "crispr_subtype",
        crispr_subtype,
        "CRISPR system not found",
    )


def get_annotations(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Annotation]:
    return _list_records(db, Annotation, filters=filters, limit=limit)


def get_annotation_by_id(db: Session, annotation_id: int) -> Annotation:
    return _get_record_or_404(db, Annotation, "annotation_id", annotation_id, "Annotation not found")


def get_crispr_arrays(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[CrisprArray]:
    return _list_records(db, CrisprArray, filters=filters, limit=limit)


def get_crispr_array_by_id(db: Session, array_id: int) -> CrisprArray:
    return _get_record_or_404(db, CrisprArray, "array_id", array_id, "CRISPR array not found")


def get_operon_proteins(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[OperonProtein]:
    return _list_records(db, OperonProtein, filters=filters, limit=limit)


def get_operon_protein_by_id(db: Session, operon_pro_id: int) -> OperonProtein:
    return _get_record_or_404(
        db,
        OperonProtein,
        "operon_pro_id",
        operon_pro_id,
        "Operon protein link not found",
    )


def get_proteins(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Protein]:
    return _list_records(db, Protein, filters=filters, limit=limit)


def get_protein_by_header(db: Session, protein_header: str) -> Protein:
    return _get_record_or_404(db, Protein, "protein_header", protein_header, "Protein not found")


def get_repeats(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Repeat]:
    return _list_records(db, Repeat, filters=filters, limit=limit)


def get_repeat_by_id(db: Session, repeat_id: int) -> Repeat:
    return _get_record_or_404(db, Repeat, "id", repeat_id, "Repeat not found")


def get_spacers(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Spacer]:
    return _list_records(db, Spacer, filters=filters, limit=limit)


def get_spacer_by_id(db: Session, spacer_id: int) -> Spacer:
    return _get_record_or_404(db, Spacer, "id", spacer_id, "Spacer not found")


def get_structures(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Structure]:
    return _list_records(db, Structure, filters=filters, limit=limit)


def get_structure_by_id(db: Session, structure_id: str) -> Structure:
    return _get_record_or_404(db, Structure, "structure_id", structure_id, "Structure not found")


def get_users(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Users]:
    return _list_records(db, Users, filters=filters, limit=limit)


def get_user_by_username(db: Session, username: str) -> Users:
    return _get_record_or_404(db, Users, "username", username, "User not found")
