from decouple import config
from fastapi import HTTPException, Request, Response

from src.session_utils import SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, verify_session_token

SESSION_COOKIE_SECURE = config("SESSION_COOKIE_SECURE", default=True, cast=bool)
SESSION_COOKIE_DOMAIN = config("SESSION_COOKIE_DOMAIN", default=".atvos.io")
SESSION_COOKIE_SAMESITE = config("SESSION_COOKIE_SAMESITE", default="none")


def session_cookie_params(*, with_domain: bool = True) -> dict:
    """Atributos compartidos para set_cookie / delete_cookie de ecosystem_session."""
    params = {
        "key": SESSION_COOKIE_NAME,
        "path": "/",
        "httponly": True,
        "secure": SESSION_COOKIE_SECURE,
        "samesite": SESSION_COOKIE_SAMESITE,
    }
    if with_domain and SESSION_COOKIE_DOMAIN:
        params["domain"] = SESSION_COOKIE_DOMAIN
    return params


def clear_session_cookies(response: Response) -> None:
    """Borra cookie con domain (nueva) y sin domain (legacy host-only)."""
    response.delete_cookie(**session_cookie_params(with_domain=True))
    response.delete_cookie(**session_cookie_params(with_domain=False))


def get_current_username(request: Request) -> str:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    username = verify_session_token(token or "")
    if not username:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada.")
    return username
