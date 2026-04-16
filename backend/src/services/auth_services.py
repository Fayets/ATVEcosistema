from datetime import datetime, timedelta, timezone

import jwt
from decouple import config
from fastapi import HTTPException
from pony.orm import db_session

from src.models import Roles, User
from src.schemas import LoginResponse, UserResponse
from src.services.user_services import verify_password_hash

JWT_ALG = "HS256"
JWT_EXPIRE_HOURS = 24


def _issue_token(user_id: int, username: str, role: str) -> str:
    secret = config("SECRET")
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALG)


class AuthServices:
    def login(self, username: str, password: str) -> LoginResponse:
        key = username.lower().strip()
        if not key:
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

        with db_session:
            user = User.get(username=key)
            if user is None or not verify_password_hash(password, user.password_hash):
                raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

            token = _issue_token(user.id, user.username, user.role)
            body_user = UserResponse(
                id=user.id,
                username=user.username,
                role=Roles(user.role),
                created_at=user.created_at,
            )

        return LoginResponse(access_token=token, user=body_user)
