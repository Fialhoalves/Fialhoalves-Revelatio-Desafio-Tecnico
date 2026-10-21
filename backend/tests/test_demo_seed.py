import io
import xml.etree.ElementTree as ET
import zipfile
from datetime import date

from sqlalchemy import func, select

from app.demo_data import ASSETS, DEMO_USER_TASKS, EXTRA_USERS, populate
from app.models import Attachment, Task, TaskStatus, User
from app.services.attachments import delete_attachment
from app.storage.local import LocalStorage


def test_populate_covers_every_flow(db_session, storage):
    totals = populate(db_session, storage)

    assert totals["tasks"] > 0 and totals["attachments"] > 0
    tasks = db_session.scalars(select(Task)).all()

    assert {t.status for t in tasks} == set(TaskStatus), "todas as colunas do quadro têm tarefas"
    assert {t.priority.value for t in tasks} == {"LOW", "MEDIUM", "HIGH"}
    assert any(t.due_date and t.due_date < date.today() and t.status != TaskStatus.DONE for t in tasks), "há atrasadas"
    assert any(t.due_date is None for t in tasks), "há tarefa sem prazo"
    assert any(not t.attachments for t in tasks), "há tarefa sem anexo"
    assert len({t.owner_id for t in tasks}) >= 4, "tarefas de vários usuários, para o resumo do administrador"

    kinds = {a.content_type for a in db_session.scalars(select(Attachment)).all()}
    assert {"image/png", "application/pdf", "text/csv", "text/plain"} <= kinds
    assert any("wordprocessingml" in kind for kind in kinds), "há documento Word"
    assert any("spreadsheetml" in kind for kind in kinds), "há planilha Excel"


def test_populate_is_idempotent(db_session, storage):
    populate(db_session, storage)
    count = lambda model: db_session.scalar(select(func.count()).select_from(model))  # noqa: E731
    before = (count(Task), count(Attachment), count(User))

    again = populate(db_session, storage)

    assert again == {"users": 0, "tasks": 0, "attachments": 0}
    assert (count(Task), count(Attachment), count(User)) == before


def test_every_asset_is_stored_and_downloadable(client, db_session, storage, admin):
    populate(db_session, storage)
    attachments = db_session.scalars(select(Attachment)).all()
    assert isinstance(storage, LocalStorage)
    assert len(list(storage.base_dir.iterdir())) == len(attachments)

    by_type = {}
    for attachment in attachments:
        response = client.get(f"/attachments/{attachment.id}/download", headers=admin)
        assert response.status_code == 200, attachment.original_name
        by_type[attachment.content_type] = response.content
    assert by_type["image/png"].startswith(b"\x89PNG")
    assert by_type["application/pdf"].startswith(b"%PDF-")


def test_demo_accounts_can_log_in_and_see_only_their_tasks(client, db_session, storage):
    populate(db_session, storage)
    email = next(iter(EXTRA_USERS))
    login = client.post("/auth/login", data={"username": email, "password": "user12345"})
    assert login.status_code == 200

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    page = client.get("/tasks", headers=headers).json()
    assert page["total"] == len(EXTRA_USERS[email][1])
    assert {item["owner"]["name"] for item in page["items"]} == {EXTRA_USERS[email][0]}


def test_demo_definitions_reference_existing_assets():
    every_task = list(DEMO_USER_TASKS) + [t for _, tasks in EXTRA_USERS.values() for t in tasks]
    for task in every_task:
        for name in task.assets:
            assert name in ASSETS


def test_most_tasks_and_every_user_have_attachments(db_session, storage):
    populate(db_session, storage)
    tasks = db_session.scalars(select(Task)).all()

    with_files = [t for t in tasks if t.attachments]
    assert len(with_files) / len(tasks) >= 0.8, "a maioria das tarefas de exemplo tem anexo"
    for owner_id in {t.owner_id for t in tasks}:
        assert any(t.attachments for t in tasks if t.owner_id == owner_id), "todo usuário tem tarefa com anexo"
    assert any(len(t.attachments) > 3 for t in tasks), "há tarefa com mais anexos do que cabem no cartão"


def test_populate_completes_missing_attachments_on_existing_tasks(db_session, storage):
    populate(db_session, storage)
    task = next(t for t in db_session.scalars(select(Task)).all() if len(t.attachments) >= 2)
    removed = task.attachments[0]
    delete_attachment(db_session, storage, removed)
    db_session.expire_all()

    again = populate(db_session, storage)

    assert again == {"users": 0, "tasks": 0, "attachments": 1}
    db_session.refresh(task)
    assert removed.original_name in {a.original_name for a in task.attachments}


def test_office_documents_are_well_formed_packages():
    for name in ("especificacao-api.docx", "orcamento-trimestre.xlsx"):
        with zipfile.ZipFile(io.BytesIO(ASSETS[name].build())) as package:
            assert "[Content_Types].xml" in package.namelist()
            for part in package.namelist():
                ET.fromstring(package.read(part))  # todo XML precisa ser bem formado
