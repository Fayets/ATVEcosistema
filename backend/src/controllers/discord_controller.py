from uuid import UUID

from fastapi import APIRouter, HTTPException, Path

from src.schemas import DiscordDocumentoAppend, DiscordDocumentoBlockEdit, DiscordDocumentoResponse
from src.services.discord_services import (
    append_discord_documento as append_discord_documento_service,
    delete_discord_documento_block as delete_discord_documento_block_service,
    get_or_create_discord_documento as get_or_create_discord_documento_service,
    update_discord_documento_block as update_discord_documento_block_service,
)

router = APIRouter(prefix="/discord", tags=["discord"])


@router.get("/clientes/{cliente_id}/documento/", response_model=DiscordDocumentoResponse)
def get_discord_documento(cliente_id: UUID) -> DiscordDocumentoResponse:
    try:
        return get_or_create_discord_documento_service(cliente_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al obtener el documento Discord: {e}",
        )


@router.post("/clientes/{cliente_id}/documento/append/", response_model=DiscordDocumentoResponse)
def append_discord_documento(cliente_id: UUID, body: DiscordDocumentoAppend) -> DiscordDocumentoResponse:
    try:
        return append_discord_documento_service(cliente_id, body)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al agregar contenido al documento Discord: {e}",
        )


@router.put(
    "/clientes/{cliente_id}/documento/blocks/{block_index}/",
    response_model=DiscordDocumentoResponse,
)
def update_discord_documento_block(
    cliente_id: UUID,
    payload: DiscordDocumentoBlockEdit,
    block_index: int = Path(..., ge=0, description="Índice del bloque (0 = primer bloque)."),
) -> DiscordDocumentoResponse:
    try:
        return update_discord_documento_block_service(cliente_id, block_index, payload)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al actualizar el bloque Discord: {e}",
        )


@router.delete(
    "/clientes/{cliente_id}/documento/blocks/{block_index}/",
    response_model=DiscordDocumentoResponse,
)
def delete_discord_documento_block(
    cliente_id: UUID,
    block_index: int = Path(..., ge=0, description="Índice del bloque a eliminar."),
) -> DiscordDocumentoResponse:
    try:
        return delete_discord_documento_block_service(cliente_id, block_index)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al eliminar el bloque Discord: {e}",
        )
