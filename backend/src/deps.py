from decouple import config
from fastapi import HTTPException, Request

from src.session_utils import SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, verify_session_token

SESSION_COOKIE_SECURE = config("SESSION_COOKIE_SECURE", default=True, cast=bool)
SESSION_COOKIE_DOMAIN = config("SESSION_COOKIE_DOMAIN", default=".atvos.io")
SESSION_COOKIE_SAMESITE = config("SESSION_COOKIE_SAMESITE", default="none")


def session_cookie_params() -> dict:
    """Atributos compartidos para set_cookie / delete_cookie de ecosystem_session."""
    return {
        "key": SESSION_COOKIE_NAME,
        "path": "/",
        "httponly": True,
        "secure": SESSION_COOKIE_SECURE,
        "samesite": SESSION_COOKIE_SAMESITE,
        "domain": SESSION_COOKIE_DOMAIN,
    }


def get_current_username(request: Request) -> str:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    username = verify_session_token(token or "")
    if not username:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada.")
    return username
