import base64
import hashlib
import hmac
import json
import time

from decouple import config

SESSION_COOKIE_NAME = "ecosystem_session"
SESSION_MAX_AGE_SECONDS = 7 * 24 * 3600


def _secret() -> bytes:
    return config("SECRET").encode("utf-8")


def create_session_token(username: str) -> str:
    exp = int(time.time()) + SESSION_MAX_AGE_SECONDS
    payload = json.dumps({"u": username, "exp": exp}, separators=(",", ":"))
    sig = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    raw = f"{payload}.{sig}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


HANDOFF_MAX_AGE_SECONDS = 60


def create_handoff_token(username: str) -> str:
    """Pase de un solo tramo para abrir una app que vive fuera de .atvos.io.

    Mismo formato y SECRET que la sesión, con "p": "handoff" para que la app de
    destino solo lo acepte en su endpoint de canje, y 60 s de vida porque viaja en
    la URL.
    """
    exp = int(time.time()) + HANDOFF_MAX_AGE_SECONDS
    payload = json.dumps({"u": username, "exp": exp, "p": "handoff"}, separators=(",", ":"))
    sig = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    raw = f"{payload}.{sig}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def verify_session_token(token: str) -> str | None:
    if not token:
        return None
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8")
        payload, sig = raw.rsplit(".", 1)
    except (ValueError, UnicodeDecodeError):
        return None

    expected = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None

    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None

    exp = data.get("exp")
    username = data.get("u")
    if not isinstance(exp, int) or not isinstance(username, str) or exp < int(time.time()):
        return None
    return username
