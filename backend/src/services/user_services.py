import hashlib
import secrets

from fastapi import HTTPException
from pony.orm import commit, db_session

from src.models import Roles, User
from src.schemas import UserCreate, UserResponse


def _hash_password(raw: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", raw.encode("utf-8"), bytes.fromhex(salt), 100_000).hex()
    return f"{salt}${dk}"


def verify_password_hash(plain: str, stored: str) -> bool:
    try:
        salt_hex, h = stored.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        check = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), salt, 100_000).hex()
        return h == check
    except (ValueError, AttributeError):
        return False


class UserServices:
    def create_user(self, payload: UserCreate) -> UserResponse:
        with db_session:
            key = payload.username.lower().strip()
            # Pony puede devolver None si no existe (no siempre lanza ObjectNotFound).
            if User.get(username=key) is not None:
                raise HTTPException(
                    status_code=409,
                    detail="Ya existe un usuario con ese nombre.",
                )

            user = User(
                username=key,
                password_hash=_hash_password(payload.password),
                role=payload.role.value,
            )
            commit()

            return UserResponse(
                id=user.id,
                username=user.username,
                role=Roles(user.role),
                created_at=user.created_at,
            )
