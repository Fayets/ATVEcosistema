from fastapi import APIRouter, HTTPException, Query

from src.schemas import (
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
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al consultar Claude por cliente.",
        )


@router.get("/clients/query/system-instruction")
def claude_client_query_system_instruction() -> dict[str, str]:
    try:
        return {"system_instruction": _service.get_client_query_system_instruction()}
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
