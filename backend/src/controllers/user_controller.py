from fastapi import APIRouter, HTTPException, status

from src.schemas import UserCreate, UserResponse
from src.services.user_services import UserServices

router = APIRouter(prefix="/users", tags=["users"])
_service = UserServices()


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate) -> UserResponse:
    try:
        return _service.create_user(body)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al crear el usuario.",
        )
