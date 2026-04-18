import json
import os
import re
from calendar import monthrange
from datetime import datetime, timedelta
from collections.abc import AsyncIterator
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

try:
    from anthropic._constants import MODEL_NONSTREAMING_TOKENS as _ANTHROPIC_MODEL_NONSTREAMING_TOKENS
except ImportError:
    _ANTHROPIC_MODEL_NONSTREAMING_TOKENS = {}
from decouple import Config, RepositoryEnv, config
from fastapi import HTTPException
from pony.orm import db_session
from src.models import Cliente, ClaudeAreaSystemPrompt, ClaudeBalanceConfig, ClaudeUsageEvent
from src.schemas import (
    ClaudeAreaPromptItem,
    ClaudeAreaPromptsResponse,
    ClaudeAreaPromptsUpdateRequest,
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


# Línea que solo es un separador markdown (---, ***, ===, ___); redundante si ya hay **Título**.
_HR_LINE_RE = re.compile(r"^\s*(?:-{3,}|={3,}|\*{3,}|_{3,})\s*$")


def _strip_horizontal_rule_lines(text: str) -> str:
    """Quita líneas horizontales tipo markdown que el modelo suele insertar entre secciones."""
    s = text or ""
    lines = [ln for ln in s.splitlines() if not _HR_LINE_RE.match(ln)]
    return "\n".join(lines)


# Va al final del user message de consulta por cliente: el contexto CRM usa #/##/listas y el modelo tendía a espejarlo.
_CLIENT_QUERY_USER_FORMAT_SUFFIX = (
    "\n\n[Criterio de formato — no repetir literalmente esta etiqueta en tu respuesta]\n"
    "El bloque de contexto viene maquetado para el sistema (títulos, listas, transcripts numerados); "
    "eso es solo empaquetado de datos. Tu respuesta no debe imitar esa maquetación.\n"
    "Escribí como en un chat entre pares: mayormente párrafos, tono natural, sin obligar cada idea a una línea "
    "que empiece con guión o viñeta.\n"
    "Evitá en particular: cronología «1. Fecha — título» con lista de guiones debajo de cada número; "
    "y secciones finales tipo «Puntos clave / a tener en cuenta» hechas casi solo con '-'. "
    "Si el usuario pidió explícitamente lista, tabla o esquema, respetalo; si no, priorizá prosa.\n"
    "No cierres con agradecimientos o apodos hacia quien escribe salvo que su mensaje lo invite."
)


def _clamp_max_tokens_for_api(max_tokens: int, user_message: str, system: str | None) -> int:
    """
    La API exige que el prompt no deje 0 espacio para max_tokens: input + max_tokens <= ventana (~200k).
    Con max_tokens muy altos y mucho contexto (Fathom + Discord), Anthropic devuelve error si no acotamos.
    """
    ctx = 200_000
    # Sobre-estimación conservadora de tokens a partir de caracteres (evita pedir más salida de la cuenta).
    approx_in = max(1024, (len(user_message or "") + len(system or "")) // 2 + 8192)
    budget = ctx - approx_in
    cap = min(max(256, budget), max(1, int(max_tokens)))
    return max(1, cap)


def _clamp_max_tokens_streaming(max_tokens: int, user_message: str, system: str | None) -> int:
    """Streaming: sin tope ~21k del SDK; limitamos por ventana de contexto y un techo razonable de salida."""
    ctx = 200_000
    approx_in = max(1024, (len(user_message or "") + len(system or "")) // 2 + 8192)
    budget = ctx - approx_in
    stream_ceil = 64_000
    return max(1, min(int(max_tokens), max(256, budget), stream_ceil))


def _anthropic_sdk_nonstreaming_output_cap(model: str) -> int:
    """
    El SDK Python rechaza messages.create (sin stream) si estima >10 min de generación
    (p. ej. max_tokens > ~21333 con la escala 128k del cliente) o si el modelo tiene tope explícito.
    Ver anthropic._constants.MODEL_NONSTREAMING_TOKENS y _base_client._calculate_nonstreaming_timeout.
    """
    m = (model or "").strip()
    explicit = _ANTHROPIC_MODEL_NONSTREAMING_TOKENS.get(m)
    if explicit is not None:
        return int(explicit)
    # Sin entrada en el dict del SDK: umbral ~ 21333 (3600 * max_tok/128k <= 600 s).
    return 21_333


def _estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    m = (model or "").lower()
    if "haiku" in m:
        input_rate, output_rate = 0.8, 4.0
    elif "opus-4-7" in m:
        input_rate, output_rate = 5.0, 25.0
    elif "opus" in m:
        input_rate, output_rate = 15.0, 75.0
    else:
        input_rate, output_rate = 3.0, 15.0
    return (max(0, input_tokens) / 1_000_000) * input_rate + (max(0, output_tokens) / 1_000_000) * output_rate


class ClaudeServices:
    """Cliente async genérico; reutilizable desde otros servicios de dominio."""

    def __init__(self) -> None:
        self._api_key: str = _read_setting("ANTHROPIC_API_KEY", default="")
        self._default_model: str = _read_setting("ANTHROPIC_MODEL", default="claude-opus-4-7")
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
        max_tokens: int = 21_333,
    ) -> ClaudeGenerationResponse:
        """
        Envía un turno de usuario a Claude. Punto de entrada genérico para otros servicios.
        Sin streaming, el SDK Anthropic acota max_tokens (~21k salvo modelos con tope menor en su dict).
        """
        client = self._get_client()
        resolved_model = (model or self._default_model).strip()
        model_candidates: list[str] = [resolved_model]
        for fallback_model in ["claude-opus-4-6", "claude-opus-4-5", "claude-opus-4-1"]:
            if fallback_model not in model_candidates:
                model_candidates.append(fallback_model)

        budget_cap = _clamp_max_tokens_for_api(max_tokens, user_message, system)

        message = None
        used_model = resolved_model
        for idx, candidate in enumerate(model_candidates):
            capped_tokens = min(budget_cap, _anthropic_sdk_nonstreaming_output_cap(candidate))
            kwargs: dict[str, Any] = {
                "model": candidate,
                "max_tokens": capped_tokens,
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

        text = _strip_horizontal_rule_lines(_extract_message_text(message)).strip()
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
            "con viñetas breves y tono profesional. "
            "No uses líneas solo con guiones repetidos (---) ni separadores similares (***, ===) entre secciones; "
            "marcá bloques con **Título** en negrita."
        )
        user = (
            "Generá un resumen ejecutivo del siguiente contexto de cliente "
            "(datos, notas o historial que te paso a continuación):\n\n"
            f"{body.context.strip()}"
        )
        return await self.send_prompt(user_message=user, system=system, max_tokens=21_333)

    async def client_insights(self, body: ClaudeClientContextRequest) -> ClaudeGenerationResponse:
        """Insights de cliente (ATV Clients)."""
        system = (
            "Sos analista comercial del sistema ATV. Respondé en español, "
            "formato breve: oportunidades, riesgos y una sugerencia de siguiente paso. "
            "Sin líneas separadoras tipo --- entre secciones; usá **Título** si hace falta estructura."
        )
        user = (
            "Analizá el siguiente contexto de cliente y devolvé insights accionables:\n\n"
            f"{body.context.strip()}"
        )
        return await self.send_prompt(user_message=user, system=system, max_tokens=21_333)

    def _compose_client_query_messages(self, body: ClaudeClientQueryRequest) -> tuple[str, str]:
        """Arma user_message y system para consulta por cliente (validación + contexto CRM)."""
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
                    raw_resp = onboarding.respuestas
                    if isinstance(raw_resp, dict):
                        for key, value in raw_resp.items():
                            clean_value = _trim_text(str(value), 1200) or "—"
                            lines.append(f"- {key}: {clean_value}")
                    else:
                        blob = json.dumps(raw_resp, ensure_ascii=False) if raw_resp is not None else ""
                        lines.append(_trim_text(blob, 8000) or "—")

        system = self.get_client_query_system_instruction(body.area)
        user_message = (
            f"Pregunta o pedido del usuario:\n{body.prompt.strip()}\n\n"
            f"Contexto del cliente (usar solo este cliente; no mezclar con otros):\n\n{'\n'.join(lines)}"
            f"{_CLIENT_QUERY_USER_FORMAT_SUFFIX}"
        )
        return user_message, system

    async def client_query(self, body: ClaudeClientQueryRequest) -> ClaudeGenerationResponse:
        """
        Consulta Claude acotada a un único cliente y fuentes específicas del CRM ATV.
        """
        user_message, system = self._compose_client_query_messages(body)
        return await self.send_prompt(
            user_message=user_message,
            system=system,
            max_tokens=body.max_tokens,
        )

    async def iter_client_query_ndjson(self, body: ClaudeClientQueryRequest) -> AsyncIterator[str]:
        """
        Streaming NDJSON para la misma consulta que client_query (experiencia tipo chat).
        """
        user_message, system = self._compose_client_query_messages(body)
        max_t = _clamp_max_tokens_streaming(body.max_tokens, user_message, system)
        client = self._get_client()
        resolved_model = (self._default_model or "").strip()
        model_candidates: list[str] = [resolved_model]
        for fallback_model in ["claude-opus-4-6", "claude-opus-4-5", "claude-opus-4-1"]:
            if fallback_model not in model_candidates:
                model_candidates.append(fallback_model)

        used_model = resolved_model
        final_msg = None

        for idx, candidate in enumerate(model_candidates):
            try:
                async with client.messages.stream(
                    model=candidate,
                    max_tokens=max_t,
                    messages=[{"role": "user", "content": user_message}],
                    system=system,
                ) as stream:
                    async for text in stream.text_stream:
                        yield json.dumps({"type": "delta", "text": text}, ensure_ascii=False) + "\n"
                    final_msg = await stream.get_final_message()
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

        if final_msg is None:
            raise HTTPException(status_code=502, detail="No se pudo obtener respuesta de Anthropic.")

        raw_text = _extract_message_text(final_msg)
        text = _strip_horizontal_rule_lines(raw_text).strip()
        usage = getattr(final_msg, "usage", None)
        input_tokens = int(getattr(usage, "input_tokens", 0) or 0) if usage else 0
        output_tokens = int(getattr(usage, "output_tokens", 0) or 0) if usage else 0
        cost_usd = _estimate_cost_usd(used_model, input_tokens, output_tokens)
        self._record_usage_event(
            model=used_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
        )
        yield json.dumps(
            {
                "type": "done",
                "text": text,
                "model": used_model,
                "stop_reason": getattr(final_msg, "stop_reason", None),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": cost_usd,
            },
            ensure_ascii=False,
        ) + "\n"

    _CLIENT_QUERY_SYSTEM_BASE = (
        "Sos un asistente del CRM ATV. Respondé siempre en español. "
        "Sé claro y no inventes datos fuera del contexto provisto. "
        "La respuesta tiene que leerse como mensaje de chat entre colegas: mayormente párrafos con ritmo variable "
        "(unos más cortos, otros más largos), conectores naturales y matices; no como informe exportado a bullets. "
        "Evitá como plantilla fija: cronología numerada (1., 2., 3…) con subtítulo por fecha o reunión y debajo "
        "solo líneas que empiezan en '-' o '•'; secciones finales tipo «Puntos clave» o «A monitorear» rellenas "
        "casi solo de guiones; repetir muchas veces el patrón título + lista. "
        "Las listas con guiones o números son excepción y breves; usalas solo si el usuario pidió esquema o si "
        "un puñado de ítems aporta más que un párrafo. "
        "No uses # ni ##; **negrita** con moderación. Sin líneas decorativas (---, ***, ===, ___). "
        "No cerrés con agradecimientos, saludos o apodos hacia quien consulta (p. ej. «Gracias capitán») salvo que el usuario lo pida."
    )

    _CLIENT_QUERY_SYSTEM_AREA: dict[str, str] = {
        "venta": (
            "Actuás como alguien del área de VENTAS de ATV: priorizá oportunidades comerciales, "
            "seguimiento de pipeline, objeciones, próximos pasos de cierre y upsell cuando el contexto lo permita. "
            "Integrá ideas de venta dentro del discurso (párrafos); no conviertas cada dato del contexto en una viñeta aparte."
        ),
        "cliente": (
            "Actuás como alguien del área de CLIENTE (éxito / operación): priorizá claridad sobre el estado del "
            "programa, alineación con lo acordado, riesgos operativos y próximos pasos para que el cliente avance. "
            "Contá la historia del caso en párrafos antes que en esquemas; equilibrá resumen y recomendaciones sin presión comercial explícita."
        ),
        "marketing": (
            "Actuás como alguien del área de MARKETING de ATV: priorizá mensaje, audiencia, posicionamiento y "
            "ideas de contenido o campaña solo cuando el contexto (notas, Discord, Fathom, onboarding) lo respalde. "
            "No inventes campañas ni métricas que no surgan del material provisto."
        ),
    }

    @classmethod
    def _default_full_instruction(cls, area: str) -> str:
        key = (area or "cliente").strip().lower()
        if key not in cls._CLIENT_QUERY_SYSTEM_AREA:
            key = "cliente"
        return f"{cls._CLIENT_QUERY_SYSTEM_BASE} {cls._CLIENT_QUERY_SYSTEM_AREA[key]}".strip()

    def _effective_area_system_instruction(self, area: str) -> str:
        key = (area or "cliente").strip().lower()
        if key not in ("venta", "cliente", "marketing"):
            key = "cliente"
        with db_session:
            row = ClaudeAreaSystemPrompt.get(area=key)
            if row and (row.instruction or "").strip():
                return (row.instruction or "").strip()
        return self._default_full_instruction(key)

    def get_client_query_system_instruction(self, area: str = "cliente") -> str:
        return self._effective_area_system_instruction(area)

    def list_area_system_prompts(self) -> ClaudeAreaPromptsResponse:
        order = ("venta", "cliente", "marketing")
        items = [
            ClaudeAreaPromptItem(area=a, instruction=self._effective_area_system_instruction(a)) for a in order
        ]
        return ClaudeAreaPromptsResponse(items=items)

    def update_area_system_prompts(self, body: ClaudeAreaPromptsUpdateRequest) -> ClaudeAreaPromptsResponse:
        allowed = {"venta", "cliente", "marketing"}
        with db_session:
            for item in body.items:
                if item.area not in allowed:
                    raise HTTPException(status_code=400, detail=f"Área no válida: {item.area}")
                text = item.instruction.strip()
                if not text:
                    raise HTTPException(status_code=400, detail="La instrucción no puede estar vacía.")
                row = ClaudeAreaSystemPrompt.get(area=item.area)
                if row:
                    row.instruction = text
                else:
                    ClaudeAreaSystemPrompt(area=item.area, instruction=text)
        return self.list_area_system_prompts()

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
