from fastapi import APIRouter, Depends, HTTPException, Response

from src.deps import (
    SESSION_MAX_AGE_SECONDS,
    clear_session_cookies,
    get_current_username,
    session_cookie_params,
)
from src.schemas import LoginRequest, SessionResponse
from src.services.auth_services import AuthServices

router = APIRouter(prefix="/api/auth", tags=["auth"])
_service = AuthServices()


@router.post("/login", response_model=SessionResponse)
def login(body: LoginRequest, response: Response) -> SessionResponse:
    try:
        session, token = _service.login(body)
        response.set_cookie(
            **session_cookie_params(),
            value=token,
            max_age=SESSION_MAX_AGE_SECONDS,
        )
        return session
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al iniciar sesión: {e}") from e


@router.get("/session", response_model=SessionResponse)
def get_session(username: str = Depends(get_current_username)) -> SessionResponse:
    try:
        return _service.get_session(username)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al validar sesión: {e}") from e


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    clear_session_cookies(response)
    return {"detail": "Sesión cerrada."}
