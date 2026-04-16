import uuid
from datetime import datetime, timezone
from enum import Enum
from uuid import UUID

from pony.orm import Json, Optional, PrimaryKey, Required, Set
from .db import db


class Roles(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    USER = "USER"


class User(db.Entity):
    id = PrimaryKey(int, auto=True)
    username = Required(str, unique=True)
    password_hash = Required(str)
    role = Required(str)
    created_at = Required(datetime, default=lambda: datetime.now(timezone.utc))


class Cliente(db.Entity):
    id = PrimaryKey(UUID, default=uuid.uuid4)
    """ID corto para compartir con el cliente (onboarding, etc.). Único y estable."""
    codigo_publico = Required(int, unique=True)
    nombre = Required(str)
    apellido = Optional(str, nullable=True)
    email = Optional(str, unique=True, nullable=True)
    telefono = Optional(str, nullable=True)
    instagram = Optional(str, nullable=True)
    programa = Required(str, default="boost")

    estado = Required(str, default="activo")
    origen = Optional(str, nullable=True)
    notas = Optional(str, nullable=True)

    created_at = Required(datetime, default=datetime.utcnow)
    updated_at = Required(datetime, default=datetime.utcnow)

    fathom_transcripts = Set("FathomTranscript", cascade_delete=True)
    discord_documento = Optional("DiscordDocumento", cascade_delete=True)
    onboarding = Optional("EntregableOnboarding", cascade_delete=True)

    def before_update(self) -> None:
        self.updated_at = datetime.utcnow()


class FathomTranscript(db.Entity):
    """Un transcript de llamada Fathom; la “carpeta” Fathom del cliente es el conjunto de estos registros."""

    id = PrimaryKey(UUID, default=uuid.uuid4)
    cliente = Required("Cliente", column="cliente_id")
    titulo = Required(str)
    external_id = Optional(str, nullable=True)
    recording_url = Optional(str, nullable=True)
    contenido = Optional(str, nullable=True)
    occurred_at = Optional(datetime, nullable=True)

    created_at = Required(datetime, default=datetime.utcnow)
    updated_at = Required(datetime, default=datetime.utcnow)

    def before_update(self) -> None:
        self.updated_at = datetime.utcnow()


class DiscordDocumento(db.Entity):
    """Un solo documento de texto por cliente; el contenido crece con append (Discord / chats)."""

    id = PrimaryKey(UUID, default=uuid.uuid4)
    cliente = Required("Cliente", unique=True, column="cliente_id")
    contenido = Optional(str, nullable=True)

    created_at = Required(datetime, default=datetime.utcnow)
    updated_at = Required(datetime, default=datetime.utcnow)

    def before_update(self) -> None:
        self.updated_at = datetime.utcnow()


class EntregableOnboarding(db.Entity):
    """Formulario de onboarding del cliente (un registro por cliente; respuestas en JSON)."""

    id = PrimaryKey(UUID, default=uuid.uuid4)
    cliente = Required("Cliente", unique=True, column="cliente_id")
    respuestas = Required(Json)

    created_at = Required(datetime, default=datetime.utcnow)
    updated_at = Required(datetime, default=datetime.utcnow)

    def before_update(self) -> None:
        self.updated_at = datetime.utcnow()


class EntregablePlantilla(db.Entity):
    """Plantilla de un tipo de entregable (formulario, checklist, etc.). Una fila por `slug` (ej. onboarding)."""

    id = PrimaryKey(int, auto=True)
    slug = Required(str, unique=True)
    nombre = Optional(str, nullable=True)
    configuracion = Required(Json)
    updated_at = Required(datetime, default=lambda: datetime.now(timezone.utc))

    def before_update(self) -> None:
        self.updated_at = datetime.now(timezone.utc)


class ClaudeUsageEvent(db.Entity):
    """Evento de consumo Claude (tokens + costo estimado) para estadísticas persistentes."""

    _table_ = "claude_usage_event"
    id = PrimaryKey(int, auto=True)
    model = Required(str)
    input_tokens = Required(int, default=0)
    output_tokens = Required(int, default=0)
    cost_usd = Required(float, default=0.0)
    created_at = Required(datetime, default=lambda: datetime.now(timezone.utc))


class ClaudeBalanceConfig(db.Entity):
    """Saldo base manual y baseline para reiniciar contador de consumo."""

    _table_ = "claude_balance_config"
    id = PrimaryKey(int, auto=True)
    balance_usd = Required(float, default=4.9)
    baseline_spent_usd = Required(float, default=0.0)
    updated_at = Required(datetime, default=lambda: datetime.now(timezone.utc))

    def before_update(self) -> None:
        self.updated_at = datetime.now(timezone.utc)
