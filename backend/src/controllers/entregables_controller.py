import re

from fastapi import APIRouter, Depends, HTTPException

from src.deps import get_bearer_payload
from src.schemas import (
    EntregablePlantillaCreate,
    EntregablePlantillaListItem,
    EntregablePlantillaMetaPatch,
    EntregablePlantillaResponse,
    EntregablePlantillaUpdate,
)
from src.services.entregables_services import EntregablesServices

router = APIRouter(prefix="/entregables", tags=["entregables"])

_slug_path_re = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


def _slug_ok(slug: str) -> bool:
    return bool(slug and _slug_path_re.match(slug.strip()))


@router.get("/plantillas/", response_model=list[EntregablePlantillaListItem])
def list_entregable_plantillas(_payload: dict = Depends(get_bearer_payload)) -> list[EntregablePlantillaListItem]:
    try:
        return EntregablesServices.list_plantillas()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al listar plantillas: {e}",
        )


@router.post("/plantillas/", response_model=EntregablePlantillaResponse)
def create_entregable_plantilla(
    body: EntregablePlantillaCreate,
    _payload: dict = Depends(get_bearer_payload),
) -> EntregablePlantillaResponse:
    try:
        return EntregablesServices.create_plantilla(body)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al crear la plantilla: {e}",
        )


@router.patch("/plantillas/{slug}/", response_model=EntregablePlantillaResponse)
def patch_entregable_plantilla_meta(
    slug: str,
    body: EntregablePlantillaMetaPatch,
    _payload: dict = Depends(get_bearer_payload),
) -> EntregablePlantillaResponse:
    if not _slug_ok(slug):
        raise HTTPException(status_code=400, detail="Slug de plantilla inválido.")
    try:
        return EntregablesServices.patch_plantilla_meta(slug.strip(), body)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al actualizar la plantilla: {e}",
        )


@router.get("/plantillas/{slug}/", response_model=EntregablePlantillaResponse)
def get_entregable_plantilla(slug: str) -> EntregablePlantillaResponse:
    if not _slug_ok(slug):
        raise HTTPException(status_code=400, detail="Slug de plantilla inválido.")
    try:
        return EntregablesServices.get_plantilla_response(slug.strip())
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al cargar la plantilla: {e}",
        )


@router.put("/plantillas/{slug}/", response_model=EntregablePlantillaResponse)
def put_entregable_plantilla(
    slug: str,
    body: EntregablePlantillaUpdate,
    _payload: dict = Depends(get_bearer_payload),
) -> EntregablePlantillaResponse:
    if not _slug_ok(slug):
        raise HTTPException(status_code=400, detail="Slug de plantilla inválido.")
    try:
        return EntregablesServices.replace_plantilla(slug.strip(), body)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al guardar la plantilla: {e}",
        )
