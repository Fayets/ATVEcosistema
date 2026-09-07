import uuid
from datetime import datetime, timezone
from uuid import UUID

from pony.orm import Json, Optional, PrimaryKey, Required

from src.db import DB_SCHEMA, db


class User(db.Entity):
    _table_ = (DB_SCHEMA, "users")

    id = PrimaryKey(UUID, default=uuid.uuid4)
    username = Required(str, unique=True)
    password_hash = Required(str)
    created_at = Required(datetime, default=lambda: datetime.now(timezone.utc))


class HiringApplication(db.Entity):
    """Postulación de la bolsa de trabajo (ATV Hiring). La tabla la crea y llena
    el backend de hiring-main; acá solo se lee y se gestiona (status / notas)."""

    _table_ = ("hiring", "applications")

    role_slug = Required(str, index=True)
    role_label = Required(str)
    name = Required(str)
    email = Required(str, index=True)
    phone = Required(str)
    country = Optional(str)
    answers = Required(Json, default=dict)
    source = Optional(str)
    campaign = Optional(str)
    page_url = Optional(str)
    user_agent = Optional(str)
    status = Required(str, default="nueva", index=True)
    notes = Optional(str)
    reviewed_by = Optional(str)
    created_at = Required(datetime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), index=True)
    updated_at = Optional(datetime)
