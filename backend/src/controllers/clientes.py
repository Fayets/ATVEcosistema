from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from src.schemas import ClienteCreate, ClienteResponse, ClienteUpdate
from src.services.clientes import (
    create_cliente as create_cliente_service,
    delete_cliente as delete_cliente_service,
    get_cliente_by_id as get_cliente_by_id_service,
    list_clientes as list_clientes_service,
    update_cliente as update_cliente_service,
)

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.post("/", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
def create_cliente(body: ClienteCreate) -> ClienteResponse:
    return create_cliente_service(body)


@router.get("/", response_model=list[ClienteResponse])
def list_clientes(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[ClienteResponse]:
    return list_clientes_service(skip=skip, limit=limit)


@router.get("/{cliente_id}", response_model=ClienteResponse)
def get_cliente(cliente_id: UUID) -> ClienteResponse:
    try:
        return get_cliente_by_id_service(cliente_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener el cliente: {e}")


@router.put("/{cliente_id}", response_model=ClienteResponse)
def update_cliente(cliente_id: UUID, body: ClienteUpdate) -> ClienteResponse:
    try:
        return update_cliente_service(cliente_id, body)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al actualizar el cliente: {e}")


@router.delete("/{cliente_id}")
def delete_cliente(cliente_id: UUID) -> dict[str, str]:
    try:
        return delete_cliente_service(cliente_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al eliminar el cliente: {e}")
