import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

from src.schemas import (
    ClaudeAreaPromptsResponse,
    ClaudeAreaPromptsUpdateRequest,
    ClaudeBalanceResponse,
    ClaudeBalanceUpdateRequest,
    ClaudeClientContextRequest,
    ClaudeClientQueryRequest,
    ClaudeGenerationResponse,
    ClaudeStatsResponse,
    ClaudeTestRequest,
)
from src.services.claude_services import ClaudeServices

router = APIRouter(prefix="/claude", tags=["claude"])
_service = ClaudeServices()


@router.post("/test", response_model=ClaudeGenerationResponse)
async def claude_test(body: ClaudeTestRequest) -> ClaudeGenerationResponse:
    try:
        return await _service.test_prompt(body)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al invocar Claude.",
        )


@router.post("/clients/summary", response_model=ClaudeGenerationResponse)
async def claude_client_summary(body: ClaudeClientContextRequest) -> ClaudeGenerationResponse:
    try:
        return await _service.client_summary(body)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al generar el resumen con Claude.",
        )


@router.post("/clients/insights", response_model=ClaudeGenerationResponse)
async def claude_client_insights(body: ClaudeClientContextRequest) -> ClaudeGenerationResponse:
    try:
        return await _service.client_insights(body)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al generar insights con Claude.",
        )


@router.post("/clients/query", response_model=ClaudeGenerationResponse)
async def claude_client_query(body: ClaudeClientQueryRequest) -> ClaudeGenerationResponse:
    try:
        return await _service.client_query(body)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception("claude_client_query falló: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al consultar Claude por cliente.",
        ) from e


@router.post("/clients/query/stream")
async def claude_client_query_stream(body: ClaudeClientQueryRequest) -> StreamingResponse:
    """
    Misma consulta que /clients/query pero con salida NDJSON en streaming (texto tipo chat).
    Líneas: {"type":"delta","text":"..."} y cierre {"type":"done", ...} o {"type":"error",...}.
    """

    async def ndjson_body():
        async for line in _service.iter_client_query_ndjson(body):
            yield line.encode("utf-8")

    return StreamingResponse(
        ndjson_body(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/area-prompts", response_model=ClaudeAreaPromptsResponse)
def claude_list_area_prompts() -> ClaudeAreaPromptsResponse:
    try:
        return _service.list_area_system_prompts()
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al listar instrucciones por área.",
        )


@router.put("/area-prompts", response_model=ClaudeAreaPromptsResponse)
def claude_update_area_prompts(body: ClaudeAreaPromptsUpdateRequest) -> ClaudeAreaPromptsResponse:
    try:
        return _service.update_area_system_prompts(body)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al guardar instrucciones por área.",
        )


@router.get("/clients/query/system-instruction")
def claude_client_query_system_instruction(
    area: Literal["venta", "cliente", "marketing"] = Query(
        default="cliente",
        description="Área ATV para previsualizar el mismo system prompt que usará /claude/clients/query.",
    ),
) -> dict[str, str]:
    try:
        return {"system_instruction": _service.get_client_query_system_instruction(area)}
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al obtener la instrucción del sistema de Claude.",
        )


@router.get("/stats", response_model=ClaudeStatsResponse)
def claude_stats(days: int = Query(default=14, ge=1, le=90)) -> ClaudeStatsResponse:
    try:
        return _service.get_stats(days=days)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener estadísticas Claude: {e}")


@router.get("/balance", response_model=ClaudeBalanceResponse)
def claude_balance() -> ClaudeBalanceResponse:
    try:
        return _service.get_balance()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener saldo Claude: {e}")


@router.post("/balance/reset", response_model=ClaudeBalanceResponse)
def claude_balance_reset(body: ClaudeBalanceUpdateRequest) -> ClaudeBalanceResponse:
    try:
        return _service.reset_balance(body)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al actualizar saldo Claude: {e}")
