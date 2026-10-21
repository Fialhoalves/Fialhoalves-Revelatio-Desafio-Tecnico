from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.core.middleware import register_middlewares
from app.routers import attachments, auth, health, tasks, users

setup_logging()
settings = get_settings()

DESCRIPTION = """
Mini gerenciador de tarefas com anexos, autenticação JWT e controle de acesso por perfil.

## Como testar

1. Clique em **Authorize** e informe o e-mail (campo `username`) e a senha de uma conta de demonstração, listadas no README do repositório.
   Também é possível chamar `POST /auth/login` e usar o `access_token` retornado.
2. Chame `GET /tasks` com filtros: `status`, `priority`, `q` (texto), `overdue`, `sort` e `order`.
3. Crie uma tarefa em `POST /tasks` e anexe arquivos em `POST /tasks/{task_id}/attachments`.
4. Compare os perfis: o usuário comum recebe `404` ao abrir a tarefa de outra pessoa e `403` em `GET /users`; o administrador enxerga tudo.

## Erros

Toda falha segue o formato `{"error": {"code", "message", "details"}}`, com códigos estáveis. O catálogo está em `docs/ERRORS.md` no repositório.
"""

app = FastAPI(
    title="Task Manager API",
    description=DESCRIPTION,
    version="1.0.0",
    swagger_ui_parameters={"persistAuthorization": True, "displayRequestDuration": True},
    openapi_tags=[
        {"name": "auth", "description": "Cadastro, login (JWT) e dados do usuário autenticado."},
        {"name": "users", "description": "Listagem de usuários. Restrito a administradores."},
        {"name": "tasks", "description": "Tarefas. Usuário comum acessa só as próprias; administrador acessa todas."},
        {"name": "attachments", "description": "Anexos das tarefas, com validação de tipo, conteúdo e tamanho."},
        {"name": "health", "description": "Verificações de vida e prontidão para o deploy."},
    ],
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

_default_openapi = app.openapi


def openapi_with_file_inputs() -> dict:
    """O FastAPI descreve arquivos como `contentMediaType`, que o Swagger UI não transforma em seletor
    de arquivo dentro de listas. Marcar o campo como `binary` faz o Swagger mostrar o botão de upload."""
    schema = _default_openapi()
    for body in schema.get("components", {}).get("schemas", {}).values():
        for prop in body.get("properties", {}).values():
            for node in (prop, prop.get("items", {})):
                if node.get("contentMediaType") == "application/octet-stream":
                    node["format"] = "binary"
    return schema


app.openapi = openapi_with_file_inputs


@app.get("/", include_in_schema=False)
def root():
    """A raiz leva à documentação interativa."""
    return RedirectResponse("/docs")


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(attachments.router)
