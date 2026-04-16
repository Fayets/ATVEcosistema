from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from src.schemas import FathomTranscriptCreate, FathomTranscriptResponse, FathomTranscriptUpdate
from src.services.fathom_services import (
    create_fathom_transcript as create_fathom_transcript_service,
    delete_fathom_transcript as delete_fathom_transcript_service,
    get_fathom_transcript as get_fathom_transcript_service,
    list_fathom_transcripts as list_fathom_transcripts_service,
    update_fathom_transcript as update_fathom_transcript_service,
)

router = APIRouter(prefix="/fathom", tags=["fathom"])


@router.post(
    "/clientes/{cliente_id}/transcripts/",
    response_model=FathomTranscriptResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_fathom_transcript(cliente_id: UUID, body: FathomTranscriptCreate) -> FathomTranscriptResponse:
    try:
        return create_fathom_transcript_service(cliente_id, body)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al crear el transcript Fathom: {e}",
        )


@router.get("/clientes/{cliente_id}/transcripts/", response_model=list[FathomTranscriptResponse])
def list_fathom_transcripts(
    cliente_id: UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[FathomTranscriptResponse]:
    try:
        return list_fathom_transcripts_service(cliente_id, skip=skip, limit=limit)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al listar transcripts Fathom: {e}",
        )


@router.get(
    "/clientes/{cliente_id}/transcripts/{transcript_id}",
    response_model=FathomTranscriptResponse,
)
def get_fathom_transcript(cliente_id: UUID, transcript_id: UUID) -> FathomTranscriptResponse:
    try:
        return get_fathom_transcript_service(cliente_id, transcript_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al obtener el transcript Fathom: {e}",
        )


@router.put(
    "/clientes/{cliente_id}/transcripts/{transcript_id}",
    response_model=FathomTranscriptResponse,
)
def update_fathom_transcript(
    cliente_id: UUID, transcript_id: UUID, body: FathomTranscriptUpdate
) -> FathomTranscriptResponse:
    try:
        return update_fathom_transcript_service(cliente_id, transcript_id, body)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al actualizar el transcript Fathom: {e}",
        )


@router.delete("/clientes/{cliente_id}/transcripts/{transcript_id}")
def delete_fathom_transcript(cliente_id: UUID, transcript_id: UUID) -> dict[str, str]:
    try:
        return delete_fathom_transcript_service(cliente_id, transcript_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al eliminar el transcript Fathom: {e}",
        )
