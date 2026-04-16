import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.models import Roles


class HealthResponse(BaseModel):
    status: str


class UserCreate(BaseModel):
    username: str = Field(description="Nombre de usuario (letras, números y guión bajo).")
    password: str = Field(description="Contraseña.")
    role: Roles

    @field_validator("username")
    @classmethod
    def username_ok(cls, v: str) -> str:
        s = v.strip()
        if len(s) < 3 or len(s) > 32:
            raise ValueError("El usuario debe tener entre 3 y 32 caracteres.")
        if not re.fullmatch(r"[a-zA-Z0-9_]+", s):
            raise ValueError("El usuario solo puede tener letras, números y guión bajo (_).")
        return s

    @field_validator("password")
    @classmethod
    def password_ok(cls, v: str) -> str:
        if not v:
            raise ValueError("La contraseña no puede estar vacía.")
        if len(v) > 128:
            raise ValueError("La contraseña no puede superar los 128 caracteres.")
        return v


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: Roles
    created_at: datetime


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# —— Anthropic Claude ——


class ClaudeTestRequest(BaseModel):
    """Request de prueba: prompt libre + parámetros opcionales."""

    prompt: str = Field(min_length=1, max_length=200_000, description="Mensaje de usuario para Claude.")
    system: str | None = Field(
        default=None,
        max_length=50_000,
        description="Instrucciones de sistema opcionales.",
    )
    model: str | None = Field(default=None, description="Modelo; por defecto ANTHROPIC_MODEL del .env.")
    max_tokens: int = Field(default=1024, ge=1, le=16_000)


class ClaudeClientContextRequest(BaseModel):
    """Contexto de cliente (notas, CRM, texto libre) para summary / insights."""

    context: str = Field(min_length=1, max_length=200_000)


class ClaudeClientQueryRequest(BaseModel):
    """Consulta de Claude acotada a un cliente y fuentes seleccionadas."""

    cliente_id: UUID
    prompt: str = Field(min_length=1, max_length=20_000)
    accion: Literal[
        "resumen_cliente",
        "puntos_criticos",
        "proximos_pasos",
        "riesgos_bloqueos",
    ] = "resumen_cliente"
    include_fathom: bool = True
    include_discord: bool = True
    include_onboarding: bool = True
    max_tokens: int = Field(default=2048, ge=1, le=16_000)


class ClaudeGenerationResponse(BaseModel):
    text: str
    model: str
    stop_reason: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    cost_usd: float | None = None


class ClaudeBalanceUpdateRequest(BaseModel):
    balance_usd: float = Field(ge=0)


class ClaudeBalanceResponse(BaseModel):
    balance_usd: float
    baseline_spent_usd: float
    spent_since_reset_usd: float
    remaining_usd: float


class ClaudeDailyCostPoint(BaseModel):
    date_key: str
    label: str
    cost_usd: float
    input_tokens: int
    output_tokens: int
    total_tokens: int


class ClaudeStatsResponse(BaseModel):
    month_spent_usd: float
    month_input_tokens: int
    month_output_tokens: int
    daily_series: list[ClaudeDailyCostPoint]


class ClienteBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    apellido: str | None = Field(default=None, max_length=120)
    telefono: str | None = Field(default=None, max_length=50)
    instagram: str | None = Field(default=None, max_length=80)
    programa: str = Field(default="boost", max_length=30)
    estado: str = Field(default="activo", max_length=30)
    notas: str | None = Field(default=None, max_length=2_000)

    @field_validator("nombre")
    @classmethod
    def nombre_ok(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("El nombre es obligatorio.")
        return value

    @field_validator("programa")
    @classmethod
    def programa_ok(cls, v: str) -> str:
        value = v.strip().lower()
        if value not in {"boost", "mentoria_avanzada"}:
            raise ValueError("El programa debe ser boost o mentoria_avanzada.")
        return value

class ClienteCreate(ClienteBase):
    nombre: str = Field(min_length=1, max_length=120)


class ClienteUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    apellido: str | None = Field(default=None, max_length=120)
    telefono: str | None = Field(default=None, max_length=50)
    instagram: str | None = Field(default=None, max_length=80)
    programa: str | None = Field(default=None, max_length=30)
    estado: str | None = Field(default=None, max_length=30)
    notas: str | None = Field(default=None, max_length=2_000)

    @field_validator("nombre")
    @classmethod
    def nombre_update_ok(cls, v: str | None) -> str | None:
        if v is None:
            return None
        value = v.strip()
        if not value:
            raise ValueError("El nombre no puede estar vacío.")
        return value

    @field_validator("programa")
    @classmethod
    def programa_update_ok(cls, v: str | None) -> str | None:
        if v is None:
            return None
        value = v.strip().lower()
        if value not in {"boost", "mentoria_avanzada"}:
            raise ValueError("El programa debe ser boost o mentoria_avanzada.")
        return value

class ClienteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    codigo_publico: int
    nombre: str
    apellido: str | None = None
    telefono: str | None = None
    instagram: str | None = None
    programa: str
    estado: str
    notas: str | None = None
    created_at: datetime
    updated_at: datetime


# —— Fathom (transcripts por cliente) ——


class FathomTranscriptBase(BaseModel):
    titulo: str = Field(min_length=1, max_length=300)
    external_id: str | None = Field(default=None, max_length=120)
    recording_url: str | None = Field(default=None, max_length=2_000)
    contenido: str | None = Field(default=None, max_length=500_000)
    occurred_at: datetime | None = None

    @field_validator("titulo")
    @classmethod
    def titulo_ok(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("El título es obligatorio.")
        return s


class FathomTranscriptCreate(FathomTranscriptBase):
    pass


class FathomTranscriptUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=1, max_length=300)
    external_id: str | None = Field(default=None, max_length=120)
    recording_url: str | None = Field(default=None, max_length=2_000)
    contenido: str | None = Field(default=None, max_length=500_000)
    occurred_at: datetime | None = None

    @field_validator("titulo")
    @classmethod
    def titulo_update_ok(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not s:
            raise ValueError("El título no puede quedar vacío.")
        return s


class FathomTranscriptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cliente_id: UUID
    titulo: str
    external_id: str | None = None
    recording_url: str | None = None
    contenido: str | None = None
    occurred_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


# —— Discord: un documento por cliente ——


class DiscordDocumentoAppend(BaseModel):
    texto: str = Field(min_length=1, max_length=2_000_000)

    @field_validator("texto")
    @classmethod
    def texto_ok(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("El texto no puede estar vacío.")
        return s


class DiscordDocumentoBlockEdit(BaseModel):
    texto: str = Field(min_length=1, max_length=2_000_000)

    @field_validator("texto")
    @classmethod
    def texto_ok(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("El texto no puede estar vacío.")
        return s


class DiscordDocumentoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cliente_id: UUID
    contenido: str
    created_at: datetime
    updated_at: datetime


# —— Onboarding (entregable por cliente) ——
# Claves y obligatoriedad de respuestas se validan contra la plantilla del entregable
# en BD (`EntregablePlantilla`, slug onboarding), vía `EntregablesServices.validate_submitted_respuestas`.


class EntregableCampoSchema(BaseModel):
    """Un campo de formulario dentro de la configuración de una plantilla (p. ej. onboarding)."""

    key: str = Field(min_length=1, max_length=80, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(min_length=1, max_length=300)
    question: str = Field(min_length=1, max_length=8000)
    example: str = Field(min_length=1, max_length=8000)
    long: bool = False
    optional: bool = False


class EntregablePlantillaResponse(BaseModel):
    slug: str
    nombre: str | None = None
    campos: list[EntregableCampoSchema]
    updated_at: datetime


class EntregablePlantillaListItem(BaseModel):
    """Resumen para listado (sin campos completos)."""

    slug: str
    nombre: str | None = None
    updated_at: datetime


class EntregablePlantillaCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9_]*$")
    nombre: str | None = Field(default=None, max_length=200)

    @field_validator("slug")
    @classmethod
    def slug_norm(cls, v: str) -> str:
        return v.strip()

    @field_validator("nombre")
    @classmethod
    def nombre_norm(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s or None


class EntregablePlantillaMetaPatch(BaseModel):
    nombre: str | None = Field(default=None, max_length=200)

    @field_validator("nombre")
    @classmethod
    def nombre_patch(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s or None


class EntregablePlantillaUpdate(BaseModel):
    campos: list[EntregableCampoSchema] = Field(min_length=1)


class OnboardingValidateResponse(BaseModel):
    cliente_id: str
    codigo_publico: int
    nombre: str
    apellido: str | None = None


class OnboardingCreate(BaseModel):
    cliente_id: str = Field(min_length=1)
    respuestas: dict[str, str]

    @field_validator("cliente_id")
    @classmethod
    def cliente_id_uuid(cls, v: str) -> str:
        try:
            UUID(v.strip())
        except ValueError as e:
            raise ValueError("cliente_id debe ser un UUID válido.") from e
        return v.strip()


class OnboardingResponse(BaseModel):
    id: UUID
    cliente_id: UUID
    respuestas: dict[str, str]
    created_at: datetime
    updated_at: datetime

