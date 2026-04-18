from pony.orm import *
from decouple import config
import psycopg2

db = Database()

_bind_kw = dict(
    provider=config("DB_PROVIDER"),
    user=config("DB_USER"),
    password=config("DB_PASS"),
    host=config("DB_HOST"),
    database=config("DB_NAME"),
)
# Neon y otros Postgres gestionados suelen exigir TLS (p. ej. DB_SSLMODE=require).
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
    )
    sslmode = (config("DB_SSLMODE", default="") or "").strip()
    if sslmode:
        kw["sslmode"] = sslmode
    return kw


def _run_postgres_schema_patches() -> None:
    provider = config("DB_PROVIDER").lower().strip()
    if provider not in {"postgres", "postgresql"}:
        return

    conn = psycopg2.connect(**_psycopg2_connect_kwargs())
    try:
        with conn:
            with conn.cursor() as cur:
                # Pony no agrega columnas nuevas en tablas existentes.
                # Buscamos el nombre real de la tabla cliente para evitar problemas de case-sensitive.
                cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND lower(table_name) = 'cliente'
                    LIMIT 1
                    """
                )
                row = cur.fetchone()
                if row is None:
                    return

                table_name = row[0]
                quoted_table = f'"{table_name}"'

                cur.execute(
                    f"ALTER TABLE {quoted_table} ADD COLUMN IF NOT EXISTS \"programa\" VARCHAR(50) DEFAULT 'boost'"
                )
                cur.execute(
                    f"UPDATE {quoted_table} SET programa = 'boost' WHERE programa IS NULL OR programa = ''"
                )
                # Ajusta columnas históricas para que acepten NULL según modelo actual.
                cur.execute(f"ALTER TABLE {quoted_table} ALTER COLUMN apellido DROP NOT NULL")
                cur.execute(f"ALTER TABLE {quoted_table} ALTER COLUMN email DROP NOT NULL")
                cur.execute(f"ALTER TABLE {quoted_table} ALTER COLUMN telefono DROP NOT NULL")
                cur.execute(f"ALTER TABLE {quoted_table} ALTER COLUMN instagram DROP NOT NULL")
                cur.execute(f"ALTER TABLE {quoted_table} ALTER COLUMN origen DROP NOT NULL")
                cur.execute(f"ALTER TABLE {quoted_table} ALTER COLUMN notas DROP NOT NULL")

                # ID numérico público (onboarding); Pony no migra columnas nuevas en tablas existentes.
                cur.execute(
                    f"ALTER TABLE {quoted_table} ADD COLUMN IF NOT EXISTS codigo_publico INTEGER"
                )
                cur.execute(
                    f"""
                    WITH numbered AS (
                        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST) AS rn
                        FROM {quoted_table}
                    )
                    UPDATE {quoted_table} c
                    SET codigo_publico = numbered.rn
                    FROM numbered
                    WHERE c.id = numbered.id AND c.codigo_publico IS NULL
                    """
                )
                cur.execute(
                    f"ALTER TABLE {quoted_table} ALTER COLUMN codigo_publico SET NOT NULL"
                )
                cur.execute(
                    f'CREATE UNIQUE INDEX IF NOT EXISTS "uq_cliente_codigo_publico" '
                    f"ON {quoted_table} (codigo_publico)"
                )

                # Tablas de estadísticas Claude (persistencia consumo/saldo).
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS claude_usage_event (
                        id SERIAL PRIMARY KEY,
                        model VARCHAR(255) NOT NULL,
                        input_tokens INTEGER NOT NULL DEFAULT 0,
                        output_tokens INTEGER NOT NULL DEFAULT 0,
                        cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS claude_balance_config (
                        id SERIAL PRIMARY KEY,
                        balance_usd DOUBLE PRECISION NOT NULL DEFAULT 4.9,
                        baseline_spent_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS claude_area_system_prompt (
                        area VARCHAR(32) PRIMARY KEY,
                        instruction TEXT NOT NULL,
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
    finally:
        conn.close()


def _pg_quote_ident(ident: str) -> str:
    """Identificador PostgreSQL entre comillas dobles (respeta mayúsculas/minúsculas reales de la tabla)."""
    safe = ident.replace('"', "")
    return f'"{safe}"'


def _migrate_legacy_onboarding_plantilla_to_entregable() -> None:
    """Copia datos de la tabla legacy `OnboardingPlantilla` a `EntregablePlantilla` (slug onboarding)."""
    provider = config("DB_PROVIDER").lower().strip()
    if provider not in {"postgres", "postgresql"}:
        return

    conn = psycopg2.connect(**_psycopg2_connect_kwargs())
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = 'public' AND lower(table_name) = 'entregableplantilla'
                    LIMIT 1
                    """
                )
                row_new = cur.fetchone()
                if row_new is None:
                    return
                new_tbl = _pg_quote_ident(row_new[0])

                cur.execute(
                    """
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = 'public' AND lower(table_name) = 'onboardingplantilla'
                    LIMIT 1
                    """
                )
                row_old = cur.fetchone()
                if row_old is None:
                    return

                legacy = _pg_quote_ident(row_old[0])
                cur.execute(f"SELECT COUNT(*) FROM {new_tbl} WHERE slug = %s", ("onboarding",))
                if cur.fetchone()[0] > 0:
                    return
                try:
                    cur.execute(
                        f"""
                        INSERT INTO {new_tbl} (slug, nombre, configuracion, "updated_at")
                        SELECT 'onboarding', 'Onboarding', jsonb_build_object('campos', campos::jsonb), "updated_at"
                        FROM {legacy} ORDER BY id LIMIT 1
                        """
                    )
                except Exception:
                    # Esquema legacy distinto o tipos incompatibles: el servicio sembrará desde JSON por defecto.
                    pass
    finally:
        conn.close()


def init_db() -> None:
    """Registra entidades y genera el mapping."""
    import src.models  # noqa: F401

    _run_postgres_schema_patches()
    if db.entities:
        # Crea tablas nuevas (p. ej. entregableonboarding). La FK cliente_id en
        # EntregableOnboarding es UNIQUE (1:1) vía Required(Cliente, unique=True) en Pony.
        db.generate_mapping(create_tables=True)
    _migrate_legacy_onboarding_plantilla_to_entregable()
