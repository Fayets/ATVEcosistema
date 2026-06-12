from fastapi import HTTPException
from pony.orm import db_session

from src.models import User
from src.password_utils import verify_password
from src.schemas import LoginRequest, SessionResponse
from src.session_utils import create_session_token


class AuthServices:
    def login(self, body: LoginRequest) -> tuple[SessionResponse, str]:
        username = body.username.strip()
        if not username:
            raise HTTPException(status_code=400, detail="Usuario requerido.")

        with db_session:
            user = User.get(username=username)
            if user is None or not verify_password(body.password, user.password_hash):
                raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

        token = create_session_token(username)
        return SessionResponse(username=username), token

    def get_session(self, username: str) -> SessionResponse:
        with db_session:
            user = User.get(username=username)
            if user is None:
                raise HTTPException(status_code=401, detail="Sesión inválida o expirada.")
        return SessionResponse(username=username)
