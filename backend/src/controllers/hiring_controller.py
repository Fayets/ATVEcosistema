from fastapi import APIRouter, Depends, HTTPException

from src.deps import get_current_username
from src.schemas import HiringApplicationUpdate
from src.services.hiring_services import HiringServices

router = APIRouter(prefix="/api/hiring", tags=["hiring"])
_service = HiringServices()


@router.get("/applications")
def list_applications(
    role_slug: str | None = None,
    status: str | None = None,
    _user: str = Depends(get_current_username),
) -> list[dict]:
    try:
        return _service.list(role_slug=role_slug, status=status)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al listar postulaciones: {e}") from e


@router.get("/applications/metrics")
def metrics(_user: str = Depends(get_current_username)) -> dict:
    try:
        return _service.metrics()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al calcular métricas: {e}") from e


@router.get("/applications/{app_id}")
def get_application(app_id: int, _user: str = Depends(get_current_username)) -> dict:
    try:
        return _service.get(app_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener la postulación: {e}") from e


@router.patch("/applications/{app_id}")
def update_application(
    app_id: int, body: HiringApplicationUpdate, username: str = Depends(get_current_username)
) -> dict:
    try:
        return _service.update(app_id, body, reviewed_by=username)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al actualizar la postulación: {e}") from e


@router.delete("/applications/{app_id}")
def delete_application(app_id: int, _user: str = Depends(get_current_username)) -> dict:
    try:
        return _service.delete(app_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al eliminar la postulación: {e}") from e
