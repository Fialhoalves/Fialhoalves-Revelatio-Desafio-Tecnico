import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.models import AttachmentBlob
from app.storage.database import DatabaseStorage
from app.storage.local import LocalStorage


@pytest.fixture(params=["local", "database"])
def storage(request, tmp_path, db_engine):
    """Todos os testes deste módulo rodam nos dois backends de armazenamento."""
    max_bytes = get_settings().max_upload_bytes
    if request.param == "local":
        return LocalStorage(str(tmp_path / "uploads"), max_bytes)
    return DatabaseStorage(sessionmaker(bind=db_engine), max_bytes)


def stored_count(storage, db_session) -> int:
    if isinstance(storage, LocalStorage):
        return len(list(storage.base_dir.iterdir()))
    return db_session.scalar(select(func.count()).select_from(AttachmentBlob)) or 0


def _task(client, headers):
    return client.post("/tasks", json={"title": "com anexo"}, headers=headers).json()["id"]


def _upload(client, headers, task_id, name="nota.txt", content=b"ola", ctype="text/plain"):
    return client.post(
        f"/tasks/{task_id}/attachments", files=[("files", (name, content, ctype))], headers=headers
    )


def test_upload_list_download_delete(client, alice, storage, db_session):
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
    assert stored_count(storage, db_session) == 0


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


def test_deleting_task_removes_files(client, alice, storage, db_session):
    task_id = _task(client, alice)
    _upload(client, alice, task_id)
    assert stored_count(storage, db_session) == 1
    client.delete(f"/tasks/{task_id}", headers=alice)
    assert stored_count(storage, db_session) == 0


def test_rejects_content_that_does_not_match_declared_type(client, alice):
    task_id = _task(client, alice)
    resp = _upload(client, alice, task_id, "foto.png", b"MZ\x90\x00 isto nao e uma imagem", "image/png")
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "FILE_CONTENT_MISMATCH"


def test_accepts_real_signatures(client, alice):
    task_id = _task(client, alice)
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
    pdf = b"%PDF-1.7\n" + b"x" * 16
    assert _upload(client, alice, task_id, "a.png", png, "image/png").status_code == 201
    assert _upload(client, alice, task_id, "a.pdf", pdf, "application/pdf").status_code == 201


def test_text_file_with_binary_content_is_rejected(client, alice):
    task_id = _task(client, alice)
    assert _upload(client, alice, task_id, "a.txt", b"abc\x00def", "text/plain").status_code == 415


def test_security_headers(client, alice):
    task_id = _task(client, alice)
    att_id = _upload(client, alice, task_id).json()[0]["id"]
    resp = client.get(f"/attachments/{att_id}/download?inline=true", headers=alice)
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in resp.headers["content-security-policy"]
    assert resp.headers["x-request-id"]


def test_download_keeps_unicode_filename(client, alice):
    task_id = _task(client, alice)
    att_id = _upload(client, alice, task_id, "relatório final.txt").json()[0]["id"]
    resp = client.get(f"/attachments/{att_id}/download", headers=alice)
    assert "filename*=UTF-8''relat%C3%B3rio%20final.txt" in resp.headers["content-disposition"]
    assert client.get(f"/attachments/{att_id}/download?inline=true", headers=alice).headers[
        "content-disposition"
    ].startswith("inline")


def test_failed_save_does_not_leave_blob_or_file(client, alice, storage, db_session):
    task_id = _task(client, alice)
    storage.max_bytes = 2
    assert _upload(client, alice, task_id, content=b"abcdef").status_code == 413
    assert stored_count(storage, db_session) == 0
