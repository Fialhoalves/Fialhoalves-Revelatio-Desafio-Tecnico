import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.db.session import get_db
from app.main import app


def test_liveness(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_readiness_ok(client):
    resp = client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json()["database"] == "ok"


def test_readiness_reports_database_failure(client):
    class BrokenSession:
        def execute(self, *_a, **_k):
            raise RuntimeError("sem conexão")

    app.dependency_overrides[get_db] = lambda: BrokenSession()
    resp = client.get("/health/ready")
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "DB_UNAVAILABLE"
    assert "sem conexão" not in resp.text


@pytest.mark.parametrize("secret", ["dev-only-change-me", "dev-only-change-me-dev-only-change-me", "curta"])
def test_production_rejects_weak_secret(secret):
    with pytest.raises(ValidationError):
        Settings(environment="production", secret_key=secret)


def test_production_accepts_strong_secret():
    assert Settings(environment="production", secret_key="x" * 48).environment == "production"


def test_development_allows_default_secret():
    Settings(environment="development")
