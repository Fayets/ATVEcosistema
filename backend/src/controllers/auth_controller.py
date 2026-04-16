from fastapi import APIRouter, HTTPException

from src.schemas import LoginRequest, LoginResponse
from src.services.auth_services import AuthServices

router = APIRouter(prefix="/auth", tags=["auth"])
_service = AuthServices()


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    try:
        return _service.login(body.username, body.password)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al iniciar sesión.",
        )
