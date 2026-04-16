import re
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from pony.orm import db_session

from src.models import Cliente, DiscordDocumento
from src.schemas import DiscordDocumentoAppend, DiscordDocumentoBlockEdit, DiscordDocumentoResponse

_MAX_DISCORD_DOC_CHARS = 2_000_000

_SEP_SPLIT = re.compile(r"\n\n--- \[[^\]]+\] ---\n\n")
_SEP_FIND_TS = re.compile(r"\n\n--- \[([^\]]+)\] ---\n\n")


def _parse_document_blocks(contenido: str) -> tuple[list[str], list[str]]:
    """Separa el documento en bloques y las marcas de tiempo entre bloques (mismo criterio que el front)."""
    if not contenido or not contenido.strip():
        return [], []
    blocks = _SEP_SPLIT.split(contenido)
    timestamps = _SEP_FIND_TS.findall(contenido)
    if len(blocks) > 0 and len(timestamps) != len(blocks) - 1:
        raise HTTPException(
            status_code=500,
            detail="El documento Discord tiene un formato de separadores inconsistente.",
        )
    return blocks, timestamps


def _join_document_blocks(blocks: list[str], timestamps: list[str]) -> str:
    if not blocks:
        return ""
    out = blocks[0]
    for i in range(1, len(blocks)):
        out += f"\n\n--- [{timestamps[i - 1]}] ---\n\n" + blocks[i]
    return out


def _delete_block(blocks: list[str], timestamps: list[str], i: int) -> tuple[list[str], list[str]]:
    n = len(blocks)
    new_blocks = blocks[:i] + blocks[i + 1 :]
    if not new_blocks:
        return [], []
    if i == 0:
        new_ts = timestamps[1:]
    elif i == n - 1:
        new_ts = timestamps[:-1]
    else:
        new_ts = timestamps[: i - 1] + timestamps[i :]
    return new_blocks, new_ts


def _to_discord_response(doc: DiscordDocumento) -> DiscordDocumentoResponse:
    return DiscordDocumentoResponse(
        id=doc.id,
        cliente_id=doc.cliente.id,
        contenido=doc.contenido or "",
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


def _get_cliente_or_404(cliente_id: UUID) -> Cliente:
    cliente = Cliente.get(id=cliente_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    return cliente


def _append_block(existing: str, texto: str) -> str:
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    if not existing or not existing.strip():
        return texto
    return existing.rstrip() + f"\n\n--- [{ts}] ---\n\n" + texto


@db_session
def get_or_create_discord_documento(cliente_id: UUID) -> DiscordDocumentoResponse:
    cliente = _get_cliente_or_404(cliente_id)
    doc = cliente.discord_documento
    if doc is None:
        doc = DiscordDocumento(cliente=cliente, contenido="")
    return _to_discord_response(doc)


@db_session
def append_discord_documento(cliente_id: UUID, data: DiscordDocumentoAppend) -> DiscordDocumentoResponse:
    cliente = _get_cliente_or_404(cliente_id)
    doc = cliente.discord_documento
    if doc is None:
        doc = DiscordDocumento(cliente=cliente, contenido="")

    nuevo = _append_block(doc.contenido or "", data.texto)
    if len(nuevo) > _MAX_DISCORD_DOC_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"El documento superaría el tamaño máximo permitido ({_MAX_DISCORD_DOC_CHARS} caracteres).",
        )
    doc.contenido = nuevo
    return _to_discord_response(doc)


@db_session
def update_discord_documento_block(cliente_id: UUID, block_index: int, data: DiscordDocumentoBlockEdit) -> DiscordDocumentoResponse:
    cliente = _get_cliente_or_404(cliente_id)
    doc = cliente.discord_documento
    if doc is None:
        raise HTTPException(status_code=404, detail="No hay documento Discord para este cliente.")

    blocks, timestamps = _parse_document_blocks(doc.contenido or "")
    if block_index < 0 or block_index >= len(blocks):
        raise HTTPException(status_code=404, detail="Bloque no encontrado.")

    blocks[block_index] = data.texto
    nuevo = _join_document_blocks(blocks, timestamps)
    if len(nuevo) > _MAX_DISCORD_DOC_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"El documento superaría el tamaño máximo permitido ({_MAX_DISCORD_DOC_CHARS} caracteres).",
        )
    doc.contenido = nuevo
    return _to_discord_response(doc)


@db_session
def delete_discord_documento_block(cliente_id: UUID, block_index: int) -> DiscordDocumentoResponse:
    cliente = _get_cliente_or_404(cliente_id)
    doc = cliente.discord_documento
    if doc is None:
        raise HTTPException(status_code=404, detail="No hay documento Discord para este cliente.")

    blocks, timestamps = _parse_document_blocks(doc.contenido or "")
    if block_index < 0 or block_index >= len(blocks):
        raise HTTPException(status_code=404, detail="Bloque no encontrado.")

    new_blocks, new_ts = _delete_block(blocks, timestamps, block_index)
    nuevo = _join_document_blocks(new_blocks, new_ts)
    if len(nuevo) > _MAX_DISCORD_DOC_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"El documento superaría el tamaño máximo permitido ({_MAX_DISCORD_DOC_CHARS} caracteres).",
        )
    doc.contenido = nuevo
    return _to_discord_response(doc)
