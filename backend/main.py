from contextlib import asynccontextmanager

from decouple import config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.controllers.auth_controller import router as auth_router
from src.controllers.health_controller import router as health_router
from src.controllers.hiring_controller import router as hiring_router
from src.db import init_db


def _cors_origins() -> list[str]:
    raw = config("CORS_ORIGINS", default="http://localhost:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="ATV Ecosystem API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(hiring_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "ATV Ecosystem API"}
