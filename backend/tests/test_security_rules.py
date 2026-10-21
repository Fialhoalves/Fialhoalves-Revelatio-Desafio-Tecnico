"""Regra do projeto: autenticação e autorização vivem SOMENTE no backend.

Estes testes não dependem do front: batem direto na API, como faria alguém que
apaga o front e monta as requisições na mão.
"""

import pytest
from app.main import app

# Únicas rotas que podem ser acessadas sem token. Qualquer rota nova fora desta
# lista e sem autenticação faz o teste abaixo falhar.
PUBLIC_ROUTES = {
    ("POST", "/auth/register"),
    ("POST", "/auth/login"),
    ("GET", "/health"),
    ("GET", "/health/ready"),
}

HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


def _api_routes():
    """Lê as rotas do schema OpenAPI, que independe de como o FastAPI organiza os routers."""
    for path, operations in app.openapi()["paths"].items():
        for method in operations:
            if method in HTTP_METHODS:
                yield method.upper(), path


def test_route_discovery_is_not_empty():
    routes = set(_api_routes())
    assert len(routes) >= 15, "a descoberta de rotas falhou; o teste de autenticação estaria vazio"
    assert PUBLIC_ROUTES <= routes, "há rota pública na allowlist que não existe mais"


@pytest.mark.parametrize(("method", "path"), sorted(_api_routes()))
def test_every_route_requires_auth_unless_public(client, method, path):
    url = path.replace("{task_id}", "1").replace("{attachment_id}", "1")
    resp = client.request(method, url)
    if (method, path) in PUBLIC_ROUTES:
        assert resp.status_code != 401, f"{method} {path} deveria ser público"
    else:
        assert resp.status_code == 401, f"{method} {path} está acessível sem autenticação"


def test_forged_and_expired_tokens_are_rejected(client):
    import jwt

    forged = jwt.encode({"sub": "1"}, "outra-chave-qualquer-com-32-bytes-ou-mais!!", algorithm="HS256")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401

    expired = jwt.encode(
        {"sub": "1", "exp": 1}, "test-secret-key-with-at-least-32-bytes!!", algorithm="HS256"
    )
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_role_is_never_taken_from_the_client(client, alice):
    """Tentar se promover a admin pelo cadastro ou por header não funciona."""
    resp = client.post(
        "/auth/register",
        json={"name": "Eve", "email": "eve@example.com", "password": "senha12345", "role": "ADMIN"},
        headers={"X-Role": "ADMIN"},
    )
    assert resp.json()["role"] == "USER"
    assert client.get("/users", headers=alice).status_code == 403
