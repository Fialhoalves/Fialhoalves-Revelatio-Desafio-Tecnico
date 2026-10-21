import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.core.deps import DbSession
from app.core.errors import DatabaseUnavailable, error_responses

router = APIRouter(prefix="/health", tags=["health"], responses=error_responses(503))
logger = logging.getLogger("app.health")


@router.get("", summary="Verificação de vida")
def liveness():
    """O processo está de pé. Não consulta dependências."""
    return {"status": "ok"}


@router.get("/ready", summary="Verificação de prontidão (inclui o banco)")
def readiness(db: DbSession):
    """A API consegue atender requisições: confirma a conexão com o banco."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Banco indisponível no health check")
        raise DatabaseUnavailable()
    return {"status": "ok", "database": "ok"}
