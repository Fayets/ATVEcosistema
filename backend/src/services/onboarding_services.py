import re
from uuid import UUID

from fastapi import HTTPException
from pony.orm import db_session

from src.models import Cliente, EntregableOnboarding
from src.schemas import OnboardingCreate, OnboardingResponse, OnboardingValidateResponse
from src.services.entregables_services import EntregablesServices

_PG_INT_MAX = 2_147_483_647


def _resolver_cliente_por_identificador(identificador: str) -> Cliente | None:
    """Acepta solo dígitos (código público) o un UUID de cliente."""
    s = identificador.strip()
    if not s:
        return None
    if re.fullmatch(r"\d+", s):
        n = int(s)
        if n < 0 or n > _PG_INT_MAX:
            return None
        return Cliente.get(codigo_publico=n)
    try:
        uid = UUID(s)
    except ValueError:
        return None
    return Cliente.get(id=uid)


class OnboardingServices:
    """Lógica de negocio y persistencia del onboarding (EntregableOnboarding)."""

    @staticmethod
    def _to_onboarding_response(row: EntregableOnboarding) -> OnboardingResponse:
        raw = row.respuestas
        if isinstance(raw, dict):
            respuestas = {str(k): str(v) for k, v in raw.items()}
        else:
            respuestas = {}
        return OnboardingResponse(
            id=row.id,
            cliente_id=row.cliente.id,
            respuestas=respuestas,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def validar_cliente_publico(self, identificador: str) -> OnboardingValidateResponse:
        with db_session:
            cliente = _resolver_cliente_por_identificador(identificador)
            if cliente is None:
                raise HTTPException(status_code=404, detail="Cliente no encontrado.")
            return OnboardingValidateResponse(
                cliente_id=str(cliente.id),
                codigo_publico=cliente.codigo_publico,
                nombre=cliente.nombre,
                apellido=cliente.apellido,
            )

    def guardar_onboarding(self, data: OnboardingCreate) -> OnboardingResponse:
        EntregablesServices.validate_submitted_respuestas(dict(data.respuestas))
        with db_session:
            cid = UUID(data.cliente_id)
            cliente = Cliente.get(id=cid)
            if cliente is None:
                raise HTTPException(status_code=404, detail="Cliente no encontrado.")

            existing = EntregableOnboarding.get(cliente=cliente)
            if existing is not None:
                existing.respuestas = dict(data.respuestas)
                return self._to_onboarding_response(existing)

            row = EntregableOnboarding(cliente=cliente, respuestas=dict(data.respuestas))
            return self._to_onboarding_response(row)

    def get_onboarding_por_cliente(self, cliente_id: UUID) -> OnboardingResponse | None:
        with db_session:
            cliente = Cliente.get(id=cliente_id)
            if cliente is None:
                raise HTTPException(status_code=404, detail="Cliente no encontrado.")
            row = EntregableOnboarding.get(cliente=cliente)
            if row is None:
                return None
            return self._to_onboarding_response(row)

    def eliminar_onboarding(self, cliente_id: UUID) -> None:
        with db_session:
            cliente = Cliente.get(id=cliente_id)
            if cliente is None:
                raise HTTPException(status_code=404, detail="Cliente no encontrado.")
            row = EntregableOnboarding.get(cliente=cliente)
            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Este cliente no tiene onboarding guardado.",
                )
            row.delete()
