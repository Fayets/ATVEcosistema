import psycopg2
from decouple import config
from fastapi import HTTPException

from src.db import DB_SCHEMA, _psycopg2_connect_kwargs
from src.schemas import HealthDbResponse, HealthResponse


class HealthServices:
    def get_health(self) -> HealthResponse:
        return HealthResponse(status="ok")

    def get_health_db(self) -> HealthDbResponse:
        provider = config("DB_PROVIDER").lower().strip()
        if provider not in {"postgres", "postgresql"}:
            raise HTTPException(status_code=503, detail="Proveedor de base de datos no soportado.")

        try:
            conn = psycopg2.connect(**_psycopg2_connect_kwargs())
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.execute(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM information_schema.schemata
                            WHERE schema_name = %s
                        )
                        """,
                        (DB_SCHEMA,),
                    )
                    schema_exists = cur.fetchone()[0]
            finally:
                conn.close()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Base de datos no disponible: {e}") from e

        if not schema_exists:
            raise HTTPException(status_code=503, detail=f"Schema «{DB_SCHEMA}» no encontrado.")

        return HealthDbResponse(status="ok", schema=DB_SCHEMA)
