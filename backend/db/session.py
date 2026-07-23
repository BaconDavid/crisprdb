from collections.abc import Generator
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

from app.config import app_settings


def build_database_url() -> str:
    db_user = quote_plus(app_settings.db_user)
    db_password = quote_plus(app_settings.db_password)

    return (
        f"postgresql+psycopg2://{db_user}:{db_password}"
        f"@{app_settings.db_host}:{app_settings.db_port}"
        f"/{app_settings.db_database}"
    )


DATABASE_URL = build_database_url()

engine = create_engine(
    DATABASE_URL,
    echo=app_settings.app_debug,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
