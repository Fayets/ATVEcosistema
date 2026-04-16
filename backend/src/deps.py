"""Dependencias FastAPI compartidas (p. ej. JWT Bearer)."""

import jwt
from decouple import config
from fastapi import Header, HTTPException

from src.services.auth_services import JWT_ALG


def get_bearer_payload(authorization: str | None = Header(None)) -> dict:
    """Valida `Authorization: Bearer <jwt>` y devuelve el payload decodificado."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado.")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado.")
    try:
        return jwt.decode(token, config("SECRET"), algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")
