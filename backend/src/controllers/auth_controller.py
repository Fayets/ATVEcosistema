from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from src.deps import (
    SESSION_MAX_AGE_SECONDS,
    clear_session_cookies,
    get_current_username,
    session_cookie_params,
)
from src.schemas import LoginRequest, SessionResponse
from src.session_utils import SESSION_COOKIE_NAME, create_handoff_token, verify_session_token
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


# Apps de ATV que viven fuera de .atvos.io: la cookie de sesión no les llega, así que
# el tile pasa por acá y se les entrega un pase firmado. Lista cerrada a propósito:
# nunca redirigir a una URL que venga del request.
HANDOFF_TARGETS = {
    "landing": "https://atvv.site/api/auth/handoff",
}


@router.get("/handoff")
def handoff(app: str, request: Request):
    try:
        target = HANDOFF_TARGETS.get(app)
        if not target:
            raise HTTPException(status_code=404, detail="App desconocida.")
        username = verify_session_token(request.cookies.get(SESSION_COOKIE_NAME) or "")
        if not username:
            return RedirectResponse("/", status_code=302)
        query = urlencode({"t": create_handoff_token(username)})
        return RedirectResponse(f"{target}?{query}", status_code=302)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al generar el pase: {e}") from e
