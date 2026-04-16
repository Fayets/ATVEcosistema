from fastapi import APIRouter, HTTPException

from src.schemas import HealthResponse
from src.services.health_services import HealthServices

router = APIRouter()
_service = HealthServices()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    try:
        return _service.ping()
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(status_code=500, detail="Error inesperado en health check.")
