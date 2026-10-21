import logging
import time
import uuid

from fastapi import FastAPI, Request

logger = logging.getLogger("app.access")


def register_middlewares(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000
            level = logging.DEBUG if request.url.path.startswith("/health") else logging.INFO
            if status_code >= 500:
                level = logging.ERROR
            logger.log(
                level, "%s %s %s %.1fms rid=%s", request.method, request.url.path, status_code, elapsed_ms, request_id
            )

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.url.path.startswith("/attachments/"):
            # Arquivos enviados por usuários nunca executam scripts no navegador.
            response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
        return response
