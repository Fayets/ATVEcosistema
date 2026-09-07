from pony.orm import Database
from decouple import config
import psycopg2

db = Database()

DB_SCHEMA = "ecosystem"

_bind_kw = dict(
    provider=config("DB_PROVIDER"),
    user=config("DB_USER"),
    password=config("DB_PASS"),
    host=config("DB_HOST"),
    database=config("DB_NAME"),
    port=config("DB_PORT", default=5432, cast=int),
)
_db_sslmode = (config("DB_SSLMODE", default="") or "").strip()
if _db_sslmode:
    _bind_kw["sslmode"] = _db_sslmode
db.bind(**_bind_kw)


def _psycopg2_connect_kwargs() -> dict:
    kw = dict(
        user=config("DB_USER"),
        password=config("DB_PASS"),
        host=config("DB_HOST"),
        dbname=config("DB_NAME"),
        port=config("DB_PORT", default=5432, cast=int),
    )
    sslmode = (config("DB_SSLMODE", default="") or "").strip()
    if sslmode:
        kw["sslmode"] = sslmode
    return kw


def _ensure_ecosystem_schema() -> None:
    provider = config("DB_PROVIDER").lower().strip()
    if provider not in {"postgres", "postgresql"}:
        return

    conn = psycopg2.connect(**_psycopg2_connect_kwargs())
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"')
                # Schema de la bolsa de trabajo (lo llena hiring-main; acá se lee y gestiona)
                cur.execute('CREATE SCHEMA IF NOT EXISTS "hiring"')
    finally:
        conn.close()


def _seed_default_user() -> None:
    from pony.orm import db_session

    from src.models import User
    from src.password_utils import hash_password

    with db_session:
        if User.select().count() > 0:
            return
        User(
            username="franco",
            password_hash=hash_password("franco"),
        )


def init_db() -> None:
    """Registra entidades, crea schema/tablas y siembra usuario inicial."""
    import src.models  # noqa: F401

    _ensure_ecosystem_schema()
    if db.entities:
        db.generate_mapping(create_tables=True)
    _seed_default_user()
