from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.controllers.auth_controller import router as auth_router
from src.controllers.claude_controller import router as claude_router
from src.controllers.clientes import router as clientes_router
from src.controllers.discord_controller import router as discord_router
from src.controllers.entregables_controller import router as entregables_router
from src.controllers.fathom_controller import router as fathom_router
from src.controllers.onboarding_controller import router as onboarding_router
from src.controllers.health_controller import router as health_router
from src.controllers.user_controller import router as user_router
from src.db import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="ATV API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router, tags=["health"])
app.include_router(auth_router)
app.include_router(claude_router)
app.include_router(clientes_router)
app.include_router(fathom_router)
app.include_router(discord_router)
app.include_router(entregables_router)
app.include_router(onboarding_router)
app.include_router(user_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "ATV backend"}
