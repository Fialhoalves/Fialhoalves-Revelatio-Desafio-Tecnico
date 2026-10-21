from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://taskmanager:taskmanager@localhost:5432/taskmanager"
    secret_key: str = "dev-only-change-me"
    access_token_expire_minutes: int = 60

    # Origens permitidas no CORS, separadas por vírgula (ex.: URL da Vercel).
    cors_origins: str = "http://localhost:5173"

    upload_dir: str = "uploads"
    max_upload_mb: int = 10
    allowed_content_types: tuple[str, ...] = (
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    # Usuários criados pelo seed (app/seed.py).
    admin_name: str = "Administrador"
    admin_email: str = "admin@example.com"
    admin_password: str = "admin12345"
    demo_user_email: str = "user@example.com"
    demo_user_password: str = "user12345"

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # O Railway expõe "postgresql://..." ou "postgres://...": força o driver psycopg 3.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
