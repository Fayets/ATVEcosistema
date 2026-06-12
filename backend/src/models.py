import uuid
from datetime import datetime, timezone
from uuid import UUID

from pony.orm import PrimaryKey, Required

from src.db import DB_SCHEMA, db


class User(db.Entity):
    _table_ = (DB_SCHEMA, "users")

    id = PrimaryKey(UUID, default=uuid.uuid4)
    username = Required(str, unique=True)
    password_hash = Required(str)
    created_at = Required(datetime, default=lambda: datetime.now(timezone.utc))
