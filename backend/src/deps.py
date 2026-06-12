from decouple import config
from fastapi import HTTPException, Request

from src.session_utils import SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, verify_session_token

SESSION_COOKIE_SECURE = config("SESSION_COOKIE_SECURE", default=False, cast=bool)


def get_current_username(request: Request) -> str:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    username = verify_session_token(token or "")
    if not username:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada.")
    return username
