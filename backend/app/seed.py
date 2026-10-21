"""Cria o admin e um usuário de demonstração (idempotente). Uso: python -m app.seed

Com SEED_DEMO_DATA=true também cria tarefas e anexos de exemplo.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Role, User
from app.storage import get_storage


def _ensure_user(db: Session, name: str, email: str, password: str, role: Role) -> None:
    if db.scalar(select(User).where(User.email == email)) is None:
        db.add(User(name=name, email=email, password_hash=hash_password(password), role=role))
        print(f"Usuário criado: {email} ({role.value})")


def run() -> None:
    settings = get_settings()
    with SessionLocal() as db:
        _ensure_user(db, settings.admin_name, settings.admin_email, settings.admin_password, Role.ADMIN)
        _ensure_user(db, "Usuário Demo", settings.demo_user_email, settings.demo_user_password, Role.USER)
        db.commit()

        if settings.seed_demo_data:
            from app.demo_data import populate

            totals = populate(db, get_storage())
            print(
                f"Dados de demonstração: {totals['users']} usuários, "
                f"{totals['tasks']} tarefas e {totals['attachments']} anexos novos"
            )


if __name__ == "__main__":
    run()
