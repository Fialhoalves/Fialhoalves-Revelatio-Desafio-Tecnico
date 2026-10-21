import os

# Precisa vir antes de importar a app: o engine lê a URL na importação.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-with-at-least-32-bytes!!"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Role, User
from app.storage import get_storage
from app.storage.local import LocalStorage


@pytest.fixture
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def storage(tmp_path):
    return LocalStorage(str(tmp_path / "uploads"), get_settings().max_upload_bytes)


@pytest.fixture
def client(db_session, storage):
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_storage] = lambda: storage
    yield TestClient(app)
    app.dependency_overrides.clear()


def _make_user(db, email, role=Role.USER, password="senha12345"):
    user = User(name=email.split("@")[0], email=email, password_hash=hash_password(password), role=role)
    db.add(user)
    db.commit()
    return user


def _auth_header(client, email, password="senha12345"):
    resp = client.post("/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def alice(client, db_session):
    _make_user(db_session, "alice@example.com")
    return _auth_header(client, "alice@example.com")


@pytest.fixture
def bob(client, db_session):
    _make_user(db_session, "bob@example.com")
    return _auth_header(client, "bob@example.com")


@pytest.fixture
def admin(client, db_session):
    _make_user(db_session, "admin@example.com", Role.ADMIN)
    return _auth_header(client, "admin@example.com")
