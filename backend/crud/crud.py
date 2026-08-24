from typing import Any

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


def get_genomes(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Genome]:
    # Query genome records with optional exact-match filters.
    query = db.query(Genome)

    if filters:
        for field_name, value in filters.items():
            if value is None:
                continue
            if not hasattr(Genome, field_name):
                raise HTTPException(status_code=400, detail=f"Unknown genome filter: {field_name}")
            query = query.filter(getattr(Genome, field_name) == value)

    return query.limit(limit).all()


def get_genome_by_header(db: Session, genome_header: str) -> Genome:
    # Query one genome by its primary key.
    genome = db.query(Genome).filter(Genome.genome_header == genome_header).first()
    if genome is None:
        raise HTTPException(status_code=404, detail="Genome not found")
    return genome


def get_operons(
    db: Session,
    filters: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[Operon]:
    # Query operon records with optional exact-match filters.
    query = db.query(Operon)

    if filters:
        for field_name, value in filters.items():
            if value is None:
                continue
            if not hasattr(Operon, field_name):
                raise HTTPException(status_code=400, detail=f"Unknown operon filter: {field_name}")
            query = query.filter(getattr(Operon, field_name) == value)

    return query.limit(limit).all()


def get_operon_by_header(db: Session, operon_header: str) -> Operon:
    # Query one operon by its primary key.
    operon = db.query(Operon).filter(Operon.operon_header == operon_header).first()
    if operon is None:
        raise HTTPException(status_code=404, detail="Operon not found")
    return operon


def get_environments(
    db: Session,
    genome_header: str | None = None,
    country: str | None = None,
    limit: int = 100,
) -> list[Environment]:
    # Query environment metadata.
    query = db.query(Environment)

    if genome_header is not None:
        query = query.filter(Environment.genome_header == genome_header)
    if country is not None:
        query = query.filter(Environment.country == country)

    return query.limit(limit).all()


def get_environment_by_genome_header(db: Session, genome_header: str) -> Environment:
    # Query one environment row by genome header.
    environment = db.query(Environment).filter(Environment.genome_header == genome_header).first()
    if environment is None:
        raise HTTPException(status_code=404, detail="Environment not found")
    return environment


def get_crispr_systems(
    db: Session,
    crispr_type: str | None = None,
    crispr_class: int | None = None,
    limit: int = 100,
) -> list[CrisprSystem]:
    # Query CRISPR system records.
    query = db.query(CrisprSystem)

    if crispr_type is not None:
        query = query.filter(CrisprSystem.crispr_type == crispr_type)
    if crispr_class is not None:
        query = query.filter(CrisprSystem.crispr_class == crispr_class)

    return query.limit(limit).all()


def get_crispr_system_by_subtype(db: Session, crispr_subtype: str) -> CrisprSystem:
    # Query one CRISPR system by subtype.
    crispr_system = db.query(CrisprSystem).filter(CrisprSystem.crispr_subtype == crispr_subtype).first()
    if crispr_system is None:
        raise HTTPException(status_code=404, detail="CRISPR system not found")
    return crispr_system


def get_annotations(
    db: Session,
    protein_header: str | None = None,
    source_db: str | None = None,
    limit: int = 100,
) -> list[Annotation]:
    # Query protein annotation records.
    query = db.query(Annotation)

    if protein_header is not None:
        query = query.filter(Annotation.protein_header == protein_header)
    if source_db is not None:
        query = query.filter(Annotation.source_db == source_db)

    return query.limit(limit).all()


def get_annotation_by_id(db: Session, annotation_id: int) -> Annotation:
    # Query one annotation by id.
    annotation = db.query(Annotation).filter(Annotation.annotation_id == annotation_id).first()
    if annotation is None:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return annotation


def get_crispr_arrays(
    db: Session,
    genome_header: str | None = None,
    limit: int = 100,
) -> list[CrisprArray]:
    # Query CRISPR array records.
    query = db.query(CrisprArray)

    if genome_header is not None:
        query = query.filter(CrisprArray.genome_header == genome_header)

    return query.limit(limit).all()


def get_crispr_array_by_id(db: Session, array_id: int) -> CrisprArray:
    # Query one CRISPR array by id.
    crispr_array = db.query(CrisprArray).filter(CrisprArray.array_id == array_id).first()
    if crispr_array is None:
        raise HTTPException(status_code=404, detail="CRISPR array not found")
    return crispr_array


def get_operon_proteins(
    db: Session,
    operon_header: str | None = None,
    protein_header: str | None = None,
    limit: int = 100,
) -> list[OperonProtein]:
    # Query operon-protein link records.
    query = db.query(OperonProtein)

    if operon_header is not None:
        query = query.filter(OperonProtein.operon_header == operon_header)
    if protein_header is not None:
        query = query.filter(OperonProtein.protein_header == protein_header)

    return query.limit(limit).all()


def get_operon_protein_by_operon_header(db: Session, operon_header: str) -> OperonProtein:
    # Query one operon-protein link by operon header.
    operon_protein = db.query(OperonProtein).filter(OperonProtein.operon_header == operon_header).first()
    if operon_protein is None:
        raise HTTPException(status_code=404, detail="Operon protein link not found")
    return operon_protein


def get_proteins(
    db: Session,
    genome_header: str | None = None,
    limit: int = 100,
) -> list[Protein]:
    # Query protein records.
    query = db.query(Protein)

    if genome_header is not None:
        query = query.filter(Protein.genome_header == genome_header)

    return query.limit(limit).all()


def get_protein_by_header(db: Session, protein_header: str) -> Protein:
    # Query one protein by its primary key.
    protein = db.query(Protein).filter(Protein.protein_header == protein_header).first()
    if protein is None:
        raise HTTPException(status_code=404, detail="Protein not found")
    return protein


def get_repeats(
    db: Session,
    array_id: int | None = None,
    genome_header: str | None = None,
    limit: int = 100,
) -> list[Repeat]:
    # Query repeat records.
    query = db.query(Repeat)

    if array_id is not None:
        query = query.filter(Repeat.array_id == array_id)
    if genome_header is not None:
        query = query.filter(Repeat.genome_header == genome_header)

    return query.limit(limit).all()


def get_repeat_by_id(db: Session, repeat_id: int) -> Repeat:
    # Query one repeat by id.
    repeat = db.query(Repeat).filter(Repeat.id == repeat_id).first()
    if repeat is None:
        raise HTTPException(status_code=404, detail="Repeat not found")
    return repeat


def get_spacers(
    db: Session,
    array_id: int | None = None,
    genome_header: str | None = None,
    limit: int = 100,
) -> list[Spacer]:
    # Query spacer records.
    query = db.query(Spacer)

    if array_id is not None:
        query = query.filter(Spacer.array_id == array_id)
    if genome_header is not None:
        query = query.filter(Spacer.genome_header == genome_header)

    return query.limit(limit).all()


def get_spacer_by_id(db: Session, spacer_id: int) -> Spacer:
    # Query one spacer by id.
    spacer = db.query(Spacer).filter(Spacer.id == spacer_id).first()
    if spacer is None:
        raise HTTPException(status_code=404, detail="Spacer not found")
    return spacer


def get_structures(
    db: Session,
    protein_header: str | None = None,
    predicted_by: str | None = None,
    limit: int = 100,
) -> list[Structure]:
    # Query structure records.
    query = db.query(Structure)

    if protein_header is not None:
        query = query.filter(Structure.protein_header == protein_header)
    if predicted_by is not None:
        query = query.filter(Structure.predicted_by == predicted_by)

    return query.limit(limit).all()


def get_structure_by_id(db: Session, structure_id: str) -> Structure:
    # Query one structure by id.
    structure = db.query(Structure).filter(Structure.structure_id == structure_id).first()
    if structure is None:
        raise HTTPException(status_code=404, detail="Structure not found")
    return structure


def get_users(db: Session, limit: int = 100) -> list[Users]:
    # Query user records.
    return db.query(Users).limit(limit).all()


def get_user_by_username(db: Session, username: str) -> Users:
    # Query one user by username.
    user = db.query(Users).filter(Users.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user
