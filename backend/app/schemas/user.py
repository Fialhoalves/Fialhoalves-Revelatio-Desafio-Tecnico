from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import Role


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: Role
    created_at: datetime


class UserSummary(BaseModel):
    """Versão reduzida do usuário, embutida nas tasks (mostra o dono para o admin)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
