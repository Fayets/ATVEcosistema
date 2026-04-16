from uuid import UUID

from fastapi import HTTPException
from pony.orm import db_session

from src.models import Cliente
from src.schemas import ClienteCreate, ClienteResponse, ClienteUpdate


def _to_cliente_response(cliente: Cliente) -> ClienteResponse:
    return ClienteResponse(
        id=cliente.id,
        codigo_publico=cliente.codigo_publico,
        nombre=cliente.nombre,
        apellido=cliente.apellido,
        telefono=cliente.telefono,
        instagram=cliente.instagram,
        programa=cliente.programa,
        estado=cliente.estado,
        notas=cliente.notas,
        created_at=cliente.created_at,
        updated_at=cliente.updated_at,
    )


@db_session
def create_cliente(data: ClienteCreate) -> ClienteResponse:
    # `Cliente.select().max(attr)` no es la API de Pony 0.7; materializamos y calculamos en Python.
    existentes = Cliente.select()._actual_fetch()
    next_codigo = max((c.codigo_publico for c in existentes), default=0) + 1
    cliente = Cliente(
        codigo_publico=next_codigo,
        nombre=data.nombre.strip(),
        apellido=data.apellido.strip() if data.apellido else None,
        telefono=data.telefono.strip() if data.telefono else None,
        instagram=data.instagram.strip() if data.instagram else None,
        programa=data.programa.strip().lower() if data.programa else "boost",
        estado=data.estado.strip() if data.estado else "activo",
        notas=data.notas.strip() if data.notas else None,
    )
    return _to_cliente_response(cliente)


@db_session
def get_cliente_by_id(cliente_id: UUID) -> ClienteResponse:
    cliente = Cliente.get(id=cliente_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    return _to_cliente_response(cliente)


@db_session
def list_clientes(skip: int = 0, limit: int = 50) -> list[ClienteResponse]:
    if skip < 0:
        raise HTTPException(status_code=400, detail="El parámetro skip no puede ser negativo.")
    if limit <= 0:
        raise HTTPException(status_code=400, detail="El parámetro limit debe ser mayor a cero.")
    if limit > 200:
        raise HTTPException(status_code=400, detail="El parámetro limit no puede superar 200.")

    clientes = Cliente.select().order_by(Cliente.created_at)._actual_fetch(limit=limit, offset=skip)
    return [_to_cliente_response(cliente) for cliente in clientes]


@db_session
def update_cliente(cliente_id: UUID, data: ClienteUpdate) -> ClienteResponse:
    cliente = Cliente.get(id=cliente_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    patch = data.model_dump(exclude_unset=True)
    if not patch:
        return _to_cliente_response(cliente)

    for field in ("nombre", "apellido", "telefono", "instagram", "programa", "estado", "notas"):
        if field in patch:
            value = patch[field]
            if isinstance(value, str):
                value = value.strip() or None
            if field == "nombre" and value is None:
                raise HTTPException(status_code=400, detail="El nombre no puede quedar vacío.")
            if field == "programa" and value is None:
                raise HTTPException(status_code=400, detail="El programa no puede quedar vacío.")
            setattr(cliente, field, value)

    if cliente.estado is None:
        cliente.estado = "activo"
    if cliente.programa is None:
        cliente.programa = "boost"

    return _to_cliente_response(cliente)


@db_session
def delete_cliente(cliente_id: UUID) -> dict[str, str]:
    cliente = Cliente.get(id=cliente_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    cliente.delete()
    return {"message": "Cliente eliminado correctamente."}
