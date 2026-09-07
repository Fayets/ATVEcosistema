from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class SessionResponse(BaseModel):
    username: str


class HealthResponse(BaseModel):
    status: str


class HealthDbResponse(BaseModel):
    status: str
    schema: str


# —— ATV Hiring (postulaciones, schema `hiring`) ——

HIRING_STATUSES = ("nueva", "revisando", "entrevista", "contratado", "descartado")


class HiringApplicationUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
