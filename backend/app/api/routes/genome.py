from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from crud.crud import get_genomes
from db.session import get_db
from schemas.schemas import GenomeRead

router = APIRouter(prefix="/genomes", tags=["genomes"])


@router.get("/", response_model=list[GenomeRead])
def read_genomes(
    genome_header: str | None = None,
    bioproject: str | None = None,
    tax_phylum: str | None = None,
    tax_class: str | None = None,
    tax_order: str | None = None,
    tax_family: str | None = None,
    tax_genus: str | None = None,
    tax_species: str | None = None,
    strain: str | None = None,
    tax_domain: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    filters = {
        "genome_header": genome_header,
        "bioproject": bioproject,
        "tax_phylum": tax_phylum,
        "tax_class": tax_class,
        "tax_order": tax_order,
        "tax_family": tax_family,
        "tax_genus": tax_genus,
        "tax_species": tax_species,
        "strain": strain,
        "tax_domain": tax_domain,
    }
    return get_genomes(db, filters=filters, limit=limit)
