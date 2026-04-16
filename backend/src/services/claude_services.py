import os
from calendar import monthrange
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from anthropic import (
    APIConnectionError,
    APIError,
    APIStatusError,
    APITimeoutError,
    AsyncAnthropic,
    RateLimitError,
)
from decouple import Config, RepositoryEnv, config
from fastapi import HTTPException
from pony.orm import db_session
from src.models import Cliente, ClaudeBalanceConfig, ClaudeUsageEvent
from src.schemas import (
    ClaudeBalanceResponse,
    ClaudeBalanceUpdateRequest,
    ClaudeClientContextRequest,
    ClaudeClientQueryRequest,
    ClaudeDailyCostPoint,
    ClaudeGenerationResponse,
    ClaudeStatsResponse,
    ClaudeTestRequest,
)


def _extract_message_text(message: Any) -> str:
    parts: list[str] = []
    for block in message.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "".join(parts).strip()


def _read_setting(name: str, default: str = "") -> str:
    env_value = (os.getenv(name) or "").strip()
    if env_value:
        return env_value

    from_decouple = (config(name, default="") or "").strip()
    if from_decouple:
        return from_decouple

    env_path = Path(__file__).resolve().parents[2] / ".env"
    if env_path.exists():
        repo = RepositoryEnv(str(env_path))
        value = (Config(repo)(name, default=default) or "").strip()
        if value:
            return value
    return default


def _trim_text(value: str | None, limit: int) -> str:
    s = (value or "").strip()
    if len(s) <= limit:
        return s
    return f"{s[:limit]}\n...[truncado]"


def _estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    m = (model or "").lower()
    if "haiku" in m:
        input_rate, output_rate = 0.8, 4.0
    elif "opus" in m:
        input_rate, output_rate = 15.0, 75.0
    else:
        input_rate, output_rate = 3.0, 15.0
    return (max(0, input_tokens) / 1_000_000) * input_rate + (max(0, output_tokens) / 1_000_000) * output_rate


class ClaudeServices:
    """Cliente async genérico; reutilizable desde otros servicios de dominio."""

    def __init__(self) -> None:
        self._api_key: str = _read_setting("ANTHROPIC_API_KEY", default="")
        self._default_model: str = _read_setting("ANTHROPIC_MODEL", default="claude-sonnet-4-6")
        self._client: AsyncAnthropic | None = None

    def _get_client(self) -> AsyncAnthropic:
        if not self._api_key:
            raise HTTPException(
                status_code=503,
                detail="ANTHROPIC_API_KEY no está configurada en el entorno.",
            )
        if self._client is None:
            self._client = AsyncAnthropic(api_key=self._api_key)
        return self._client

    def _record_usage_event(
        self,
        *,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: float,
    ) -> None:
        with db_session:
            ClaudeUsageEvent(
                model=model,
                input_tokens=max(0, int(input_tokens)),
                output_tokens=max(0, int(output_tokens)),
                cost_usd=max(0.0, float(cost_usd)),
            )

    def _total_spent_usd(self) -> float:
        with db_session:
            events = list(ClaudeUsageEvent.select())
            total = 0.0
            for ev in events:
                total += float(ev.cost_usd or 0.0)
            return total

    async def send_prompt(
        self,
        *,
        user_message: str,
        system: str | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
    ) -> ClaudeGenerationResponse:
        """
        Envía un turno de usuario a Claude. Punto de entrada genérico para otros servicios.
        """
        client = self._get_client()
        resolved_model = (model or self._default_model).strip()
        model_candidates: list[str] = [resolved_model]
        for fallback_model in ["claude-sonnet-4-6", "claude-haiku-4-5", "claude-3-5-sonnet-latest"]:
            if fallback_model not in model_candidates:
                model_candidates.append(fallback_model)

        message = None
        used_model = resolved_model
        for idx, candidate in enumerate(model_candidates):
            kwargs: dict[str, Any] = {
                "model": candidate,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": user_message}],
            }
            if system:
                kwargs["system"] = system
            try:
                message = await client.messages.create(**kwargs)
                used_model = candidate
                break
            except RateLimitError as e:
                raise HTTPException(
                    status_code=429,
                    detail="Límite de uso de Anthropic; reintentá más tarde.",
                ) from e
            except (APIConnectionError, APITimeoutError) as e:
                raise HTTPException(
                    status_code=502,
                    detail="No se pudo conectar con Anthropic o expiró el tiempo de espera.",
                ) from e
            except APIStatusError as e:
                is_model_not_found = (
                    (getattr(e, "status_code", None) == 404)
                    and ("model" in (getattr(e, "message", str(e)) or "").lower())
                )
                if is_model_not_found and idx < len(model_candidates) - 1:
                    continue
                raise HTTPException(
                    status_code=getattr(e, "status_code", None) or 502,
                    detail=getattr(e, "message", str(e)) or "Error de Anthropic.",
                ) from e
            except APIError as e:
                raise HTTPException(
                    status_code=502,
                    detail=str(e) or "Error al llamar a la API de Anthropic.",
                ) from e

        if message is None:
            raise HTTPException(
                status_code=502,
                detail="No se pudo obtener respuesta de Anthropic.",
            )

        text = _extract_message_text(message)
        usage = getattr(message, "usage", None)
        input_tokens = int(getattr(usage, "input_tokens", 0) or 0) if usage else 0
        output_tokens = int(getattr(usage, "output_tokens", 0) or 0) if usage else 0
        cost_usd = _estimate_cost_usd(used_model, input_tokens, output_tokens)
        self._record_usage_event(
            model=used_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
        )
        return ClaudeGenerationResponse(
            text=text,
            model=used_model,
            stop_reason=getattr(message, "stop_reason", None),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
        )

    async def test_prompt(self, body: ClaudeTestRequest) -> ClaudeGenerationResponse:
        """Casuística del endpoint de prueba: validada con Pydantic en el controlador."""
        return await self.send_prompt(
            user_message=body.prompt,
            system=body.system,
            model=body.model,
            max_tokens=body.max_tokens,
        )

    async def client_summary(self, body: ClaudeClientContextRequest) -> ClaudeGenerationResponse:
        """Resumen de cliente (ATV Clients)."""
        system = (
            "Sos un asistente del CRM ATV. Respondé siempre en español, "
            "con viñetas breves y tono profesional."
        )
        user = (
            "Generá un resumen ejecutivo del siguiente contexto de cliente "
            "(datos, notas o historial que te paso a continuación):\n\n"
            f"{body.context.strip()}"
        )
        return await self.send_prompt(user_message=user, system=system, max_tokens=2048)

    async def client_insights(self, body: ClaudeClientContextRequest) -> ClaudeGenerationResponse:
        """Insights de cliente (ATV Clients)."""
        system = (
            "Sos analista comercial del sistema ATV. Respondé en español, "
            "formato breve: oportunidades, riesgos y una sugerencia de siguiente paso."
        )
        user = (
            "Analizá el siguiente contexto de cliente y devolvé insights accionables:\n\n"
            f"{body.context.strip()}"
        )
        return await self.send_prompt(user_message=user, system=system, max_tokens=2048)

    async def client_query(self, body: ClaudeClientQueryRequest) -> ClaudeGenerationResponse:
        """
        Consulta Claude acotada a un único cliente y fuentes específicas del CRM ATV.
        """
        if not (body.include_fathom or body.include_discord or body.include_onboarding):
            raise HTTPException(
                status_code=400,
                detail="Seleccioná al menos una fuente (Fathom, Discord u Onboarding).",
            )

        with db_session:
            cliente = Cliente.get(id=body.cliente_id)
            if not cliente:
                raise HTTPException(status_code=404, detail="Cliente no encontrado.")

            full_name = " ".join([p for p in [cliente.nombre, cliente.apellido] if p]).strip()
            lines: list[str] = [
                "# Perfil cliente",
                f"- Nombre: {full_name or cliente.nombre}",
                f"- Programa: {cliente.programa}",
                f"- Estado: {cliente.estado}",
            ]
            if cliente.notas:
                lines.append("\n## Notas CRM")
                lines.append(_trim_text(cliente.notas, 4000))

            if body.include_fathom:
                lines.append("\n## Fuente Fathom")
                transcripts = sorted(
                    cliente.fathom_transcripts,
                    key=lambda t: t.occurred_at or t.created_at,
                    reverse=True,
                )[:8]
                if not transcripts:
                    lines.append("Sin transcripts Fathom.")
                else:
                    for idx, t in enumerate(transcripts, start=1):
                        title = (t.titulo or "Sin título").strip()
                        content = _trim_text(t.contenido, 2500) or "Sin contenido."
                        lines.append(f"{idx}. {title}\n{content}")

            if body.include_discord:
                lines.append("\n## Fuente Discord")
                discord_doc = cliente.discord_documento
                if not discord_doc or not (discord_doc.contenido or "").strip():
                    lines.append("Sin documento Discord.")
                else:
                    lines.append(_trim_text(discord_doc.contenido, 9000))

            if body.include_onboarding:
                lines.append("\n## Fuente Onboarding")
                onboarding = cliente.onboarding
                if not onboarding or not onboarding.respuestas:
                    lines.append("Sin onboarding cargado.")
                else:
                    for key, value in onboarding.respuestas.items():
                        clean_value = _trim_text(str(value), 1200) or "—"
                        lines.append(f"- {key}: {clean_value}")

        accion_prompts = {
            "resumen_cliente": "Generá un resumen ejecutivo del cliente.",
            "puntos_criticos": "Listá los puntos críticos actuales del cliente (máximo 8).",
            "proximos_pasos": "Proponé próximos pasos concretos y priorizados.",
            "riesgos_bloqueos": "Detectá riesgos/bloqueos y sugerí mitigaciones prácticas.",
        }
        action_instruction = accion_prompts.get(body.accion, accion_prompts["resumen_cliente"])
        system = self.get_client_query_system_instruction()
        user_message = (
            f"{action_instruction}\n\n"
            f"Pregunta del usuario:\n{body.prompt.strip()}\n\n"
            f"Contexto cliente (usar solo este cliente):\n\n{'\n'.join(lines)}"
        )
        return await self.send_prompt(
            user_message=user_message,
            system=system,
            max_tokens=body.max_tokens,
        )

    def get_client_query_system_instruction(self) -> str:
        return (
            "Sos un asistente del CRM ATV. Respondé siempre en español. "
            "Sé claro, accionable y no inventes datos fuera del contexto provisto. "
            "Evitá usar encabezados markdown con # o ##. En su lugar, usá títulos en negrita "
            "con formato **Título** y luego viñetas breves."
        )

    def get_stats(self, days: int = 14) -> ClaudeStatsResponse:
        _ = days  # mantenemos compatibilidad de firma; stats se devuelven por mes calendario
        with db_session:
            now = datetime.utcnow()
            month_start = datetime(now.year, now.month, 1)
            all_events = list(ClaudeUsageEvent.select())
            month_events = [ev for ev in all_events if ev.created_at >= month_start]
            month_spent_usd = float(sum(float(ev.cost_usd or 0.0) for ev in month_events))
            month_input_tokens = int(sum(int(ev.input_tokens or 0) for ev in month_events))
            month_output_tokens = int(sum(int(ev.output_tokens or 0) for ev in month_events))

            day_cost_map: dict[str, float] = {}
            day_input_map: dict[str, int] = {}
            day_output_map: dict[str, int] = {}
            for ev in month_events:
                key = ev.created_at.strftime("%Y-%m-%d")
                day_cost_map[key] = day_cost_map.get(key, 0.0) + float(ev.cost_usd or 0.0)
                day_input_map[key] = day_input_map.get(key, 0) + int(ev.input_tokens or 0)
                day_output_map[key] = day_output_map.get(key, 0) + int(ev.output_tokens or 0)

        points: list[ClaudeDailyCostPoint] = []
        last_day = monthrange(now.year, now.month)[1]
        for day in range(1, last_day + 1):
            d = datetime(now.year, now.month, day).date()
            key = d.strftime("%Y-%m-%d")
            label = d.strftime("%d-%b").lower()
            points.append(
                ClaudeDailyCostPoint(
                    date_key=key,
                    label=label,
                    cost_usd=float(day_cost_map.get(key, 0.0)),
                    input_tokens=int(day_input_map.get(key, 0)),
                    output_tokens=int(day_output_map.get(key, 0)),
                    total_tokens=int(day_input_map.get(key, 0) + day_output_map.get(key, 0)),
                )
            )

        return ClaudeStatsResponse(
            month_spent_usd=month_spent_usd,
            month_input_tokens=month_input_tokens,
            month_output_tokens=month_output_tokens,
            daily_series=points,
        )

    def get_balance(self) -> ClaudeBalanceResponse:
        with db_session:
            cfg = ClaudeBalanceConfig.select().first()
            if cfg is None:
                cfg = ClaudeBalanceConfig(balance_usd=4.9, baseline_spent_usd=0.0)
        total_spent = self._total_spent_usd()
        with db_session:
            cfg = ClaudeBalanceConfig.select().first()
            if cfg is None:
                cfg = ClaudeBalanceConfig(balance_usd=4.9, baseline_spent_usd=0.0)
            spent_since_reset = max(0.0, total_spent - float(cfg.baseline_spent_usd or 0.0))
            remaining = max(0.0, float(cfg.balance_usd) - spent_since_reset)
            return ClaudeBalanceResponse(
                balance_usd=float(cfg.balance_usd),
                baseline_spent_usd=float(cfg.baseline_spent_usd or 0.0),
                spent_since_reset_usd=spent_since_reset,
                remaining_usd=remaining,
            )

    def reset_balance(self, body: ClaudeBalanceUpdateRequest) -> ClaudeBalanceResponse:
        total_spent = self._total_spent_usd()
        with db_session:
            cfg = ClaudeBalanceConfig.select().first()
            if cfg is None:
                cfg = ClaudeBalanceConfig(
                    balance_usd=float(body.balance_usd),
                    baseline_spent_usd=total_spent,
                )
            else:
                cfg.balance_usd = float(body.balance_usd)
                cfg.baseline_spent_usd = total_spent
        return self.get_balance()
