from fastapi import APIRouter, Depends, HTTPException, Response

from src.deps import (
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_SECURE,
    SESSION_MAX_AGE_SECONDS,
    get_current_username,
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
            key=SESSION_COOKIE_NAME,
            value=token,
            max_age=SESSION_MAX_AGE_SECONDS,
            httponly=True,
            secure=SESSION_COOKIE_SECURE,
            samesite="lax",
            path="/",
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
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"detail": "Sesión cerrada."}
