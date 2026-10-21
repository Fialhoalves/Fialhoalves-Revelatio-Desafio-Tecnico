def _create(client, headers, title="Estudar", **extra):
    resp = client.post("/tasks", json={"title": title, **extra}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_crud_and_complete(client, alice):
    task = _create(client, alice, description="FastAPI", due_date="2026-12-01")
    assert task["status"] == "PENDING"

    patched = client.patch(f"/tasks/{task['id']}", json={"title": "Novo título"}, headers=alice)
    assert patched.json()["title"] == "Novo título"
    assert patched.json()["description"] == "FastAPI"  # campos não enviados ficam intactos

    done = client.post(f"/tasks/{task['id']}/complete", headers=alice)
    assert done.json()["status"] == "DONE"

    assert client.delete(f"/tasks/{task['id']}", headers=alice).status_code == 204
    assert client.get(f"/tasks/{task['id']}", headers=alice).status_code == 404


def test_validation(client, alice):
    assert client.post("/tasks", json={"title": ""}, headers=alice).status_code == 422
    assert client.post("/tasks", json={"title": "x", "status": "NOPE"}, headers=alice).status_code == 422


def test_user_sees_only_own_tasks(client, alice, bob):
    _create(client, alice, "da alice")
    _create(client, bob, "do bob")

    items = client.get("/tasks", headers=alice).json()
    assert items["total"] == 1
    assert items["items"][0]["title"] == "da alice"


def test_user_cannot_touch_others_task(client, alice, bob):
    task = _create(client, alice)
    url = f"/tasks/{task['id']}"
    assert client.get(url, headers=bob).status_code == 404
    assert client.patch(url, json={"title": "hack"}, headers=bob).status_code == 404
    assert client.post(f"{url}/complete", headers=bob).status_code == 404
    assert client.delete(url, headers=bob).status_code == 404
    assert client.get(url, headers=alice).json()["title"] == task["title"]


def test_admin_sees_and_manages_everything(client, alice, bob, admin):
    a = _create(client, alice, "da alice")
    _create(client, bob, "do bob")

    listing = client.get("/tasks", headers=admin).json()
    assert listing["total"] == 2
    assert {t["owner"]["name"] for t in listing["items"]} == {"alice", "bob"}

    assert client.patch(f"/tasks/{a['id']}", json={"status": "IN_PROGRESS"}, headers=admin).status_code == 200
    assert client.delete(f"/tasks/{a['id']}", headers=admin).status_code == 204


def test_filters(client, alice):
    _create(client, alice, "comprar pão", status="DONE")
    _create(client, alice, "estudar python", description="fastapi")

    assert client.get("/tasks?status=DONE", headers=alice).json()["total"] == 1
    assert client.get("/tasks?q=fastapi", headers=alice).json()["total"] == 1
    assert client.get("/tasks?q=nada", headers=alice).json()["total"] == 0


def test_owner_id_in_payload_is_ignored(client, alice, bob):
    me_bob = client.get("/auth/me", headers=bob).json()["id"]
    task = _create(client, alice, owner_id=me_bob)
    assert task["owner"]["name"] == "alice"
