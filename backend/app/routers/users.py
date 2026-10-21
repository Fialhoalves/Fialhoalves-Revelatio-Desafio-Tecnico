from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import AdminUser, DbSession
from app.core.errors import error_responses
from app.models import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"], responses=error_responses(401, 403))


@router.get("", response_model=list[UserOut])
def list_users(db: DbSession, _admin: AdminUser):
    """Lista os usuários (apenas admin). Usado para filtrar tasks por dono."""
    return db.scalars(select(User).order_by(User.name)).all()
