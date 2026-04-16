from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from starlette.responses import Response

from src.deps import get_bearer_payload
from src.schemas import OnboardingCreate, OnboardingResponse, OnboardingValidateResponse
from src.services.onboarding_services import OnboardingServices

router = APIRouter(prefix="/onboarding", tags=["onboarding"])
_service = OnboardingServices()


@router.get("/validar/{identificador}/", response_model=OnboardingValidateResponse)
def validar_cliente_onboarding(identificador: str) -> OnboardingValidateResponse:
    try:
        return _service.validar_cliente_publico(identificador)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al validar el cliente: {e}",
        )


@router.post("/submit/", response_model=OnboardingResponse)
def submit_onboarding(body: OnboardingCreate) -> OnboardingResponse:
    try:
        return _service.guardar_onboarding(body)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al guardar el onboarding: {e}",
        )


@router.get("/{cliente_id}/", response_model=OnboardingResponse)
def get_onboarding_interno(
    cliente_id: UUID,
    _payload: dict = Depends(get_bearer_payload),
) -> OnboardingResponse:
    try:
        data = _service.get_onboarding_por_cliente(cliente_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al obtener el onboarding: {e}",
        )
    if data is None:
        raise HTTPException(status_code=404, detail="Este cliente no tiene onboarding guardado.")
    return data


@router.delete("/{cliente_id}/")
def delete_onboarding_interno(
    cliente_id: UUID,
    _payload: dict = Depends(get_bearer_payload),
) -> Response:
    try:
        _service.eliminar_onboarding(cliente_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al eliminar el onboarding: {e}",
        )
    return Response(status_code=204)
