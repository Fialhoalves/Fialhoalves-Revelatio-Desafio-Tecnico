def test_register_and_login(client):
    resp = client.post("/auth/register", json={"name": "Ana", "email": "ana@example.com", "password": "senha12345"})
    assert resp.status_code == 201
    assert resp.json()["role"] == "USER"

    login = client.post("/auth/login", data={"username": "ana@example.com", "password": "senha12345"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "ana@example.com"


def test_register_duplicate_email(client):
    body = {"name": "Ana", "email": "ana@example.com", "password": "senha12345"}
    assert client.post("/auth/register", json=body).status_code == 201
    assert client.post("/auth/register", json=body).status_code == 409


def test_login_wrong_password(client):
    client.post("/auth/register", json={"name": "Ana", "email": "ana@example.com", "password": "senha12345"})
    resp = client.post("/auth/login", data={"username": "ana@example.com", "password": "errada123"})
    assert resp.status_code == 401


def test_requires_valid_token(client):
    assert client.get("/tasks").status_code == 401
    assert client.get("/tasks", headers={"Authorization": "Bearer lixo"}).status_code == 401


def test_users_list_is_admin_only(client, alice, admin):
    assert client.get("/users", headers=alice).status_code == 403
    assert client.get("/users", headers=admin).status_code == 200
