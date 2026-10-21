def _task(client, headers):
    return client.post("/tasks", json={"title": "com anexo"}, headers=headers).json()["id"]


def _upload(client, headers, task_id, name="nota.txt", content=b"ola", ctype="text/plain"):
    return client.post(
        f"/tasks/{task_id}/attachments", files=[("files", (name, content, ctype))], headers=headers
    )


def test_upload_list_download_delete(client, alice, tmp_path):
    task_id = _task(client, alice)
    resp = _upload(client, alice, task_id)
    assert resp.status_code == 201
    att = resp.json()[0]
    assert att["original_name"] == "nota.txt" and att["size"] == 3

    assert len(client.get(f"/tasks/{task_id}/attachments", headers=alice).json()) == 1
    assert client.get(f"/tasks/{task_id}", headers=alice).json()["attachments"][0]["id"] == att["id"]

    dl = client.get(f"/attachments/{att['id']}/download", headers=alice)
    assert dl.status_code == 200 and dl.content == b"ola"

    assert client.delete(f"/attachments/{att['id']}", headers=alice).status_code == 204
    assert client.get(f"/attachments/{att['id']}/download", headers=alice).status_code == 404
    assert list((tmp_path / "uploads").iterdir()) == []


def test_rejects_disallowed_type(client, alice):
    task_id = _task(client, alice)
    resp = _upload(client, alice, task_id, "virus.exe", b"MZ", "application/x-msdownload")
    assert resp.status_code == 415


def test_rejects_oversized_file(client, alice, storage):
    task_id = _task(client, alice)
    storage.max_bytes = 2
    resp = _upload(client, alice, task_id, content=b"abcdef")
    assert resp.status_code == 413


def test_attachment_access_follows_task_owner(client, alice, bob, admin):
    task_id = _task(client, alice)
    att_id = _upload(client, alice, task_id).json()[0]["id"]

    assert client.get(f"/attachments/{att_id}/download", headers=bob).status_code == 404
    assert client.delete(f"/attachments/{att_id}", headers=bob).status_code == 404
    assert _upload(client, bob, task_id).status_code == 404
    assert client.get(f"/attachments/{att_id}/download", headers=admin).status_code == 200


def test_deleting_task_removes_files(client, alice, tmp_path):
    task_id = _task(client, alice)
    _upload(client, alice, task_id)
    assert len(list((tmp_path / "uploads").iterdir())) == 1
    client.delete(f"/tasks/{task_id}", headers=alice)
    assert list((tmp_path / "uploads").iterdir()) == []
