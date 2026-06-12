from fastapi import APIRouter, HTTPException

from src.schemas import HealthDbResponse, HealthResponse
from src.services.health_services import HealthServices

router = APIRouter(tags=["health"])
_service = HealthServices()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    try:
        return _service.get_health()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado en health: {e}") from e


@router.get("/health/db", response_model=HealthDbResponse)
def health_db() -> HealthDbResponse:
    try:
        return _service.get_health_db()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado en health/db: {e}") from e
