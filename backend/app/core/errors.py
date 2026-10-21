"""Contrato de erros da API.

Toda resposta de erro tem o formato:

    {"error": {"code": "TASK_NOT_FOUND", "message": "...", "details": [...]}}

- `code`: identificador estável e específico. O front decide o que mostrar a partir dele.
- `message`: texto amigável em português, usado como padrão se o front não tiver
  uma mensagem própria para o código.
- `details`: opcional; lista de problemas por campo nos erros de validação.

O catálogo completo está em docs/ERRORS.md.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.errors")


class AppError(Exception):
    status_code = 400
    code = "BAD_REQUEST"
    message = "Não foi possível concluir a ação."

    def __init__(self, message: str | None = None, *, headers: dict[str, str] | None = None):
        super().__init__(message or self.message)
        self.message = message or self.message
        self.headers = headers


# --- Autenticação / autorização -------------------------------------------------
class AuthRequired(AppError):
    status_code = 401
    code = "AUTH_REQUIRED"
    message = "Faça login para continuar."


class InvalidToken(AppError):
    status_code = 401
    code = "AUTH_TOKEN_INVALID"
    message = "Sua sessão expirou ou é inválida. Entre novamente."


class InvalidCredentials(AppError):
    status_code = 401
    code = "AUTH_INVALID_CREDENTIALS"
    message = "E-mail ou senha incorretos."


class PermissionDenied(AppError):
    status_code = 403
    code = "PERMISSION_DENIED"
    message = "Você não tem permissão para realizar esta ação."


class TooManyAttempts(AppError):
    status_code = 429
    code = "RATE_LIMITED"
    message = "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."

    def __init__(self, retry_after: int):
        super().__init__(headers={"Retry-After": str(retry_after)})
        self.retry_after = retry_after


# --- Recursos --------------------------------------------------------------------
class EmailAlreadyRegistered(AppError):
    status_code = 409
    code = "EMAIL_ALREADY_REGISTERED"
    message = "Já existe uma conta com este e-mail."


class TaskNotFound(AppError):
    status_code = 404
    code = "TASK_NOT_FOUND"
    message = "Tarefa não encontrada."


class AttachmentNotFound(AppError):
    status_code = 404
    code = "ATTACHMENT_NOT_FOUND"
    message = "Anexo não encontrado."


class AttachmentFileMissing(AppError):
    status_code = 404
    code = "ATTACHMENT_FILE_MISSING"
    message = "O arquivo deste anexo não está mais disponível."


# --- Upload ----------------------------------------------------------------------
class FileTypeNotAllowed(AppError):
    status_code = 415
    code = "FILE_TYPE_NOT_ALLOWED"
    message = "Este tipo de arquivo não é permitido."


class FileContentMismatch(AppError):
    status_code = 415
    code = "FILE_CONTENT_MISMATCH"
    message = "O conteúdo do arquivo não corresponde ao tipo informado."


class FileTooLarge(AppError):
    status_code = 413
    code = "FILE_TOO_LARGE"
    message = "O arquivo é maior que o limite permitido."


# --- Disponibilidade -------------------------------------------------------------
class DatabaseUnavailable(AppError):
    status_code = 503
    code = "DB_UNAVAILABLE"
    message = "Serviço temporariamente indisponível. Tente novamente em instantes."


# --- Tratamento global -----------------------------------------------------------
class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[dict[str, Any]] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


def _response(
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=code, message=message, details=details))
    return JSONResponse(
        status_code=status_code, content=body.model_dump(exclude_none=True), headers=headers
    )


_VALIDATION_MESSAGES = {
    "missing": "Campo obrigatório.",
    "string_too_short": "Texto curto demais.",
    "string_too_long": "Texto longo demais.",
    "value_error": "Valor inválido.",
    "date_from_datetime_parsing": "Data inválida.",
    "date_parsing": "Data inválida.",
    "enum": "Valor não permitido.",
    "int_parsing": "Número inválido.",
}

_HTTP_FALLBACKS = {
    401: ("AUTH_REQUIRED", AuthRequired.message),
    403: ("PERMISSION_DENIED", PermissionDenied.message),
    404: ("NOT_FOUND", "Recurso não encontrado."),
    405: ("METHOD_NOT_ALLOWED", "Operação não permitida neste endereço."),
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError):
        headers = exc.headers
        if exc.status_code == 401 and headers is None:
            headers = {"WWW-Authenticate": "Bearer"}
        return _response(exc.status_code, exc.code, exc.message, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, exc: RequestValidationError):
        details = [
            {
                "field": ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path")),
                "type": err["type"],
                "message": _VALIDATION_MESSAGES.get(err["type"], "Valor inválido."),
            }
            for err in exc.errors()
        ]
        return _response(422, "VALIDATION_ERROR", "Confira os campos informados.", details)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(_: Request, exc: StarletteHTTPException):
        # Cobre erros do próprio framework (rota inexistente, método errado, OAuth2 sem token).
        code, message = _HTTP_FALLBACKS.get(exc.status_code, ("HTTP_ERROR", "Não foi possível concluir a ação."))
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return _response(exc.status_code, code, message, headers=headers)

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        logger.exception("Erro não tratado em %s %s", request.method, request.url.path)
        return _response(500, "INTERNAL_ERROR", "Algo deu errado do nosso lado. Tente novamente em instantes.")
