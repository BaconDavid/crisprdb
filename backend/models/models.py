from sqlalchemy import BIGINT, TEXT, Column, ForeignKey, INTEGER, REAL, SMALLINT, VARCHAR
from sqlalchemy.dialects.postgresql import DOUBLE_PRECISION, JSONB

from db.session import Base


class Genome(Base):
    __tablename__ = "genome"

    genome_header = Column(VARCHAR(255), primary_key=True, index=True)
    bioproject = Column(VARCHAR(255))
    tax_phylum = Column(VARCHAR(255))
    tax_class = Column(VARCHAR(255))
    tax_order = Column(VARCHAR(255))
    tax_family = Column(VARCHAR(255))
    tax_genus = Column(VARCHAR(255))
    tax_species = Column(VARCHAR(255))
    strain = Column(VARCHAR(255))
    tax_domain = Column(VARCHAR(255))

class Operon(Base):
    __tablename__ = "operon"

    operon_header = Column(VARCHAR(255), primary_key=True, index=True)
    n_genes = Column(INTEGER)
    crispr_subtype = Column(
        VARCHAR(255),
        ForeignKey("crispr_system.crispr_subtype", onupdate="CASCADE", ondelete="SET NULL"),
        index=True,
    )
    genome_header = Column(VARCHAR(255), ForeignKey("genome.genome_header", ondelete="CASCADE"), index=True)
    annotated_by = Column(VARCHAR(255))

class Environment(Base):
    __tablename__ = "environment"

    genome_header = Column(
        VARCHAR(255),
        ForeignKey("genome.genome_header", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    country = Column(VARCHAR(255), server_default="NA")
    host = Column(VARCHAR(255))
    source = Column(VARCHAR(255))


class CrisprSystem(Base):
    __tablename__ = "crispr_system"

    crispr_subtype = Column(VARCHAR(255), primary_key=True, index=True)
    crispr_type = Column(VARCHAR(255))
    crispr_class = Column(SMALLINT)

class Annotation(Base):
    __tablename__ = "annotation"

    annotation_id = Column(BIGINT, primary_key=True, index=True)
    protein_header = Column(VARCHAR(255), ForeignKey("protein.protein_header", ondelete="CASCADE"), index=True)
    source_db = Column(VARCHAR(255))
    annotation_software = Column(VARCHAR(255))
    annotation_acc = Column(VARCHAR(255))
    annotation_name = Column(VARCHAR(255))
    e_value = Column(DOUBLE_PRECISION)
    bitscore = Column(REAL)
    start_pos = Column(SMALLINT)
    end_pos = Column(SMALLINT)
    extra = Column(JSONB)

class CrisprArray(Base):
    __tablename__ = "crispr_array"

    array_id = Column(BIGINT, primary_key=True, index=True)
    genome_header = Column(VARCHAR(255), ForeignKey("genome.genome_header", ondelete="CASCADE"), index=True)
    start = Column(INTEGER)
    end = Column(INTEGER)
    consensus_repeat = Column(VARCHAR(255))
    n_repeats = Column(SMALLINT)
    n_spacer = Column(SMALLINT)
    average_repeat_length = Column(INTEGER)
    average_spacer_length = Column(INTEGER)
    annotation_software = Column(VARCHAR(255))
    CRISPR = Column(VARCHAR(255))

class OperonProtein(Base):
    __tablename__ = "operon_protein"

    operon_pro_id = Column(BIGINT, primary_key=True, index=True)
    operon_header = Column(
        VARCHAR(255),
        ForeignKey("operon.operon_header", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    protein_header = Column(
        VARCHAR(255),
        ForeignKey("protein.protein_header", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

class Protein(Base):
    __tablename__ = "protein"

    protein_header = Column(VARCHAR(255), primary_key=True, index=True)
    genome_header = Column(
        VARCHAR(255),
        ForeignKey("genome.genome_header", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_pos = Column(INTEGER, nullable=False)
    end_pos = Column(INTEGER, nullable=False)
    strand = Column(SMALLINT, nullable=False)
    length = Column(SMALLINT, nullable=False)
    sequence = Column(TEXT, nullable=False)

class Repeat(Base):
    __tablename__ = "repeat"

    id = Column(INTEGER, primary_key=True, index=True)
    array_id = Column(BIGINT, ForeignKey("crispr_array.array_id", ondelete="CASCADE"), index=True)
    repeat_sequence = Column(VARCHAR(255))
    start = Column(INTEGER)
    end = Column(INTEGER)
    CRISPR = Column(VARCHAR(255))
    genome_header = Column(VARCHAR(255))
    annotated_by = Column(VARCHAR(255))
    length = Column(INTEGER)
    strand = Column(VARCHAR(255))

class Spacer(Base):
    __tablename__ = "spacer"

    id = Column(INTEGER, primary_key=True, index=True)
    array_id = Column(BIGINT, ForeignKey("crispr_array.array_id", ondelete="CASCADE"), index=True)
    spacer_sequence = Column(VARCHAR(255))
    start = Column(INTEGER)
    end = Column(INTEGER)
    CRISPR = Column(VARCHAR(255))
    genome_header = Column(VARCHAR(255))
    annotated_by = Column(VARCHAR(255))
    length = Column(INTEGER)
    strand = Column(VARCHAR(255))

class Structure(Base):
    __tablename__ = "structure"

    structure_id = Column(VARCHAR(255), primary_key=True, index=True)
    protein_header = Column(VARCHAR(255), ForeignKey("protein.protein_header", ondelete="CASCADE"), index=True)
    predicted_by = Column(VARCHAR(255), nullable=False)
    mean_plddt = Column(REAL, nullable=False)
    structure_path = Column(VARCHAR(255))


class Users(Base):
    __tablename__ = "users"

    username = Column(VARCHAR(255), primary_key=True, index=True)
    password = Column(TEXT)
