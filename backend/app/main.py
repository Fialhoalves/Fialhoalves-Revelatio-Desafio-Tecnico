from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import ErrorResponse, register_error_handlers
from app.core.logging import setup_logging
from app.core.middleware import register_middlewares
from app.routers import attachments, auth, health, tasks, users

setup_logging()
settings = get_settings()

app = FastAPI(
    title="Task Manager API",
    description="Mini gerenciador de tarefas com anexos, autenticação JWT e controle de acesso por perfil.",
    version="1.0.0",
    responses={
        401: {"model": ErrorResponse, "description": "Não autenticado ou sessão inválida"},
        403: {"model": ErrorResponse, "description": "Sem permissão"},
        404: {"model": ErrorResponse, "description": "Recurso não encontrado"},
        422: {"model": ErrorResponse, "description": "Erro de validação"},
    },
)

register_error_handlers(app)
register_middlewares(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(attachments.router)
