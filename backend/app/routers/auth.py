from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession
from app.core.errors import EmailAlreadyRegistered, InvalidCredentials, error_responses
from app.core.rate_limit import login_limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Role, User
from app.schemas.user import Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"], responses=error_responses(401, 409, 429))


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: DbSession):
    """Cria um usuário comum. Administradores são criados apenas pelo seed."""
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise EmailAlreadyRegistered()
    user = User(name=data.name, email=email, password_hash=hash_password(data.password), role=Role.USER)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(request: Request, form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession):
    """Login com e-mail (campo `username`) e senha. Retorna um JWT.

    Após várias falhas seguidas para o mesmo IP e e-mail, responde 429 por um período.
    """
    email = form.username.lower()
    key = f"{request.client.host if request.client else 'desconhecido'}:{email}"
    login_limiter.check(key)
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(form.password, user.password_hash):
        login_limiter.register_failure(key)
        raise InvalidCredentials()
    login_limiter.reset(key)
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
