"""Cada erro tem status HTTP correto, `code` estável e mensagem em português."""

from fastapi.testclient import TestClient

from app.main import app


def _err(resp):
    body = resp.json()
    assert set(body) == {"error"}, body
    assert body["error"]["message"]
    return body["error"]


def test_auth_required_without_token(client):
    resp = client.get("/tasks")
    assert resp.status_code == 401
    assert _err(resp)["code"] == "AUTH_REQUIRED"
    assert resp.headers["www-authenticate"] == "Bearer"


def test_invalid_token(client):
    resp = client.get("/tasks", headers={"Authorization": "Bearer lixo"})
    assert resp.status_code == 401
    assert _err(resp)["code"] == "AUTH_TOKEN_INVALID"


def test_invalid_credentials(client):
    resp = client.post("/auth/login", data={"username": "ninguem@example.com", "password": "qualquer123"})
    assert resp.status_code == 401
    assert _err(resp)["code"] == "AUTH_INVALID_CREDENTIALS"


def test_wrong_password_and_unknown_email_look_the_same(client, alice):
    wrong = client.post("/auth/login", data={"username": "alice@example.com", "password": "errada12345"})
    unknown = client.post("/auth/login", data={"username": "x@example.com", "password": "errada12345"})
    assert wrong.json() == unknown.json()  # não revela se o e-mail existe


def test_permission_denied(client, alice):
    resp = client.get("/users", headers=alice)
    assert resp.status_code == 403
    assert _err(resp)["code"] == "PERMISSION_DENIED"


def test_email_already_registered(client):
    body = {"name": "Ana", "email": "ana@example.com", "password": "senha12345"}
    client.post("/auth/register", json=body)
    resp = client.post("/auth/register", json=body)
    assert resp.status_code == 409
    assert _err(resp)["code"] == "EMAIL_ALREADY_REGISTERED"


def test_task_not_found(client, alice):
    resp = client.get("/tasks/9999", headers=alice)
    assert resp.status_code == 404
    assert _err(resp)["code"] == "TASK_NOT_FOUND"


def test_other_users_task_looks_like_not_found(client, alice, bob):
    task_id = client.post("/tasks", json={"title": "x"}, headers=alice).json()["id"]
    resp = client.get(f"/tasks/{task_id}", headers=bob)
    assert resp.status_code == 404
    assert _err(resp)["code"] == "TASK_NOT_FOUND"


def test_attachment_not_found(client, alice):
    resp = client.get("/attachments/9999/download", headers=alice)
    assert resp.status_code == 404
    assert _err(resp)["code"] == "ATTACHMENT_NOT_FOUND"


def test_attachment_file_missing_from_storage(client, alice, tmp_path):
    task_id = client.post("/tasks", json={"title": "x"}, headers=alice).json()["id"]
    att = client.post(
        f"/tasks/{task_id}/attachments", files=[("files", ("a.txt", b"a", "text/plain"))], headers=alice
    ).json()[0]
    for f in (tmp_path / "uploads").iterdir():
        f.unlink()
    resp = client.get(f"/attachments/{att['id']}/download", headers=alice)
    assert resp.status_code == 404
    assert _err(resp)["code"] == "ATTACHMENT_FILE_MISSING"


def test_file_type_not_allowed(client, alice):
    task_id = client.post("/tasks", json={"title": "x"}, headers=alice).json()["id"]
    resp = client.post(
        f"/tasks/{task_id}/attachments",
        files=[("files", ("a.exe", b"MZ", "application/x-msdownload"))],
        headers=alice,
    )
    assert resp.status_code == 415
    assert _err(resp)["code"] == "FILE_TYPE_NOT_ALLOWED"


def test_file_content_mismatch(client, alice):
    task_id = client.post("/tasks", json={"title": "x"}, headers=alice).json()["id"]
    resp = client.post(
        f"/tasks/{task_id}/attachments", files=[("files", ("a.png", b"nao e png", "image/png"))], headers=alice
    )
    assert resp.status_code == 415
    assert _err(resp)["code"] == "FILE_CONTENT_MISMATCH"


def test_file_too_large(client, alice, storage):
    storage.max_bytes = 2
    task_id = client.post("/tasks", json={"title": "x"}, headers=alice).json()["id"]
    resp = client.post(
        f"/tasks/{task_id}/attachments", files=[("files", ("a.txt", b"abcdef", "text/plain"))], headers=alice
    )
    assert resp.status_code == 413
    assert _err(resp)["code"] == "FILE_TOO_LARGE"


def test_validation_error_lists_fields(client, alice):
    resp = client.post("/tasks", json={"title": "", "due_date": "ontem"}, headers=alice)
    assert resp.status_code == 422
    err = _err(resp)
    assert err["code"] == "VALIDATION_ERROR"
    assert {d["field"] for d in err["details"]} == {"title", "due_date"}
    assert all(d["message"] for d in err["details"])


def test_unknown_route_and_wrong_method(client):
    assert _err(client.get("/nao-existe"))["code"] == "NOT_FOUND"
    resp = client.delete("/health")
    assert resp.status_code == 405
    assert _err(resp)["code"] == "METHOD_NOT_ALLOWED"


def test_unexpected_error_is_hidden(client, monkeypatch):
    def boom(*_a, **_k):
        raise RuntimeError("segredo interno")

    monkeypatch.setattr("app.routers.tasks.task_service.create_task", boom)
    safe = TestClient(app, raise_server_exceptions=False)
    token = client.post("/auth/register", json={"name": "A", "email": "a@a.com", "password": "senha12345"})
    login = client.post("/auth/login", data={"username": "a@a.com", "password": "senha12345"}).json()
    resp = safe.post("/tasks", json={"title": "x"}, headers={"Authorization": f"Bearer {login['access_token']}"})
    assert resp.status_code == 500
    assert _err(resp)["code"] == "INTERNAL_ERROR"
    assert "segredo" not in resp.text
