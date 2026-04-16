from uuid import UUID

from fastapi import HTTPException
from pony.orm import db_session

from src.models import Cliente, FathomTranscript
from src.schemas import FathomTranscriptCreate, FathomTranscriptResponse, FathomTranscriptUpdate


def _to_fathom_response(row: FathomTranscript) -> FathomTranscriptResponse:
    return FathomTranscriptResponse(
        id=row.id,
        cliente_id=row.cliente.id,
        titulo=row.titulo,
        external_id=row.external_id,
        recording_url=row.recording_url,
        contenido=row.contenido,
        occurred_at=row.occurred_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _get_cliente_or_404(cliente_id: UUID) -> Cliente:
    cliente = Cliente.get(id=cliente_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    return cliente


def _get_transcript_for_cliente_or_404(cliente_id: UUID, transcript_id: UUID) -> FathomTranscript:
    _get_cliente_or_404(cliente_id)
    row = FathomTranscript.get(id=transcript_id)
    if row is None or row.cliente.id != cliente_id:
        raise HTTPException(status_code=404, detail="Transcript Fathom no encontrado.")
    return row


@db_session
def create_fathom_transcript(cliente_id: UUID, data: FathomTranscriptCreate) -> FathomTranscriptResponse:
    cliente = _get_cliente_or_404(cliente_id)
    row = FathomTranscript(
        cliente=cliente,
        titulo=data.titulo.strip(),
        external_id=data.external_id.strip() if data.external_id else None,
        recording_url=data.recording_url.strip() if data.recording_url else None,
        contenido=data.contenido if data.contenido else None,
        occurred_at=data.occurred_at,
    )
    return _to_fathom_response(row)


@db_session
def get_fathom_transcript(cliente_id: UUID, transcript_id: UUID) -> FathomTranscriptResponse:
    row = _get_transcript_for_cliente_or_404(cliente_id, transcript_id)
    return _to_fathom_response(row)


@db_session
def list_fathom_transcripts(cliente_id: UUID, skip: int = 0, limit: int = 50) -> list[FathomTranscriptResponse]:
    if skip < 0:
        raise HTTPException(status_code=400, detail="El parámetro skip no puede ser negativo.")
    if limit <= 0:
        raise HTTPException(status_code=400, detail="El parámetro limit debe ser mayor a cero.")
    if limit > 200:
        raise HTTPException(status_code=400, detail="El parámetro limit no puede superar 200.")

    cliente = _get_cliente_or_404(cliente_id)
    # Usar la relación Set en lugar de select(lambda …): en Python 3.13 el filtro por FK
    # a veces devuelve resultados vacíos aunque existan filas en BD.
    rows = sorted(cliente.fathom_transcripts, key=lambda t: t.created_at, reverse=True)
    if skip > 0:
        rows = rows[skip:]
    rows = rows[:limit]
    return [_to_fathom_response(t) for t in rows]


@db_session
def update_fathom_transcript(
    cliente_id: UUID, transcript_id: UUID, data: FathomTranscriptUpdate
) -> FathomTranscriptResponse:
    row = _get_transcript_for_cliente_or_404(cliente_id, transcript_id)
    patch = data.model_dump(exclude_unset=True)
    if not patch:
        return _to_fathom_response(row)

    if "titulo" in patch and patch["titulo"] is not None:
        row.titulo = patch["titulo"].strip()
    if "external_id" in patch:
        v = patch["external_id"]
        row.external_id = v.strip() if isinstance(v, str) and v.strip() else None
    if "recording_url" in patch:
        v = patch["recording_url"]
        row.recording_url = v.strip() if isinstance(v, str) and v.strip() else None
    if "contenido" in patch:
        v = patch["contenido"]
        row.contenido = v if v else None
    if "occurred_at" in patch:
        row.occurred_at = patch["occurred_at"]

    return _to_fathom_response(row)


@db_session
def delete_fathom_transcript(cliente_id: UUID, transcript_id: UUID) -> dict[str, str]:
    row = _get_transcript_for_cliente_or_404(cliente_id, transcript_id)
    row.delete()
    return {"message": "Transcript Fathom eliminado correctamente."}
